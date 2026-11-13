// WYGENEROWANE przez tools/sync-core.mjs z public/index.html — NIE EDYTUJ RĘCZNIE.
// Zmiany wprowadzaj w public/index.html, potem uruchom: node tools/sync-core.mjs
// Stałe skanera: limity kolejek, czasy, odstępy zapytań, przedziały progu zysku.

// ── Kolejka ofert i powiadomień (v5.6) ────────────────────────────────────────────────
// Oferta jest "załatwiona" dopiero po analizie albo po trwałym odrzuceniu z konkretnym powodem,
// a okazja — po potwierdzonej wysyłce na Discord. Do tego czasu czeka w kolejce zapisanej
// w przeglądarce, więc limit analiz na cykl, błąd AI, STOP ani zamknięcie karty jej nie gubią.
export const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;   // po przerwie dłuższej niż 24 h analizujemy tylko oferty z ostatnich 24 h

export const PENDING_MAX = 300;                          // maks. ofert w kolejce

export const PENDING_MAX_AGE_MS = 48 * 60 * 60 * 1000;   // starsze oferty wypadają z kolejki (pewnie już nieaktualne)

export const MAX_ANALYSIS_ATTEMPTS = 3;                  // po tylu nieudanych analizach oferta trafia do "niepewnych"

export const OUTBOX_MAX = 200;                           // maks. powiadomień czekających na wysyłkę

export const OUTBOX_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const TRANSPORT_DEFAULT_EUR = 70;                 // koszt sprowadzenia roweru do PL — odejmowany od zysku

export const AI_FETCH_TIMEOUT_MS = 180000;               // limit czasu jednego zapytania AI (myślenie modeli Pro bywa długie)

export const SCRAPE_TIMEOUT_MS = 30000;

export const DISCORD_TIMEOUT_MS = 20000;

export const ECO_FROM_BUDGET_SHARE = 0.85;               // od 85% budżetu — tryb oszczędny; od 100% — analizy wstrzymane

// ── v5.11 ──
export const MIN_LISTING_PRICE_DEFAULT = 200;            // tańsze ogłoszenia odpadają bez AI (symboliczne ceny, części, "1 €")

export const SEEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;     // ogłoszenie niewidziane w wynikach przez 30 dni wypada z pamięci

// v6: minimalny zysk (%) zależny od ceny zakupu — przedziały ceny ogłoszenia (od, do; „do” nie wlicza się)
export const PROFIT_TIERS = [{ from: 200, to: 450 }, { from: 450, to: 800 }, { from: 800, to: 1100 }, { from: 1100, to: 1400 }];

export const tierIndexFor = (price) => { const p = Number(price); if (!Number.isFinite(p)) return 0; let i = 0; while (i < PROFIT_TIERS.length - 1 && p >= PROFIT_TIERS[i].to) i++; return i; };

export const AI_FAIL_PAUSE_MS = 10 * 60 * 1000;          // v5.14: przerwa w analizach AI po 2 nieudanych pod rząd

export const DUPE_TTL_MS = 3 * 24 * 60 * 60 * 1000;      // v6.1: indeks przeanalizowanych ogłoszeń do wykrywania duplikatów (ten sam rower pod innym numerem)

export const DUPE_MAX = 600;

export const RESULTS_MAX = 200;                          // v5.14: tyle ostatnich wyników trzymamy w localStorage (ddf_results)

export const STATUS_NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000; // ten sam problem zgłaszamy na Discord najwyżej co 6 h

export const SCRAPE_BLOCK_PAUSE_MS = 20 * 60 * 1000;     // 2 zablokowane wyszukiwania pod rząd → 20 min przerwy w odpytywaniu Kleinanzeigen

export const OUTBOX_REFRESH_MIN_GAP_MS = 5 * 60 * 1000;  // zaległą okazję sprawdzamy na stronie ogłoszenia najwyżej co 5 min

export const RARE_SEARCH_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // wyszukiwanie bez nowych ofert od 3 dni = "rzadkie"…

export const RARE_SEARCH_RESCAN_MS = 10 * 60 * 1000;     // …sprawdzane co ok. 10 min zamiast w każdym cyklu (popularne częściej)

export const NEAR_DEAL_MAX_DROP = 0.20;                  // v5.12 "na granicy": cena musi spaść NAJWYŻEJ o 20%, żeby zakup się opłacał

export const NEAR_DEAL_OFFER_SHARE = 0.88;               // propozycja dla sprzedawcy: ok. 12% poniżej kwoty „opłaca się do”, w dół do 10 €

// v5.12: wersja linków wyszukiwań. Po zmianie filtra (np. dodany typ E-Bike) nowo widoczne STARE oferty nie są
// "nowe" — przy pierwszym skanie po zmianie analizujemy tylko te z ostatnich 24 h (jak po długiej przerwie).
export const SEARCH_URL_VERSION = 4;                     // v6.3: zakres cen (preis:min:max) w linkach wyszukiwań modeli/marek; v6.4: „tylko oferty” + górna cena w linkach kategorii

export const KA_MIN_GAP_MS = 4000;                       // v6.3: min. odstęp między DOWOLNYMI zapytaniami do Kleinanzeigen (+ losowo do 2 s) — wyszukiwania i strony ogłoszeń idą równolegle

export const JOB_AGING_MS = 15 * 60 * 1000;

export const EMPTY_SUSPICIOUS_MIN_CARDS = 5;

export const NIGHT_BATCH = 60;                           // v6.4: nocne sprawdzanie cen — tyle stron ogłoszeń na cykl (ok. 5 min przy odstępie 4–6 s)

export const NIGHT_WINDOW_H = 5;                         // v6.4: okno nocnego sprawdzania (od godziny z Ustawień)

export const NIGHT_SKIP_SEEN_MS = 12 * 60 * 60 * 1000;   // v6.4: widziane w wynikach w ostatnich 12 h — zmianę ceny skaner i tak zauważy

export const SEEN_HARD_REJ = new Set(["stary", "inny", "slowa", "czesc", "ebike", "sklep"]); // v6.4: odrzucone na stałe — obniżka nic nie zmienia             // v6.3: pusta lista tam, gdzie ostatnio było ≥ 5 ogłoszeń = podejrzana (powtórka na końcu cyklu)              // v6.3: oferta czekająca dłużej w kolejce wyprzedza nowsze (najstarsze najpierw)

export const SEARCH_GAP_MS = 6000;                       // v5.12: odstęp między wyszukiwaniami (+ losowo do 1,5 s); w v5.11 było 3 s — za szybko (blokady)

export const EVENTS_MAX = 300;                           // dziennik ważnych zdarzeń (Status → Dziennik) — trwały, przeżywa odświeżenie

// Ważne zdarzenia do dziennika (oprócz wszystkich błędów): start/stop, wysłane alerty, blokady, budżet, autostart
export const EVENT_RE = /^(🚀|⏹|⛔|📨 Wysłano|🤏 Wysłano|❓ Zaległa|🔁|💰 .*wyczerp|🏷️ Wersja)/;

// Gdy rocznik jest nieznany (a w ogłoszeniach zwykle go nie ma): łagodny limit jak dla roweru ok. 2-letniego.
// Odcina tylko rażące zakotwiczenie na cenie nowego, nie blokuje okazji bez podanego rocznika.
export const UNKNOWN_YEAR_CAP = 0.65;

// Znacznik wersji — widoczny w nagłówku i w logu startu, żeby łatwo sprawdzić co działa na Vercelu.
export const APP_VERSION = "v6.5 (2026-11-13)";

// ── Analiza zdjęć ──
// Pierwsza analiza każdego ogłoszenia: 4 pierwsze zdjęcia. Dokładniejsza analiza "niepewnego" ogłoszenia
// i weryfikacja okazji: WSZYSTKIE zdjęcia z galerii (do 20). Serwer (api/gemini.js) sam pobiera je z img.kleinanzeigen.de.
export const MAX_PHOTOS_PER_CALL = 4;

export const MAX_PHOTOS_ALL = 20;     // górny limit "wszystkich zdjęć" (Claude przyjmuje do 20 zdjęć bez dodatkowych ograniczeń rozmiaru)

export const DETAILS_WAIT_MAX_MS = 2 * 60 * 60 * 1000;  // ile czekać na pełny opis (blokada / błąd strony), zanim ocenimy z fragmentu

export const DETAILS_MAX_AGE_MS = 30 * 60 * 1000;      // oferta czekająca dłużej niż 30 min: przed analizą/wysyłką pobieramy stronę ponownie (cena, dostępność)

export const RESUME_MAX_UNDATED = 5;  // po długiej przerwie: ile ofert BEZ daty na wyszukiwanie mimo to analizujemy

export const WEAK_DESC_CHARS = 250;   // krótszy opis (bez tytułu) = słaby — zdjęcia już w pierwszej analizie

export const WEAK_DESC_RE = /siehe\s+(bilder|fotos?)|(details|infos?|mehr)\s+(auf|siehe)\s+(den\s+)?(bildern|fotos)|see\s+(pictures|photos)|wie\s+auf\s+(den\s+)?(bildern|fotos)/i;
