// WYGENEROWANE przez tools/sync-core.mjs z public/index.html — NIE EDYTUJ RĘCZNIE.
// Zmiany wprowadzaj w public/index.html, potem uruchom: node tools/sync-core.mjs
// Okazja i ogłoszenie w postaci do zapisu w kolejce wysyłki; limit wyceny względem ceny nowego.

// Okazja zapisana do wysyłki — tylko pola potrzebne do wiadomości na Discordzie
export const dealSnapshot = (a) => ({
  typ_roweru: a.typ_roweru, fakty: { rocznik: a.fakty?.rocznik ?? null, rocznik_zrodlo: a.fakty?.rocznik_zrodlo ?? "brak", rocznik_zakres: a.fakty?.rocznik_zakres ?? null },
  _summary: a._summary ?? null,
  przewidywany_zysk: a.przewidywany_zysk, transport_eur: a.transport_eur ?? null, krotki_opis: a.krotki_opis,
  cena_zakupu_eur: a.cena_zakupu_eur ?? null, szacowana_sprzedaz_eur: a.szacowana_sprzedaz_eur ?? null, // do przeliczenia zysku przy zmianie ceny
  zdjecia: a.zdjecia ?? null, _photos: a._photos ?? null, _verifyMode: a._verifyMode ?? null, ostrzezenia: a.ostrzezenia ?? null,
  rozmiar_ramy: a.rozmiar_ramy ?? null, argumenty_negocjacji: a.argumenty_negocjacji ?? null,
  widelec: a.widelec ?? null, rama: a.rama ?? null,
});

export const slimListing = (l) => ({
  listingId: l.listingId, title: l.title, price: l.price ?? null, href: l.href, desc: l.desc || "",
  location: l.location || "", bike: l.bike || "", postedAt: l.postedAt ?? null,
  prevPrice: l.prevPrice ?? null, photo: l.photo || (Array.isArray(l.images) ? l.images[0] : null) || null,
});

// Górny limit ceny sprzedaży używanego roweru jako ułamek "ceny nowego" z opisu, wg wieku (lata od rocznika).
// Zapobiega zakotwiczeniu wyceny na "Neupreis"/"NP" przy rowerach "neuwertig".
export const ageCapFactor = (age) =>
  age <= 1 ? 0.75 : age === 2 ? 0.65 : age === 3 ? 0.58 : age === 4 ? 0.52 : age === 5 ? 0.47 : age === 6 ? 0.43 : age === 7 ? 0.40 : 0.37;
