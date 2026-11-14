// Skaner na serwerze: lokalna strona + Chrome bez okna + polecenia sterujące.
//
//   node server/main.mjs            → uruchamia usługę (zwykle przez systemd)
//   node server/cli.mjs status      → sterowanie z konsoli (patrz server/cli.mjs)
//
// Ustawienia (zmienne środowiska):
//   DDF_PORT           port strony na 127.0.0.1 (domyślnie 8787). NIE zmieniać po starcie — pamięć skanera jest
//                      przypisana do adresu strony.
//   DDF_DATA_DIR       katalog danych (domyślnie ./var): profil przeglądarki z pamięcią skanera, ustawienia serwera
//   DDF_PAGE           original (domyślnie; strona bez zmian, React z cdnjs) | compiled (bez internetu do wczytania strony)
//   DDF_RESTART_HOURS  co ile godzin zamknąć i otworzyć Chrome na nowo (domyślnie 24; 0 = nigdy). Jak odświeżenie
//                      karty: autostart wznawia skanowanie, kolejka i pamięć zostają.
// Tryb pobierania stron Kleinanzeigen (direct / vercel) zmienia się poleceniem scrape-mode — zapisuje się w server.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSite } from "./site.mjs";
import { launchRunner } from "./runner.mjs";
import { SCRAPE_MODES } from "../core/providers/api.js";
import { ENGINE_VERSION } from "../core/version.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fail = (status, msg) => Object.assign(new Error(msg), { status });

export const startServer = async ({
  port = Number(process.env.DDF_PORT) || 8787,
  dataDir = process.env.DDF_DATA_DIR || path.join(ROOT, "var"),
  pageMode = process.env.DDF_PAGE || "original",
  restartHours = process.env.DDF_RESTART_HOURS != null ? Number(process.env.DDF_RESTART_HOURS) : 24,
  headless = true, transformApp, fetchImpl, log = (m) => console.log(`${new Date().toISOString()} ${m}`),
} = {}) => {
  fs.mkdirSync(dataDir, { recursive: true });
  const settingsPath = path.join(dataDir, "server.json");
  let settings = { scrapeMode: "direct", scrapeProxyUrl: "" };
  try { settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsPath, "utf8")) }; } catch {}
  const saveSettings = () => fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");

  let runner = null, stopping = false, restartTimer = null, relaunching = null;
  const need = () => { if (!runner || runner.isClosed()) throw fail(503, "Przeglądarka skanera nie działa (trwa ponowne uruchamianie) — spróbuj za chwilę"); return runner; };

  const control = {
    status: async () => ({ engineVersion: ENGINE_VERSION, pageMode: site.pageMode, origin: site.origin, scrapeMode: settings.scrapeMode, scrapeProxyUrl: settings.scrapeProxyUrl, ...(await need().status()) }),
    start: () => need().start(),
    stop: () => need().stop(),
    reload: () => need().reload(),
    log: async ({ n = 50 } = {}) => ({ lines: (await need().logs()).slice(-Math.max(1, Math.min(500, Number(n) || 50))) }),
    export: () => need().exportState(),
    import: (args) => need().importState(args),
    "restart-browser": async () => { await relaunch("polecenie z konsoli"); return { restarted: true }; },
    "scrape-mode": async ({ mode, proxyUrl } = {}) => {
      if (mode == null) return { scrapeMode: settings.scrapeMode, scrapeProxyUrl: settings.scrapeProxyUrl };
      if (!SCRAPE_MODES.includes(mode)) throw fail(400, `Nieznany tryb „${mode}” (dozwolone: ${SCRAPE_MODES.join(", ")})`);
      if (proxyUrl != null) {
        if (!/^https:\/\/[^\s]+$/.test(String(proxyUrl))) throw fail(400, "Adres pośrednika musi zaczynać się od https://");
        settings.scrapeProxyUrl = String(proxyUrl);
      }
      if (mode === "vercel" && !settings.scrapeProxyUrl) throw fail(400, "Tryb vercel wymaga adresu pośrednika, np. https://bikefinder-69.vercel.app/api/scrape");
      settings.scrapeMode = mode;
      saveSettings();
      log(`Pobieranie stron Kleinanzeigen: tryb ${mode}${mode === "vercel" ? ` (${settings.scrapeProxyUrl})` : ""}`);
      return { scrapeMode: settings.scrapeMode, scrapeProxyUrl: settings.scrapeProxyUrl };
    },
  };

  const site = await createSite({ port, pageMode, transformApp, fetchImpl, control, scrape: () => ({ mode: settings.scrapeMode, proxyUrl: settings.scrapeProxyUrl }) });
  const profileDir = path.join(dataDir, "profile");

  const launch = async () => {
    runner = await launchRunner({ url: site.origin + "/", profileDir, headless, onEvent: (ev) => {
      if (ev.type === "pageerror") log(`Błąd na stronie skanera: ${ev.msg}`);
      if ((ev.type === "crash" || ev.type === "browser-closed") && !stopping && !relaunching) {
        log(`Przeglądarka skanera przestała działać (${ev.type}) — uruchamiam ponownie za 5 s`);
        setTimeout(() => { if (!stopping) relaunch(ev.type).catch(e => log(`Ponowne uruchomienie nieudane: ${e.message}`)); }, 5000);
      }
    } });
    const st = await runner.status();
    log(`Strona skanera wczytana (${st.appVersion || "wersja nieznana"}, tryb strony ${site.pageMode}); skaner ${st.running ? "działa" : st.autorun ? "wznowi pracę z autostartu" : "zatrzymany"}`);
  };
  // Zamknięcie i ponowne otwarcie Chrome (świeży proces = zwolniona pamięć). Bez klikania Stop — autostart wznawia skanowanie.
  const relaunch = (why) => relaunching ||= (async () => {
    try {
      log(`Ponowne uruchomienie przeglądarki: ${why}`);
      if (runner && !runner.isClosed()) await runner.close().catch(() => {});
      await launch();
    } finally { relaunching = null; }
  })();

  try { await launch(); } catch (e) { await site.close(); throw e; }
  if (restartHours > 0) {
    restartTimer = setInterval(() => { relaunch(`planowe, co ${restartHours} h`).catch(e => log(`Planowe ponowne uruchomienie nieudane: ${e.message}`)); }, restartHours * 3600 * 1000);
    restartTimer.unref?.();
  }
  log(`Skaner na serwerze gotowy: ${site.origin} (silnik ${ENGINE_VERSION}, dane w ${dataDir})`);

  return {
    site, control, origin: site.origin, port: site.port, dataDir,
    runner: () => runner,
    // Zamknięcie usługi (SIGTERM, restart serwera): bez Stop — po ponownym starcie skaner sam wznawia pracę
    stop: async () => {
      stopping = true;
      if (restartTimer) clearInterval(restartTimer);
      if (relaunching) await relaunching.catch(() => {});
      if (runner && !runner.isClosed()) await runner.close().catch(() => {});
      await site.close();
    },
  };
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await startServer().catch((e) => { console.error(`Nie udało się uruchomić skanera: ${e.message}`); process.exit(1); });
  let closing = false;
  const shutdown = async (sig) => {
    if (closing) return; closing = true;
    console.log(`${new Date().toISOString()} ${sig}: zamykam przeglądarkę (autostart zostaje — po starcie usługi skaner wznowi pracę)`);
    await app.stop().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
