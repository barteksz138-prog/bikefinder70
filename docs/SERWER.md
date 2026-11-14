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
- **v7.0-alpha.2** — pośrednicy bez Vercela: `core/providers/ai.js`, `discord.js`, `scrape.js` to kopie `api/*.js`
  (też odświeżane przez `tools/sync-core.mjs`). `core/providers/api.js` daje silnikowi `apiFetch` — zamiennik
  `fetch("/api/…")`, który woła te funkcje w tym samym procesie (klucze nie wychodzą poza serwer) i ma przełącznik
  pobierania stron: `direct` (serwer pobiera sam) albo `vercel` (jak dziś, przez pośrednika — zapas przy blokadzie adresu).
  Test: `tests/core/t_core_api.mjs` (dotychczasowe testy pośredników na kopiach + porównanie z prawdziwym zapytaniem HTTP).

## Następne kroki
1. Logika z `App()`, przenoszona ręcznie z testami: filtry i Groq (etap 1), analiza AI (etap 2), pamięć ogłoszeń,
   kolejki i duplikaty, wysyłka na Discorda, pętla zbierania i wykonawca AI, nocne sprawdzanie cen.
2. Parser stron (wyniki, strona ogłoszenia) bez przeglądarki + test porównawczy z Chrome. Wymaga biblioteki `linkedom`
   (albo `jsdom`) — do zainstalowania przy dostępie do sieci.
3. Usługa na serwerze: SQLite, `.env`, sterowanie z konsoli, strażnik, instalacja.
4. Eksport stanu ze starej strony, import, przełączenie.

## Różnice względem Vercela, o których trzeba pamiętać
- Funkcja na Vercelu ma własny limit czasu działania; na serwerze go nie ma — zostają limity z kodu
  (AI 180 s po stronie silnika, pobieranie strony 20 s, zdjęcie 8 s, Discord 15 s).
- Zdjęcia ogłoszeń pobiera teraz serwer (dziś Vercel). W trybie `vercel` przez pośrednika idą tylko strony HTML.
- Cache zdjęć (10 min) żyje w pamięci procesu — na serwerze jest stały, na Vercelu bywał gubiony między wywołaniami.
