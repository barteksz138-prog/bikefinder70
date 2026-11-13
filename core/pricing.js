// WYGENEROWANE przez tools/sync-core.mjs z public/index.html — NIE EDYTUJ RĘCZNIE.
// Zmiany wprowadzaj w public/index.html, potem uruchom: node tools/sync-core.mjs
// Dostawcy i modele AI, cennik tokenów, kursy walut.

export const PROVIDERS = {
  gemini: {
    label: "Gemini / Claude",
    models: [
      { id: "gemini-2.5-flash",      label: "Gemini 2.5 Flash (zalecany)" },
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite (najtańszy, domyślnie bez myślenia)" },
      { id: "gemini-flash-latest",   label: "Gemini 3.5 Flash (najnowszy, droższy)" },
      { id: "gemini-2.5-pro",        label: "Gemini 2.5 Pro" },
      { id: "claude-haiku-5-5",      label: "Claude Haiku 5.5 (Anthropic — tańszy, wymaga klucza Claude)" },
    ],
    keyPlaceholder: "AIza...",
    keyHint: "aistudio.google.com/apikey",
  },
  groq: {
    label: "Groq",
    models: [
      { id: "openai/gpt-oss-120b",      label: "GPT-OSS 120B (zalecany — tani, z rozumowaniem)" },
      { id: "openai/gpt-oss-20b",       label: "GPT-OSS 20B (tańszy, szybszy)" },
    ],
    keyPlaceholder: "gsk_...",
    keyHint: "console.groq.com/keys",
  },
};

// Groq wyłączył modele Llama 16.08.2026 (zapytania zwracają "model does not exist").
// Zapisane w ustawieniach stare ID zamieniamy na oficjalne zamienniki Groqa — inaczej dropdown
// POKAZYWAŁBY nowy model, a aplikacja dalej po cichu wysyłałaby martwy.
export const DEAD_GROQ_MODELS = {
  "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
  "llama-3.1-8b-instant":    "openai/gpt-oss-20b",
  "mixtral-8x7b-32768":      "openai/gpt-oss-120b",
};

// Kurs do przeliczania cen sprzedaży w PL (zł) na euro w prompcie Gemini. Wystarczy przybliżony —
// zaktualizuj, jeśli kurs mocno się zmieni (zmiana tej liczby = nowy cache promptu, to normalne).
export const EUR_PLN_RATE = 4.35;

// Kurs dolara — cennik Google jest w USD. Celowo lekko zawyżony (NBP 07.2026: ~3,79 zł),
// żeby licznik wydatków raczej zawyżał niż zaniżał koszty i budżet nie został przekroczony.
export const USD_PLN_RATE = 3.80;

// Cennik Gemini API (USD za 1 mln tokenów, prompty < 200 tys. tokenów), stan na 10.2026.
// "out" obejmuje tokeny myślenia, "cached" = odczyt z cache, "storage" = przechowanie cache przez godzinę.
// Służy tylko do licznika wydatków w aplikacji — źródłem prawdy jest rozliczenie w Google AI Studio.
export const GEMINI_PRICES = {
  "gemini-2.5-flash":      { in: 0.30, cached: 0.03,  out: 2.50,  storage: 1.00 },
  "gemini-2.5-flash-lite": { in: 0.10, cached: 0.01,  out: 0.40,  storage: 1.00 },
  "gemini-2.5-pro":        { in: 1.25, cached: 0.125, out: 10.00, storage: 4.50 },
  "gemini-flash-latest":   { in: 1.50, cached: 0.15,  out: 9.00,  storage: 1.00 },
  // Claude Haiku 5.5 (cennik Anthropic, 11.2026, prompty do 100 tys. tokenów): "write" = zapis do cache na 1 h.
  // Cache Claude nie ma opłaty za przechowywanie — płaci się tylko za zapis i odczyty.
  "claude-haiku-5-5":      { in: 0.10, cached: 0.01,  out: 0.50,  storage: 0, write: 0.20 },
  "claude-sonnet-5-5":     { in: 2.00, cached: 0.10,  out: 10.00, storage: 0, write: 4.00 },
};

export const GEMINI_PRICE_FALLBACK = { in: 2.00, cached: 0.20, out: 12.00, storage: 4.50 }; // nieznany model — liczymy jak najdroższy

export const isClaudeModel = (m) => /^claude-/i.test(m || "");

export const aiName = (m) => isClaudeModel(m) ? "Claude" : "Gemini";

// Mocniejszy model do decyzji, w których błąd kosztuje najwięcej: weryfikacja okazji i trudne przypadki.
// Domyślnie Gemini 2.5 Pro (jak dotąd); w Ustawieniach można wybrać tańszy model.
export const STRONG_GEMINI_MODEL = "gemini-2.5-pro";

export const STRONG_MODELS = [
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (Anthropic — mocny; cena podobna do Gemini 2.5 Pro)" },
  { id: "gemini-2.5-pro",    label: "Gemini 2.5 Pro (dotychczasowy)" },
  { id: "claude-haiku-5-5",  label: "Claude Haiku 5.5 (Anthropic — najtańszy)" },
  { id: "gemini-2.5-flash",  label: "Gemini 2.5 Flash (z myśleniem)" },
];
