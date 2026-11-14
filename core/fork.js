// WYGENEROWANE przez tools/sync-core.mjs z public/index.html — NIE EDYTUJ RĘCZNIE.
// Zmiany wprowadzaj w public/index.html, potem uruchom: node tools/sync-core.mjs
// Widelec w dircie: ściąga dla AI, normalizacja pola „widelec”, opis do alertu.

// v5.13: pole "widelec" z analizy AI → { model | null, zrodlo, sztywny }
export const FORK_SOURCES = ["napis", "opis", "wyglad", "nieznany"];

export const normalizeFork = (w) => {
  const o = w && typeof w === "object" ? w : {};
  let model = typeof o.model === "string" ? o.model.trim().slice(0, 60) : "";
  if (!model || /^(null|brak|none|-|nieznany|unknown|\?)$/i.test(model) || /^nieznan/i.test(model)) model = null;
  let zrodlo = FORK_SOURCES.includes(o.zrodlo) ? o.zrodlo : "nieznany";
  if (!model) zrodlo = "nieznany";
  else if (zrodlo === "nieznany") zrodlo = "wyglad";
  // v5.14: sama marka bez modelu ("RockShox (model nieznany)", "X-Fusion (wersja nieczytelna)", "Fox") — model NIE jest rozpoznany
  const bezModelu = !!model && (FORK_PARTIAL_RE.test(model) || FORK_BRAND_ONLY_RE.test(model.replace(/[()]/g, "").trim()));
  return { model, zrodlo, sztywny: o.sztywny === true, ...(bezModelu ? { bezModelu: true } : {}) };
};

export const FORK_PARTIAL_RE = /nieznan|nieczyteln|nierozpozn|niewidoczn|unknown|bez\s+(napisu|nazwy)|\?/i;

export const FORK_BRAND_ONLY_RE = /^(rock\s*shox|fox(\s+racing\s+shox)?|manitou|marzocchi|x-?fusion|(sr\s+)?suntour|rst|dvo|formula|[öo]hlins)$/i;

// Marki, w których od modelu zależy półka (Pike DJ, Fox 36 831, Circus Pro, Bomber DJ) — sama marka = trzeba sprawdzić.
// X-Fusion / Suntour / RST to zawsze pasmo „słabszy widelec”, więc sama marka wystarcza.
export const FORK_BRAND_MATTERS_RE = /rock\s*shox|\bfox\b|manitou|marzocchi|\bdvo\b|formula|[öo]hlins/i;

export const FORK_BRAND_WEAK_RE = /x-?fusion|suntour|\brst\b/i;

export const forkNeedsCheck = (w) => !w || w.sztywny ? null
  : !w.model || w.zrodlo === "nieznany" ? "sprawdź widelec (nie rozpoznano — liczone jak słabszy)"
  : w.bezModelu ? (FORK_BRAND_WEAK_RE.test(w.model) && !FORK_BRAND_MATTERS_RE.test(w.model) ? null : `sprawdź widelec (${w.model.replace(/\s*\(.*\)\s*$/, "")} bez rozpoznanego modelu — liczone jak słabszy)`)
  : w.zrodlo === "wyglad" ? `sprawdź widelec (${w.model} rozpoznany tylko z wyglądu)` : null;

export const FORK_SOURCE_LABELS = { napis: "napis na zdjęciu", opis: "z opisu", wyglad: "z wyglądu — sprawdź" };

export const fmtFork = (w) => !w ? null : w.sztywny ? "sztywny (bez amortyzacji)"
  : w.model ? `${w.model} (${w.bezModelu ? "model nierozpoznany — liczone jak słabszy" : FORK_SOURCE_LABELS[w.zrodlo] || w.zrodlo})` : "nie rozpoznano";

export const forkField = (a) => a?.widelec && (a.typ_roweru === "dirt" || a.widelec.model) ? [{ name: "🔧 Widelec", value: String(fmtFork(a.widelec)).slice(0, 200), inline: true }] : [];

// v5.13: ściąga rozpoznawania widelców — dołączana do analizy TYLKO przy dirtach (w fullach reguła „gruby RockShox = Pike DJ” by myliła).
// Treść uzgodniona z właścicielem (dokument „Ściąga: widelce w dirtach”, 11.2026). Przy dirtach analiza dostaje też od razu wszystkie zdjęcia.
export const DIRT_FORK_GUIDE = `=== WIDELEC W DIRCIE — JAK ROZPOZNAĆ (najważniejsze dla wyceny dirta) ===
Najpierw szukaj napisu z nazwą widelca (na goleni, mostku, koronie) i nazwy w opisie. Napis na zdjęciu wygrywa z opisem. Kolor lag sam niczego nie przesądza.

WYSOKA PÓŁKA (pasmo „Pike DJ / Bomber DJ”):
- RockShox Pike DJ: tylko 26", skok 100 mm, GRUBE lagi 35 mm (masywny na tle cienkiej ramy), zwykle czarne lagi; golenie czarne, matowe, srebrne, białe albo czerwone (czasem custom malowanie); napis „PIKE” / „PIKE DJ” (często mały albo zdrapany); sztywna oś 15 mm z dźwignią albo śrubą.
- Marzocchi Bomber DJ (od 2020): 26", 100 mm, lagi 36 mm, czarny albo czerwony, duże „DJ” i logo Marzocchi, oś 20 mm skręcana śrubami na końcówkach goleni, stożkowa rura sterowa.
- Fox 36 831 (rzadki): 26", ok. 100 mm, złote lagi Kashima, logo Fox, napis „831” / „36”, GRUBE lagi 36 mm, oś 15 mm. Wysoka półka TYLKO przy lagach 36 mm albo napisie „36” — sama Kashima + krótki skok nie wystarczy (patrz Fox 32 831 niżej).
- Manitou Circus Pro: tylko gdy napis „PRO” jest czytelny na zdjęciu albo podany w opisie; wygląda jak inne Circusy.
ŚREDNIA PÓŁKA (pasmo „słabszy widelec”):
- Manitou Circus Expert / Comp: lagi 32 mm (srebrne = Comp, czarne = Expert albo Pro); kolorowe litery „CIRCUS”; mostek (łuk goleni) z TYŁU widelca, od strony ramy — w innych widelcach jest z przodu; oś 20 mm, po dwie śruby na końcówce. Circus bez czytelnego „PRO” = to pasmo.
- X-Fusion Slant: lagi 34 mm, sprężyna powietrzna, napis „SLANT” / X-Fusion; seryjnie m.in. w nowszych NS (Metropolis).
- RockShox Argyle (ok. 2008–2013): lagi 32 mm srebrne, oś 20 mm, napis „ARGYLE”, błyszczące kolory.
- Fox 32 831 (starszy): cieńsze lagi 32 mm (często złote Kashima), napis „32” / „831” — pasmo „słabszy widelec”, nawet z Kashimą.
- stare Marzocchi Dirt Jumper 1/2/3 (sprzed ok. 2013): napisy „DIRT JUMPER” / „DJ 1-3”, często białe; DJ3 = szybkozamykacz 9 mm, najsłabszy. Napis „DJ” na Marzocchi to jeszcze nie nowy Bomber DJ.
SŁABE (pasmo „słabszy widelec”, bez dopłaty):
- RockShox Sektor, Recon, Judy, XC30/32 (widelce XC: cienkie lagi, często szybkozamykacz, długi skok). Złote albo szampańskie lagi RockShoxa to NIE Kashima — Kashima mają tylko Foxy z logo Fox.
- SR Suntour, RST, X-Fusion inne niż Slant (np. MIG), widelce bez nazwy.

REGUŁY:
- Sztywny widelec (bez amortyzacji: brak lag i goleni, równe nogi) = rower odrzucony, decyzja „nie”, w polu "widelec" wpisz "sztywny": true.
- Dirt z kołem 26" + RockShox z grubymi lagami ok. 35 mm, krótkim skokiem i osią 15 mm = Pike DJ ("zrodlo": "wyglad"), nawet bez napisu „DJ”. Cienkie lagi, oś 20 mm albo szybkozamykacz = NIE Pike DJ.
- Nie da się ustalić widelca = "model": "nieznany": wyceniaj w paśmie „słabszy widelec”. Widzisz tylko markę (np. RockShox bez nazwy modelu) — wpisz samą markę, np. "RockShox", i wyceniaj w paśmie „słabszy widelec”.
- Rocznik dirta: rocznik oszacowany (bez podanego w ogłoszeniu) NIE jest powodem do odrzucenia — wyceniaj dirta normalnie z pasma.
- Pole "widelec" w odpowiedzi: marka i model + źródło ("napis" na zdjęciu / "opis" / "wyglad" / "nieznany").`;
