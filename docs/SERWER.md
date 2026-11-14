# Wersja serwerowa — stan prac

Cel: skaner działa na VPS bez laptopa właściciela. Działający skaner to nadal `bikefinder-69` (karta Chrome + Vercel).

## Kierunek (decyzja właściciela, 14.11.2026): Chrome bez okna
Na serwerze działa **ta sama strona** co dziś (`public/index.html`, bez zmian w logice), otwarta w Chrome bez okna.
Przepisanie logiki do Node (pierwotny plan) jest odłożone — wrócimy do niego tylko, jeśli Chrome okaże się za ciężki
albo niestabilny.

```
Chrome bez okna ──► http://127.0.0.1:8787/            strona skanera (server/site.mjs)
   (server/runner.mjs)        /api/gemini|discord|scrape   te same funkcje co na Vercelu (core/providers)
                              /control/…                   polecenia z konsoli (server/cli.mjs)
```

- Pamięć skanera (`ddf_*`: ustawienia z kluczami, widziane ogłoszenia, kolejki) leży w profilu przeglądarki:
  `var/profile/` (katalog `var/` jest poza repo). Jest przypisana do adresu strony — **nie zmieniać portu** po starcie.
- Strony Kleinanzeigen, zdjęcia, AI i Discord są wołane z procesu serwera (nie z Chrome). Przełącznik pobierania stron:
  `direct` (serwer sam) / `vercel` (przez pośrednika na Vercelu — zapas przy blokadzie adresu serwera).
- Zamknięcie usługi nie klika „Stop”: po starcie skaner sam wznawia pracę (autostart), jak po odświeżeniu karty.
- Chrome jest zamykany i otwierany na nowo co 24 h (`DDF_RESTART_HOURS`), żeby nie puchł w pamięci.

## Uruchomienie ręczne (instalator i usługa systemd — w następnym kroku)
```
cd server && npm run setup          # playwright + Chromium (esbuild tylko dla trybu strony „compiled”)
node server/main.mjs                # usługa; ustawienia: DDF_PORT, DDF_DATA_DIR, DDF_PAGE, DDF_RESTART_HOURS
node server/cli.mjs status          # stan, kolejka, wydatki AI, ostatnie linie logu
node server/cli.mjs start | stop    # jak przyciski na stronie
node server/cli.mjs log 100
node server/cli.mjs export stan.json        # plik zawiera klucze API!
node server/cli.mjs import stan.json [--replace]   # tylko przy zatrzymanym skanerze; nie włącza autostartu
node server/cli.mjs scrape-mode vercel https://bikefinder-69.vercel.app/api/scrape
node server/cli.mjs scrape-mode direct
```
Tryb strony: `original` (domyślny) — `index.html` bez zmian, React i Babel z cdnjs jak u właściciela;
`compiled` — skompilowana zawczasu, bez internetu do wczytania strony (tak chodzą testy).

## Jak przenieść nowszą wersję z bikefinder-69
1. Skopiować `public/index.html`, `api/`, `tests/`, `docs/NOTATKI.md` z `bikefinder-69` (osobna gałąź + PR).
2. `node tools/sync-core.mjs` — odświeża kopie pośredników i moduły w `core/`.
3. `node tests/run-all.mjs`. Jeśli zmieniły się napisy przycisków Start/Stop albo zakładki „Skaner”, test
   `tests/server/t_server.mjs` to pokaże (serwer steruje stroną przez te przyciski).
4. Na serwerze: pobrać nową wersję i `node server/cli.mjs reload`.

## Zrobione
- **v7.0-alpha.1** — `core/`: 10 modułów bez przeglądarki, wydzielanych automatycznie z góry `index.html`
  (dziś niepotrzebne do działania w wariancie Chrome; zostają pod ewentualne przepisanie do Node).
- **v7.0-alpha.2** — `core/providers/`: pośrednicy AI, Discorda i pobierania stron bez Vercela + `apiFetch`
  z przełącznikiem `direct` / `vercel`.
- **v7.0-alpha.3** — `server/`: lokalna strona, Chrome bez okna, sterowanie z konsoli (status, start, stop, log,
  eksport i import pamięci, tryb pobierania, restart przeglądarki). Test: `tests/server/t_server.mjs`.

## Następne kroki
1. Instalacja na VPS jednym skryptem: użytkownik systemowy, Node, Chromium, usługa systemd z auto-restartem.
2. Strażnik: alert na kanał „problemy”, gdy skaner milczy ok. 15 min; dziennik skanera zapisywany do pliku.
3. Próba adresu serwera: jeden obieg wyszukiwań + kilka zdjęć z VPS, przy zatrzymanym skanerze na laptopie.
4. Przeniesienie pamięci z laptopa: eksport `ddf_*` z przeglądarki właściciela → `import` → `start`.
   NIGDY obie wersje naraz (podwójne alerty i koszty).
5. Podgląd dla właściciela (log i stan z hasłem). Zwykłe otwarcie adresu serwera w innej przeglądarce byłoby
   drugim, pustym skanerem — dlatego strona słucha tylko na 127.0.0.1.

## Znane ograniczenia i niewiadome
- Stabilność Chrome przez tygodnie jest niesprawdzona; zabezpieczenia: restart co 24 h, auto-restart po awarii.
- Tryb strony `original` nie był uruchamiany w testach (w środowisku testowym nie ma dostępu do cdnjs) —
  pierwsze sprawdzenie nastąpi na VPS. Testy chodzą w trybie `compiled` z Reactem 19 (plik `tests/react-shim.js`);
  strona u właściciela używa Reacta 18.2.
- Nagłe zabicie procesu (brak prądu, kill -9) może zgubić ostatnie sekundy zapisów w pamięci strony — jak przy
  nagłym zamknięciu laptopa.
- Limit pamięci strony (ok. 5 MB na adres) zostaje jak w przeglądarce właściciela.
- Zdjęcia ogłoszeń pobiera serwer, nie Vercel — nowe źródło zapytań do `img.kleinanzeigen.de` z adresu serwera.
- Funkcje nie mają limitu czasu Vercela; zostają limity z kodu (AI 180 s, strona 30 s po stronie skanera).
