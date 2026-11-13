// Wersja serwerowa, krok 1: moduły core/ muszą być wierną kopią górnej części public/index.html.
// Sprawdza: (1) pliki w core/ są dokładnie tym, co wytwarza tools/sync-core.mjs, (2) każdy kawałek kodu
// występuje w index.html znak w znak, (3) żadna deklaracja z góry index.html nie została pominięta.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { buildCore, diffCore, prefixLines, appScript, MODULES } from "../../tools/sync-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8");
const { files, chunks } = buildCore(html);

// 1. core/ na dysku = wynik generatora
assert.deepEqual(diffCore(files), [], "core/ nie zgadza się z public/index.html — uruchom: node tools/sync-core.mjs");
console.log(`✅ core/ zgodne z public/index.html (${Object.keys(files).length} plików)`);

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
