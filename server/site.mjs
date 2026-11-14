// Lokalna strona skanera dla wersji serwerowej („Chrome bez okna”).
//
// Serwer HTTP tylko na 127.0.0.1: podaje stronę skanera (public/index.html), obsługuje jej zapytania /api/gemini,
// /api/discord, /api/scrape tymi samymi funkcjami co Vercel (core/providers) oraz przyjmuje polecenia sterujące
// (/control/…) od konsoli. Strona jest otwierana przez Chrome bez okna (server/runner.mjs).
//
// Dwa sposoby podania strony:
//   "original" — public/index.html bez żadnej zmiany; React i Babel z cdnjs, dokładnie jak w przeglądarce właściciela
//                (Chrome trzyma je potem w swojej pamięci podręcznej w profilu). Domyślny.
//   "compiled" — JSX skompilowany zawczasu (esbuild), React z pliku w repo (ten sam, na którym chodzą testy);
//                nie wymaga internetu do wczytania strony. Używany w testach i jako zapas, gdy cdnjs jest niedostępny.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApi } from "../core/providers/api.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PAGE_MODES = ["original", "compiled"];
const MAX_BODY_BYTES = 8 * 1024 * 1024;

// Strona w trybie "compiled". transformApp (tylko testy): zmiana skompilowanego skryptu, np. skrócenie przerw.
export const buildCompiledPage = async ({ transformApp } = {}) => {
  const html0 = fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8");
  const m = html0.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Nie znaleziono <script type=\"text/babel\"> w public/index.html");
  const esbuildMod = await import("esbuild").catch(() => import("/opt/npm-tools/node_modules/esbuild/lib/main.js"));
  const esbuild = esbuildMod.default || esbuildMod;
  let { code } = await esbuild.transform(m[1], { loader: "jsx" });
  if (transformApp) code = transformApp(code);
  const cdn = /[ \t]*<script src="https:\/\/cdnjs\.cloudflare\.com\/[^"]*"><\/script>\r?\n?/g;
  if ((html0.match(cdn) || []).length < 2) throw new Error("Nie znaleziono skryptów React z cdnjs w public/index.html");
  let first = true;
  const html = html0
    .replace(cdn, () => { if (!first) return ""; first = false; return "  <script src=\"/vendor/react.js\"></script>\n"; })
    .replace(/<script type="text\/babel"[^>]*>[\s\S]*?<\/script>/, () => "<script src=\"/app.js\"></script>");
  return { "/": [html, "text/html; charset=utf-8"], "/app.js": [code, "text/javascript; charset=utf-8"],
    "/vendor/react.js": [fs.readFileSync(path.join(ROOT, "tests/react-shim.js"), "utf8"), "text/javascript; charset=utf-8"] };
};
export const buildOriginalPage = () => ({ "/": [fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8"), "text/html; charset=utf-8"] });

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = []; let size = 0;
  req.on("data", (c) => { size += c.length; if (size > MAX_BODY_BYTES) { reject(Object.assign(new Error("Za duże zapytanie"), { status: 413 })); req.destroy(); } else chunks.push(c); });
  req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  req.on("error", reject);
});
const send = (res, status, type, text) => { res.writeHead(status, { "content-type": type, "cache-control": "no-store" }); res.end(text); };
const sendJson = (res, status, obj) => send(res, status, "application/json; charset=utf-8", JSON.stringify(obj));

// control: { nazwa: async (argumenty) => wynik } — polecenia dla konsoli (patrz server/main.mjs).
// scrape: () => ({ mode, proxyUrl }) — czytane przy każdym zapytaniu, więc przełącznik działa bez restartu.
export const createSite = async ({ host = "127.0.0.1", port = 8787, pageMode = "original", transformApp, scrape = () => ({ mode: "direct", proxyUrl: "" }), control = {}, fetchImpl } = {}) => {
  if (!PAGE_MODES.includes(pageMode)) throw new Error(`Nieznany tryb strony „${pageMode}” (dozwolone: ${PAGE_MODES.join(", ")})`);
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) throw new Error("Strona skanera może słuchać tylko na adresie lokalnym (127.0.0.1) — zapytania /api przyjmują klucze i nie mają hasła");
  const assets = pageMode === "compiled" ? await buildCompiledPage({ transformApp }) : buildOriginalPage();
  const api = createApi({ scrapeMode: () => scrape().mode, scrapeProxyUrl: () => scrape().proxyUrl, fetchImpl });

  const server = http.createServer(async (req, res) => {
    try {
      // Tylko zapytania kierowane wprost do tego serwera (ochrona przed stroną z internetu udającą adres lokalny)
      const hostHdr = String(req.headers.host || "");
      const okHosts = [`127.0.0.1:${actualPort()}`, `localhost:${actualPort()}`];
      if (!okHosts.includes(hostHdr)) return sendJson(res, 403, { error: "Niedozwolony adres hosta" });
      const url = new URL(req.url, `http://${hostHdr}`);

      if (req.method === "GET" && assets[url.pathname]) return send(res, 200, assets[url.pathname][1], assets[url.pathname][0]);
      // Pusta strona pod tym samym adresem — do wgrania pamięci (import), gdy skaner nie jest wczytany
      if (req.method === "GET" && url.pathname === "/__blank") return send(res, 200, "text/html; charset=utf-8", "<!DOCTYPE html><title>ddf</title>");

      if (url.pathname.startsWith("/api/")) {
        const raw = req.method === "POST" ? await readBody(req) : undefined;
        const abort = new AbortController();
        res.on("close", () => { if (!res.writableEnded) abort.abort(); }); // strona przerwała zapytanie (STOP, limit czasu)
        let resp;
        try { resp = await api(url.pathname + url.search, { method: req.method, body: raw, signal: abort.signal }); }
        catch (e) {
          if (abort.signal.aborted) return;
          return sendJson(res, 502, { error: { message: `Błąd serwera skanera: ${e?.message || e}` } });
        }
        const text = await resp.text();
        if (abort.signal.aborted) return;
        return send(res, resp.status, resp.headers.get("content-type") || "text/plain; charset=utf-8", text);
      }

      if (url.pathname.startsWith("/control/")) {
        // Polecenia tylko od programu z tego serwera (konsola), nie od strony w przeglądarce
        if (req.headers.origin) return sendJson(res, 403, { ok: false, error: "Polecenia sterujące nie są dostępne dla stron" });
        const fn = control[url.pathname.slice("/control/".length)];
        if (!fn) return sendJson(res, 404, { ok: false, error: "Nieznane polecenie" });
        let args = Object.fromEntries(url.searchParams);
        if (req.method === "POST") {
          const raw = await readBody(req);
          if (raw) { try { args = { ...args, ...JSON.parse(raw) }; } catch { return sendJson(res, 400, { ok: false, error: "Niepoprawny JSON" }); } }
        }
        try { return sendJson(res, 200, { ok: true, ...(await fn(args)) }); }
        catch (e) { return sendJson(res, e?.status || 500, { ok: false, error: e?.message || String(e) }); }
      }
      return send(res, 404, "text/plain; charset=utf-8", "Nie ma takiej strony");
    } catch (e) {
      if (!res.headersSent) sendJson(res, e?.status || 500, { error: e?.message || String(e) }); else res.end();
    }
  });
  const actualPort = () => server.address()?.port;
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, host === "localhost" ? "127.0.0.1" : host, resolve); });
  return {
    server, port: actualPort(), origin: `http://127.0.0.1:${actualPort()}`, pageMode,
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
};
