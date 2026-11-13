// WYGENEROWANE przez tools/sync-core.mjs z public/index.html — NIE EDYTUJ RĘCZNIE.
// Zmiany wprowadzaj w public/index.html, potem uruchom: node tools/sync-core.mjs
// Lista wyszukiwań (modele i marki) oraz wzorce rozpoznające znane modele i części w tytule.

// Typy wpisów:
//   isCategory: true  → categoryUrl to gotowy URL Kleinanzeigen (np. z filtrem ceny "preis:250:"); od v6.4 program dokłada „anzeige:angebote” i górną cenę z Ustawień
//   (brak)            → query to fraza wyszukiwana w /s-fahrraeder/{query}/k0c217
//
// Lista modeli ZAMIAST całej kategorii "Mountain Bike" — celowo węższe wyszukiwanie po
// konkretnych, znanych modelach (z cennika referencyjnego i wiedzy Groqa o pełnych zawieszeniach)
// zamiast łapania WSZYSTKIEGO z zakresu cenowego. To bezpośrednio zmniejsza wolumen ogłoszeń
// lecących przez Groq/Gemini (mniej = taniej i mniej przeciążeń), kosztem tego że model spoza
// tej listy nie zostanie znaleziony. Możesz dowolnie włączać/wyłączać pojedyncze modele checkboxem
// w Ustawieniach — bez zmian w kodzie. Dopisuj tu modele, które Gemini rozpoznaje z własnej wiedzy
// rynkowej (patrz "powod_decyzji" w logach), żeby lista rosła wraz z tym co faktycznie się trafia.
export const BIKE_MODELS = [
  { id: "canyon_torque",     label: "Canyon Torque",       query: "Canyon Torque" },
  { id: "canyon_spectral",   label: "Canyon Spectral",     query: "Canyon Spectral" },
  { id: "canyon_strive",     label: "Canyon Strive",       query: "Canyon Strive" },
  { id: "canyon_neuron",     label: "Canyon Neuron",       query: "Canyon Neuron" },
  { id: "canyon_stitched",   label: "Canyon Stitched",     query: "Canyon Stitched" },
  { id: "trek_remedy",       label: "Trek Remedy",         query: "Trek Remedy" },
  { id: "trek_slash",        label: "Trek Slash",          query: "Trek Slash" },
  { id: "trek_fuel_ex",      label: "Trek Fuel EX",        query: "Trek Fuel EX" },
  { id: "trek_session",      label: "Trek Session",        query: "Trek Session" },
  { id: "trek_ticket",       label: "Trek Ticket",         query: "Trek Ticket" },
  { id: "specialized_stumpjumper", label: "Specialized Stumpjumper", query: "Specialized Stumpjumper" },
  { id: "specialized_enduro",      label: "Specialized Enduro",      query: "Specialized Enduro" },
  { id: "specialized_camber",      label: "Specialized Camber",      query: "Specialized Camber" },
  { id: "specialized_demo",        label: "Specialized Demo",        query: "Specialized Demo" },
  { id: "specialized_p3",          label: "Specialized P.3",         query: "Specialized P.3" },
  { id: "cube_stereo",       label: "Cube Stereo",         query: "Cube Stereo" },
  { id: "cube_ams",          label: "Cube AMS",            query: "Cube AMS" },
  { id: "santa_cruz",  label: "Santa Cruz (cała marka)",  query: "Santa Cruz" },
  { id: "yt",          label: "YT (cała marka)",          query: "YT" },
  { id: "commencal",   label: "Commencal (cała marka)",   query: "Commencal" },
  { id: "radon_swoop",  label: "Radon Swoop",  query: "Radon Swoop" },
  { id: "radon_slide",  label: "Radon Slide",  query: "Radon Slide" },
  { id: "radon_slush",  label: "Radon Slush",  query: "Radon Slush" },
  { id: "ghost_riot",   label: "Ghost Riot",   query: "Ghost Riot" },
  { id: "focus_jam",    label: "Focus Jam",    query: "Focus Jam" },
  { id: "focus_sam",    label: "Focus Sam",    query: "Focus Sam" },
  { id: "focus_thron",  label: "Focus Thron",  query: "Focus Thron" },
  { id: "gt_force",     label: "GT Force",     query: "GT Force" },
  { id: "gt_fury",      label: "GT Fury",      query: "GT Fury" },
  { id: "rose_bruce",   label: "Rose The Bruce", query: "Rose The Bruce" },
  { id: "dartmoor",     label: "Dartmoor (cała marka)", query: "Dartmoor" },
  // ── Nowe marki (całe, bez rozbicia na modele) ──
  { id: "propain",        label: "Propain (cała marka)",        query: "Propain" },
  { id: "norco",          label: "Norco (cała marka)",          query: "Norco" },
  { id: "ns_bikes",       label: "NS Bikes (cała marka)",       query: "NS Bikes" },
  { id: "nukeproof",      label: "Nukeproof (cała marka)",      query: "Nukeproof" },
  { id: "rocky_mountain", label: "Rocky Mountain (cała marka)", query: "Rocky Mountain" },
  { id: "marin",          label: "Marin (cała marka)",          query: "Marin" },
  { id: "transition",     label: "Transition (cała marka)",     query: "Transition" },
  { id: "evil",           label: "Evil (cała marka)",           query: "Evil" },
  { id: "intense",        label: "Intense (cała marka)",        query: "Intense" },
  { id: "raaw",           label: "Raaw (cała marka)",           query: "Raaw" },
  { id: "beddo",          label: "Beddo (dirt)",                query: "Beddo" },
  // Giant: gotowy link — cała marka od 400 €, typ "mountainbike" ORAZ "ebike" (wcześniej tylko mountainbike)
  { id: "giant", label: "Giant (cała marka, MTB + e-bike, od 400 €)", isCategory: true,
    categoryUrl: "https://www.kleinanzeigen.de/s-fahrraeder/preis:400:/giant/k0c217+fahrraeder.type_s:(ebike%2Cmountainbike)" },
  // ── Wyszukiwania ogólne dirtówek (gotowe linki z minimalną ceną, bez filtra typu roweru) ──
  { id: "dirt_search",     label: "Dirt — wyszukiwanie ogólne (od 250 €)",     isCategory: true,
    categoryUrl: "https://www.kleinanzeigen.de/s-fahrraeder/preis:250:/dirt/k0c217" },
  { id: "dirtbike_search", label: "Dirtbike — wyszukiwanie ogólne (od 200 €)", isCategory: true,
    categoryUrl: "https://www.kleinanzeigen.de/s-fahrraeder/preis:200:/dirtbike/k0c217" },
];

// Wyszukiwania dodane po v5.1 — przy starej zapisanej konfiguracji (bez listy "knownBikes") włączamy je
// automatycznie, inaczej nowe pozycje byłyby po cichu odznaczone. Po zapisaniu Ustawień liczy się już
// to, co zaznaczysz (zapisujemy listę znanych pozycji).
export const BIKES_ADDED_AFTER_V51 = ["dirt_search", "dirtbike_search"];

// v6.4: modele marek wyszukiwanych w całości („cała marka”) — tytuł z takim modelem to znany rower: odrzucenie
// samego Groqa („inny”, „stary” bez dowodu) nie wystarcza, decyduje analiza AI (pełny opis, zdjęcia, twarde reguły)
export const BRAND_MODEL_NAMES = {
  santa_cruz:     /\b(nomad|bronson|hightower|megatower|5010|tallboy|blur|v10|heckler|bullit|vala|chameleon|jackal)\b/i,
  yt:             /\b(capra|jeffsy|tues|izzo|decoy|dirt\s*love)\b/i,
  commencal:      /\b(meta\s*(am|tr|sx|ht|power)|clash|supreme|furious|absolut|tempo)\b/i,
  dartmoor:       /\b(blackbird|bluebird|hornet|gamer|two6player|shine)\b/i,
  propain:        /\b(tyee|spindrift|hugene|ekano|rage|trickshot)\b/i,
  norco:          /\b(sight|range|optic|fluid|torrent|aurum)\b/i,
  ns_bikes:       /\b(snabb|define|eccentric|soda|movement|zircus|decade|metropolis)\b/i,
  nukeproof:      /\b(mega|giga|reactor|dissent|megawatt|scout)\b/i,
  rocky_mountain: /\b(altitude|instinct|slayer|element|reaper|powerplay|growler)\b/i,
  marin:          /\b(alpine\s*trail|rift\s*zone|hawk\s*hill|alcatraz)\b/i,
  transition:     /\b(patrol|sentinel|spire|scout|smuggler|tr11|pbj)\b/i,
  evil:           /\b(wreckoning|offering|following|insurgent|calling|chamois|sovereign)\b/i,
  intense:        /\b(tracer|primer|carbine|m29|m16|spider)\b/i,
  raaw:           /\b(madonna|jibb|yalla)\b/i,
  giant:          /\b(reign|trance|stance|anthem|glory|faith|fathom)\b/i,
};

// Znane dirty / slopestyle — Groq bywa przekonany, że to "inny" albo "stary" (sztywny tył, 26" to w dirtach norma)
export const DIRT_MODEL_RE = /(the\s*bruce|two\s*6\s*player|two6player|dartmoor\s+(gamer|shine)|stitched|specialized\s+p\.?\s?(3|26|24)\b|p\.?\s?slope|dirt\s*love|commencal\s+absolut|radon\s+slush|marin\s+alcatraz|trickshot|ns\s*(bikes\s+)?(movement|zircus|metropolis|decade|capital)|santa\s*cruz\s+jackal|voltage\s*yz|norco\s+rampage|kona\s+shonky|flying\s*circus|trek\s+ticket)/i;

// Tytuł wskazujący na samą część — wtedy "inny" od Groqa zostaje (nie ratujemy znanym modelem)
// v5.14: uzasadnienie Groqa „inny” mówiące o samej ramie / części (wtedy przy tytule bez słowa o części decyduje AI)
export const GROQ_PART_REASON_RE = /\b(ram[aąęy]|rame|cz[ęe][śs][ćc]i?|komponent\w*|rahmen\w*|frame\w*|part\w*|teile|sam[aąe]?\s+(rama|cz))/i;

export const PART_TITLE_RE = /\b(rahmen|rahmenset|frame|frameset|gabel|federgabel|dämpfer|daempfer|laufrad|laufradsatz|teile|ersatzteil\w*)\b/i;
