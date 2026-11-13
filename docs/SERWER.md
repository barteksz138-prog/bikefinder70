# Wersja serwerowa — stan prac

Cel: skaner jako stały proces na VPS (bez karty Chrome i bez laptopa właściciela). Plan: dokument
„DirtDealFinder: plan przebudowy na wersję serwerową (VPS)”. Działający skaner to nadal `bikefinder-69`.

## Zasada na czas przebudowy
- `public/index.html`, `api/` i testy przeglądarkowe to **wzorzec** (kopia `bikefinder-69`, dziś v6.5). Nie zmieniamy ich tutaj.
- Nowy kod powstaje w `core/` (silnik), później `server/` (usługa, baza, sterowanie) i `deploy/` (instalacja).
- Każdy krok ma test, który porównuje nowy kod ze wzorcem.

## Jak przenieść nowszą wersję z bikefinder-69
1. Skopiować `public/index.html`, `api/`, `tests/`, `docs/NOTATKI.md` z `bikefinder-69` (osobna gałąź + PR).
2. `node tools/sync-core.mjs` — odświeża pliki `core/` wydzielane automatycznie.
3. `node tests/run-all.mjs` — jeśli na górze `index.html` doszła nowa stała albo funkcja, test powie, gdzie ją dopisać
   (`MODULES` w `tools/sync-core.mjs`, dane w `tests/core/t_core_parity.mjs`).
4. Części przenoszone ręcznie (kolejne kroki) — porównać z listą zmian danej wersji.

## Zrobione
- **v7.0-alpha.1** — `core/`: 10 modułów bez zależności od przeglądarki (stałe, lista wyszukiwań, baza cen i dobór wpisów,
  modele i cennik AI, funkcje tekstowe, data z karty, widelec, materiał ramy, zapis okazji). Powstają automatycznie
  z góry `index.html` (117 deklaracji, znak w znak). Testy: `tests/core/t_core_sync.mjs` (zgodność tekstu),
  `tests/core/t_core_parity.mjs` (te same wyniki co kod strony).

## Następne kroki
1. Parser stron (wyniki, strona ogłoszenia) bez przeglądarki + test porównawczy z Chrome.
2. Pośrednicy z `api/*.js` jako zwykłe funkcje (AI, zdjęcia, Discord, pobieranie stron: bezpośrednio / przez Vercel).
3. Logika z `App()`: filtry, Groq, analiza AI, kolejki, wysyłka, pętla zbierania i wykonawca AI, nocne sprawdzanie cen.
4. Usługa na serwerze: SQLite, `.env`, sterowanie z konsoli, strażnik, instalacja.
5. Eksport stanu ze starej strony, import, przełączenie.
