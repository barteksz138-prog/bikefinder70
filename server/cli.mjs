#!/usr/bin/env node
// Sterowanie skanerem na serwerze z konsoli. Rozmawia z działającą usługą (server/main.mjs) pod 127.0.0.1.
//
//   node server/cli.mjs status                 co robi skaner, kolejka, wydatki AI, ostatnie linie logu
//   node server/cli.mjs start | stop           to samo, co przyciski Start / Stop na stronie
//   node server/cli.mjs log [ile]              ostatnie linie logu (domyślnie 50)
//   node server/cli.mjs export <plik>          pamięć skanera do pliku (ZAWIERA KLUCZE API — plik tylko dla właściciela)
//   node server/cli.mjs import <plik> [--replace]   wgranie pamięci (tylko przy zatrzymanym skanerze)
//   node server/cli.mjs scrape-mode [direct|vercel [adres-pośrednika]]
//   node server/cli.mjs reload                 odświeżenie strony (jak F5)
//   node server/cli.mjs restart-browser        zamknięcie i ponowne otwarcie Chrome
import fs from "node:fs";

const port = Number(process.env.DDF_PORT) || 8787;
const base = `http://127.0.0.1:${port}/control/`;
const [cmd, ...rest] = process.argv.slice(2);

const call = async (name, body) => {
  let resp;
  try { resp = await fetch(base + name, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
  catch (e) { console.error(`Nie mogę połączyć się z usługą skanera pod 127.0.0.1:${port} — czy działa? (${e.cause?.code || e.message})`); process.exit(2); }
  const data = await resp.json().catch(() => ({ ok: false, error: `Niepoprawna odpowiedź usługi (HTTP ${resp.status})` }));
  if (!data.ok) { console.error(`Błąd: ${data.error}`); process.exit(1); }
  return data;
};

const usage = () => { console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").filter(l => l.startsWith("//   ")).map(l => l.slice(5)).join("\n")); };

switch (cmd) {
  case "status": {
    const s = await call("status");
    console.log(`Skaner: ${s.running ? (s.stopping ? "zatrzymuje się" : "DZIAŁA") : "zatrzymany"}${s.autorun ? " (autostart włączony)" : ""}`);
    console.log(`Wersja strony: ${s.appVersion || "?"} · serwer: ${s.engineVersion} · strona: ${s.pageMode} · pobieranie: ${s.scrapeMode}${s.scrapeMode === "vercel" ? ` (${s.scrapeProxyUrl})` : ""}`);
    if (s.scanStatus) console.log(`Teraz: ${s.scanStatus}`);
    if (s.aiStatus) console.log(`AI: ${s.aiStatus}`);
    console.log(`Pamięć: ${s.seen ?? "?"} ogłoszeń · kolejka analiz: ${s.pending ?? "?"} · do wysłania: ${s.outbox ?? "?"}`);
    if (s.aiSpend) console.log(`AI w ${s.aiSpend.month}: ${Number(s.aiSpend.usd || 0).toFixed(4)} USD, ${s.aiSpend.calls} zapytań`);
    if (s.otherTab) console.log("Uwaga: strona zgłasza skaner działający w innej karcie");
    for (const e of s.pageErrors || []) console.log(`Błąd strony: ${e.msg}`);
    if (s.lastLog?.length) { console.log("Ostatnie linie logu:"); for (const l of s.lastLog) console.log("  " + l); }
    break;
  }
  case "start": { const r = await call("start", {}); console.log(r.note || "Skaner wystartował"); break; }
  case "stop": { const r = await call("stop", {}); console.log(r.note || "Skaner zatrzymany (autostart wyłączony)"); break; }
  case "reload": await call("reload", {}); console.log("Strona odświeżona"); break;
  case "restart-browser": await call("restart-browser", {}); console.log("Chrome uruchomiony ponownie"); break;
  case "log": { const r = await call(`log?n=${Number(rest[0]) || 50}`); for (const l of r.lines) console.log(l); break; }
  case "export": {
    if (!rest[0]) { console.error("Podaj nazwę pliku: export <plik>"); process.exit(1); }
    const { ok, ...state } = await call("export");
    fs.writeFileSync(rest[0], JSON.stringify(state), { mode: 0o600 });
    console.log(`Zapisano ${state.keys} kluczy do ${rest[0]} — plik zawiera klucze API i webhooki, nie wysyłaj go nikomu`);
    break;
  }
  case "import": {
    const file = rest.find(a => !a.startsWith("--"));
    if (!file) { console.error("Podaj plik: import <plik> [--replace]"); process.exit(1); }
    let state; try { state = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { console.error(`Nie mogę odczytać ${file}: ${e.message}`); process.exit(1); }
    const r = await call("import", { state, replace: rest.includes("--replace") });
    console.log(`Wgrano ${r.imported} kluczy: ${r.seen ?? "?"} ogłoszeń w pamięci, ${r.pending ?? "?"} w kolejce analiz, ${r.outbox ?? "?"} do wysłania.${r.skipped?.length ? ` Pominięto: ${r.skipped.join(", ")} (start to osobny krok).` : ""}`);
    break;
  }
  case "scrape-mode": {
    const r = rest[0] ? await call("scrape-mode", { mode: rest[0], ...(rest[1] ? { proxyUrl: rest[1] } : {}) }) : await call("scrape-mode");
    console.log(`Pobieranie stron Kleinanzeigen: ${r.scrapeMode}${r.scrapeProxyUrl ? ` · pośrednik: ${r.scrapeProxyUrl}` : ""}`);
    break;
  }
  default: usage(); process.exit(cmd ? 1 : 0);
}
