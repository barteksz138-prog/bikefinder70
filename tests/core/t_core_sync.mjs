// Wersja serwerowa, krok 1: moduły core/ muszą być wierną kopią górnej części public/index.html.
// Sprawdza: (1) pliki w core/ są dokładnie tym, co wytwarza tools/sync-core.mjs, (2) każdy kawałek kodu
// występuje w index.html znak w znak, (3) żadna deklaracja z góry index.html nie została pominięta.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { buildCore, buildAll, buildCopies, copyHeader, diffCore, prefixLines, appScript, MODULES, COPIES } from "../../tools/sync-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8");
const { files, chunks } = buildCore(html);

// 1. core/ na dysku = wynik generatora (moduły z index.html + kopie pośredników z api/)
const all = buildAll().files;
assert.deepEqual(diffCore(all), [], "core/ nie zgadza się ze wzorcem — uruchom: node tools/sync-core.mjs");
console.log(`✅ core/ zgodne ze wzorcem (${Object.keys(files).length} plików z index.html + ${Object.keys(COPIES).length} z api/)`);
// kopie pośredników: po zdjęciu nagłówka plik jest identyczny z api/*.js co do znaku
for (const [file, c] of Object.entries(COPIES)) {
  const copy = fs.readFileSync(path.join(ROOT, "core", file), "utf8");
  assert.ok(copy.startsWith(copyHeader(c)), `core/${file}: brak nagłówka pliku generowanego`);
  assert.equal(copy.slice(copyHeader(c).length), fs.readFileSync(path.join(ROOT, c.from), "utf8"), `core/${file} różni się od ${c.from}`);
}
assert.notEqual(buildCopies((rel) => "zmienione")["providers/discord.js"], all["providers/discord.js"]);
console.log(`✅ ${Object.keys(COPIES).length} pośredników skopiowanych z api/ bez zmian`);

// 2. każdy kawałek kodu jest w index.html znak w znak, a w pliku core/ różni się tylko słowem „export”
const script = appScript(html);
for (const c of chunks) {
  assert.ok(script.includes(c.code), `kod „${c.name}” nie występuje dosłownie w index.html`);
  assert.ok(files[c.file].includes("export " + c.code), `kod „${c.name}” w core/${c.file} różni się od index.html`);
}
console.log(`✅ ${chunks.length} deklaracji przeniesionych znak w znak`);

// 3. nic nie zostało pominięte: każda nazwana deklaracja z kolumny 0 (przed interfejsem) ma swój plik
const declared = prefixLines(html).map(l => l.match(/^(?:const|let|var|function|async function)\s+([A-Za-z_$][\w$]*)/)?.[1]).filter(Boolean);
const assigned = new Set(Object.values(MODULES).flatMap(m => m.names));
assert.deepEqual(declared.filter(n => !assigned.has(n)), [], "deklaracje bez przypisanego pliku w tools/sync-core.mjs");
assert.equal(declared.length, assigned.size, "liczba deklaracji na górze index.html ≠ liczba wpisów w MODULES");
// linie kodu z kolumny 0, które nie są deklaracją ani jej dalszym ciągiem, oznaczałyby kod wykonywany „luzem” — nie przenosimy go po cichu
const loose = prefixLines(html).filter(l => /^(if|for|while|try|switch|[A-Za-z_$][\w$.]*\s*(\(|=[^=>]))/.test(l) && !/^(const|let|var|function|async function)\s/.test(l));
const looseOutsideTemplates = loose.filter(l => !chunks.some(c => c.code.includes("`") && c.code.includes(l)));
assert.deepEqual(looseOutsideTemplates, [], "kod wykonywany poza deklaracjami na górze index.html — wymaga ręcznego przeniesienia");
console.log(`✅ komplet: ${declared.length} deklaracji z góry index.html ma swój plik w core/`);

// 4. generator zgłasza zmianę: nowa stała w index.html bez wpisu w MODULES to błąd z nazwą stałej
assert.throws(() => buildCore(html.replace("\nconst SC = {", "\nconst NOWA_STALA_TESTOWA = 1;\n\nconst SC = {")), /NOWA_STALA_TESTOWA/);
// …a zmiana w istniejącym kodzie daje inny plik (czyli --check i punkt 1 ją wykryją)
const changed = buildCore(html.replace("const SEARCH_GAP_MS = 6000;", "const SEARCH_GAP_MS = 6001;"));
assert.notEqual(changed.files["constants.js"], files["constants.js"]);
console.log("✅ zmiana na górze index.html jest wykrywana");

console.log("CORE SYNC TESTS OK");
