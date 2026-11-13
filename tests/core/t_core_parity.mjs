// Wersja serwerowa, krok 1: moduły core/ muszą DZIAŁAĆ tak samo jak kod w public/index.html.
// Wzorzec = górna część skryptu ze strony uruchomiona tak, jak w przeglądarce (jeden wspólny zakres).
// Moduły core/ są wczytywane osobno (import), więc brakujący import albo pętla importów wyjdzie tutaj.
// Każda funkcja jest wywoływana w obu wersjach na tych samych danych; każda stała jest porównywana.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { buildCore, prefixLines, MODULES } from "../../tools/sync-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8");
const names = Object.values(MODULES).flatMap(m => m.names);

// Stały zegar: fmtAgo i parseCardDate liczą względem „teraz” — obie wersje muszą widzieć tę samą chwilę.
const FIXED = new Date(2026, 10, 13, 15, 30, 0).getTime();
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(FIXED); }
  static now() { return FIXED; }
};

// Wzorzec: kod ze strony w jednym zakresie (React jest tam potrzebny tylko do pierwszej linii z hookami)
const ref = new Function("React", `${prefixLines(html).join("\n")}\nreturn { ${names.join(", ")} };`)({});

// core/: każdy moduł wczytany przez import
const core = {};
for (const file of Object.keys(buildCore(html).files)) {
  const mod = await import(pathToFileURL(path.join(ROOT, "core", file)).href);
  for (const n of MODULES[file].names) {
    assert.ok(n in mod, `core/${file} nie eksportuje „${n}”`);
    core[n] = mod[n];
  }
}
console.log(`✅ ${Object.keys(MODULES).length} modułów core/ wczytuje się bez błędów (bez pętli importów)`);

// Sprowadza wartość do postaci porównywalnej (wyrażenia regularne, zbiory i mapy też)
const norm = (v, depth = 0) => {
  if (depth > 12) return "…";
  if (v instanceof RegExp) return { __re: v.source, flags: v.flags };
  if (v instanceof Set) return { __set: [...v].map(x => norm(x, depth + 1)) };
  if (v instanceof Map) return { __map: [...v].map(([k, x]) => [norm(k, depth + 1), norm(x, depth + 1)]) };
  if (typeof v === "function") return { __fn: v.toString() };
  if (Array.isArray(v)) return v.map(x => norm(x, depth + 1));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x, depth + 1)]));
  return v === undefined ? "__undefined" : v;
};

// Atrapa karty ogłoszenia dla parseCardDate (tylko to, czego funkcja używa)
const card = (texts, datetime) => ({
  querySelectorAll: () => texts.map(t => ({ closest: () => null, textContent: t })),
  querySelector: () => datetime ? { getAttribute: () => datetime } : null,
});
const forks = [
  { model: "RockShox Pike DJ", zrodlo: "napis" }, { model: "Fox" }, { model: "nieznany" }, null,
  { model: "X-Fusion (wersja nieczytelna)", zrodlo: "wyglad", sztywny: false }, { sztywny: true },
  { model: "Manitou Circus Expert", zrodlo: "wyglad" }, { model: "RockShox (model nieznany)", zrodlo: "opis" }, { model: "Marzocchi Bomber DJ", zrodlo: "cos_innego" },
];
const framesAi = [
  { material: "karbon", zrodlo: "wyglad", dowod: "brak spoin przy suporcie", sprzedaz_alu_eur: "1200,5" },
  { material: "karbon", zrodlo: "napis", dowod: "napis CF na rurze", sprzedaz_alu_eur: 1300 },
  { material: "alu", zrodlo: "napis", dowod: "AL na ramie" }, { material: "nie_wiem" }, { material: "tytan", zrodlo: "x", dowod: "brak" }, null,
];
const frameTexts = [
  ["YT Capra AL Core 2", "Verkaufe mein Capra, Carbon Lenker, top Zustand"], ["Canyon Spectral CF 8", "Rahmen aus Carbon"],
  ["Santa Cruz Nomad CC", ""], ["Santa Cruz Bronson A", "Alu-Hinterbau"], ["Giant Reign Advanced 1", ""], ["Trek Slash 8", "Alpha Platinum Aluminium Rahmen"],
  ["Cube Stereo 150 C:62 Race", "HPC"], ["Specialized Enduro", "Carbonräder, Kurbel aus Carbon"], ["Propain Tyee Carbon Alu", "al"], ["Radon Swoop", "Der Rahmen ist AL, Hinterbau Carbon"], ["", ""],
];

// Dane wejściowe dla KAŻDEJ funkcji. Wartość może być funkcją (api) → lista zestawów argumentów, gdy dane zależą od innych funkcji.
const CASES = {
  tierIndexFor: [[199], [200], [449], [450], [799.99], [800], [1100], [1400], [5000], ["abc"], [null], [undefined]],
  selectKbChunkIds: [
    [["Canyon Torque CF 8", "Canyon Torque", "Verkaufe mein Torque"], "full"], [["Specialized P3 Dirt Jump"], "dirt"], [["NS Metropolis", "Dirt"], "niepewne"],
    [["Cube Stereo Hybrid 140 HPC", "Cube Stereo"], "elektryk_gorski"], [["Specialized Turbo Levo Comp"], "full"], [["Haibike AllMtn 7"], "elektryk_gorski"],
    [["Fahrrad zu verkaufen", "YT Capra", "schönes Rad von YT"], "full"], [["Fahrrad", "", "Santa Cruz Bronson in L"], null], [["nieznana marka"], "inny"], [[], undefined], ["Trek Slash 9.8", null],
  ],
  kbChunksText: (api) => [[[]], [api.selectKbChunkIds(["Canyon Torque"], "full")], [api.selectKbChunkIds(["Specialized P3"], "dirt")], [api.selectKbChunkIds(["Cube Stereo Hybrid"], "elektryk_gorski")]],
  kbChunkNames: (api) => [[[]], [api.selectKbChunkIds(["Canyon Torque"], "full")], [api.selectKbChunkIds(["Trek Rail 9.8"], "elektryk_gorski")]],
  isKbDuplicate: (api) => [[""], [null], ["Canyon Spectral 2019 sprzedany za 6500 zł"], ["BAZA CEN — ab"], ["BAZA CEN — coś zupełnie innego (11.2026)"],
    ...api.KB.entryNames.slice(0, 6).map(n => [`BAZA CEN — ${n} — 07.2026\nstara treść`])],
  isClaudeModel: [["claude-haiku-5-5"], ["Claude-Sonnet-5-5"], ["gemini-2.5-pro"], ["openai/gpt-oss-120b"], [null], [undefined]],
  aiName: [["claude-haiku-5-5"], ["gemini-2.5-flash"], [null]],
  fmtYear: [[{ rocznik: 2019, rocznik_zrodlo: "podany" }], [{ rocznik: 2014, rocznik_zrodlo: "oszacowany", rocznik_zakres: "2012–2016" }], [{ rocznik: 2018, rocznik_zrodlo: "oszacowany" }], [{}], [null]],
  listingIdFromHref: [["/s-anzeige/canyon-torque-cf-8/3012345678-217-1234"], ["https://www.kleinanzeigen.de/s-anzeige/x/123456-217-99?utm=1"], ["/s-anzeige/x/12345-217-99"], ["/s-anzeige/x"], [null], [""]],
  fmtAgo: [[FIXED], [FIXED - 5 * 60000], [FIXED - 59 * 60000], [FIXED - 60 * 60000], [FIXED - 47 * 3600000], [FIXED - 5 * 86400000], [FIXED + 60000], [NaN], [null], [undefined]],
  numberContext: [["Gabel Baujahr 2015, Rahmen Modelljahr 2020", 14], ["Gabel Baujahr 2015, Rahmen Modelljahr 2020", 37], ["Baujahr 2019", 8], ["Fox 36 Gabel\nFahrrad von 2021", 25], ["Laufradsatz 2022 neu, Bike 2018", 12], ["", 0]],
  escapeRe: [["a.b*c(d)[e]{f}|g\\h^$+?"], ["zwykłe słowo"], [""]],
  keywordRe: [["laufrad"], ["nur rahmen"], ["e-bike"], ["c++"], ["laufrad"]],
  parseCardDate: [
    [card(["51570 Windeck", "Heute, 14:22"]), null], [card(["Gestern, 09:10"]), null], [card(["Heute"]), null], [card(["Gestern"]), null], [card(["heute, 7:05 Uhr"]), null],
    [card(["07.11.2026"]), null], [card(["1.2.2025"]), null], [card(["vor 5 Minuten"]), null], [card(["vor 1 Stunde"]), null], [card(["vor 3 Tagen"]), null],
    [card(["Versand möglich", "bardzo długi tekst, który na pewno nie jest datą dodania ogłoszenia"], "2026-11-10T08:00:00+01:00"), null],
    [card([]), { datePosted: "2026-11-01" }], [card(["Direkt kaufen"]), null], [card([""], "nie-data"), {}],
  ],
  repairJsonText: [
    ['{\n  "tytul": "Trek Slash 7 27,5" Laufräder",\n  "zysk": 100\n}'], ['{\n  "a": "Rahmen 29"",\n  "b": 2\n}'], ['{\n  "a": "x"\n  "b": [1, 2,],\n}'],
    ['{"a": "linia1\nlinia2", "b": true}'], ['{\n  "a": 5\n  "b": {"c": "d"}\n  "e": null\n}'], ['{"ok": "z \\"cytatem\\"", "n": 1}'], ['{"t": "tab\ti\r\nnowa"}'], [""],
  ],
  fmtDuration: [[0], [499], [5000], [59500], [65000], [600000], [3723000]],
  normalizeFork: forks.map(f => [f]).concat([["Pike"], [{ model: "  " }], [{ model: "x".repeat(100), zrodlo: "opis" }]]),
  forkNeedsCheck: (api) => [...forks.map(f => [api.normalizeFork(f)]), [null]],
  fmtFork: (api) => [...forks.map(f => [api.normalizeFork(f)]), [null]],
  forkField: (api) => [...forks.map(f => [{ typ_roweru: "dirt", widelec: api.normalizeFork(f) }]), ...forks.map(f => [{ typ_roweru: "full", widelec: api.normalizeFork(f) }]), [{}], [null]],
  frameTokens: [...frameTexts.flatMap(([t, d]) => [[t, true], [d, false], [t, false]]), [null, true], [undefined, false]],
  frameVerdict: [[{ carbon: ["CF"], alu: [] }], [{ carbon: [], alu: ["AL"] }], [{ carbon: ["Carbon"], alu: ["Alu"] }], [{ carbon: [], alu: [] }]],
  detectFrameMaterialText: [...frameTexts, [null, null], ["Capra Al", undefined]],
  normalizeFrame: [...framesAi.map(f => [f]), ["karbon"], [{ material: "alu", sprzedaz_alu_eur: -5 }], [{ material: "karbon", sprzedaz_alu_eur: "abc", dowod: "  " }], [{ material: "karbon", dowod: "d".repeat(300) }]],
  resolveFrameMaterial: (api) => frameTexts.flatMap(([t, d]) => framesAi.flatMap(f => [1500, 0, null].map(sale => [api.detectFrameMaterialText(t, d), api.normalizeFrame(f), sale]))),
  fmtFrame: [[{ material: "karbon", zrodlo: "wyglad", possibleCarbon: true, dowod: "brak spoin" }], [{ material: "alu", zrodlo: "tekst" }], [{ material: "nie_wiem", zrodlo: "nieznany" }], [{ material: "karbon", zrodlo: "inne" }], [{ zrodlo: "napis" }], [null]],
  frameField: [[{ typ_roweru: "full", rama: { material: "karbon", zrodlo: "napis", dowod: "CF" } }], [{ typ_roweru: "dirt", rama: { material: "alu", zrodlo: "tekst" } }], [{ typ_roweru: "full", rama: { material: null } }], [{}], [null]],
  dealSnapshot: [
    [{ typ_roweru: "full", fakty: { rocznik: 2020, rocznik_zrodlo: "podany" }, przewidywany_zysk: 300, krotki_opis: "opis", cena_zakupu_eur: 900, szacowana_sprzedaz_eur: 1270, transport_eur: 70, niepotrzebne: 1, widelec: { model: "Fox 36" }, rama: { material: "alu" } }],
    [{ typ_roweru: "dirt", przewidywany_zysk: 100, krotki_opis: "x" }],
  ],
  slimListing: [
    [{ listingId: "1", title: "t", href: "h", images: ["a", "b"], fullDesc: "pomijane" }], [{ listingId: "2", title: "t", price: 500, href: "h", photo: "p", desc: "d", location: "Berlin", bike: "YT Capra", postedAt: 5, prevPrice: 600 }],
    [{ listingId: "3", title: "t", href: "h", price: 0, images: [] }],
  ],
  ageCapFactor: [[-1], [0], [1], [2], [3], [4], [5], [6], [7], [8], [20], [2.5]],
};

// Stałe (wszystko, co nie jest funkcją) — przed wywołaniami, bo keywordReCache zapełnia się w trakcie
let consts = 0;
for (const n of names) {
  if (typeof ref[n] === "function") continue;
  assert.deepEqual(norm(core[n]), norm(ref[n]), `stała „${n}” w core/ różni się od index.html`);
  consts++;
}
console.log(`✅ ${consts} stałych w core/ ma te same wartości co na stronie`);

// Funkcje: te same dane → ten sam wynik (albo ten sam błąd)
const run = (fn, args) => { try { return { ok: norm(fn(...args)) }; } catch (e) { return { err: `${e.name}: ${e.message}` }; } };
let fns = 0, calls = 0;
for (const n of names) {
  if (typeof ref[n] !== "function") continue;
  assert.equal(typeof core[n], "function", `„${n}” w core/ nie jest funkcją`);
  assert.ok(CASES[n], `brak danych testowych dla funkcji „${n}” — dopisz je do CASES w tests/core/t_core_parity.mjs`);
  const refArgs = typeof CASES[n] === "function" ? CASES[n](ref) : CASES[n];
  const coreArgs = typeof CASES[n] === "function" ? CASES[n](core) : CASES[n];
  assert.ok(refArgs.length > 0, `pusta lista danych dla „${n}”`);
  assert.deepEqual(norm(coreArgs), norm(refArgs), `dane wejściowe „${n}” (zbudowane innymi funkcjami) różnią się między wersjami`);
  refArgs.forEach((args, i) => {
    const a = run(ref[n], args), b = run(core[n], coreArgs[i]);
    assert.ok(!/ReferenceError/.test(b.err || ""), `„${n}” w core/ odwołuje się do czegoś, czego moduł nie importuje: ${b.err}`);
    assert.deepEqual(b, a, `„${n}” daje inny wynik w core/ niż na stronie (zestaw ${i + 1}: ${JSON.stringify(args)?.slice(0, 200)})`);
    calls++;
  });
  fns++;
}
assert.deepEqual(Object.keys(CASES).filter(n => typeof ref[n] !== "function"), [], "CASES zawiera funkcje, których nie ma już na stronie");
console.log(`✅ ${fns} funkcji, ${calls} wywołań: wyniki w core/ identyczne jak na stronie`);

// Kilka wyników sprawdzonych wprost (żeby test nie porównywał tylko „błędu z błędem”)
assert.equal(core.listingIdFromHref("/s-anzeige/canyon-torque-cf-8/3012345678-217-1234"), "3012345678");
assert.equal(core.tierIndexFor(450), 1);
assert.equal(core.tierIndexFor(1400), 3);
assert.equal(core.ageCapFactor(2), 0.65);
assert.equal(core.detectFrameMaterialText("YT Capra AL Core 2", "Carbon Lenker").material, "alu");
assert.deepEqual(core.selectKbChunkIds(["Specialized P3 Dirt Jump"], "dirt"), ["dirt"]);
assert.equal(JSON.parse(core.repairJsonText('{\n  "a": "Rahmen 29"",\n  "b": 2\n}')).a, 'Rahmen 29"');
assert.ok(core.keywordRe("laufrad").test("Verkaufe Laufrad") && !core.keywordRe("laufrad").test("Laufradsatz neu"));
assert.equal(new RealDate(core.parseCardDate(card(["Heute, 14:22"]), null)).getHours(), 14);
const failed = Object.entries(CASES).flatMap(([n, c]) => (typeof c === "function" ? c(core) : c).map(args => run(core[n], args)).filter(r => r.err).map(r => `${n}: ${r.err}`));
console.log(`✅ wyniki kontrolne zgodne z oczekiwanymi${failed.length ? ` (wywołań kończących się błędem w obu wersjach: ${failed.length})` : ""}`);
if (failed.length) for (const f of [...new Set(failed)]) console.log("   ℹ️ " + f);

globalThis.Date = RealDate;
console.log("CORE PARITY TESTS OK");
