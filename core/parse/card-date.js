// WYGENEROWANE przez tools/sync-core.mjs z public/index.html — NIE EDYTUJ RĘCZNIE.
// Zmiany wprowadzaj w public/index.html, potem uruchom: node tools/sync-core.mjs
// Data dodania z karty ogłoszenia na liście wyników.

// Data dodania z karty ogłoszenia na liście wyników: "Heute, 14:22", "Gestern, 09:10", "07.11.2026",
// "vor 5 Minuten". Zwraca znacznik czasu albo null (nie udało się odczytać).
export const parseCardDate = (article, jsonLd) => {
  const now = new Date();
  for (const el of article.querySelectorAll("div, span, p, time, li, small")) {
    if (el.closest("script, style")) continue;
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 30) continue;
    let m = t.match(/^(Heute|Gestern)(?:,?\s*(\d{1,2}):(\d{2}))?(?:\s*Uhr)?$/i);
    if (m) {
      const yesterday = /gestern/i.test(m[1]);
      if (m[2] == null) return now.getTime() - (yesterday ? 12 : 0) * 3600 * 1000;
      const d = new Date(now);
      if (yesterday) d.setDate(d.getDate() - 1);
      d.setHours(Number(m[2]), Number(m[3]), 0, 0);
      return d.getTime();
    }
    m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12).getTime();
    m = t.match(/^vor\s+(\d+)\s+(Minute|Minuten|Stunde|Stunden|Tag|Tagen)$/i);
    if (m) return now.getTime() - Number(m[1]) * (/^min/i.test(m[2]) ? 60e3 : /^stund/i.test(m[2]) ? 3600e3 : 86400e3);
  }
  const ts = Date.parse(article.querySelector("time[datetime]")?.getAttribute("datetime") || jsonLd?.datePosted || "");
  return Number.isFinite(ts) ? ts : null;
};
