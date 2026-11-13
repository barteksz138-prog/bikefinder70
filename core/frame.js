// WYGENEROWANE przez tools/sync-core.mjs z public/index.html — NIE EDYTUJ RĘCZNIE.
// Zmiany wprowadzaj w public/index.html, potem uruchom: node tools/sync-core.mjs
// Materiał ramy (alu / karbon): wykrywanie z tekstu ogłoszenia, pole „rama” z AI, który materiał liczy program.

// ==FRAME_START== v6.5: MATERIAŁ RAMY (alu / karbon). Testy na 18 ogłoszeniach (11.2026): AI ze zdjęć bez napisu myli alu z karbonem
// (Haiku 2–5 z 9 ram alu, Sonnet 1–2 z 9 — m.in. YT Capra AL, która miała „AL” w tytule), więc o wycenie decyduje kolejno: tekst ogłoszenia
// (wykrywa program), czytelny napis na ramie, a dopiero potem wygląd. Karbon z samego wyglądu liczy się jako karbon (decyzja właściciela
// 13.11.2026), ale alert dostaje znacznik „tylko z wyglądu” i zysk w wersji alu.
// Słowa przy podzespołach („Carbon Lenker”, „Carbonräder”, „Alu-Hinterbau”) nie mówią nic o ramie (przednim trójkącie) — usuwamy je przed szukaniem.
export const FRAME_PART_WORDS = "lenker|laufr(?:a|ä|ae)d|r(?:ä|ae)der|gabel|felgen?|kurbel\\w*|sattelst(?:ü|ue)tze|st(?:ü|ue)tze|vorbau|sattel|pedale?|naben?|speichen|griffe|kassette|kettenbl(?:a|ä)tt\\w*|"
  + "hinterbau|heck|schwinge|wippe|ketten?streben?|sitzstreben?|umlenk\\w*|optik|look|handlebars?|bars?|wheels?|wheelset|rims?|cranks?|seatpost|stem|parts|teile|komponenten|ausstattung|rocker|links?|spokes";

export const FRAME_PART_AFTER_RE = new RegExp(`(?:voll)?(?:carbon|karbon|alu(?:minium|minum)?|alloy)[\\s\\-]*(?:${FRAME_PART_WORDS})[a-zäöüß]*`, "gi"); // także odmiana: „Carbonlaufrädern”

export const FRAME_PART_BEFORE_RE = new RegExp(`(?<![a-zäöüß])(?:${FRAME_PART_WORDS})[a-zäöüß]*[\\s:\\-]*(?:aus|in|from|made of|:)?\\s*(?:voll)?(?:carbon|karbon|alu(?:minium|minum)?|alloy)(?![a-zäöüß])`, "gi");

export const SC_MODELS = "nomad|bronson|hightower|megatower|5010|tallboy|blur|heckler|bullit|v10|jackal|vala";

export const frameTokens = (text, isTitle) => {
  const t = String(text || "").replace(FRAME_PART_AFTER_RE, " ").replace(FRAME_PART_BEFORE_RE, " ");
  const carbon = [], alu = [];
  const hit = (arr, re) => { const m = t.match(re); if (m) arr.push(m[0].trim()); };
  hit(carbon, /(?<![a-zäöüß])(?:voll)?(?:carbon|karbon|kohlefaser)[a-zäöüß-]*/i);
  hit(carbon, /\bcfr?\s?\d{0,2}\b/i);
  hit(carbon, /\b(?:hpc|oclv|s-?works)\b/i);
  hit(carbon, /\bc:6[2-8]\b/i);
  hit(carbon, /\bfact\s?\d{1,2}m\b/i);
  if (isTitle && /\b(?:giant|liv)\b/i.test(t)) hit(carbon, /\badvanced\b/i);
  if (/santa\s*cruz/i.test(t) || new RegExp(`\\b(?:${SC_MODELS})\\b`, "i").test(t)) {
    hit(carbon, new RegExp(`\\b(?:${SC_MODELS})\\s+(?:cc|c)\\b|\\bcc\\b`, "i"));
    hit(alu, new RegExp(`\\b(?:${SC_MODELS})\\s+a\\b`, "i"));
  }
  hit(alu, /(?<![a-zäöüß])(?:alu(?:minium|minum)?|alloy|aluxx)[a-zäöüß-]*/i);
  hit(alu, /\bhpa\b/i);
  hit(alu, /\balpha\s+(?:silver|gold|platinum)\b/i);
  // „AL” jako oznaczenie wersji: w tytule w każdej pisowni („Capra Al”), w opisie tylko „AL”/„Al” (małe „al” bywa zwykłym słowem)
  hit(alu, isTitle ? /\bal\b/i : /\bA[Ll]\b/);
  return { carbon, alu };
};

export const frameVerdict = ({ carbon, alu }) => carbon.length && !alu.length ? "karbon" : alu.length && !carbon.length ? "alu" : carbon.length && alu.length ? "sprzeczny" : null;

export const detectFrameMaterialText = (title, desc) => {
  const tt = frameTokens(title, true), td = frameTokens(desc, false);
  const vt = frameVerdict(tt), vd = frameVerdict(td);
  const ev = (where, toks) => `${where}: ${[...new Set([...toks.carbon, ...toks.alu])].map(s => `„${s}”`).join(", ")}`;
  if (vt === "karbon" || vt === "alu") return { material: vt, conflict: false, evidence: ev("tytuł", tt) };
  if ((vd === "karbon" || vd === "alu") && vt !== "sprzeczny") return { material: vd, conflict: false, evidence: ev("opis", td) };
  if (vt === "sprzeczny") return { material: null, conflict: true, evidence: ev("tytuł", tt) };
  if (vd === "sprzeczny") return { material: null, conflict: true, evidence: ev("opis", td) };
  return { material: null, conflict: false, evidence: null };
};

// Pole "rama" z odpowiedzi AI → { material, zrodlo, dowod, sprzedaz_alu_eur }
export const FRAME_SOURCES = ["tekst", "napis", "wyglad", "nieznany"];

export const normalizeFrame = (r) => {
  const o = r && typeof r === "object" ? r : {};
  const material = ["karbon", "alu", "nie_wiem"].includes(o.material) ? o.material : null;
  const zrodlo = FRAME_SOURCES.includes(o.zrodlo) ? o.zrodlo : "nieznany";
  const dowod = typeof o.dowod === "string" && o.dowod.trim() && !/^(null|brak|none|-)$/i.test(o.dowod.trim()) ? o.dowod.trim().slice(0, 160) : null;
  const v = typeof o.sprzedaz_alu_eur === "number" ? o.sprzedaz_alu_eur : (typeof o.sprzedaz_alu_eur === "string" && /^\s*\d+([.,]\d+)?\s*$/.test(o.sprzedaz_alu_eur) ? parseFloat(o.sprzedaz_alu_eur.replace(",", ".")) : null);
  return { material, zrodlo, dowod, sprzedaz_alu_eur: Number.isFinite(v) && v > 0 ? v : null };
};

// Gdy AI wyceniło karbon, a liczymy alu, a AI nie podało wyceny alu: karbon ≈ +10–25% wobec alu (KOREKTY w bazie) → alu ≈ 80% karbonu
export const FRAME_ALU_FACTOR = 0.8;

// Który materiał liczy program. text = detectFrameMaterialText(...), rama = normalizeFrame(...), sale = wycena AI (€).
// Tekst „alu” (albo napis alu sprzeczny z tekstem) → wycena alu (priceAsAlu). Karbon tylko z wyglądu → zostaje karbon, ale possibleCarbon
// i saleAlu = wartość wersji alu (do pokazania w alercie).
export const resolveFrameMaterial = (text, rama, sale) => {
  const ai = rama.material, src = rama.zrodlo;
  let final, source, warn = null, possibleCarbon = false;
  if (text.material) {
    final = text.material; source = "tekst";
    if (ai && ai !== "nie_wiem" && ai !== text.material && src === "napis") {
      warn = `napis na ramie wskazuje ${ai === "karbon" ? "karbon" : "alu"}, a tekst ogłoszenia ${text.material} — sprawdź materiał`;
      if (ai === "alu") final = "alu"; // przy sprzeczności liczymy ostrożniej
    }
  } else if (ai === "karbon" && src === "napis") {
    final = "karbon"; source = "napis";
  } else if (ai === "karbon") {
    possibleCarbon = true; source = "wyglad"; final = "karbon";
  } else {
    final = ai || "nie_wiem"; source = ai ? src : "nieznany";
  }
  const priceAsAlu = ai === "karbon" && final === "alu" && sale != null && sale > 0;
  const saleAlu = !(priceAsAlu || possibleCarbon) || sale == null || !(sale > 0) ? null
    : rama.sprzedaz_alu_eur != null && rama.sprzedaz_alu_eur < sale ? rama.sprzedaz_alu_eur : Math.round(sale * FRAME_ALU_FACTOR);
  return { final, source, warn, possibleCarbon, priceAsAlu, saleAlu };
};

// ==FRAME_END==
export const FRAME_SOURCE_LABELS = { tekst: "z tekstu ogłoszenia", napis: "napis na ramie", wyglad: "tylko z wyglądu", nieznany: "nieustalony" };

export const fmtFrame = (r) => !r || !r.material ? null
  : `${r.material === "karbon" ? "karbon" : r.material === "alu" ? "alu" : "nieustalony (liczone jak alu)"} (${FRAME_SOURCE_LABELS[r.zrodlo] || r.zrodlo})`
    + (r.possibleCarbon ? " — sprawdź spoiny przy suporcie" : "") + (r.dowod ? `: ${r.dowod}` : "");

export const frameField = (a) => a?.rama?.material && a.typ_roweru !== "dirt" ? [{ name: "🧱 Rama", value: String(fmtFrame(a.rama)).slice(0, 220), inline: false }] : [];
