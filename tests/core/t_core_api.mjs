// Wersja serwerowa, krok 2: pośrednicy (AI + zdjęcia, Discord, pobieranie stron) wywoływani w tym samym procesie.
// 1) Dotychczasowe testy pośredników (t_api, t_img, t_disc, t_scrape) uruchomione na kopiach w core/providers/.
// 2) apiFetch — zamiennik fetch("/api/…"): te same statusy i treści co prawdziwe zapytanie HTTP do tych funkcji,
//    przerwanie przez signal, przełącznik pobierania „direct” / „vercel”.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const coreUrl = (f) => pathToFileURL(path.join(ROOT, "core/providers", f)).href;

// ── 1. Te same testy co dla api/*.js, ale na kopiach z core/providers/ ─────────────────────────────
const SUITES = { "t_api.mjs": { "./.build/gem.mjs": "ai.js" }, "t_img.mjs": { "./.build/gem.mjs": "ai.js" }, "t_disc.mjs": { "./.build/disc.mjs": "discord.js" }, "t_scrape.mjs": { "./.build/scr.mjs": "scrape.js" } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ddf-core-api-"));
for (const [file, map] of Object.entries(SUITES)) {
  let src = fs.readFileSync(path.join(ROOT, "tests", file), "utf8");
  for (const [from, to] of Object.entries(map)) {
    assert.ok(src.includes(`"${from}"`), `${file}: nie znaleziono importu ${from}`);
    src = src.replaceAll(`"${from}"`, JSON.stringify(coreUrl(to)));
  }
  assert.ok(!src.includes("./.build/"), `${file}: został import z .build`);
  const p = path.join(tmp, file);
  fs.writeFileSync(p, src);
  const r = spawnSync(process.execPath, [p], { encoding: "utf8", timeout: 120000 });
  assert.equal(r.status, 0, `${file} na core/providers nie przeszedł:\n${(r.stdout + r.stderr).slice(-1500)}`);
  console.log(`✅ ${file} przechodzi na kopii w core/providers/`);
}
fs.rmSync(tmp, { recursive: true, force: true });

// ── 2. apiFetch ─────────────────────────────────────────────────────────────────────────────────
const { createApi, invokeHandler } = await import(coreUrl("api.js"));
const handlers = {
  "/api/gemini": (await import(coreUrl("ai.js"))).default,
  "/api/discord": (await import(coreUrl("discord.js"))).default,
  "/api/scrape": (await import(coreUrl("scrape.js"))).default,
};
const { __clearImageCache } = await import(coreUrl("ai.js"));

// Atrapa świata zewnętrznego (Anthropic, Groq, Google, Discord, Kleinanzeigen). Zapytania do 127.0.0.1 idą naprawdę.
const realFetch = globalThis.fetch;
const outside = [];
const WEBHOOK = "https://discord.com/api/webhooks/123/abc";
const IMG = "https://img.kleinanzeigen.de/api/v1/prod-ads/images/ab/12345678-1234-1234-1234-123456789abc?rule=$_59.JPG";
const SEARCH = "https://www.kleinanzeigen.de/s-fahrraeder/anzeige:angebote/preis:200:1400/dirt/k0c217";
const hdr = (o = {}) => ({ get: (k) => o[String(k).toLowerCase()] ?? null });
let world = {};
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith("http://127.0.0.1")) return realFetch(url, opts);
  outside.push({ url, opts });
  if (world.delayMs) await new Promise(r => setTimeout(r, world.delayMs));
  if (url.startsWith("https://img.")) return { ok: true, headers: new Map([["content-type", "image/jpeg"], ["content-length", "4"]]), arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer };
  if (url.includes("anthropic.com")) return world.anthropic ? world.anthropic() : { ok: true, status: 200, headers: hdr(), json: async () => ({ content: [{ type: "text", text: "{\"a\":1}" }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 3 }, model: "claude-haiku-5-5" }) };
  if (url.includes("groq.com")) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "full" } }], usage: { total_tokens: 7 } }) };
  if (url.includes("googleapis.com")) return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "{}" }] }, finishReason: "STOP" }] }) };
  if (url.startsWith("https://discord.com")) return world.discord ? world.discord() : { ok: true, status: 204, headers: hdr(), json: async () => null };
  if (url.includes("kleinanzeigen.de")) return world.ka ? world.ka(url) : { ok: true, status: 200, url, text: async () => `<html><head><title>x</title></head><body><nav>menu</nav><article data-adid="1">A</article><article data-adid="2">B</article><footer>stopka</footer></body></html>` };
  throw new Error("nieoczekiwany adres w teście: " + url);
};

// Wzorzec: prawdziwy serwer HTTP wołający te same funkcje tak, jak robi to Vercel (treść JSON → obiekt, parametry adresu → query)
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://127.0.0.1");
  let raw = ""; for await (const c of req) raw += c;
  let body; if (raw) { try { body = JSON.parse(raw); } catch { res.writeHead(400, { "content-type": "application/json; charset=utf-8" }); return res.end(JSON.stringify({ error: "Niepoprawny JSON" })); } }
  const out = await invokeHandler(handlers[u.pathname], { method: req.method, body, query: Object.fromEntries(u.searchParams) });
  res.writeHead(out.status, out.headers); res.end(out.text);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const api = createApi({ scrapeMode: "direct" });
const snap = async (resp) => { const text = await resp.text(); return { ok: resp.ok, status: resp.status, json: (resp.headers.get("content-type") || "").includes("application/json"), text }; };
const J = (o) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
const msg = [{ role: "user", parts: [{ text: "stała część", cacheControl: true }, { text: "ogłoszenie" }] }];
const REQUESTS = [
  ["analiza Claude", "/api/gemini", J({ provider: "anthropic", model: "claude-haiku-5-5", apiKey: "k", messages: msg, generationConfig: { claudeEffort: "low" } })],
  ["analiza Claude ze zdjęciem", "/api/gemini", J({ provider: "anthropic", model: "claude-haiku-5-5", apiKey: "k", messages: msg, imageUrls: [IMG] })],
  ["etap 1 Groq", "/api/gemini", J({ provider: "groq", model: "openai/gpt-oss-120b", apiKey: "k", messages: [{ role: "user", content: "x" }], generationConfig: { reasoningEffort: "low" } })],
  ["Gemini", "/api/gemini", J({ provider: "gemini", model: "gemini-2.5-flash", apiKey: "k", messages: msg })],
  ["AI bez klucza", "/api/gemini", J({ provider: "anthropic", model: "claude-haiku-5-5", messages: msg })],
  ["AI zły model", "/api/gemini", J({ provider: "anthropic", model: "gpt 4", apiKey: "k", messages: msg })],
  ["AI metodą GET", "/api/gemini", { method: "GET" }],
  ["AI niepoprawny JSON", "/api/gemini", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{nie json" }],
  ["Discord wysyłka", "/api/discord", J({ webhookUrl: WEBHOOK, threadId: "123456", payload: { content: "okazja" } })],
  ["Discord obcy adres", "/api/discord", J({ webhookUrl: "https://evil.com/api/webhooks/1/x", payload: { content: "x" } })],
  ["Discord bez treści", "/api/discord", J({ webhookUrl: WEBHOOK })],
  ["strona wyników", `/api/scrape?url=${encodeURIComponent(SEARCH)}`, {}],
  ["strona ogłoszenia", `/api/scrape?url=${encodeURIComponent("https://www.kleinanzeigen.de/s-anzeige/rad/3569543906-217-7615")}`, {}],
  ["pobieranie obcej domeny", `/api/scrape?url=${encodeURIComponent("https://example.com/x")}`, {}],
  ["pobieranie bez adresu", "/api/scrape", {}],
];
for (const [name, url, init] of REQUESTS) {
  __clearImageCache();
  const viaHttp = await snap(await realFetch(base + url, init));
  __clearImageCache();
  const local = await snap(await api(url, init));
  assert.deepEqual(local, viaHttp, `apiFetch daje inną odpowiedź niż zapytanie HTTP: ${name}`);
}
console.log(`✅ apiFetch = zapytanie HTTP do tych samych funkcji (${REQUESTS.length} rodzajów zapytań: status, typ i treść)`);

// Wyniki kontrolne wprost
let r = await api("/api/gemini", REQUESTS[0][2]);
assert.equal(r.status, 200); assert.ok(r.headers.get("content-type").includes("application/json"));
let d = await r.json();
assert.equal(d.candidates[0].content.parts[0].text, "{\"a\":1}");
assert.equal(d.usageMetadata.promptTokenCount, 13);
r = await api("/api/gemini", REQUESTS[1][2]); d = await r.json();
assert.equal(d.imagesAttached, 1, "zdjęcie pobrane i dołączone po stronie serwera");
r = await api("/api/gemini", { method: "GET" });
assert.equal(r.status, 405); await assert.rejects(() => r.json());
r = await api("/api/discord", REQUESTS[8][2]); d = await r.json();
assert.deepEqual(d, { ok: true, status: 204, retryAfter: null, error: null });
assert.ok(outside.at(-1).url.startsWith(WEBHOOK) && outside.at(-1).url.includes("thread_id=123456"));
world.discord = () => ({ ok: false, status: 429, headers: hdr({ "retry-after": "2" }), json: async () => ({ message: "You are being rate limited.", retry_after: 1.5 }) });
d = await (await api("/api/discord", REQUESTS[8][2])).json();
assert.deepEqual(d, { ok: false, status: 429, retryAfter: 1.5, error: "You are being rate limited." });
world.discord = null;
world.anthropic = () => ({ ok: false, status: 429, headers: hdr({ "retry-after": "7" }), json: async () => ({ type: "error", error: { type: "rate_limit_error", message: "limit" } }) });
r = await api("/api/gemini", REQUESTS[0][2]); d = await r.json();
assert.equal(r.status, 429); assert.match(d.error.message, /Claude HTTP 429 rate_limit_error: limit \(retry in 7s\)/);
world.anthropic = null;
console.log("✅ AI i Discord: odpowiedzi, kody błędów i czasy ponowienia docierają do silnika bez zmian");

// Pobieranie stron: tryb „direct” — prawdziwy status z Kleinanzeigen, strona wyników przycięta do kart
r = await api(`/api/scrape?url=${encodeURIComponent(SEARCH)}`, {});
let html = await r.text();
assert.ok(r.ok && html.includes('<article data-adid="1">') && !html.includes("<nav>") && !html.includes("stopka"));
world.ka = (url) => ({ ok: false, status: 403, url, text: async () => "<html>captcha</html>" });
r = await api(`/api/scrape?url=${encodeURIComponent(SEARCH)}`, {});
assert.equal(r.status, 403); assert.equal(r.ok, false); assert.equal(await r.text(), "<html>captcha</html>");
world.ka = null;
let before = outside.length;
r = await api(`/api/scrape?url=${encodeURIComponent("https://example.com/x")}`, {});
assert.equal(r.status, 400); assert.equal(outside.length, before, "obca domena nie jest pobierana");
console.log("✅ pobieranie „direct”: status blokady (403) widoczny dla silnika, tylko kleinanzeigen.de");

// Tryb „vercel”: dokładnie jedno zapytanie do pośrednika, ten sam parametr url, sygnał przekazany; funkcja lokalna nieużywana
const proxyCalls = [];
const viaVercel = createApi({ scrapeMode: "vercel", scrapeProxyUrl: "https://bikefinder-69.vercel.app/api/scrape", fetchImpl: async (u, o) => { proxyCalls.push({ u, o }); return { ok: true, status: 200, headers: hdr({ "content-type": "text/html" }), text: async () => "<html>z Vercela</html>" }; } });
before = outside.length;
const ctrl = new AbortController();
r = await viaVercel(`/api/scrape?url=${encodeURIComponent(SEARCH)}`, { signal: ctrl.signal });
assert.equal(await r.text(), "<html>z Vercela</html>");
assert.equal(proxyCalls.length, 1);
assert.equal(proxyCalls[0].u, `https://bikefinder-69.vercel.app/api/scrape?url=${encodeURIComponent(SEARCH)}`);
assert.equal(proxyCalls[0].o.signal, ctrl.signal);
assert.equal(outside.length, before, "w trybie vercel serwer sam nie pobiera stron Kleinanzeigen");
// AI i Discord w trybie „vercel” dalej lokalnie (klucze nie idą przez Vercel)
r = await viaVercel("/api/discord", REQUESTS[8][2]); assert.equal((await r.json()).ok, true); assert.equal(proxyCalls.length, 1);
// przełącznik jako funkcja — zmiana działa od następnego zapytania, bez tworzenia api od nowa
let mode = "direct";
const switchable = createApi({ scrapeMode: () => mode, scrapeProxyUrl: () => "https://bikefinder-69.vercel.app/api/scrape", fetchImpl: async (u) => { proxyCalls.push({ u }); return { ok: true, status: 200, headers: hdr(), text: async () => "V" }; } });
assert.notEqual(await (await switchable(`/api/scrape?url=${encodeURIComponent(SEARCH)}`, {})).text(), "V");
mode = "vercel";
assert.equal(await (await switchable(`/api/scrape?url=${encodeURIComponent(SEARCH)}`, {})).text(), "V");
await assert.rejects(() => createApi({ scrapeMode: "vercel" })(`/api/scrape?url=${encodeURIComponent(SEARCH)}`, {}), /scrapeProxyUrl/);
await assert.rejects(() => createApi({ scrapeMode: "tor" })(`/api/scrape?url=${encodeURIComponent(SEARCH)}`, {}), /Nieznany tryb/);
console.log("✅ przełącznik pobierania „direct” / „vercel” (zmiana bez restartu)");

// Przerwanie: sygnał przerwany wcześniej → nic nie jest wołane; przerwany w trakcie → odrzucenie od razu, z nazwą błędu jak w przeglądarce
const dead = new AbortController(); dead.abort();
before = outside.length;
await assert.rejects(() => api("/api/gemini", { ...REQUESTS[0][2], signal: dead.signal }), (e) => e.name === "AbortError");
assert.equal(outside.length, before);
world.delayMs = 400;
const stop = new AbortController();
let t0 = Date.now();
setTimeout(() => stop.abort(), 30);
await assert.rejects(() => api("/api/gemini", { ...REQUESTS[0][2], signal: stop.signal }), (e) => e.name === "AbortError");
assert.ok(Date.now() - t0 < 300, "STOP przerywa oczekiwanie od razu, nie po odpowiedzi AI");
t0 = Date.now();
await assert.rejects(() => api(`/api/scrape?url=${encodeURIComponent(SEARCH)}`, { signal: AbortSignal.timeout(40) }), (e) => e.name === "TimeoutError");
assert.ok(Date.now() - t0 < 300);
world.delayMs = 0;
await new Promise(r => setTimeout(r, 450)); // przerwane zapytania kończą się w tle — nie mogą wywrócić procesu
console.log("✅ STOP i limit czasu przerywają zapytanie tak jak w przeglądarce (AbortError / TimeoutError)");

// Nieznany adres i pośrednik, który rzuca wyjątek
r = await api("/api/nie-ma", {}); assert.equal(r.status, 404);
const boom = await invokeHandler(async () => { throw new Error("bum"); }, {});
assert.equal(boom.status, 500); assert.ok(!boom.headers["content-type"].includes("json"));
console.log("✅ nieznany adres → 404, awaria pośrednika → 500 bez JSON-u (silnik rozpozna to jak awarię funkcji)");

server.close();
globalThis.fetch = realFetch;
console.log("CORE API TESTS OK");
