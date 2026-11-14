// Wersja serwerowa („Chrome bez okna”): lokalna strona + pośrednicy w tym samym procesie + sterowanie z konsoli.
// Prawdziwy Chrome bez okna otwiera stronę skanera podaną przez server/site.mjs; świat zewnętrzny (Kleinanzeigen,
// AI, Discord) jest atrapą na poziomie fetch w procesie serwera — czyli zapytania strony przechodzą całą drogę:
// strona → /api/… → core/providers → „internet”.
import fs from "node:fs";
import os from "node:os";
import net from "node:net";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { card, detailHtml, analysisJson, geminiResp, closeBrowser } from "../harness.mjs";
import { startServer } from "../../server/main.mjs";
import { createSite } from "../../server/site.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const results = [];
async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push("OK"); console.log(`✅ ${name} (${Date.now() - t0} ms)`); }
  catch (e) { results.push("FAIL"); console.log(`❌ ${name}: ${e.stack?.split("\n").slice(0, 4).join(" | ")}`); }
}

// ── Atrapa świata zewnętrznego ────────────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
const A = { id: "1000000001", title: "Canyon Torque AL alt", price: 1000 };
const B = { id: "2000000002", title: "Canyon Torque AL 6 2021 L", price: 900 };
const C = { id: "3000000003", title: "Canyon Torque CF 8 2022", price: 950 };
const PROXY = "https://zapas.example/api/scrape";
const st = { phase: 1, searches: 0, proxied: 0, details: [], ai: [], discord: [], prices: {} };
const hdr = { get: () => null };
const searchHtml = () => { const cards = [A, ...(st.phase >= 2 ? [B] : []), ...(st.phase >= 3 ? [C] : [])]; for (const c of cards) st.prices[c.id] = c.price; return `<html><body>${cards.map(card).join("")}</body></html>`; };
const kaPage = (target) => {
  if (target.includes("/s-anzeige/")) {
    const id = (target.match(/\/(\d{7,})(?:-|$)/) || [])[1];
    st.details.push(id);
    return detailHtml({ desc: "Sehr gepflegtes Bike, Fox 38, SRAM GX, Größe L, regelmäßig gewartet, Rechnung vorhanden, kleine Kratzer am Rahmen, sonst top. Abholung.", price: st.prices[id] });
  }
  return searchHtml();
};
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith("http://127.0.0.1")) return realFetch(url, opts);
  if (url.startsWith(PROXY)) { st.proxied++; const target = new URL(url).searchParams.get("url"); return { ok: true, status: 200, headers: { get: (k) => k.toLowerCase() === "content-type" ? "text/html; charset=utf-8" : null }, text: async () => kaPage(target) }; }
  if (url.startsWith("https://www.kleinanzeigen.de/")) { if (!url.includes("/s-anzeige/")) st.searches++; return { ok: true, status: 200, url, text: async () => kaPage(url) }; }
  if (url.startsWith("https://img.kleinanzeigen.de/")) return { ok: true, headers: new Map([["content-type", "image/jpeg"], ["content-length", "4"]]), arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer };
  if (url.includes("generativelanguage.googleapis.com")) {
    if (url.includes("cachedContents")) return { ok: true, status: 200, json: async () => ({}) };
    st.ai.push(JSON.parse(opts.body));
    return { ok: true, status: 200, json: async () => geminiResp(analysisJson()) };
  }
  if (url.startsWith("https://discord.com/api/webhooks/")) { st.discord.push({ url, body: JSON.parse(opts.body) }); return { ok: true, status: 204, headers: hdr, json: async () => null }; }
  throw new Error("nieoczekiwany adres w teście: " + url);
};

const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const port = await freePort();
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ddf-server-"));
const fastSleep = (code) => {
  const out = code.replace("const sleep = (ms) => new Promise((r) => setTimeout(r, ms));", "const sleep = (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5)));");
  if (!out.includes("Math.min(ms, 5)")) throw new Error("sleep patch failed");
  return out;
};
const quiet = [];
const boot = (extra = {}) => startServer({ port, dataDir, pageMode: "compiled", transformApp: fastSleep, restartHours: 0, log: (m) => quiet.push(m), ...extra });
const ctl = async (name, body) => {
  const r = await realFetch(`http://127.0.0.1:${port}/control/${name}`, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { http: r.status, ...(await r.json()) };
};
const until = async (fn, timeout, label) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (await fn()) return; await new Promise(r => setTimeout(r, 150)); } throw new Error("timeout: " + label); };
const logHas = async (re) => (await ctl("log?n=500")).lines.some(l => re.test(l));
const alertsFor = (l) => st.discord.filter(d => JSON.stringify(d.body).includes(l.title)).length;
const CFG = { provider: "gemini", geminiModel: "gemini-2.5-flash", geminiKey: "AIza-test", discordWebhook: "https://discord.com/api/webhooks/1/x",
  uncertainWebhook: "https://discord.com/api/webhooks/2/y", selectedBikes: ["canyon_torque"] };

let app = await boot();

await test("strona skanera wczytana w Chrome bez okna; skaner zatrzymany, pamięć pusta", async () => {
  const s = await ctl("status");
  assert.equal(s.ok, true); assert.equal(s.running, false); assert.equal(s.autorun, false);
  assert.match(s.appVersion, /^v6\.5/); assert.equal(s.pageMode, "compiled"); assert.equal(s.scrapeMode, "direct");
  assert.equal(s.seen, 0); assert.deepEqual(s.pageErrors, []);
});

await test("start bez ustawień: strona odmawia, konsola dostaje jej komunikat", async () => {
  const r = await ctl("start", {});
  assert.equal(r.ok, false); assert.equal(r.http, 409); assert.match(r.error, /Brak klucza API/);
  assert.equal((await ctl("status")).running, false);
});

await test("import pamięci (ustawienia z kluczami) — bez autostartu", async () => {
  assert.equal((await ctl("import", { state: { format: "zly", data: {} } })).http, 400);
  assert.equal((await ctl("import", { state: { format: "ddf-state-1", data: { inny_klucz: "x" } } })).http, 400);
  const r = await ctl("import", { state: { format: "ddf-state-1", data: { ddf_cfg: JSON.stringify(CFG), ddf_autorun: "1" } } });
  assert.equal(r.ok, true); assert.deepEqual(r.skipped, ["ddf_autorun"]);
  const s = await ctl("status");
  assert.equal(s.running, false); assert.equal(s.autorun, false, "import nie uruchamia skanera");
  await new Promise(r => setTimeout(r, 6000)); // autostart czeka 5 s — po imporcie nie może zadziałać
  assert.equal((await ctl("status")).running, false);
});

await test("start → pierwszy cykl zapamiętuje, nowa oferta → analiza AI → alert na Discordzie (cała droga przez /api)", async () => {
  const r = await ctl("start", {});
  assert.equal(r.started, true);
  await until(() => logHas(/pierwsze skanowanie tego wyszukiwania — zapamiętano 1/), 20000, "pierwsze skanowanie");
  await until(() => logHas(/Cykl #1 zakończony/), 20000, "cykl 1");
  assert.equal(st.ai.length, 0, "pierwszy cykl bez analiz");
  st.phase = 2;
  await until(() => alertsFor(B) >= 1, 30000, "alert o ofercie B");
  assert.ok(st.searches >= 2 && st.proxied === 0, "strony pobierane wprost (tryb direct)");
  assert.ok(st.details.includes(B.id), "strona ogłoszenia B pobrana");
  assert.ok(st.ai.length >= 1, "analiza AI poszła przez pośrednika w procesie serwera");
  assert.ok(st.discord[0].url.startsWith("https://discord.com/api/webhooks/1/x"));
  const s = await ctl("status");
  assert.equal(s.running, true); assert.equal(s.autorun, true); assert.ok(s.seen >= 2);
});

await test("import przy działającym skanerze jest odrzucany; eksport zawiera pamięć", async () => {
  assert.equal((await ctl("import", { state: { format: "ddf-state-1", data: { ddf_cfg: "{}" } }, replace: true })).http, 409);
  const e = await ctl("export");
  assert.equal(e.format, "ddf-state-1");
  assert.ok(e.data.ddf_seen.includes(A.id) && e.data.ddf_seen.includes(B.id));
  assert.equal(JSON.parse(e.data.ddf_cfg).geminiKey, "AIza-test");
  assert.equal(e.data.ddf_autorun, "1");
});

await test("restart usługi (bez Stop): pamięć zostaje w profilu, autostart wznawia, stary alert nie wychodzi drugi raz", async () => {
  await until(async () => (await ctl("status")).outbox === 0, 15000, "pusta lista do wysłania");
  await app.stop();
  await assert.rejects(() => realFetch(`http://127.0.0.1:${port}/control/status`), "usługa zamknięta");
  app = await boot();
  const s0 = await ctl("status");
  assert.ok(s0.seen >= 2, "pamięć ogłoszeń przetrwała restart");
  assert.equal(s0.autorun, true);
  await until(async () => (await ctl("status")).running, 15000, "autostart po restarcie");
  assert.ok(await logHas(/Autostart/));
  st.phase = 3;
  await until(() => alertsFor(C) >= 1, 30000, "alert o ofercie C po restarcie");
  assert.equal(alertsFor(B), 1, "oferta B zgłoszona dokładnie raz");
  assert.equal(alertsFor(A), 0, "oferta zapamiętana przy pierwszym skanowaniu nigdy nie była analizowana");
});

await test("przełącznik pobierania: vercel → strony idą przez pośrednika; ustawienie zapisane", async () => {
  assert.equal((await ctl("scrape-mode", { mode: "tor" })).http, 400);
  assert.equal((await ctl("scrape-mode", { mode: "vercel" })).http, 400, "vercel bez adresu pośrednika");
  const r = await ctl("scrape-mode", { mode: "vercel", proxyUrl: PROXY });
  assert.equal(r.scrapeMode, "vercel");
  await new Promise(r => setTimeout(r, 300)); // zapytania wysłane przed przełączeniem dobiegają końca
  const direct = st.searches;
  await until(() => st.proxied >= 2, 20000, "wyszukiwania przez pośrednika");
  assert.equal(st.searches, direct, "po przełączeniu serwer sam nie pobiera stron Kleinanzeigen");
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, "server.json"), "utf8")).scrapeMode, "vercel");
  assert.equal((await ctl("scrape-mode", { mode: "direct" })).scrapeMode, "direct");
});

await test("konsola (server/cli.mjs): status i log z działającej usługi", async () => {
  // konsola to osobny proces rozmawiający z usługą w TYM procesie — musi być uruchamiana bez blokowania (spawn, nie spawnSync)
  const runOn = (p, ...args) => new Promise((resolve) => {
    const c = spawn(process.execPath, [path.join(ROOT, "server/cli.mjs"), ...args], { env: { ...process.env, DDF_PORT: String(p) } });
    let stdout = "", stderr = ""; c.stdout.on("data", d => stdout += d); c.stderr.on("data", d => stderr += d);
    const t = setTimeout(() => c.kill(), 30000);
    c.on("close", (status) => { clearTimeout(t); resolve({ status, stdout, stderr }); });
  });
  const run = (...args) => runOn(port, ...args);
  let r = await run("status");
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /Skaner: DZIAŁA \(autostart włączony\)/); assert.match(r.stdout, /Wersja strony: v6\.5/);
  r = await run("log", "5"); assert.equal(r.status, 0); assert.ok(r.stdout.trim().split("\n").length >= 1);
  const file = path.join(dataDir, "eksport.json");
  r = await run("export", file); assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.statSync(file).mode & 0o077, 0, "plik eksportu czytelny tylko dla właściciela");
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).format, "ddf-state-1");
  r = await run("import", file); assert.equal(r.status, 1); assert.match(r.stderr, /zatrzymaj skaner/);
  r = await runOn(await freePort(), "status");
  assert.equal(r.status, 2); assert.match(r.stderr, /Nie mogę połączyć się z usługą/);
});

await test("stop: skaner zatrzymany, autostart wyłączony — po restarcie usługi stoi", async () => {
  const r = await ctl("stop", {});
  assert.equal(r.stopped, true);
  assert.ok(await logHas(/⏹ Zatrzymano/));
  let s = await ctl("status");
  assert.equal(s.running, false); assert.equal(s.autorun, false);
  assert.equal((await ctl("restart-browser", {})).restarted, true);
  await new Promise(r => setTimeout(r, 6500));
  s = await ctl("status");
  assert.equal(s.running, false, "bez autostartu skaner sam nie rusza");
  assert.ok(s.seen >= 3, "pamięć nietknięta");
});

await test("import z zastąpieniem pamięci przy zatrzymanym skanerze (jak przeniesienie z laptopa)", async () => {
  const state = { format: "ddf-state-1", data: { ddf_cfg: JSON.stringify(CFG), ddf_seen: JSON.stringify([{ id: "9000000009", price: 500, lowest: 500, lastSeenAt: Date.now() }]) } };
  assert.equal((await ctl("import", { state })).http, 409, "niepusta pamięć bez replace");
  const r = await ctl("import", { state, replace: true });
  assert.equal(r.ok, true); assert.equal(r.seen, 1);
  const e = await ctl("export");
  assert.ok(e.data.ddf_seen.includes("9000000009") && !e.data.ddf_seen.includes(B.id));
});

await test("zabezpieczenia: polecenia nie dla stron, obcy host odrzucony, zmiana adresu nie gubi po cichu pamięci", async () => {
  const withOrigin = await realFetch(`http://127.0.0.1:${port}/control/status`, { headers: { origin: "https://zla-strona.example" } });
  assert.equal(withOrigin.status, 403);
  const badHost = await new Promise((resolve) => { http.get({ host: "127.0.0.1", port, path: "/control/status", headers: { host: "zla-strona.example" } }, (res) => { res.resume(); resolve(res.statusCode); }); });
  assert.equal(badHost, 403);
  assert.equal((await realFetch(`http://127.0.0.1:${port}/control/nie-ma`)).status, 404);
  await assert.rejects(() => createSite({ port: 0, host: "0.0.0.0" }), /tylko na adresie lokalnym/, "strona nie może być wystawiona do sieci");
  await assert.rejects(() => createSite({ port: 0, pageMode: "inny" }), /Nieznany tryb strony/);
  // tryb „original”: strona podana bez żadnej zmiany (bajt w bajt public/index.html)
  const orig = await createSite({ port: 0, pageMode: "original" });
  assert.equal(await (await realFetch(orig.origin + "/")).text(), fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8"));
  assert.equal((await realFetch(orig.origin + "/app.js")).status, 404);
  await orig.close();
  await app.stop();
  await assert.rejects(() => startServer({ port: 0, dataDir, pageMode: "compiled", restartHours: 0, log: () => {} }), /Pamięć skanera jest przypisana do adresu/);
});

await app.stop().catch(() => {});
await closeBrowser();
globalThis.fetch = realFetch;
fs.rmSync(dataDir, { recursive: true, force: true });
const failed = results.filter(r => r === "FAIL").length;
console.log(failed ? `SERVER TESTS: ${failed} z ${results.length} nie przeszło` : "SERVER TESTS OK");
process.exit(failed ? 1 : 0);
