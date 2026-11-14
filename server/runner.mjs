// Uruchamia stronę skanera w Chrome bez okna i steruje nią tak, jak robi to właściciel: klika Start / Stop,
// czyta log i pamięć strony (localStorage). Logika skanera to niezmieniony public/index.html.
//
// Profil przeglądarki (profileDir) leży na dysku serwera — to w nim jest cała pamięć skanera (ddf_*): ustawienia
// z kluczami, widziane ogłoszenia, kolejki. Pamięć jest przypisana do ADRESU strony (http://127.0.0.1:<port>),
// więc zmiana portu = pusta pamięć. Dlatego adres jest zapisywany w profilu i sprawdzany przy starcie.
import fs from "node:fs";
import path from "node:path";

const pw = await import("playwright").then(m => m.default || m).catch(() => import("/opt/npm-tools/node_modules/playwright/index.js").then(m => m.default || m));
const { chromium } = pw;

const BOOT_TIMEOUT_MS = 60000;
const LOG_LINE_RE = /^\d{1,2}:\d{2}:\d{2} /;
const STATE_PREFIX = "ddf_";
export const STATE_FORMAT = "ddf-state-1";
const fail = (status, msg) => Object.assign(new Error(msg), { status });

export const launchRunner = async ({ url, profileDir, headless = true, allowOriginChange = false, onEvent = () => {} }) => {
  fs.mkdirSync(profileDir, { recursive: true });
  const origin = new URL(url).origin;
  const marker = path.join(profileDir, "ddf-origin.txt");
  const prev = fs.existsSync(marker) ? fs.readFileSync(marker, "utf8").trim() : null;
  if (prev && prev !== origin && !allowOriginChange) {
    throw new Error(`Ten profil przeglądarki należy do adresu ${prev}, a skaner ma ruszyć pod ${origin}. Pamięć skanera jest przypisana do adresu — pod nowym byłaby pusta. Ustaw poprzedni port albo świadomie pozwól na zmianę (allowOriginChange).`);
  }
  fs.writeFileSync(marker, origin + "\n");

  const context = await chromium.launchPersistentContext(profileDir, {
    headless,
    viewport: { width: 1300, height: 900 },
    // Karta bez okna nie może być usypiana ani spowalniana — skaner ma chodzić cały czas
    args: ["--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"],
  });
  let page = context.pages()[0] || await context.newPage();
  for (const p of context.pages()) if (p !== page) await p.close().catch(() => {});
  let closed = false;
  const errors = [];
  const wire = (p) => {
    p.on("pageerror", (e) => { errors.push({ t: Date.now(), msg: e.message }); if (errors.length > 50) errors.shift(); onEvent({ type: "pageerror", msg: e.message }); });
    p.on("crash", () => onEvent({ type: "crash" }));
  };
  wire(page);

  // Strona gotowa = widać przycisk Start albo Stop (albo zakładkę, z której da się do nich wrócić)
  const boot = async () => {
    await page.goto(url, { waitUntil: "load", timeout: BOOT_TIMEOUT_MS });
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => /Start — skanuj|⏹ Stop|Zatrzymuję|🔍 Skaner/.test(b.textContent)), null, { timeout: BOOT_TIMEOUT_MS })
      .catch(() => { throw new Error(`Strona skanera nie uruchomiła się w ${BOOT_TIMEOUT_MS / 1000} s (${url}). W trybie „original” potrzebny jest dostęp do cdnjs.cloudflare.com — zapas: tryb strony „compiled”.`); });
  };
  await boot();

  // Log i przyciski Start/Stop są w zakładce „Skaner” — po błędzie startu strona sama przechodzi do Ustawień
  const showScanner = () => page.evaluate(() => {
    const has = () => [...document.querySelectorAll("button")].some(b => /Start — skanuj|⏹ Stop|Zatrzymuję/.test(b.textContent));
    if (!has()) [...document.querySelectorAll("button")].find(b => b.textContent.includes("🔍 Skaner"))?.click();
  }).then(() => page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => /Start — skanuj|⏹ Stop|Zatrzymuję/.test(b.textContent)), null, { timeout: 5000 }));
  const buttons = () => page.evaluate(() => {
    const t = [...document.querySelectorAll("button")].map(b => b.textContent);
    return { running: t.some(x => /⏹ Stop|Zatrzymuję/.test(x)), stopping: t.some(x => /Zatrzymuję/.test(x)), canStart: t.some(x => /Start — skanuj/.test(x)) };
  });
  const logs = async () => { await showScanner(); return (await page.evaluate(() => document.body.innerText)).split("\n").filter(l => LOG_LINE_RE.test(l)); };
  const ls = (k) => page.evaluate((k) => localStorage.getItem(k), k);
  const readState = () => page.evaluate((prefix) => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(prefix)) out[k] = localStorage.getItem(k); }
    return out;
  }, STATE_PREFIX);
  const waitFor = async (fn, timeoutMs, label) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) { const v = await fn(); if (v) return v; await new Promise(r => setTimeout(r, 150)); }
    throw fail(504, `Przekroczony czas oczekiwania: ${label}`);
  };
  // Czy w pamięci jest coś, czego szkoda nadpisać: widziane ogłoszenia, kolejki albo ustawienia z kluczem / webhookiem.
  // (Świeża strona sama zapisuje drobiazgi, np. dziennik zdarzeń — to nie jest „pamięć skanera”.)
  const hasRealState = (data) => {
    if ([data.ddf_seen, data.ddf_pending, data.ddf_outbox].some(v => (count(v) || 0) > 0)) return true;
    try { const c = JSON.parse(data.ddf_cfg || "{}"); return ["geminiKey", "claudeKey", "groqClassifierKey", "discordWebhook"].some(k => String(c?.[k] || "").trim()); } catch { return false; }
  };
  const count = (raw) => { try { const v = JSON.parse(raw || "null"); return Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0; } catch { return null; } };

  const runner = {
    origin, profileDir, page: () => page,
    logs,
    ls,
    async status() {
      await showScanner();
      const b = await buttons();
      const [pending, outbox, seen, autorun, spendRaw] = await Promise.all(["ddf_pending", "ddf_outbox", "ddf_seen", "ddf_autorun", "ddf_ai_spend"].map(ls));
      const texts = await page.evaluate(() => ({
        scan: document.querySelector("[data-testid=scan-status]")?.textContent || null,
        ai: document.querySelector("[data-testid=ai-status]")?.textContent || null,
        otherTab: !!document.querySelector("[data-testid=other-tab]"),
        // textContent, nie innerText: nagłówek jest wyświetlany wielkimi literami (CSS), a tu chodzi o tekst ze strony
        version: (document.body.textContent.match(/Kleinanzeigen × AI × Discord · (v\d+(?:\.\d+)*(?: \([\d-]+\))?)/) || [])[1] || null,
      }));
      let spend = null; try { spend = JSON.parse(spendRaw || "null"); } catch {}
      const l = await logs();
      return { running: b.running, stopping: b.stopping, appVersion: texts.version, scanStatus: texts.scan, aiStatus: texts.ai, otherTab: texts.otherTab,
        autorun: autorun === "1", pending: count(pending), outbox: count(outbox), seen: count(seen),
        aiSpend: spend ? { month: spend.month, usd: spend.usd, calls: spend.calls } : null,
        pageErrors: errors.slice(-5), lastLog: l.slice(-5) };
    },
    // Start: to samo, co kliknięcie „▶ Start — skanuj ciągle”. Gdy strona odmówi (brak klucza, webhooka), zwraca jej komunikat.
    async start() {
      await showScanner();
      if ((await buttons()).running) return { started: false, running: true, note: "skaner już działa" };
      const before = (await logs()).length;
      await page.getByRole("button", { name: /Start — skanuj/ }).click();
      const res = await waitFor(async () => {
        if ((await buttons().catch(() => ({}))).running) return { started: true, running: true };
        const fresh = (await logs().catch(() => [])).slice(before).filter(x => /❌|⛔/.test(x));
        return fresh.length ? { started: false, running: false, error: fresh.join(" | ") } : null;
      }, 15000, "start skanera");
      if (!res.started) throw fail(409, `Skaner nie wystartował: ${res.error}`);
      return res;
    },
    // Stop: to samo, co kliknięcie „⏹ Stop” — strona kończy bieżący krok, niczego nie wysyła, kasuje autostart.
    async stop({ timeoutMs = 120000 } = {}) {
      await showScanner();
      if (!(await buttons()).running) return { stopped: false, running: false, note: "skaner nie działał" };
      const b = await buttons();
      if (!b.stopping) await page.getByRole("button", { name: "⏹ Stop", exact: true }).click();
      await waitFor(async () => !(await buttons()).running, timeoutMs, "zatrzymanie skanera");
      return { stopped: true, running: false };
    },
    // Odświeżenie strony (jak F5 u właściciela): autostart wznawia skanowanie, jeśli działało.
    async reload() { await boot(); return { reloaded: true }; },
    async exportState() {
      const data = await readState();
      return { format: STATE_FORMAT, exportedAt: new Date().toISOString(), origin, appVersion: (await runner.status()).appVersion, keys: Object.keys(data).length, data };
    },
    // Import pamięci (np. z przeglądarki właściciela). Tylko przy zatrzymanym skanerze; istniejącej pamięci nie nadpisuje bez replace.
    async importState({ state, replace = false } = {}) {
      if (!state || state.format !== STATE_FORMAT || !state.data || typeof state.data !== "object") throw fail(400, `Niepoprawny plik stanu (oczekiwany format ${STATE_FORMAT})`);
      const entries = Object.entries(state.data);
      if (!entries.length || entries.some(([k, v]) => !k.startsWith(STATE_PREFIX) || typeof v !== "string")) throw fail(400, "Plik stanu może zawierać tylko klucze ddf_* z wartościami tekstowymi");
      if ((await buttons()).running) throw fail(409, "Najpierw zatrzymaj skaner (stop) — import przy działającym skanerze pomieszałby pamięć");
      const current = await readState();
      if (hasRealState(current) && !replace) throw fail(409, `Pamięć skanera nie jest pusta (${count(current.ddf_seen) || 0} ogłoszeń, kolejka ${count(current.ddf_pending) || 0}, ustawienia z kluczami). Żeby ją zastąpić, użyj replace — wcześniej zrób eksport.`);
      // Zapis na pustej stronie tego samego adresu: wczytany skaner mógłby nadpisać wgrywane dane swoim stanem z pamięci
      await page.goto(origin + "/__blank", { waitUntil: "load", timeout: BOOT_TIMEOUT_MS });
      await page.evaluate(({ prefix, entries }) => {
        for (const k of Object.keys(localStorage)) if (k.startsWith(prefix)) localStorage.removeItem(k);
        for (const [k, v] of entries) if (k !== "ddf_autorun") localStorage.setItem(k, v); // start po imporcie to osobna, świadoma decyzja
      }, { prefix: STATE_PREFIX, entries });
      await boot();
      const after = await readState();
      return { imported: Object.keys(after).length, skipped: entries.some(([k]) => k === "ddf_autorun") ? ["ddf_autorun"] : [], seen: count(after.ddf_seen), pending: count(after.ddf_pending), outbox: count(after.ddf_outbox) };
    },
    // Zamknięcie przeglądarki BEZ klikania Stop — autostart zostaje, więc po ponownym uruchomieniu skaner wznawia pracę.
    async close() { if (closed) return; closed = true; await context.close(); },
    isClosed: () => closed,
  };
  context.on("close", () => { if (!closed) { closed = true; onEvent({ type: "browser-closed" }); } });
  return runner;
};
