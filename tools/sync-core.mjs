// Wydziela „czystą” część skanera (stałe i funkcje bez zależności od przeglądarki) z public/index.html
// do modułów w core/. Kod jest kopiowany ZNAK W ZNAK — narzędzie dodaje tylko „export” i importy.
//
//   node tools/sync-core.mjs          → zapisuje pliki core/*.js
//   node tools/sync-core.mjs --check  → nic nie zapisuje; kod wyjścia 1, gdy core/ nie zgadza się z index.html
//
// Po co: do czasu przełączenia na wersję serwerową wzorcem jest public/index.html (kopia bikefinder-69).
// Gdy właściciel przeniesie tu nowszą wersję strony, wystarczy uruchomić to narzędzie — czyste moduły
// odświeżą się same, bez ręcznego przepisywania. Nowa stała albo funkcja na górze index.html musi dostać
// wpis w MODULES poniżej (narzędzie i test przypomną o tym błędem).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = path.join(ROOT, "public/index.html");
const CORE = path.join(ROOT, "core");

// Który kawałek kodu trafia do którego pliku. Kolejność nazw nie ma znaczenia — w pliku zostaje kolejność z index.html.
export const MODULES = {
  "constants.js": {
    about: "Stałe skanera: limity kolejek, czasy, odstępy zapytań, przedziały progu zysku.",
    names: ["RESUME_WINDOW_MS", "PENDING_MAX", "PENDING_MAX_AGE_MS", "MAX_ANALYSIS_ATTEMPTS", "OUTBOX_MAX", "OUTBOX_MAX_AGE_MS",
      "TRANSPORT_DEFAULT_EUR", "AI_FETCH_TIMEOUT_MS", "SCRAPE_TIMEOUT_MS", "DISCORD_TIMEOUT_MS", "ECO_FROM_BUDGET_SHARE",
      "MIN_LISTING_PRICE_DEFAULT", "SEEN_TTL_MS", "PROFIT_TIERS", "tierIndexFor", "AI_FAIL_PAUSE_MS", "DUPE_TTL_MS", "DUPE_MAX",
      "RESULTS_MAX", "STATUS_NOTIFY_COOLDOWN_MS", "SCRAPE_BLOCK_PAUSE_MS", "OUTBOX_REFRESH_MIN_GAP_MS", "RARE_SEARCH_AFTER_MS",
      "RARE_SEARCH_RESCAN_MS", "NEAR_DEAL_MAX_DROP", "NEAR_DEAL_OFFER_SHARE", "SEARCH_URL_VERSION", "KA_MIN_GAP_MS", "JOB_AGING_MS",
      "EMPTY_SUSPICIOUS_MIN_CARDS", "NIGHT_BATCH", "NIGHT_WINDOW_H", "NIGHT_SKIP_SEEN_MS", "SEEN_HARD_REJ", "SEARCH_GAP_MS",
      "EVENTS_MAX", "EVENT_RE", "APP_VERSION", "MAX_PHOTOS_PER_CALL", "MAX_PHOTOS_ALL", "DETAILS_WAIT_MAX_MS", "DETAILS_MAX_AGE_MS",
      "RESUME_MAX_UNDATED", "WEAK_DESC_CHARS", "WEAK_DESC_RE", "UNKNOWN_YEAR_CAP"],
  },
  "bikes.js": {
    about: "Lista wyszukiwań (modele i marki) oraz wzorce rozpoznające znane modele i części w tytule.",
    names: ["BIKE_MODELS", "BIKES_ADDED_AFTER_V51", "BRAND_MODEL_NAMES", "DIRT_MODEL_RE", "GROQ_PART_REASON_RE", "PART_TITLE_RE"],
  },
  "kb-data.js": {
    about: "Wbudowana baza cen (blok KB z index.html, generowany przez kb_build.py).",
    names: ["KB"],
  },
  "kb.js": {
    about: "Dobór wpisów bazy cen do ogłoszenia (marka, dirt, e-MTB) i wykrywanie powtórzonych notatek.",
    names: ["KB_BRAND_PATTERNS", "KB_EMTB_ONLY_PATTERNS", "KB_EMTB_RE", "KB_DIRT_RE", "selectKbChunkIds", "kbChunksText",
      "kbChunkNames", "isKbDuplicate"],
  },
  "pricing.js": {
    about: "Dostawcy i modele AI, cennik tokenów, kursy walut.",
    names: ["PROVIDERS", "DEAD_GROQ_MODELS", "EUR_PLN_RATE", "USD_PLN_RATE", "GEMINI_PRICES", "GEMINI_PRICE_FALLBACK",
      "isClaudeModel", "aiName", "STRONG_GEMINI_MODEL", "STRONG_MODELS"],
  },
  "text.js": {
    about: "Funkcje tekstowe: numer ogłoszenia z linku, całe słowa z czarnej listy, kontekst liczby, naprawa JSON-u, etykiety.",
    names: ["TYPE_LABELS", "UNCERTAIN_LABELS", "fmtYear", "LISTING_ID_RE", "listingIdFromHref", "fmtAgo", "COMPONENT_WORDS_RE",
      "BIKE_WORDS_RE", "numberContext", "escapeRe", "keywordReCache", "keywordRe", "DESC_PARTS_ONLY_RE", "DESC_NEGATION_BEFORE_RE",
      "DESC_COMPLETE_BIKE_RE", "repairJsonText", "fmtDuration"],
  },
  "parse/card-date.js": {
    about: "Data dodania z karty ogłoszenia na liście wyników.",
    names: ["parseCardDate"],
  },
  "fork.js": {
    about: "Widelec w dircie: ściąga dla AI, normalizacja pola „widelec”, opis do alertu.",
    names: ["FORK_SOURCES", "normalizeFork", "FORK_PARTIAL_RE", "FORK_BRAND_ONLY_RE", "FORK_BRAND_MATTERS_RE", "FORK_BRAND_WEAK_RE",
      "forkNeedsCheck", "FORK_SOURCE_LABELS", "fmtFork", "forkField", "DIRT_FORK_GUIDE"],
  },
  "frame.js": {
    about: "Materiał ramy (alu / karbon): wykrywanie z tekstu ogłoszenia, pole „rama” z AI, który materiał liczy program.",
    names: ["FRAME_PART_WORDS", "FRAME_PART_AFTER_RE", "FRAME_PART_BEFORE_RE", "SC_MODELS", "frameTokens", "frameVerdict",
      "detectFrameMaterialText", "FRAME_SOURCES", "normalizeFrame", "FRAME_ALU_FACTOR", "resolveFrameMaterial",
      "FRAME_SOURCE_LABELS", "fmtFrame", "frameField"],
  },
  "deal.js": {
    about: "Okazja i ogłoszenie w postaci do zapisu w kolejce wysyłki; limit wyceny względem ceny nowego.",
    names: ["dealSnapshot", "slimListing", "ageCapFactor"],
  },
};

// Pośrednicy z api/*.js (AI + zdjęcia, Discord, pobieranie stron) — całe pliki kopiowane bez zmian. Na serwerze są
// wywoływani w tym samym procesie (core/providers/api.js), a nie przez HTTP do Vercela.
export const COPIES = {
  "providers/ai.js": { from: "api/gemini.js", about: "Pośrednik AI: Gemini, Groq, Anthropic; pobieranie i cache zdjęć ogłoszenia." },
  "providers/discord.js": { from: "api/discord.js", about: "Wysyłka na webhooki Discorda." },
  "providers/scrape.js": { from: "api/scrape.js", about: "Pobieranie stron kleinanzeigen.de (strony wyników przycinane do kart)." },
};

const HEADER_MARK = "// WYGENEROWANE przez tools/sync-core.mjs";
const DECL_RE = /^(?:const|let|var|function|async function)\s+([A-Za-z_$][\w$]*)/;
const END_RE = /^const SC = \{/; // pierwsza rzecz należąca już do interfejsu (style statusów) — dalej jest React
const isFiller = (l) => l.trim() === "" || l.startsWith("//");

// Skrypt aplikacji z index.html → tekst części „przed interfejsem”
export const appScript = (html) => {
  const m = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Nie znaleziono <script type=\"text/babel\"> w public/index.html");
  return m[1];
};
export const prefixLines = (html) => {
  const lines = appScript(html).split("\n");
  const end = lines.findIndex(l => END_RE.test(l));
  if (end < 0) throw new Error("Nie znaleziono końca części bez interfejsu („const SC = {”) w public/index.html");
  return lines.slice(0, end);
};

// Tnie część „przed interfejsem” na kawałki: jedna deklaracja z kolumny 0 + komentarz bezpośrednio nad nią.
export const splitChunks = (lines) => {
  const decl = [];
  lines.forEach((l, i) => { const m = l.match(DECL_RE); if (m) decl.push({ name: m[1], line: i }); });
  const chunks = decl.map(d => {
    let start = d.line;
    while (start > 0 && isFiller(lines[start - 1])) start--;
    return { ...d, start };
  });
  chunks.forEach((c, k) => {
    let end = k + 1 < chunks.length ? chunks[k + 1].start : lines.length; // koniec (bez tej linii)
    while (end > c.line + 1 && isFiller(lines[end - 1])) end--;           // bez pustych linii i komentarzy na końcu
    let start = c.start;
    while (start < c.line && lines[start].trim() === "") start++;          // bez pustych linii na początku
    c.comment = lines.slice(start, c.line).join("\n");
    c.code = lines.slice(c.line, end).join("\n");
  });
  return chunks;
};

// Z jakich innych deklaracji korzysta kawałek kodu (z nadmiarem: słowo w napisie też się liczy — zbędny import nie szkodzi)
const usedNames = (code, all) => {
  const body = code.split("\n").filter(l => !l.trimStart().startsWith("//")).join("\n");
  const found = new Set();
  for (const m of body.matchAll(/[A-Za-z_$][\w$]*/g)) if (all.has(m[0])) found.add(m[0]);
  return found;
};

// Zwraca { files: { "constants.js": tekst, … }, chunks } albo rzuca błąd z czytelnym opisem.
export const buildCore = (html) => {
  const chunks = splitChunks(prefixLines(html));
  const byName = new Map();
  for (const c of chunks) {
    if (byName.has(c.name)) throw new Error(`Deklaracja „${c.name}” występuje dwa razy na górze index.html`);
    byName.set(c.name, c);
  }
  const fileOf = new Map();
  for (const [file, mod] of Object.entries(MODULES)) {
    for (const n of mod.names) {
      if (fileOf.has(n)) throw new Error(`„${n}” jest przypisane do dwóch plików: ${fileOf.get(n)} i ${file}`);
      if (!byName.has(n)) throw new Error(`„${n}” (plik ${file}) nie istnieje już na górze index.html — usuń wpis z MODULES w tools/sync-core.mjs`);
      fileOf.set(n, file);
    }
  }
  const missing = chunks.filter(c => !fileOf.has(c.name)).map(c => c.name);
  if (missing.length) throw new Error(`Nowe deklaracje na górze index.html bez przypisanego pliku: ${missing.join(", ")} — dopisz je do MODULES w tools/sync-core.mjs`);

  const all = new Set(byName.keys());
  const deps = {}; // plik → Map(plik źródłowy → Set(nazw))
  for (const c of chunks) {
    c.file = fileOf.get(c.name);
    c.uses = [...usedNames(c.code, all)].filter(n => n !== c.name);
    for (const n of c.uses) {
      const src = fileOf.get(n);
      if (src === c.file) continue;
      ((deps[c.file] ||= new Map()).get(src) || deps[c.file].set(src, new Set()).get(src)).add(n);
    }
  }
  // Importy nie mogą tworzyć pętli (stałe liczone przy wczytaniu modułu wymagają wczytanego źródła)
  const state = {};
  const visit = (f, trail) => {
    if (state[f] === 2) return;
    if (state[f] === 1) throw new Error(`Pętla importów w core/: ${[...trail, f].join(" → ")} — popraw przypisania w MODULES`);
    state[f] = 1;
    for (const src of (deps[f] || new Map()).keys()) visit(src, [...trail, f]);
    state[f] = 2;
  };
  Object.keys(MODULES).forEach(f => visit(f, []));

  const files = {};
  for (const [file, mod] of Object.entries(MODULES)) {
    const mine = chunks.filter(c => c.file === file);
    const imports = [...(deps[file] || new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([src, names]) => {
      let rel = path.posix.relative(path.posix.dirname(file), src);
      if (!rel.startsWith(".")) rel = "./" + rel;
      return `import { ${[...names].sort().join(", ")} } from "${rel}";`;
    });
    const body = mine.map(c => (c.comment ? c.comment + "\n" : "") + "export " + c.code).join("\n\n");
    files[file] = [
      `${HEADER_MARK} z public/index.html — NIE EDYTUJ RĘCZNIE.`,
      "// Zmiany wprowadzaj w public/index.html, potem uruchom: node tools/sync-core.mjs",
      `// ${mod.about}`,
      ...(imports.length ? ["", ...imports] : []),
      "",
      body,
      "",
    ].join("\n");
  }
  return { files, chunks };
};

// Kopie całych plików z api/ (z nagłówkiem). read(ścieżka względem repo) → tekst.
export const copyHeader = (c) => `${HEADER_MARK} z ${c.from} — NIE EDYTUJ RĘCZNIE.\n// Zmiany wprowadzaj w ${c.from}, potem uruchom: node tools/sync-core.mjs\n// ${c.about}\n\n`;
export const buildCopies = (read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8")) =>
  Object.fromEntries(Object.entries(COPIES).map(([file, c]) => [file, copyHeader(c) + read(c.from)]));

// Wszystko, co narzędzie wytwarza: moduły z index.html + kopie z api/
export const buildAll = () => {
  const { files, chunks } = buildCore(fs.readFileSync(INDEX, "utf8"));
  return { files: { ...files, ...buildCopies() }, chunks };
};

// Porównuje wygenerowane pliki z tym, co leży w core/. Zwraca listę różnic (pusta = zgodne).
export const diffCore = (files) => {
  const out = [];
  for (const [file, text] of Object.entries(files)) {
    const p = path.join(CORE, file);
    if (!fs.existsSync(p)) out.push(`brak pliku core/${file}`);
    else if (fs.readFileSync(p, "utf8") !== text) out.push(`core/${file} różni się od ${COPIES[file]?.from || "public/index.html"}`);
  }
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  for (const p of fs.existsSync(CORE) ? walk(CORE) : []) {
    const rel = path.relative(CORE, p).split(path.sep).join("/");
    if (!files[rel] && p.endsWith(".js") && fs.readFileSync(p, "utf8").startsWith(HEADER_MARK)) out.push(`core/${rel} ma nagłówek pliku generowanego, ale nie ma go w MODULES`);
  }
  return out;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files } = buildAll();
  if (process.argv.includes("--check")) {
    const diff = diffCore(files);
    if (diff.length) { console.error("core/ nie zgadza się ze wzorcem:\n  " + diff.join("\n  ") + "\nUruchom: node tools/sync-core.mjs"); process.exit(1); }
    console.log(`core/ zgodne ze wzorcem — public/index.html i api/ (${Object.keys(files).length} plików)`);
  } else {
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(CORE, file)), { recursive: true });
      fs.writeFileSync(path.join(CORE, file), text);
    }
    console.log(`Zapisano ${Object.keys(files).length} plików w core/`);
  }
}
