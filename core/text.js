// WYGENEROWANE przez tools/sync-core.mjs z public/index.html — NIE EDYTUJ RĘCZNIE.
// Zmiany wprowadzaj w public/index.html, potem uruchom: node tools/sync-core.mjs
// Funkcje tekstowe: numer ogłoszenia z linku, całe słowa z czarnej listy, kontekst liczby, naprawa JSON-u, etykiety.

// Etykiety typu roweru zwracanego przez Gemini
export const TYPE_LABELS = {
  full: { label: "🟢 Full",  color: "#22c55e" },
  dirt: { label: "🟠 Dirt",  color: "#f59e0b" },
  elektryk_gorski: { label: "⚡ Elektryk górski", color: "#38bdf8" },
  inny: { label: "⚫ Inny",  color: "#475569" },
};

// Rocznik do wyświetlenia: podany → "2019"; oszacowany → zakres, jeśli AI go podało ("2012–2016 (oszac.)")
export const fmtYear = (f) => !f?.rocznik ? "?" : f.rocznik_zrodlo === "oszacowany" ? `${f.rocznik_zakres || f.rocznik} (oszac.)` : String(f.rocznik);

// Numer ogłoszenia z linku: /s-anzeige/<tytuł>/<numer>-217-<miejsce>. Tytuł w linku zmienia się, gdy sprzedawca
// edytuje ogłoszenie — dlatego ofertę rozpoznajemy po numerze, a nie po całym linku.
export const LISTING_ID_RE = /\/(\d{6,12})-\d+-\d+(?:[/?#]|$)/;

export const listingIdFromHref = (href) => { const m = String(href || "").match(LISTING_ID_RE); return m ? m[1] : null; };

export const fmtAgo = (ts) => {
  if (!Number.isFinite(ts)) return null;
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  return m < 60 ? `${m} min temu` : m < 48 * 60 ? `${Math.round(m / 60)} h temu` : `${Math.round(m / 1440)} dni temu`;
};

// Czy liczba z opisu (rocznik, cena nowego) dotyczy PODZESPOŁU, a nie całego roweru.
// Patrzymy na najbliższe słowo przed liczbą w tej samej linii (do ~45 znaków): podzespół → "component",
// rama/rower → "bike". Np. "Gabel Baujahr 2015, Rahmen Modelljahr 2020" → 2015 = widelec, 2020 = rower.
export const COMPONENT_WORDS_RE = /(?:federgabel|gabel|d[äa]mpfer|federbein|laufr[äa]d\w*|felge\w*|reifen|bremse\w*|schaltwerk|schaltung|kurbel\w*|kette|kassette|antrieb|sattelst[üu]tze|vorbau|lenker|pedale?|motor|akku|display|rock\s?shox|marzocchi|[öo]hlins|manitou|suntour|magura|dt\s?swiss|mavic|schwalbe|maxxis|\bfox\b|\bsram\b|shimano|ersatzteil\w*|\bteile\b)/gi;

export const BIKE_WORDS_RE = /(?:rahmen\w*|fahrrad|(?<![a-zäöüß])rad\b|\bbike\b|fully|komplettrad|\bmodell\b|mountainbike|\bmtb\b)/gi;

export const numberContext = (text, idx) => {
  const seg = text.slice(Math.max(0, idx - 45), idx);
  const line = seg.slice(seg.lastIndexOf("\n") + 1);
  const lastPos = (re) => { let p = -1; for (const m of line.matchAll(re)) p = m.index; return p; };
  const c = lastPos(COMPONENT_WORDS_RE), b = lastPos(BIKE_WORDS_RE);
  return c > b ? "component" : b >= 0 ? "bike" : "none";
};

// Słowo z czarnej listy liczy się tylko jako CAŁE słowo (z typowymi końcówkami: -s, -e, -n, -en, -er, -es).
// Dzięki temu "Laufrad" nie łapie "Laufradsatz", a "Rad" nie łapie "Fahrrad".
export const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const keywordReCache = new Map();

export const keywordRe = (kw) => {
  if (!keywordReCache.has(kw)) {
    keywordReCache.set(kw, new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRe(kw).replace(/\s+/g, "\\s+")}(?:s|e|n|en|er|es)?(?=$|[^\\p{L}\\p{N}])`, "iu"));
  }
  return keywordReCache.get(kw);
};

// W OPISIE odrzucamy tylko jednoznaczne zwroty o sprzedaży samej ramy — pojedyncze słowa
// ("Laufrad", "Ersatzteile", "Rennrad") w opisie kompletnego roweru są normalne ("inkl. Ersatzteile", "kein Tausch gegen Rennrad").
export const DESC_PARTS_ONLY_RE = /\b(?:nur\s+(?:der|den|das)?\s*rahmen(?:set)?|rahmen\s+only|frame\s+only)\b/gi;

export const DESC_NEGATION_BEFORE_RE = /(?:nicht|kein\w*|not)\s*$/i;           // "nicht nur Rahmen", "not frame only"

export const DESC_COMPLETE_BIKE_RE = /komplett(?:es|er|rad)?\s*(?:fahr)?rad|komplettrad|complete\s+bike|fahrbereit/i;

// v6.3: naprawa typowych błędów składni JSON od modelu — cudzysłów w tekście bez \ (np. „27,5"”), znak nowej linii
// w tekście, brakujący przecinek między polami, przecinek przed } lub ]. Cudzysłów zamyka tekst tylko wtedy, gdy
// po nim (pomijając spacje) stoi , } ] albo : — w przeciwnym razie traktujemy go jako znak w tekście.
export const repairJsonText = (src) => {
  let out = "", inStr = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (!inStr) { out += c; if (c === '"') inStr = true; continue; }
    if (c === "\\") { out += c + (src[i + 1] ?? ""); i++; continue; }
    if (c === "\n") { out += "\\n"; continue; }
    if (c === "\r") continue;
    if (c === "\t") { out += "\\t"; continue; }
    if (c === '"') {
      let j = i + 1;
      while (j < src.length && /[ \t\r\n]/.test(src[j])) j++;
      const newField = src[j] === '"' && /\n/.test(src.slice(i + 1, j)); // „"x"⏎"b": …” — brakujący przecinek, nie cudzysłów w tekście
      if (j >= src.length || ",}]:".includes(src[j]) || newField) { out += c; inStr = false; }
      else out += '\\"';
      continue;
    }
    out += c;
  }
  return out
    .replace(/("|\d|true|false|null|\}|\])(\s*\n\s*)(")/g, "$1,$2$3") // brakujący przecinek przed kolejnym polem
    .replace(/,(\s*[}\]])/g, "$1");                                     // przecinek przed } / ]
};

export const fmtDuration = (ms) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`;
};

// Kategorie "niepewnych" — konkretny powód zamiast ogólnego "za mało danych"
export const UNCERTAIN_LABELS = {
  nisza_custom: "Nisza/custom — brak cen rynkowych",
  za_malo_opisu: "Za mało informacji w opisie",
  nieznany_model: "Nieznany model",
  inne: "Do sprawdzenia",
};
