// Zamiennik fetch("/api/…") dla wersji serwerowej.
//
// W przeglądarce skaner woła trzech pośredników na Vercelu: /api/gemini (AI + zdjęcia), /api/discord, /api/scrape.
// Na serwerze te same funkcje (kopie w ai.js, discord.js, scrape.js) są wywoływane w tym samym procesie — bez HTTP,
// a klucze API nie wychodzą poza serwer. Silnik dostaje `apiFetch(adres, opcje)`, które zachowuje się jak fetch
// w przeglądarce w zakresie, z którego korzysta skaner: resp.ok, resp.status, resp.headers.get(), resp.json(),
// resp.text() oraz przerwanie przez `signal` (STOP i limity czasu).
//
// Pobieranie stron Kleinanzeigen ma przełącznik (ustalenie z właścicielem, 12.11.2026):
//   scrapeMode "direct" — strony pobiera ten serwer (funkcja z api/scrape.js uruchomiona lokalnie),
//   scrapeMode "vercel" — jak dotąd, przez pośrednika na Vercelu (scrapeProxyUrl); zapas na wypadek blokady adresu serwera.
import aiHandler from "./ai.js";
import discordHandler from "./discord.js";
import scrapeHandler from "./scrape.js";

export const SCRAPE_MODES = ["direct", "vercel"];
const HANDLERS = { "/api/gemini": aiHandler, "/api/discord": discordHandler, "/api/scrape": scrapeHandler };

// Uruchamia pośrednika z atrapą obiektów req/res (taki sam kształt, jaki daje Vercel). Zwraca { status, headers, text }.
// Pośrednik, który rzuci wyjątek, daje 500 z treścią niebędącą JSON-em — tak jak awaria funkcji na Vercelu.
export const invokeHandler = async (handler, { method = "GET", body, query = {} } = {}) => {
  const out = { status: 200, headers: {}, text: "" };
  const res = {
    setHeader(k, v) { out.headers[String(k).toLowerCase()] = String(v); return res; },
    status(code) { out.status = code; return res; },
    json(obj) {
      if (!out.headers["content-type"]) out.headers["content-type"] = "application/json; charset=utf-8";
      out.text = JSON.stringify(obj) ?? "";
      return res;
    },
    send(text) {
      if (text != null && typeof text === "object") return res.json(text);
      out.text = text == null ? "" : String(text);
      return res;
    },
    end(text) { if (text != null) out.text = String(text); return res; },
  };
  try {
    await handler({ method, body, query, headers: {} }, res);
  } catch (e) {
    return { status: 500, headers: { "content-type": "text/plain; charset=utf-8" }, text: `Błąd pośrednika: ${e?.message || e}` };
  }
  return out;
};

// Odpowiedź w kształcie, z którego korzysta skaner (podzbiór Response z przeglądarki)
const toResponse = ({ status, headers, text }) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[String(k).toLowerCase()] ?? null },
  text: async () => text,
  json: async () => JSON.parse(text),
});

const abortError = (signal) => signal?.reason instanceof Error ? signal.reason
  : Object.assign(new Error("Zapytanie przerwane"), { name: "AbortError" });

// Jak fetch: przerwany sygnał odrzuca obietnicę od razu (praca pośrednika w tle dobiega końca sama — na Vercelu było tak samo)
const withSignal = (promise, signal) => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError(signal));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
};

// scrapeMode / scrapeProxyUrl mogą być funkcjami — wtedy zmiana ustawienia działa bez restartu (od następnego zapytania).
// fetchImpl: prawdziwy fetch dla trybu "vercel" (domyślnie globalny).
export const createApi = ({ scrapeMode = "direct", scrapeProxyUrl = "", fetchImpl } = {}) => {
  const val = (v) => typeof v === "function" ? v() : v;
  return async function apiFetch(input, init = {}) {
    const url = new URL(String(input), "http://ddf.local");
    const handler = HANDLERS[url.pathname];
    const signal = init.signal;
    if (signal?.aborted) throw abortError(signal);
    if (!handler) return toResponse({ status: 404, headers: { "content-type": "text/plain; charset=utf-8" }, text: `Nieznany adres ${url.pathname}` });
    const method = String(init.method || "GET").toUpperCase();

    if (url.pathname === "/api/scrape") {
      const mode = val(scrapeMode);
      if (!SCRAPE_MODES.includes(mode)) throw new Error(`Nieznany tryb pobierania „${mode}” (dozwolone: ${SCRAPE_MODES.join(", ")})`);
      if (mode === "vercel") {
        const proxy = val(scrapeProxyUrl);
        if (!/^https:\/\//.test(String(proxy || ""))) throw new Error("Tryb pobierania „vercel” wymaga adresu pośrednika (scrapeProxyUrl, https://…/api/scrape)");
        return (fetchImpl || globalThis.fetch)(`${proxy}${url.search}`, { method, signal });
      }
    }

    let body;
    if (method === "POST") {
      // Vercel sam zamienia treść JSON na obiekt; niepoprawny JSON kończy się 400 jeszcze przed funkcją
      try { body = typeof init.body === "string" ? JSON.parse(init.body) : init.body; }
      catch { return toResponse({ status: 400, headers: { "content-type": "application/json; charset=utf-8" }, text: JSON.stringify({ error: "Niepoprawny JSON" }) }); }
    }
    const query = Object.fromEntries(url.searchParams);
    return toResponse(await withSignal(invokeHandler(handler, { method, body, query }), signal));
  };
};
