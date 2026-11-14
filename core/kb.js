// WYGENEROWANE przez tools/sync-core.mjs z public/index.html — NIE EDYTUJ RĘCZNIE.
// Zmiany wprowadzaj w public/index.html, potem uruchom: node tools/sync-core.mjs
// Dobór wpisów bazy cen do ogłoszenia (marka, dirt, e-MTB) i wykrywanie powtórzonych notatek.

import { KB } from "./kb-data.js";

// ==KB_END==

// ── Dobór wpisów bazy do ogłoszenia ───────────────────────────────────────────────────────
// Gemini NIE dostaje całej bazy (~60 tys. znaków) przy każdym ogłoszeniu. Dostaje:
//  • część ogólną (KB.core) — zawsze tę samą, więc siedzi w stałej części promptu (cache Google, ~10% stawki),
//  • wpisy TYLKO tych marek, których dotyczy ogłoszenie (KB.chunks) — w części dynamicznej, przy ogłoszeniu.
// Markę rozpoznajemy po tytule; gdy tytuł jej nie zdradza — po etykiecie wyszukiwania (listing.bike,
// np. "Canyon Torque"), a potem po początku opisu. Brak marki w bazie → zostaje część ogólna (wycena kategorii).
export const KB_BRAND_PATTERNS = {
  canyon:      /\bcanyon\b/i,
  trek:        /\btrek\b/i,
  specialized: /\bspeciali[sz]ed\b|\bstumpjumper\b|\bkenevo\b|\bturbo\s*levo\b|\bs-works\b/i,
  cube:        /\bcube\b/i,
  radon:       /\bradon\b/i,
  ghost:       /\bghost\b/i,
  focus:       /\bfocus\b/i,
  gt:          /^GT\b|\bGT\s+(force|fury|sensor|sanction|distortion|ruckus|zaskar|avalanche)\b/i,
  dartmoor:    /\bdartmoor\b/i,
  santa_cruz:  /\bsanta\s*cruz\b|\bnomad\b|\bbronson\b|\bhightower\b|\bmegatower\b|\b5010\b|\bheckler\b|\bv10\b/i,
  yt:          /\bYT\b|\bcapra\b|\bjeffsy\b|\btues\b|\bdecoy\b|\bizzo\b/i,
  commencal:   /\bcommencal\b|\bmeta\s*(am|tr|sx|ht|power)\b|\bfurious\b/i,
  propain:     /\bpropain\b|\btyee\b|\bspindrift\b|\bhugene\b|\bekano\b/i,
  norco:       /\bnorco\b|\baurum\b/i,
  ns:          /\bNS\b|\b[Nn][Ss][\s-]?[Bb]ikes?\b|\b[Ss]nabb\b/,
  nukeproof:   /\bnukeproof\b/i,
  rocky_mountain: /\brocky\s*mountain\b/i,
  marin:       /\bmarin\b/i,
  transition:  /\btransition\b/i,
  evil_intense_raaw: /\bevil\b|\bintense\b|\braaw\b/i,
  giant:       /\bgiant\b|\breign\b|\btrance\b/i,
};

// v6.4: marki występujące tylko w katalogu e-MTB (wpisy „emtb_<marka>”)
export const KB_EMTB_ONLY_PATTERNS = {
  cannondale: /\bcannondale\b|\bmoterra\b/i,
  haibike:    /\bhaibike\b|\ballmtn\b|\bfullseven\b|\b[sx]duro\b/i,
  merida:     /\bmerida\b|\beone[\s-]?(sixty|forty)\b/i,
  orbea:      /\borbea\b/i,
  scott:      /\bscott\b.*\beride\b|\b(genius|patron|strike|ransom)\s*eride\b/i,
};

// v6.4: sygnały e-MTB w tytule / etykiecie — wtedy dołączamy wpis „e-MTB: zasady i kategorie” i katalog marki
export const KB_EMTB_RE = /\be[\s-]?(mtb|bike|fully|enduro)\b|\bpedelec\b|\bhybrid\b|:on\b|\bturbo\s*(levo|kenevo)\b|\blevo\b|\bkenevo\b|\brail\s*\d|\bpowerfly\b|\be\+|\bmoterra\b|\beone[\s-]?(sixty|forty)\b|\bwild\s*fs\b|\borbea\s+(wild|rise)\b|\bheckler\b|\bbullit\b|\bdecoy\b|\bizzo\b|\ballmtn\b|\bfullseven\b|\b[sx]duro\b|\bmeta\s*power\b|\beride\b|\bpowerplay\b|\b(jam|sam|thron)(²|2)\b|\bbosch\b|\be8000\b|\bep8\b|\bep801\b|\b\d{3}\s?wh\b|\bbrose\b|\byamaha\b/i;

// Dirtówki i slopestyle (wpis o dirtach obejmuje m.in. Stitched, Ticket, P.3, Slush, Two6player, NS, Jackal)
export const KB_DIRT_RE = /\bdirt|slopestyle|pump\s*track|\bstitched\b|\bticket\b|\bp\.?\s?3\b|\bslush\b|two6player|\bgamer\b|streetfighter|\bbruce\b|\balcatraz\b|\bdecade\b|\bzircus\b|\bmetropolis\b|\bmovement\b|\btrickshot\b|commencal\s+absolut|dirt\s*love|\bjackal\b|\bbeddo\b|\bwhip\b|\bjump\s*bike\b|\bDJ\b/i;

// texts — teksty od najważniejszego: [tytuł, etykieta wyszukiwania, początek opisu]; marki bierzemy z PIERWSZEGO,
// w którym jakąś widać (tytuł wygrywa z etykietą — wyniki wyszukiwania "Canyon" bywają innej marki).
// typ — typ z Etapu 1 (albo null w czacie).
export const selectKbChunkIds = (texts, typ) => {
  const list = (Array.isArray(texts) ? texts : [texts]).map(x => String(x || ""));
  const ids = [];
  if (typ === "dirt" || KB_DIRT_RE.test(list.slice(0, 2).join(" "))) ids.push("dirt");
  if (typ === "dirt") return ids; // pewna dirtówka: wystarcza wpis o dirtach (wpisy marek to fulle i e-MTB)
  // v6.4: e-MTB — katalog marki (emtb_<marka>) + zasady i kategorie e-MTB; zwykły wpis marki zostaje (bike checki)
  const isEmtb = typ === "elektryk_gorski" || KB_EMTB_RE.test(list.slice(0, 2).join(" "));
  const emtbFor = (brandIds) => isEmtb ? ["emtb_core", ...brandIds.map(b => `emtb_${b}`).filter(id => KB.chunks[id])] : [];
  for (const txt of list) {
    const brands = Object.keys(KB_BRAND_PATTERNS).filter(id => KB.chunks[id] && KB_BRAND_PATTERNS[id].test(txt));
    const emtbOnly = isEmtb ? Object.keys(KB_EMTB_ONLY_PATTERNS).filter(id => KB_EMTB_ONLY_PATTERNS[id].test(txt)) : [];
    if (brands.length > 0 || emtbOnly.length > 0) return [...ids, ...brands, ...emtbFor([...brands, ...emtbOnly].filter((v, i, a) => a.indexOf(v) === i))].filter(id => KB.chunks[id]);
  }
  return [...ids, ...emtbFor([])].filter(id => KB.chunks[id]);
};

export const kbChunksText = (ids) => ids.map(id => KB.chunks[id].text).join("\n\n");

export const kbChunkNames = (ids) => ids.map(id => KB.chunks[id].name).join(", ");

// Przypięty w czacie wpis "BAZA CEN — <nazwa wpisu z bazy wbudowanej> …" to stara kopia tej bazy —
// nie wysyłamy go drugi raz (podwójne tokeny i ryzyko starszych cen). Inne przypięte notatki zostają.
export const isKbDuplicate = (text) => {
  const first = String(text || "").trim().split("\n")[0];
  const m = first.match(/^BAZA CEN\s*[—–-]\s*(.+?)(?:\s+[—–-]\s|\s*\(|$)/i);
  if (!m) return false;
  const name = m[1].trim().toLowerCase();
  if (name.length < 3) return false;
  return KB.entryNames.some(n => { const k = n.toLowerCase(); return name === k || name.startsWith(k) || k.startsWith(name); });
};
