/* ============================================================
   Con-Raumplan — geteilte Konfiguration & Helfer
   Eingebunden von index.html und plan.html VOR deren eigenem
   Inline-Script (<script src="common.js"></script>).
   ============================================================ */

/* ---------- Konfiguration ---------- */
const CONFIG = {
  supabase: {
    url: "https://wgnbcebakabkzjonslfi.supabase.co",
    anonKey: "sb_publishable_H87YdUgB35PR37LL-efOkA_ShJxVIaq",
  },
};

const PLAYABL = "https://oapuqtuewlvswrdezthc.supabase.co";
const PLAYABL_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hcHVxdHVld2x2c3dyZGV6dGhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDQ3OTExODMsImV4cCI6MTk2MDM2NzE4M30.uSjfOkoD7KXv4ztVSFhzIS9LuIsgKg42NaZotZAcqko";

/* ---------- Kleine Helfer ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function slugify(name) {
  const base = (name || "con").toLowerCase()
    .replace(/[äöüß]/g, c => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c]))
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "con";
  return base + "-" + Math.random().toString(36).slice(2, 6);
}

/* ---------- Theme-Umschalter ---------- */
const THEMES = [
  { key: "dark", label: "🌙", nameKey: "themeDark" },
  { key: "light", label: "☀️", nameKey: "themeLight" },
  { key: "contrast", label: "◐", nameKey: "themeContrast" },
  { key: "colorful", label: "🎨", nameKey: "themeColorful" },
  { key: "terminal", label: "▚", nameKey: "themeTerminal" },
  { key: "cyberpunk", label: "⚡", nameKey: "themeCyberpunk" },
  { key: "ukiyo", label: "🌸", nameKey: "themeUkiyo" },
  { key: "solarpunk", label: "🌱", nameKey: "themeSolarpunk" },
  { key: "glass", label: "🫧", nameKey: "themeGlass" },
  { key: "punk", label: "✖", nameKey: "themePunk" },
  { key: "comic", label: "💥", nameKey: "themeComic" },
];
// Core-3 bleiben als flache Buttons im Header sichtbar, der Rest wandert in
// ein "Weitere Themes"-Popover — siehe renderThemeSwitch().
const CORE_THEME_KEYS = ["dark", "light", "contrast"];

const PIXEL_CAT_SVG = `<svg class="pixel-cat" viewBox="0 0 16 16" role="img" aria-label="Eine kleine Pixel-Katze hat sich hier versteckt" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="6" width="2" height="2"/><rect x="12" y="6" width="2" height="2"/>
  <rect x="1" y="4" width="2" height="2"/><rect x="13" y="4" width="2" height="2"/>
  <rect x="3" y="7" width="10" height="6"/>
  <rect x="4" y="13" width="2" height="1"/><rect x="10" y="13" width="2" height="1"/>
  <rect x="5" y="9" width="1" height="1" fill="#04150a"/><rect x="10" y="9" width="1" height="1" fill="#04150a"/>
  <rect x="7" y="11" width="2" height="1" fill="#04150a"/>
</svg>`;

function terminalEasterEgg() {
  if (window.__rpCatLogged) return;
  window.__rpCatLogged = true;
  console.log(
    "%c" +
    " /\\_/\\ \n" +
    "( o.o )  Con-Raumplan Terminal aktiviert.\n" +
    " > ___ <  Miau. Viel Erfolg bei der Raumzuteilung.",
    "color:#3dff85;font-family:monospace;font-size:12px;"
  );
}

function updateCatEasterEgg() {
  const slot = document.getElementById("themeCatSlot");
  if (!slot) return;
  slot.innerHTML = document.documentElement.getAttribute("data-theme") === "terminal" ? PIXEL_CAT_SVG : "";
}

// Gemeinfreie Ukiyo-e-Holzschnitte (Wikimedia/Wikipedia Commons, >150 Jahre
// alt), selbst gehostet statt gehotlinkt — eines zufällig PRO THEME-WECHSEL
// (nicht pro Aufruf/Klick) als dezenter Hintergrund (Deckkraft in theme.css),
// plus Name+Quelle für die Attributions-Bildunterschrift (#artCaption).
const UKIYO_BACKGROUNDS = [
  { file: "images/ukiyo/great-wave.jpg", name: "Unter der Welle vor Kanagawa", sourceUrl: "https://commons.wikimedia.org/wiki/File:Tsunami_by_hokusai_19th_century.jpg" },
  { file: "images/ukiyo/red-fuji.jpg", name: "Roter Fuji (Fine Wind, Clear Morning)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Red_Fuji_southern_wind_clear_morning.jpg" },
  { file: "images/ukiyo/hiroshige-hakone.jpg", name: "Hakone (Hiroshige, Tōkaidō)", sourceUrl: "https://en.wikipedia.org/wiki/File:Hiroshige11_hakone.jpg" },
  { file: "images/ukiyo/hiroshige-kanbara.jpg", name: "Kanbara (Hiroshige, Tōkaidō)", sourceUrl: "https://en.wikipedia.org/wiki/File:Hiroshige16_kanbara.jpg" },
  { file: "images/ukiyo/hiroshige-kameido-plum-garden.jpg", name: "Pflaumengarten in Kameido (Hiroshige)", sourceUrl: "https://en.wikipedia.org/wiki/File:De_pruimenboomgaard_te_Kameido-Rijksmuseum_RP-P-1956-743.jpeg" },
  { file: "images/ukiyo/mandarin-duck-woodcut.jpg", name: "Mandarinenten (Holzschnitt)", sourceUrl: "https://en.wikipedia.org/wiki/File:Mandarin_duck_woodcut3.jpg" },
  { file: "images/ukiyo/hokusai-woodblock-15.jpg", name: "Holzschnitt (Hokusai)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Ukiyo-e_woodblock_print_by_Katsushika_Hokusai,_digitally_enhanced_by_rawpixel-com_15.jpg" },
  { file: "images/ukiyo/kuniyoshi-takiyasha.jpg", name: "Takiyasha und das Skelettgespenst (Kuniyoshi)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Takiyasha_the_Witch_and_the_Skeleton_Spectre,_by_Utagawa_Kuniyoshi.jpg" },
  { file: "images/ukiyo/kuniyoshi-woodblock-1.jpg", name: "Holzschnitt (Kuniyoshi)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Woodblock_print_by_Utagawa_Kuniyoshi,_digitally_enhanced_by_rawpixel-com_1.jpg" },
  { file: "images/ukiyo/hiroshige-full-moon.jpg", name: "Vollmond über Berglandschaft (Hiroshige)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Hiroshige_Full_moon_over_a_mountain_landscape.jpg" },
  { file: "images/ukiyo/hiroshige-landscape-5.jpg", name: "Landschaft (Hiroshige)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Hiroshige,_Landscape_5.jpg" },
];
// Gemeinfreie Golden-Age-Comic-Cover (Wikimedia Commons). Die ursprünglich
// vorhandenen Motive liegen lokal; weitere Commons-Motive werden über
// Special:Redirect/file in einer bildschirmgerechten Größe ausgeliefert.
// Jeder Eintrag verlinkt in der Bildunterschrift auf seine konkrete
// Commons-Dateiseite mit Urheber- und Lizenzangaben.
const COMIC_BACKGROUNDS = [
  { file: "images/comic/black-owl-prize-comics.jpg", name: "Black Owl (Prize Comics)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Black_Owl_in_Prize_Comics_no2.jpg" },
  { file: "images/comic/thor-weird-comics.jpg", name: "Thor (Weird Comics)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Thor_Weird_Comics.jpg" },
  { file: "images/comic/thunder-agents-1.jpg", name: "T.H.U.N.D.E.R. Agents #1", sourceUrl: "https://commons.wikimedia.org/wiki/File:Thunder_agents_issue_1.jpg" },
  { file: "images/comic/smash-comics-panel.jpg", name: "Smash Comics Vol.1 #12 (Panel)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Abdul_the_Arab_-_Smash_Comics_Vol_1_12_(panel).png" },
  { file: "images/comic/blue-beetle-1.jpg", name: "Blue Beetle #1 Cover", sourceUrl: "https://commons.wikimedia.org/wiki/File:Blue_Beetle_Number_1_Cover.jpg" },
  { file: "images/comic/mystery-men-comics-16.jpg", name: "Mystery Men Comics #16", sourceUrl: "https://commons.wikimedia.org/wiki/File:Mystery_Men_Comics_16.jpg" },
  { file: "images/comic/smash-comics-14.jpg", name: "Smash Comics #14 (Cover Art)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Smash_Comics_no._14_(cover_art).jpg" },
  { file: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Planet_Comics_01.jpg?width=1600", name: "Planet Comics #1", sourceUrl: "https://commons.wikimedia.org/wiki/File:Planet_Comics_01.jpg" },
  { file: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Planet_Comics_11.jpg?width=1600", name: "Planet Comics #11", sourceUrl: "https://commons.wikimedia.org/wiki/File:Planet_Comics_11.jpg" },
  { file: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Planet_Comics_42.jpg?width=1600", name: "Planet Comics #42", sourceUrl: "https://commons.wikimedia.org/wiki/File:Planet_Comics_42.jpg" },
  { file: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Planet_Comics_53.jpg?width=1600", name: "Planet Comics #53", sourceUrl: "https://commons.wikimedia.org/wiki/File:Planet_Comics_53.jpg" },
  { file: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Fantastic_Comics_-11.jpg?width=1600", name: "Fantastic Comics #11", sourceUrl: "https://commons.wikimedia.org/wiki/File:Fantastic_Comics_-11.jpg" },
  { file: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Jumbo_Comics_no._9_(cover_art).jpg?width=1600", name: "Jumbo Comics #9", sourceUrl: "https://commons.wikimedia.org/wiki/File:Jumbo_Comics_no._9_(cover_art).jpg" },
  { file: "https://commons.wikimedia.org/wiki/Special:Redirect/file/WonderworldComics3.jpg?width=1600", name: "Wonderworld Comics #3", sourceUrl: "https://commons.wikimedia.org/wiki/File:WonderworldComics3.jpg" },
  { file: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Silverstreak_001.jpg?width=1600", name: "Silver Streak Comics #11", sourceUrl: "https://commons.wikimedia.org/wiki/File:Silverstreak_001.jpg" },
  { file: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Fight_Comics_82.jpg?width=1600", name: "Fight Comics #82", sourceUrl: "https://commons.wikimedia.org/wiki/File:Fight_Comics_82.jpg" },
  { file: "https://commons.wikimedia.org/wiki/Special:Redirect/file/AmazingMan22.jpg?width=1600", name: "Amazing-Man Comics #22", sourceUrl: "https://commons.wikimedia.org/wiki/File:AmazingMan22.jpg" },
];
let currentUkiyoPick = null, currentComicPick = null, currentComicContext = null;
function pickUkiyoBackground() {
  currentUkiyoPick = UKIYO_BACKGROUNDS[Math.floor(Math.random() * UKIYO_BACKGROUNDS.length)];
  document.documentElement.style.setProperty("--ukiyo-bg", `url("${currentUkiyoPick.file}")`);
  renderArtCaption();
}
// Ein neues Zufallsbild gehört zu einem echten Navigationswechsel, nicht zu
// jedem renderActive()-Aufruf: Suche, Filter und Zuordnungen rendern dieselbe
// Ansicht oft neu und würden sonst unangenehm flackern.
function comicViewContext() {
  const pathname = location.pathname.toLowerCase();
  if (pathname.endsWith("index.html") || pathname.endsWith("/")) return "cons";
  if (typeof S === "undefined" || !S.mode) return pathname;
  if (S.mode === "print") return `print:${S.printMode || "raster"}`;
  if (S.mode === "crew") {
    const setup = S.crewView === "setup" ? `:${S.setupTab || "slots"}` : "";
    return `crew:${S.crewView || "zuordnen"}${setup}`;
  }
  return `plan:${S.view || "raster"}`;
}
function pickComicBackground(force = false) {
  const context = comicViewContext();
  if (!force && currentComicPick && currentComicContext === context) {
    renderArtCaption();
    return currentComicPick;
  }
  const previousIndex = COMIC_BACKGROUNDS.indexOf(currentComicPick);
  let index = Math.floor(Math.random() * COMIC_BACKGROUNDS.length);
  if (COMIC_BACKGROUNDS.length > 1 && index === previousIndex) {
    index = (index + 1 + Math.floor(Math.random() * (COMIC_BACKGROUNDS.length - 1))) % COMIC_BACKGROUNDS.length;
  }
  currentComicPick = COMIC_BACKGROUNDS[index];
  currentComicContext = context;
  document.documentElement.style.setProperty("--comic-bg", `url("${currentComicPick.file}")`);
  renderArtCaption();
  return currentComicPick;
}
// Attributions-Bildunterschrift unten rechts (Name + Link zur Quelle) für
// Ukiyo/Comic — 1:1 aus der Vorlage (ukiyoCaptionStyle/-Text/-Url), fehlte
// bisher komplett.
function renderArtCaption() {
  let el = document.getElementById("artCaption");
  if (!el) {
    el = document.createElement("div");
    el.id = "artCaption";
    el.className = "art-caption no-print";
    document.body.appendChild(el);
  }
  const theme = document.documentElement.getAttribute("data-theme") || "dark";
  const pick = theme === "ukiyo" ? currentUkiyoPick : theme === "comic" ? currentComicPick : null;
  if (!pick) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<a href="${esc(pick.sourceUrl)}" target="_blank" rel="noopener">${esc((theme === "ukiyo" ? "波 " : "") + pick.name)}</a>`;
}
function applyTheme(key) {
  document.documentElement.setAttribute("data-theme", key);
  try { localStorage.setItem("raumplan-theme", key); } catch {}
  if (key === "terminal") terminalEasterEgg();
  updateCatEasterEgg();
  if (key === "ukiyo") pickUkiyoBackground();
  else if (key === "comic") pickComicBackground(true);
  else renderArtCaption();
}

// Core-3 (Dunkel/Hell/Kontrastreich) bleiben flache Buttons, der Rest wandert
// in ein "Weitere Themes"-Popover (Trigger zeigt das aktive Special-Theme,
// sonst ✨) — reduziert die Kopfzeile deutlich, ohne Themes wegzunehmen.
// Reiner Re-Render bei jeder Auswahl (Listener werden nur EINMAL gebunden,
// per container.dataset.wired-Flag, sonst würden sie sich bei jedem
// Re-Render duplizieren).
// Popover lebt als EIN gemeinsames Element direkt in <body> (Portal), nicht
// verschachtelt im Header — sonst würde es unter später im DOM folgende
// .card-Flächen rutschen: unsere Fade-in-Animation setzt auf jeder .card
// einen transform-Wert (auch nur translateY(0) im Ruhezustand zählt), und
// JEDER transform ≠ none erzeugt einen neuen Stacking-Kontext, gegen den
// ein z-index innerhalb des Headers nicht ankommt.
function ensureThemeMorePopoverEl() {
  let el = document.getElementById("themeMorePopover");
  if (!el) {
    el = document.createElement("div");
    el.id = "themeMorePopover";
    el.className = "theme-more-popover";
    el.hidden = true;
    document.body.appendChild(el);
    // Einmalig verdrahtet (Singleton-Element, lebt über alle renderThemeSwitch()-
    // Aufrufe hinweg) — Klick auf eine Zeile wendet direkt das Theme an und
    // aktualisiert JEDEN #themeSwitch/#langSwitch-Switcher auf der Seite neu.
    el.addEventListener("click", e => {
      const btn = e.target.closest("button[data-theme-key]");
      if (!btn) return;
      applyTheme(btn.dataset.themeKey);
      closeThemeMorePopover();
      document.querySelectorAll(".theme-switch-group").forEach(c => renderThemeSwitch(c));
    });
  }
  return el;
}
function closeThemeMorePopover() {
  const popover = document.getElementById("themeMorePopover");
  if (popover) popover.hidden = true;
  document.querySelectorAll(".theme-more-trigger[aria-expanded='true']").forEach(t => t.setAttribute("aria-expanded", "false"));
}
function renderThemeSwitch(container) {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  if (current === "terminal") terminalEasterEgg();
  updateCatEasterEgg();
  const core = THEMES.filter(t => CORE_THEME_KEYS.includes(t.key));
  const specials = THEMES.filter(t => !CORE_THEME_KEYS.includes(t.key));
  const activeSpecial = specials.find(t => t.key === current);
  container.className = "theme-switch-group";
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", tr("themeSwitchLabel"));
  container.innerHTML = `
    <div class="theme-switch">
      ${core.map(th => `<button type="button" data-theme-key="${th.key}" aria-pressed="${String(th.key === current)}" title="${esc(tr(th.nameKey))}" aria-label="${esc(tr(th.nameKey))}">${th.label}</button>`).join("")}
    </div>
    <div class="theme-more-wrap">
      <button type="button" class="theme-more-trigger${activeSpecial ? " is-active" : ""}" aria-haspopup="true" aria-expanded="false" title="${esc(tr("moreThemes"))}" aria-label="${esc(tr("moreThemes"))}">
        <span>${activeSpecial ? activeSpecial.label : "✨"}</span><span class="theme-more-chevron">⌄</span>
      </button>
    </div>`;
  ensureThemeMorePopoverEl();
  if (!container.dataset.wired) {
    container.dataset.wired = "1";
    // Delegiert von container aus (bleibt über Re-Renders hinweg bestehen —
    // anders als die Buttons selbst, die bei jedem innerHTML-Neuaufbau
    // frisch erzeugt werden und jeden direkt angehängten Listener verlieren).
    container.addEventListener("click", e => {
      const themeBtn = e.target.closest("button[data-theme-key]");
      if (themeBtn) { applyTheme(themeBtn.dataset.themeKey); closeThemeMorePopover(); renderThemeSwitch(container); return; }
      const trigger = e.target.closest(".theme-more-trigger");
      if (!trigger) return;
      e.stopPropagation();
      const popover = ensureThemeMorePopoverEl();
      const willOpen = popover.hidden;
      closeThemeMorePopover();
      if (!willOpen) return;
      const r = trigger.getBoundingClientRect();
      popover.style.top = `${r.bottom + 6}px`;
      popover.style.left = `${Math.max(8, r.right - 190)}px`;
      popover.innerHTML = THEMES.filter(t => !CORE_THEME_KEYS.includes(t.key)).map(th => {
        const isCurrent = th.key === (document.documentElement.getAttribute("data-theme") || "dark");
        return `<button type="button" data-theme-key="${th.key}" class="theme-more-row" aria-pressed="${String(isCurrent)}"><span>${th.label}</span><span style="flex:1;text-align:left">${esc(tr(th.nameKey))}</span><span>${isCurrent ? "✓" : ""}</span></button>`;
      }).join("");
      popover.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
    });
    document.addEventListener("click", e => {
      if (e.target.closest(".theme-more-wrap") || e.target.closest("#themeMorePopover")) return;
      closeThemeMorePopover();
    });
  }
}

/* ---------- Prefs: kleiner localStorage-Wrapper für UI-Einstellungen
   (Assign-Modus, Detailgrad, Sprache) — bündelt das Ad-hoc-Muster, das
   applyTheme() schon einzeln nutzt. ---------- */
const Prefs = {
  get(key, fallback) { try { return localStorage.getItem("raumplan-" + key) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem("raumplan-" + key, value); } catch {} },
};

/* ============================================================
   Mehrsprachigkeit (Deutsch/Englisch) — dasselbe Grundmuster wie das
   Theme-System: Umschalter im Header, Wahl in localStorage, Fallback auf
   Deutsch. Ohne gespeicherte Wahl entscheidet die Browsersprache (nur
   Englisch wird automatisch erkannt, alles andere bleibt Deutsch als
   Standard). STRINGS ist die EINE gemeinsame Quelle für index.html,
   plan.html und impressum.html (alle laden common.js zuerst).
   ============================================================ */
const STRINGS = {
  de: {
    // Theme-/Sprach-Switcher, Login
    themeDark: "Dunkel", themeLight: "Hell", themeContrast: "Kontrastreich", themeColorful: "Playabl",
    themeTerminal: "Terminal", themeCyberpunk: "Cyberpunk", themeUkiyo: "Ukiyo-e",
    themeSolarpunk: "Solarpunk", themeGlass: "Glassmorphism", themePunk: "Punk", themeComic: "Comic", moreThemes: "Weitere Themes",
    themeSwitchLabel: "Farbschema wählen", langSwitchLabel: "Sprache wählen",
    langDe: "Deutsch", langEn: "English",
    loginRegister: "Login / Registrieren", logout: "Logout", login: "Login", register: "Registrieren", loggingIn: "Einloggen",
    loginRegisterTitle: "Login / Registrierung",
    authHint: "Ein Konto allein gibt noch keine Rechte — die bekommst du erst als Crew-Mitglied einer Con.",
    email: "E-Mail", password: "Passwort", cancel: "Abbrechen",
    authSignupPending: "Fast fertig — bitte den Bestätigungslink in deinem Postfach anklicken, dann hier erneut einloggen.",
    authLoginFailed: "Login fehlgeschlagen", authSignupFailed: "Registrierung fehlgeschlagen",
    noSession: "keine Sitzung", sessionExpired: "Sitzung abgelaufen",
    // Rollen/Einladungen
    roleAdmin: "Admin", roleEditor: "Bearbeiter", invitePending: "Einladung offen",
    inviteBanner: "📬 Du wurdest als {role} zur Crew von {con} eingeladen.",
    accept: "Annehmen", decline: "Ablehnen",
    acceptFailed: "Annehmen fehlgeschlagen: {err}", declineFailed: "Ablehnen fehlgeschlagen: {err}",
    // index.html
    headerLabel: "Kopfzeile", heroTitle: "Wer spielt wann wo?", heroSub: "Raum- und Tischplan für Cons — live synchronisiert mit Playabl. Sieh, wo noch Platz ist, oder öffne den vollen Plan.",
    loadingCons: "Lade Cons …", openConDirectly: "Con direkt öffnen", openConHint: "Link oder ID einer bestehenden Con einfügen.",
    nextConEyebrow: "Nächste Con", nextConToday: "heute", nextConTomorrow: "morgen", nextConInDays: "in {n} Tagen",
    nextConBadgeText: "● läuft bald · {countdown}",
    nextConCrewBadge: "Crew-Zugriff", goToOverview: "Zur Übersicht →",
    directInputPlaceholder: "…oder Link/ID direkt öffnen", open: "Öffnen",
    existingCons: "Weitere Cons", existingConsHint: "Playabl-Events und manuell angelegte Cons · neueste zuerst.",
    searchCon: "Con suchen …",
    createConTitle: "Neue Con für die Raumplanung anlegen", createConHint: "Du wirst automatisch erstes Crew-Mitglied dieser Con.",
    conTypePlayabl: "Mit Playabl-Event", conTypeManual: "Rein manuell (kein Playabl)",
    community: "Community", event: "Event", eventIdDirect: "… oder Event-ID direkt",
    manualHint: "Ohne Playabl-Event gibt es keine automatisch geladenen Spiele — Spiele/Programmpunkte werden im Raumplan manuell angelegt.",
    conNameLabel: "Name der Con", conListedLabel: "In „Bestehende Cons“ öffentlich auflisten",
    createConBtn: "Con anlegen", createConTriggerBtn: "+ Neue Con anlegen", unlisted: "ungelistet", createdOn: "angelegt {date}", playablEvent: "Playabl-Event",
    delete: "Löschen", openArrow: "Öffnen →", noConFound: "Noch keine Con gefunden.",
    confirmDeleteCon: "„{name}“ inkl. aller Räume/Tische/Zuordnungen/Änderungswünsche UNWIDERRUFLICH löschen?",
    deleteFailed: "Löschen fehlgeschlagen: {err}", pleaseLoginFirst: "Bitte zuerst einloggen oder registrieren.",
    pleaseEnterConName: "Bitte einen Namen für die Con eingeben.", createConFailed: "Anlegen fehlgeschlagen: {err}",
    dataLoadFailed: "Daten konnten nicht geladen werden ({err}).", asOf: "Stand: {date} Uhr",
    imprint: "Impressum",
    // plan.html — Kopfzeile/Dialoge (Teil 1)
    backToCons: "← alle Cons", loading: "Lädt …", loadingData: "Lade Daten …",
    pageTabCons: "Cons", pageTabPlan: "Raumplan", pageTabCrew: "Crew",
    globalSearchPlaceholder: "Spiel, Anbieter, Raum oder Tisch …",
    viewLabel: "Ansicht", searchLabel: "Suche", rowsLabel: "Zeilen", slotLabel: "Slot", detailsLabel: "Details", printCurrentView: "Druckansicht öffnen",
    printBtn: "Drucken", printAction: "Drucken", crewLabel: "Crew",
    printSettingsTitle: "Druckeinstellungen", printModeLabel: "Modus", printAxisLabel: "Zeilen", printSlotLabel: "Slot",
    printDetailLabel: "Details", printOrientationLabel: "Ausrichtung", printColorLabel: "Farbe",
    printOrientationAuto: "Automatisch", printOrientationPortrait: "Hochformat", printOrientationLandscape: "Querformat",
    printColorColor: "Farbig", printColorBw: "Schwarzweiß",
    printBackLink: "← zurück zum Plan", printAllSlots: "Alle Slots",
    printColHost: "SL", printColTag: "Tag",
    printMetaSl: "SL: {host}", printMetaFull: "SL: {host}{tag} · {seats}p",
    printConMetaPlayabl: "Playabl-Event {id}", printConMetaManual: "manuelle Con",
    printCreatedOn: "Erstellt am {time}", printLiveVersion: "Live-Version: {url}",
    footPlayabl: "Spiele werden bei jedem Öffnen live von der Playabl-API geladen; Plätze = Spielplätze + 1 anbietende Person.",
    footRequest: "Über „Änderung vorschlagen“ am Spiel kann jede*r der Crew einen Wunsch schicken.",
    proposeChange: "Änderung vorschlagen", concerns: "Betrifft", reqMsgLabel: "Was soll anders sein – und warum? *",
    proposeChangeHint: "Änderung vorschlagen — für alle offen",
    reqMsgPlaceholder: "z.B. Bitte in einen ruhigeren Raum – Runde mit viel Konzentration.",
    reqContactLabel: "Rückfragen an (optional, z.B. Discord-Name)", submit: "Absenden",
    room: "Raum", nameRequired: "Name *", floorLocation: "Stock / Lage", floorLocationPlaceholder: "z.B. EG, 1. Stock links",
    sortOrder100: "Reihenfolge (1–100)", features: "Eigenschaften", specialNotes: "Besonderheiten (Freitext)", save: "Speichern",
    table: "Tisch", tableNamePlaceholder: "z.B. Tisch 1", seatsInclGm: "Plätze (Spielende inkl. SL) *", noteOptional: "Hinweis (optional)",
    slot: "Slot", labelRequired: "Bezeichnung *", slotLabelPlaceholder: "z.B. Freitag Abend", sortOrder: "Reihenfolge",
    timeBlock: "Zeitabschnitt", bucketLabelPlaceholder: "z.B. Vormittag", fromHour: "Von (Stunde)", toHour: "Bis (Stunde)",
    bucketActiveLabel: "aktiv (wird für neue Tage verwendet)",
    autoAssignInfoTitle: "Was macht Auto-Zuordnung?",
    autoAssignInfoText: "Reguläre Runden bekommen möglichst denselben Tisch wie in einem anderen Slot, sonst den kleinsten noch passenden freien Tisch. Hat ein Spiel Anforderungen (Chip-Picker oder Playabl-Klammer-Syntax), werden Räume bevorzugt, die alle davon erfüllen. Workshops/Panels/Vorträge (erkannt an Titel oder System) ohne eigene Anforderungen werden stattdessen bevorzugt in Räume mit „Bewegung ok“ oder „laut ok“ gesetzt. Blockiert nichts — schon zugeordnete Spiele bleiben unangetastet, danach kann jederzeit von Hand nachjustiert werden.",
    understood: "Verstanden", game: "Spiel", titleRequired: "Titel *", providerOptional: "Anbieter (optional)",
    peopleInclGm: "Personen (inkl. Leitung) *", workshopPanel: "Workshop/Panel",
    gameSlotLabel: "Slot (optional — ohne Slot bleibt das Spiel im Backlog von „Spiele verwalten“)",
    descOptional: "Beschreibung (optional)", gameReqLabel: "Anforderungen an den Tisch/Raum (optional, fürs Matching)",
    // plan.html — chipHtml/Kopf-Kacheln/Tabelle/Raster
    seatsPersons: "{n} Personen", providerLabel: "Anbieter {p}", workshop: "Workshop", manuallyCreated: "manuell angelegt",
    noSlot: "kein Slot", noTableYet: "noch kein Tisch", overCapacityPersons: "{n} Person(en) über Tischkapazität",
    needsTags: "braucht: {tags}", tableDoesNotMeet: "Tisch erfüllt nicht: {tags}",
    proposeChangeTo: "Änderung zu „{title}“ vorschlagen", overCapacityBadge: "+{n} über Kapazität",
    noTableYetDash: "– noch kein Tisch –", personsShort: "{n} Pers.", manualBadge: "manuell",
    minSeatsLabel: "min. {n} Plätze", decreaseMinSeats: "weniger Plätze", increaseMinSeats: "mehr Plätze",
    selectedClickTable: "✓ ausgewählt — Tisch anklicken", selectBtn: "Auswählen", chooseTable: "– Tisch wählen –",
    assignTableFor: "Tisch zuweisen für {title}", removeFromTable: "{title} vom Tisch entfernen", deleteItemNamed: "{title} löschen",
    gamesLabel: "Spiele", roomsLabel: "Räume", tablesLabel: "Tische", slotsLabel: "Slots",
    legendColorRoom: "Farbe = Raum", legendDashedWorkshop: "gestrichelt = Workshop", legendOverCapacity: "über Kapazität (blockiert nichts)",
    legendInfoText: "Raumfarbe: jeder Raum hat eine feste Farbe (Raster, Tabelle, Räume-Ansicht). Spieltitel anklicken öffnet Playabl (falls verknüpft). ✎ (bei Hover) schlägt eine Änderung vor — für alle offen, kein Login nötig.",
    noSearchResults: "Keine Treffer für diese Suche.", noGamesYet: "Noch keine Spiele.",
    tableCaption: "Alle Spiele mit Spielleitung, Slot, Raum, Tisch und Plätzen",
    gameCol: "Spiel", slotCol: "Slot", roomCol: "Raum", tableCol: "Tisch", seatsCol: "Plätze",
    noRoomsYet: "Noch keine Räume angelegt.", noSlotsYet: "Noch keine Slots angelegt.",
    viewRaster: "Raster", viewTable: "Tabelle", viewRooms: "Räume",
    crewViewAssign: "Zuordnen", crewViewSetup: "Setup", crewViewRequests: "Wünsche",
    crewViewRooms: "Räume verwalten", crewViewGames: "Spiele verwalten", crewViewCrew: "Crew verwalten",
    setupTabRooms: "Räume", setupTabSlots: "Slots", setupTabGames: "Spiele", setupTabCrew: "Crew", setupSubTabsAriaLabel: "Setup-Bereich wählen",
    crewNavAriaLabel: "Crew-Bereich wählen",
    toolbarSlotLabel: "Slot", toolbarAssignModeLabel: "Zuordnen per", toolbarFilterLabel: "Filter",
    toolbarDetailsLabel: "Details", toolbarDetailsBtn: "Details", toolbarDetailsHint: "Zeigt/versteckt Plätze, Spielleitung und Anforderungen bei zugeordneten Spielen",
    crewGameSearchPlaceholder: "Nur Spiele: Titel, SL, Raum, Tisch …",
    crewGameSearchAriaLabel: "Spiele nach Titel, Spielleitung, Raum, Tisch oder Anforderung filtern",
    crewGameSearchScope: "Textsuche · nur Spiele",
    noCrewGameMatches: "Keine Spiele passen zu Suche und Filtern.",
    noCrewTableGameMatch: "Kein passendes Spiel",
    queueInfoAriaLabel: "Was ist die Warteschlange? (Erklärung öffnen)",
    queueInfoText: "{hint} Filter-Chips wirken auch auf die Räume rechts — sie zeigen dann nur passende Räume.",
    // plan.html — Raster/Räume/Zuordnen
    noGames: "Keine Spiele", flipAxisBtn: "⇄ Achsen tauschen (aktuell: {axis})", axisSlotsRows: "Slots als Zeilen", axisRoomsRows: "Räume als Zeilen",
    chooseSlotAriaLabel: "Slot wählen", scrollSlotsLeftAriaLabel: "Frühere Slots anzeigen", scrollSlotsRightAriaLabel: "Weitere Slots anzeigen", editSlotTitle: "Aktuellen Termin ({label}) umbenennen/löschen", editSlotAriaLabel: "Aktuellen Termin umbenennen oder löschen",
    addSlotTitle: "Neuen Termin anlegen (z.B. für einen weiteren Tag) — Zeitabschnitts-Vorlagen wie „Vormittag/Nachmittag“ liegen unter Setup → Slots",
    addSlotAriaLabel: "Neuen Termin anlegen", addSlotBtnLabel: "+ Slot",
    locationLabel: "Lage: {floor}", noTablesYet: "Noch keine Tische.", seatsCountLabel: "{n} Plätze", freeLabel: "frei", overCapacityPlain: "über Kapazität", hostShortLabel: "SL: {name}",
    addFirstSlotBtn: "+ ersten Slot anlegen",
    minSeatsFilterLabel: "Spiele mit mind. {stepper} Plätzen", reqFilterLabel: "Anforderungen: {picker}",
    minTableSeatsFilterLabel: "Tische ab {stepper} Plätzen hervorheben", reqSatisfiedFilterLabel: "Anforderungen erfüllt: {picker}",
    queueHintClick: "Wähle ein Spiel aus und klicke dann auf einen Tisch (oder auf „Warteschlange“, um es dort abzulegen).",
    queueHintDnd: "Ziehe ein Spiel auf einen Tisch oder nutze das Auswahlfeld am Spiel.",
    unassignedTitle: "Warteschlange", allAssigned: "🎉 Alles zugeordnet.",
    doubleBooked: "doppelt belegt!", doesNotMeet: "Erfüllt nicht: {tags}", missingTags: "fehlt: {tags}",
    noTablesCreateInRooms: "Noch keine Tische — in „Räume verwalten“ anlegen.", noRoomsGoToManage: "Noch keine Räume angelegt. Wechsle zu „Räume verwalten“.",
    assignModeAriaLabel: "Zuordnungs-Modus", dragDropLabel: "Drag & Drop", singleSelectLabel: "Auswahl",
    autoAssignBtn: "Auto zuordnen", autoAssignBtnTitle: "Zeigt einen Vorschlag zur Bestätigung, bevor etwas zugeordnet wird.",
    autoAssignInfoAriaLabel: "Was macht Auto-Zuordnung? (Erklärung öffnen)",
    autoAssignPreviewTitle: "Vorschlag: Auto-Zuordnung", apply: "Übernehmen",
    autoAssignRulesTitle: "So entscheidet die Auto-Zuordnung",
    autoAssignPreviewSummary: "Vorschläge: {n} · Slot: „{slot}“ · Danach ohne Tisch: {unresolved}",
    autoAssignEditHint: "Ziel direkt ändern; ein bereits verwendeter Tisch wird mit dem bisherigen Ziel getauscht.",
    autoAssignChangeTargetAria: "Zieltisch für „{title}“ ändern",
    autoReasonCapacityFits: "Kapazität passt: {gameSeats} von {tableSeats} Plätzen.",
    autoReasonCapacityShort: "Achtung: Kapazität reicht nicht ({gameSeats} benötigt, {tableSeats} vorhanden; Differenz {n}).",
    autoReasonPreviousTable: "Derselbe Tisch wurde für dieses Spiel bereits in einem anderen Slot verwendet und ist hier frei.",
    autoReasonPreviousRequirementsWarning: "Die Wiederverwendung hat Vorrang, obwohl der Raum diese Anforderungen nicht erfüllt: {tags}.",
    autoReasonSmallestFit: "Gewählt wurde der kleinste noch passende freie Tisch, damit größere Tische verfügbar bleiben.",
    autoReasonRequirementsMatch: "Der Raum erfüllt alle Anforderungen: {tags}.",
    autoReasonRequirementsFallback: "Kein freier Tisch erfüllt alle Anforderungen; hier fehlen: {tags}.",
    autoReasonWorkshopRequirements: "Workshop/Panel: Der Raum erfüllt alle expliziten Anforderungen ({tags}); unter diesen Treffern wird ein großer freier Tisch bevorzugt.",
    autoReasonWorkshopFeatures: "Workshop/Panel ohne explizite Anforderungen: Der Raum ist für Bewegung oder Lautstärke markiert; unter diesen Treffern wird ein großer freier Tisch bevorzugt.",
    autoReasonWorkshopFallback: "Workshop/Panel: Kein bevorzugter Workshop-Raum ist frei; deshalb wird auf einen ausreichend großen freien Tisch ausgewichen.",
    autoReasonManualChoice: "Ziel wurde in der Vorschau manuell geändert.",
    autoReasonManualSwap: "Ziele wurden in der Vorschau miteinander getauscht.",
    autoReasonManualRequirementsMatch: "Der gewählte Raum erfüllt alle Anforderungen: {tags}.",
    autoReasonManualRequirementsMissing: "Der gewählte Raum erfüllt diese Anforderungen nicht: {tags}.",
    clearSlotBtn: "Slot leeren",
    clearSlotBtnTitle: "Alle Tischzuordnungen dieses Slots lösen",
    clearSlotDialogTitle: "Slot wirklich leeren?",
    clearSlotWarningTitle: "„{slot}“ wird von allen Tischen gelöst.",
    clearSlotWarningText: "Betroffen sind {n} Tischzuordnungen. Spiele, Slot, Räume und Tische bleiben erhalten; nur die Tischbelegungen werden entfernt.",
    clearSlotConfirmBtn: "Zuordnungen entfernen",
    clearSlotWorking: "Wird entfernt …",
    clearSlotResult: "{n} Tischzuordnungen wurden entfernt.",
    clearSlotFailed: "Zuordnungen konnten nicht entfernt werden: {err}",
    roomsInfoAriaLabel: "Was ist „Räume verwalten“? (Erklärung öffnen)", roomsInfoTitle: "Räume verwalten",
    roomsInfoText: "Hier legst du Räume und ihre Tische an und vergibst Eigenschaften (z.B. „Bewegung ok“, „laut ok“), nach denen später automatisch oder manuell zugeordnet wird.",
    gamesInfoAriaLabel: "Was ist „Spiele verwalten“? (Erklärung öffnen)", gamesInfoTitle: "Spiele verwalten",
    gamesInfoText: "Manuelle Spiele (ohne Playabl-Anbindung) legst du komplett hier an, inklusive Anforderungen an Tisch/Raum fürs Matching bei der Zuordnung. Playabl-Spiele bearbeitest du direkt auf Playabl.",
    slotsInfoTitle: "Slots verwalten", slotsInfoAriaLabel: "Was sind Slots? (Erklärung öffnen)",
    slotsInfoText: "Konkrete Slots bestimmen die Zeilen und Zeitabschnitte des Raumplans. Automatisch erzeugte Tages-Slots können hier umbenannt, sortiert oder gelöscht werden.",
    assignmentCount: "{n} Zuordnung", assignmentCountPlural: "{n} Zuordnungen",
    requestsInfoAriaLabel: "Was sind Änderungswünsche? (Erklärung öffnen)", requestsInfoTitle: "Änderungswünsche",
    requestsInfoText: "Kommen aus der öffentlichen Ansicht — jede·r kann hier einen Wunsch zu einem Spiel oder allgemein einreichen. Als Crew markierst du sie als erledigt oder abgelehnt. „Zum Spiel →“ springt direkt zur Zuordnen-Ansicht und markiert das betroffene Spiel.",
    crewInfoAriaLabel: "Was kann die Crew? (Erklärung öffnen)", crewInfoTitle: "Crew",
    crewInfoText: "Crew-Mitglieder haben Zugriff auf alle Zuordnungs- und Verwaltungsfunktionen. Admins können zusätzlich Rollen ändern sowie Mitglieder einladen oder entfernen.",
    jumpToGameBtn: "Zum Spiel →", closeBanner: "Leiste schließen",
    unscheduledCount: "{n} Spiel(e) ohne Slot", moveToActiveSlot: "→ in diesen Slot",
    bucketTimeRange: "{start}–{end} Uhr", inactiveBadge: "inaktiv", noBucketsYet: "Noch keine Zeitabschnitte definiert.",
    editBucketAriaLabel: "Zeitabschnitt {label} bearbeiten", bucketsTitle: "Zeitabschnitte (Slot-Vorlagen)",
    bucketsHint: "Bestimmen, wie Playabl-Spiele automatisch in Tages-Slots einsortiert werden (z.B. Vormittag/Nachmittag) — beliebig viele Abschnitte möglich, wirkt erst auf neue Tage.",
    addBucketBtn: "+ Zeitabschnitt", editTableAriaLabel: "Tisch {name} bearbeiten", deleteTableAriaLabel: "Tisch {name} löschen",
    addTableBtn: "+ Tisch", editRoomAriaLabel: "Raum {name} bearbeiten", deleteRoomAriaLabel: "Raum {name} löschen", addRoomBtn: "+ Raum",
    editItemNamed: "{title} bearbeiten", editBtnLabel: "Bearbeiten", deleteBtnLabel: "Löschen",
    noManualGamesYet: "Noch keine manuellen Spiele angelegt.", playablGamesTitle: "Spiele von Playabl",
    playablGamesHint: "Live von Playabl geladen — hier nur zur Übersicht, bearbeitbar nur direkt auf Playabl.",
    noPlayablGamesYet: "Keine Spiele von Playabl geladen.", openOnPlayabl: "Auf Playabl öffnen ↗",
    addGameBtn: "+ Spiel", manualGamesTitle: "Manuelle Spiele", manualGamesHint: "Selbst angelegt — hier bearbeitbar, inkl. optionalem Slot.",
    gameAssignedBadge: "zugeordnet", gameOpenBadge: "offen", tableCountLabel: "{n} Tische",
    expandRoomAriaLabel: "Tische von {name} ein-/ausblenden",
    fromContact: "von {contact}", general: "Allgemein",
    statusOpen: "offen", statusDone: "erledigt", statusRejected: "abgelehnt",
    statusDoneBtn: "✓ erledigt", markDoneBtn: "Als erledigt markieren", markDoneShort: "Erledigt", rejectShort: "Abgelehnt", statusRejectedBtn: "✕ abgelehnt", statusOpenBtn: "↻ offen",
    crewNotePlaceholder: "Crew-Notiz", showDoneCheckbox: "auch erledigte/abgelehnte anzeigen", noOpenRequests: "Keine offenen Änderungswünsche.",
    noTableAssignedContext: "kein Tisch zugeordnet",
    crewTitle: "Crew verwalten", adminCanManage: "Als Admin kannst du Rollen ändern und Mitglieder entfernen.",
    onlyAdminsCanManage: "Nur Admins können die Crew verwalten — du siehst die Liste read-only.",
    inviteTitle: "Einladen", inviteEmailLabel: "E-Mail (muss bereits registriert sein)", roleLabel: "Rolle", inviteBtn: "Einladen",
    removeBtn: "Entfernen", noMembersFound: "Keine Mitglieder gefunden.",
    saveFailed: "Speichern fehlgeschlagen: {err}", nothingToAssign: "Nichts zuzuordnen – entweder alles verteilt oder keine passenden freien Tische.",
    autoAssignNothingToDo: "Nichts zu tun.", autoAssignNoFittingTables: "Keine passenden freien Tische gefunden.",
    autoAssignResult: "Auto-Zuordnung: {n} Spiele zugeordnet{rest}.", autoAssignRest: ", {n} weiterhin ohne passenden Tisch",
    confirmDeleteGame: "Spiel löschen?", confirmDeleteRoom: "Raum samt Tischen löschen?", confirmDeleteTable: "Tisch löschen?",
    confirmRemoveCrew: "Diese Person aus der Crew entfernen?", inviteSent: "{email} wurde eingeladen — wird aktiv, sobald die Person zustimmt.",
    thanksMsg: "Danke!", thanksFullMsg: "Danke! Dein Wunsch ist bei der Crew gelandet.", sendFailed: "Senden fehlgeschlagen: {err}",
    removeFromFilterAriaLabel: "{label} aus Filter entfernen", addRequirementToFilterAriaLabel: "Anforderung zum Filter hinzufügen",
    addRequirementOption: "+ Filter", removeTagAriaLabel: "{label} entfernen", noneSelectedYet: "Noch keine ausgewählt.",
    addFeatureAriaLabel: "Eigenschaft hinzufügen", addFeatureOption: "+ Eigenschaft hinzufügen",
    confirmDeleteSlot: "Slot löschen? Nur möglich, wenn ihm keine Spiele mehr zugeordnet sind.",
    deleteFailedSlot: "Löschen fehlgeschlagen (sind noch Spiele in diesem Slot?): {err}",
    confirmDeleteBucket: "Zeitabschnitt löschen? Bereits angelegte Slots bleiben erhalten.",
    deleteFailed: "Löschen fehlgeschlagen: {err}",
    noSlotOption: "– kein Slot –",
    detailMinimal: "Kompakt", detailMinimalName: "Kompakt — nur Titel + Plätze, einzeilig",
    detailMedium: "Standard", detailMediumName: "Standard — zusätzlich Anbieter/Workshop",
    detailFull: "Ausführlich", detailFullName: "Ausführlich — alle Details (Slot, Uhrzeit, Raum/Tisch)",
    superadminBanner: "🛡️ Du bearbeitest diese Con als Super-Admin (unabhängig von einer eigenen Crew-Mitgliedschaft).",
    loggedInNotCrew: "Du bist eingeloggt, aber (noch) nicht Teil der Crew dieser Con — du siehst die öffentliche Ansicht.",
    publicViewLogin: "Öffentliche Ansicht. Crew-Mitglieder können sich oben einloggen.",
    conNotFound: "Diese Con wurde nicht gefunden.", backToOverview: "Zurück zur Übersicht",
    pageSubPlayabl: "Playabl-Event {id} · lädt bei jedem Öffnen live", pageSubManual: "Kein Playabl-Event verknüpft — nur manuelle Spiele.",
    backGeneric: "← zurück",
    imprintIntro: "Con-Raumplan ist ein privates, nicht-kommerzielles Community-Projekt ohne Werbung oder Bezahlschranke.",
    imprintResponsible: "Verantwortlich:", imprintContact: "Kontakt:", imprintDisclaimer: "Diese Angaben sind keine Rechtsberatung.",
  },
  en: {
    themeDark: "Dark", themeLight: "Light", themeContrast: "High contrast", themeColorful: "Playabl",
    themeTerminal: "Terminal", themeCyberpunk: "Cyberpunk", themeUkiyo: "Ukiyo-e",
    themeSolarpunk: "Solarpunk", themeGlass: "Glassmorphism", themePunk: "Punk", themeComic: "Comic", moreThemes: "More themes",
    themeSwitchLabel: "Choose color scheme", langSwitchLabel: "Choose language",
    langDe: "Deutsch", langEn: "English",
    loginRegister: "Log in / Register", logout: "Log out", login: "Log in", register: "Register", loggingIn: "Log in",
    loginRegisterTitle: "Log in / Register",
    authHint: "An account alone doesn't grant any rights yet — you get those once you're crew on a con.",
    email: "Email", password: "Password", cancel: "Cancel",
    authSignupPending: "Almost done — please click the confirmation link in your inbox, then log in here again.",
    authLoginFailed: "Login failed", authSignupFailed: "Registration failed",
    noSession: "no session", sessionExpired: "Session expired",
    roleAdmin: "Admin", roleEditor: "Editor", invitePending: "Invite pending",
    inviteBanner: "📬 You've been invited as {role} to the crew of {con}.",
    accept: "Accept", decline: "Decline",
    acceptFailed: "Accept failed: {err}", declineFailed: "Decline failed: {err}",
    // index.html
    headerLabel: "Header", heroTitle: "Who's playing what, when, where?", heroSub: "Room and table plan for cons — synced live with Playabl. See where there's still space, or open the full plan.",
    loadingCons: "Loading cons …", openConDirectly: "Open a con directly", openConHint: "Paste a link or ID of an existing con.",
    nextConEyebrow: "Next con", nextConToday: "today", nextConTomorrow: "tomorrow", nextConInDays: "in {n} days",
    nextConBadgeText: "● coming up · {countdown}",
    nextConCrewBadge: "Crew access", goToOverview: "To overview →",
    directInputPlaceholder: "…or open a link/ID directly", open: "Open",
    existingCons: "More cons", existingConsHint: "Playabl events and manually created cons · newest first.",
    searchCon: "Search cons …",
    createConTitle: "Create a new con for room planning", createConHint: "You'll automatically become that con's first crew member.",
    conTypePlayabl: "With a Playabl event", conTypeManual: "Fully manual (no Playabl)",
    community: "Community", event: "Event", eventIdDirect: "… or event ID directly",
    manualHint: "Without a Playabl event, no games load automatically — games/programme items are added manually in the room plan.",
    conNameLabel: "Con name", conListedLabel: "List publicly under “Existing cons”",
    createConBtn: "Create con", createConTriggerBtn: "+ New con", unlisted: "unlisted", createdOn: "created {date}", playablEvent: "Playabl event",
    delete: "Delete", openArrow: "Open →", noConFound: "No con found yet.",
    confirmDeleteCon: "Permanently delete “{name}” including all rooms/tables/assignments/change requests?",
    deleteFailed: "Delete failed: {err}", pleaseLoginFirst: "Please log in or register first.",
    pleaseEnterConName: "Please enter a name for the con.", createConFailed: "Creating failed: {err}",
    dataLoadFailed: "Data could not be loaded ({err}).", asOf: "As of: {date}",
    imprint: "Legal notice",
    // plan.html — header/dialogs (part 1)
    backToCons: "← all cons", loading: "Loading …", loadingData: "Loading data …",
    pageTabCons: "Cons", pageTabPlan: "Plan", pageTabCrew: "Crew",
    globalSearchPlaceholder: "Game, host, room or table …",
    viewLabel: "View", searchLabel: "Search", rowsLabel: "Rows", slotLabel: "Slot", detailsLabel: "Detail", printCurrentView: "Open print view",
    printBtn: "Print", printAction: "Print", crewLabel: "Crew",
    printSettingsTitle: "Print settings", printModeLabel: "Mode", printAxisLabel: "Rows", printSlotLabel: "Slot",
    printDetailLabel: "Details", printOrientationLabel: "Orientation", printColorLabel: "Color",
    printOrientationAuto: "Automatic", printOrientationPortrait: "Portrait", printOrientationLandscape: "Landscape",
    printColorColor: "Color", printColorBw: "Black & white",
    printBackLink: "← back to plan", printAllSlots: "All slots",
    printColHost: "Host", printColTag: "Tag",
    printMetaSl: "Host: {host}", printMetaFull: "Host: {host}{tag} · {seats}p",
    printConMetaPlayabl: "Playabl event {id}", printConMetaManual: "manual con",
    printCreatedOn: "Created on {time}", printLiveVersion: "Live version: {url}",
    footPlayabl: "Games are loaded live from the Playabl API on every visit; seats = game seats + 1 GM.",
    footRequest: "Anyone can send the crew a request via “Propose change” on a game.",
    proposeChange: "Propose change", concerns: "Regarding", reqMsgLabel: "What should be different – and why? *",
    proposeChangeHint: "Propose a change — open to everyone",
    reqMsgPlaceholder: "e.g. Please move to a quieter room – this round needs a lot of concentration.",
    reqContactLabel: "Follow-up contact (optional, e.g. Discord name)", submit: "Send",
    room: "Room", nameRequired: "Name *", floorLocation: "Floor / location", floorLocationPlaceholder: "e.g. ground floor, 1st floor left",
    sortOrder100: "Sort order (1–100)", features: "Features", specialNotes: "Notes (free text)", save: "Save",
    table: "Table", tableNamePlaceholder: "e.g. Table 1", seatsInclGm: "Seats (incl. GM) *", noteOptional: "Note (optional)",
    slot: "Slot", labelRequired: "Label *", slotLabelPlaceholder: "e.g. Friday evening", sortOrder: "Sort order",
    timeBlock: "Time block", bucketLabelPlaceholder: "e.g. Morning", fromHour: "From (hour)", toHour: "To (hour)",
    bucketActiveLabel: "active (used for new days)",
    autoAssignInfoTitle: "What does auto-assign do?",
    autoAssignInfoText: "Regular games keep the same table as in another slot where possible, otherwise the smallest still-fitting free table. If a game has requirements (tag picker or Playabl bracket syntax), rooms that satisfy all of them are preferred. Workshops/panels/talks (detected from title or system) without their own requirements are instead preferred in rooms tagged “movement ok” or “loud ok”. Blocks nothing — already-assigned games stay untouched, and you can always adjust by hand afterwards.",
    understood: "Got it", game: "Game", titleRequired: "Title *", providerOptional: "Provider (optional)",
    peopleInclGm: "People (incl. GM) *", workshopPanel: "Workshop/panel",
    gameSlotLabel: "Slot (optional — without a slot the game stays in the backlog of “Manage games”)",
    descOptional: "Description (optional)", gameReqLabel: "Requirements for table/room (optional, for matching)",
    // plan.html — chip/header tiles/table/grid
    seatsPersons: "{n} people", providerLabel: "Provider {p}", workshop: "Workshop", manuallyCreated: "manually created",
    noSlot: "no slot", noTableYet: "no table yet", overCapacityPersons: "{n} person(s) over table capacity",
    needsTags: "needs: {tags}", tableDoesNotMeet: "Table doesn't meet: {tags}",
    proposeChangeTo: "Propose a change to “{title}”", overCapacityBadge: "+{n} over capacity",
    noTableYetDash: "– no table yet –", personsShort: "{n} ppl.", manualBadge: "manual",
    minSeatsLabel: "min. {n} seats", decreaseMinSeats: "fewer seats", increaseMinSeats: "more seats",
    selectedClickTable: "✓ selected — click a table", selectBtn: "Select", chooseTable: "– choose table –",
    assignTableFor: "Assign table for {title}", removeFromTable: "Remove {title} from table", deleteItemNamed: "Delete {title}",
    gamesLabel: "Games", roomsLabel: "Rooms", tablesLabel: "Tables", slotsLabel: "Slots",
    legendColorRoom: "Color = room", legendDashedWorkshop: "dashed = workshop", legendOverCapacity: "over capacity (blocks nothing)",
    legendInfoText: "Room color: every room has a fixed color (grid, table, rooms view). Clicking a game title opens Playabl (if linked). ✎ (on hover) proposes a change — open to everyone, no login needed.",
    noSearchResults: "No results for this search.", noGamesYet: "No games yet.",
    tableCaption: "All games with host, slot, room, table and seats",
    gameCol: "Game", slotCol: "Slot", roomCol: "Room", tableCol: "Table", seatsCol: "Seats",
    noRoomsYet: "No rooms set up yet.", noSlotsYet: "No slots set up yet.",
    viewRaster: "Grid", viewTable: "Table", viewRooms: "Rooms",
    crewViewAssign: "Assign", crewViewSetup: "Setup", crewViewRequests: "Requests",
    crewViewRooms: "Manage rooms", crewViewGames: "Manage games", crewViewCrew: "Manage crew",
    setupTabRooms: "Rooms", setupTabSlots: "Slots", setupTabGames: "Games", setupTabCrew: "Crew", setupSubTabsAriaLabel: "Choose setup section",
    crewNavAriaLabel: "Choose crew section",
    toolbarSlotLabel: "Slot", toolbarAssignModeLabel: "Assign by", toolbarFilterLabel: "Filter",
    toolbarDetailsLabel: "Details", toolbarDetailsBtn: "Details", toolbarDetailsHint: "Shows/hides seats, GM and requirements on assigned games",
    crewGameSearchPlaceholder: "Games only: title, GM, room, table …",
    crewGameSearchAriaLabel: "Filter games by title, GM, room, table, or requirement",
    crewGameSearchScope: "Text search · games only",
    noCrewGameMatches: "No games match the search and filters.",
    noCrewTableGameMatch: "No matching game",
    queueInfoAriaLabel: "What is the queue? (open explanation)",
    queueInfoText: "{hint} Filter chips also apply to the rooms on the right — they then show only matching rooms.",
    // plan.html — grid/rooms/assign
    noGames: "No games", flipAxisBtn: "⇄ Swap axes (currently: {axis})", axisSlotsRows: "slots as rows", axisRoomsRows: "rooms as rows",
    chooseSlotAriaLabel: "Choose slot", scrollSlotsLeftAriaLabel: "Show earlier slots", scrollSlotsRightAriaLabel: "Show more slots", editSlotTitle: "Rename/delete current slot ({label})", editSlotAriaLabel: "Rename or delete current slot",
    addSlotTitle: "Add a new slot (e.g. for another day) — time-block templates like “morning/afternoon” live under Setup → Slots",
    addSlotAriaLabel: "Add new slot", addSlotBtnLabel: "+ Slot",
    locationLabel: "Location: {floor}", noTablesYet: "No tables yet.", seatsCountLabel: "{n} seats", freeLabel: "free", overCapacityPlain: "over capacity", hostShortLabel: "GM: {name}",
    addFirstSlotBtn: "+ Add first slot",
    minSeatsFilterLabel: "Games with at least {stepper} seats", reqFilterLabel: "Requirements: {picker}",
    minTableSeatsFilterLabel: "Highlight tables with at least {stepper} seats", reqSatisfiedFilterLabel: "Requirements met: {picker}",
    queueHintClick: "Select a game, then click a table (or click “Queue” to drop it there).",
    queueHintDnd: "Drag a game onto a table, or use the dropdown on the game.",
    unassignedTitle: "Queue", allAssigned: "🎉 Everything's assigned.",
    doubleBooked: "double-booked!", doesNotMeet: "Doesn't meet: {tags}", missingTags: "missing: {tags}",
    noTablesCreateInRooms: "No tables yet — add some under “Manage rooms”.", noRoomsGoToManage: "No rooms yet. Switch to “Manage rooms”.",
    assignModeAriaLabel: "Assignment mode", dragDropLabel: "Drag & drop", singleSelectLabel: "Select",
    autoAssignBtn: "Auto-assign", autoAssignBtnTitle: "Shows a suggestion to confirm before anything is assigned.",
    autoAssignInfoAriaLabel: "What does auto-assign do? (open explanation)",
    autoAssignPreviewTitle: "Suggestion: auto-assign", apply: "Apply",
    autoAssignRulesTitle: "How auto-assign decides",
    autoAssignPreviewSummary: "Suggestions: {n} · Slot: “{slot}” · Remaining without a table: {unresolved}",
    autoAssignEditHint: "Change a target directly; choosing a table already in use swaps it with the previous target.",
    autoAssignChangeTargetAria: "Change target table for “{title}”",
    autoReasonCapacityFits: "Capacity fits: {gameSeats} of {tableSeats} seats.",
    autoReasonCapacityShort: "Warning: {n} seat(s) short ({gameSeats} needed, {tableSeats} available).",
    autoReasonPreviousTable: "This game already used the same table in another slot, and it is free here.",
    autoReasonPreviousRequirementsWarning: "Reusing the table takes priority even though the room does not meet these requirements: {tags}.",
    autoReasonSmallestFit: "The smallest available fitting table was chosen to keep larger tables free.",
    autoReasonRequirementsMatch: "The room meets every requirement: {tags}.",
    autoReasonRequirementsFallback: "No free table meets every requirement; this room is missing: {tags}.",
    autoReasonWorkshopRequirements: "Workshop/panel: The room meets every explicit requirement ({tags}); a large free table is preferred among these matches.",
    autoReasonWorkshopFeatures: "Workshop/panel without explicit requirements: The room is tagged for movement or noise; a large free table is preferred among these matches.",
    autoReasonWorkshopFallback: "Workshop/panel: No preferred workshop room is free, so an adequately sized free table is used instead.",
    autoReasonManualChoice: "The target was changed manually in the preview.",
    autoReasonManualSwap: "The targets were swapped in the preview.",
    autoReasonManualRequirementsMatch: "The selected room meets every requirement: {tags}.",
    autoReasonManualRequirementsMissing: "The selected room does not meet these requirements: {tags}.",
    clearSlotBtn: "Clear slot",
    clearSlotBtnTitle: "Remove every table assignment in this slot",
    clearSlotDialogTitle: "Really clear this slot?",
    clearSlotWarningTitle: "“{slot}” will be removed from every table.",
    clearSlotWarningText: "{n} table assignment(s) are affected. Games, the slot, rooms, and tables remain; only table placements are removed.",
    clearSlotConfirmBtn: "Remove assignments",
    clearSlotWorking: "Removing …",
    clearSlotResult: "{n} table assignment(s) removed.",
    clearSlotFailed: "Assignments could not be removed: {err}",
    roomsInfoAriaLabel: "What is “Manage rooms”? (open explanation)", roomsInfoTitle: "Manage rooms",
    roomsInfoText: "Here you create rooms and their tables and give them features (e.g. “movement ok”, “loud ok”) used later for automatic or manual assignment.",
    gamesInfoAriaLabel: "What is “Manage games”? (open explanation)", gamesInfoTitle: "Manage games",
    gamesInfoText: "Manual games (without a Playabl link) are created entirely here, including table/room requirements for matching during assignment. Edit Playabl games directly on Playabl.",
    slotsInfoTitle: "Manage slots", slotsInfoAriaLabel: "What are slots? (open explanation)",
    slotsInfoText: "Concrete slots define the rows and time blocks in the room plan. Automatically created day slots can be renamed, sorted, or deleted here.",
    assignmentCount: "{n} assignment", assignmentCountPlural: "{n} assignments",
    requestsInfoAriaLabel: "What are change requests? (open explanation)", requestsInfoTitle: "Change requests",
    requestsInfoText: "These come from the public view — anyone can submit a request about a game or in general. As crew you mark them done or rejected. “To game →” jumps straight to the assign view and highlights the affected game.",
    crewInfoAriaLabel: "What can crew do? (open explanation)", crewInfoTitle: "Crew",
    crewInfoText: "Crew members have access to all assignment and management functions. Admins can additionally change roles and invite or remove members.",
    jumpToGameBtn: "To game →", closeBanner: "Close banner",
    unscheduledCount: "{n} game(s) without a slot", moveToActiveSlot: "→ to this slot",
    bucketTimeRange: "{start}–{end}", inactiveBadge: "inactive", noBucketsYet: "No time blocks defined yet.",
    editBucketAriaLabel: "Edit time block {label}", bucketsTitle: "Time blocks (slot templates)",
    bucketsHint: "Determine how Playabl games are automatically sorted into daily slots (e.g. morning/afternoon) — any number of blocks possible, only affects new days.",
    addBucketBtn: "+ Time block", editTableAriaLabel: "Edit table {name}", deleteTableAriaLabel: "Delete table {name}",
    addTableBtn: "+ Table", editRoomAriaLabel: "Edit room {name}", deleteRoomAriaLabel: "Delete room {name}", addRoomBtn: "+ Room",
    editItemNamed: "Edit {title}", editBtnLabel: "Edit", deleteBtnLabel: "Delete",
    noManualGamesYet: "No manual games created yet.", playablGamesTitle: "Games from Playabl",
    playablGamesHint: "Loaded live from Playabl — overview only here, edit directly on Playabl.",
    noPlayablGamesYet: "No games loaded from Playabl.", openOnPlayabl: "Open on Playabl ↗",
    addGameBtn: "+ Game", manualGamesTitle: "Manual games", manualGamesHint: "Created here — editable here, including an optional slot.",
    gameAssignedBadge: "assigned", gameOpenBadge: "open", tableCountLabel: "{n} tables",
    expandRoomAriaLabel: "Show/hide tables of {name}",
    fromContact: "from {contact}", general: "General",
    statusOpen: "open", statusDone: "done", statusRejected: "rejected",
    statusDoneBtn: "✓ done", markDoneBtn: "Mark as done", markDoneShort: "Done", rejectShort: "Rejected", statusRejectedBtn: "✕ rejected", statusOpenBtn: "↻ open",
    crewNotePlaceholder: "Crew note", showDoneCheckbox: "also show done/rejected", noOpenRequests: "No open change requests.",
    noTableAssignedContext: "no table assigned",
    crewTitle: "Manage crew", adminCanManage: "As an admin you can change roles and remove members.",
    onlyAdminsCanManage: "Only admins can manage the crew — you're seeing a read-only list.",
    inviteTitle: "Invite", inviteEmailLabel: "Email (must already be registered)", roleLabel: "Role", inviteBtn: "Invite",
    removeBtn: "Remove", noMembersFound: "No members found.",
    saveFailed: "Save failed: {err}", nothingToAssign: "Nothing to assign – everything is placed, or no fitting free tables.",
    autoAssignNothingToDo: "Nothing to do.", autoAssignNoFittingTables: "No fitting free tables found.",
    autoAssignResult: "Auto-assign: {n} games assigned{rest}.", autoAssignRest: ", {n} still without a fitting table",
    confirmDeleteGame: "Delete game?", confirmDeleteRoom: "Delete room including all its tables?", confirmDeleteTable: "Delete table?",
    confirmRemoveCrew: "Remove this person from the crew?", inviteSent: "{email} was invited — becomes active once they accept.",
    thanksMsg: "Thanks!", thanksFullMsg: "Thanks! Your request has reached the crew.", sendFailed: "Send failed: {err}",
    removeFromFilterAriaLabel: "Remove {label} from filter", addRequirementToFilterAriaLabel: "Add requirement to filter",
    addRequirementOption: "+ Filter", removeTagAriaLabel: "Remove {label}", noneSelectedYet: "None selected yet.",
    addFeatureAriaLabel: "Add feature", addFeatureOption: "+ Add feature",
    confirmDeleteSlot: "Delete slot? Only possible if no games are assigned to it anymore.",
    deleteFailedSlot: "Delete failed (are there still games in this slot?): {err}",
    confirmDeleteBucket: "Delete time block? Slots already created stay intact.",
    deleteFailed: "Delete failed: {err}",
    noSlotOption: "– no slot –",
    detailMinimal: "Compact", detailMinimalName: "Compact — title + seats only, single line",
    detailMedium: "Standard", detailMediumName: "Standard — plus provider/workshop",
    detailFull: "Detailed", detailFullName: "Detailed — all details (slot, time, room/table)",
    superadminBanner: "🛡️ You're editing this con as super-admin (independent of your own crew membership).",
    loggedInNotCrew: "You're logged in, but not (yet) part of this con's crew — you're seeing the public view.",
    publicViewLogin: "Public view. Crew members can log in above.",
    conNotFound: "This con was not found.", backToOverview: "Back to overview",
    pageSubPlayabl: "Playabl event {id} · loaded live on every visit", pageSubManual: "No Playabl event linked — manual games only.",
    backGeneric: "← back",
    imprintIntro: "Con-Raumplan is a private, non-commercial community project with no ads or paywall.",
    imprintResponsible: "Responsible:", imprintContact: "Contact:", imprintDisclaimer: "This information is not legal advice.",
  },
};
let LANG = Prefs.get("lang", null) || ((navigator.language || "").toLowerCase().startsWith("en") ? "en" : "de");
function tr(key, vars) {
  let s = STRINGS[LANG]?.[key] ?? STRINGS.de[key] ?? key;
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}
function translateStaticDom() {
  document.documentElement.lang = LANG;
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = tr(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = tr(el.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = tr(el.dataset.i18nTitle); });
  document.querySelectorAll("[data-i18n-aria-label]").forEach(el => { el.setAttribute("aria-label", tr(el.dataset.i18nAriaLabel)); });
}
function applyLang(key) {
  LANG = key;
  Prefs.set("lang", key);
  translateStaticDom();
  (window.__authUIRefreshers || []).forEach(fn => fn());
  if (typeof gamesFromDb === "function") gamesFromDb();
  if (typeof renderDetailSwitch === "function") renderDetailSwitch();
  if (typeof renderActive === "function") renderActive();
  if (typeof updateCatEasterEgg === "function") updateCatEasterEgg();
}
const LANGS = [{ key: "de", label: "DE" }, { key: "en", label: "EN" }];
function renderLangSwitch(container) {
  container.className = "lang-switch-flat";
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", tr("langSwitchLabel"));
  container.innerHTML = LANGS.map(l =>
    `<button type="button" data-lang-key="${l.key}" aria-pressed="${String(l.key === LANG)}" title="${esc(tr("lang" + (l.key === "de" ? "De" : "En")))}" aria-label="${esc(tr("lang" + (l.key === "de" ? "De" : "En")))}">${l.label}</button>`
  ).join("");
  container.addEventListener("click", e => {
    const btn = e.target.closest("button[data-lang-key]");
    if (!btn) return;
    applyLang(btn.dataset.langKey);
    container.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
  });
}

/* ---------- Supabase REST/RPC ---------- */
async function supaFetch(path, opts = {}) {
  // Ohne explizite Headers (typischer Fall für öffentliche Lesezugriffe)
  // trotzdem den anon-Key mitschicken, statt unauthentifiziert anzufragen.
  if (!opts.headers) opts = { ...opts, headers: supaHeaders(null, false) };
  const r = await fetch(`${CONFIG.supabase.url}/rest/v1/${path}`, opts);
  if (!r.ok) throw new Error(`Backend HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

function supaHeaders(accessToken, write) {
  const h = { apikey: CONFIG.supabase.anonKey, Authorization: "Bearer " + (accessToken || CONFIG.supabase.anonKey) };
  if (write) { h["Content-Type"] = "application/json"; h.Prefer = "return=representation"; }
  return h;
}

async function supaRpc(name, body, accessToken) {
  const r = await fetch(`${CONFIG.supabase.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: CONFIG.supabase.anonKey, Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error(data?.message || `RPC-Fehler (${r.status})`);
  return data;
}

/* ---------- Supabase Auth (E-Mail + Passwort, inkl. Self-Signup) ---------- */
const Auth = {
  _key: "raumplan-auth",
  session() { try { return JSON.parse(localStorage.getItem(this._key)); } catch { return null; } },
  _store(s) { localStorage.setItem(this._key, JSON.stringify(s)); },
  logout() { localStorage.removeItem(this._key); },
  async signup(email, password) {
    const r = await fetch(`${CONFIG.supabase.url}/auth/v1/signup`, {
      method: "POST", headers: { apikey: CONFIG.supabase.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error_description || j.msg || tr("authSignupFailed"));
    if (j.access_token) { this._store({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at }); return true; }
    return false; // Bestätigungsmail nötig (falls "Confirm email" doch aktiv ist)
  },
  async login(email, password) {
    const r = await fetch(`${CONFIG.supabase.url}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: CONFIG.supabase.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error_description || j.msg || tr("authLoginFailed"));
    this._store({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at });
  },
  async refresh() {
    const s = this.session();
    if (!s) throw new Error(tr("noSession"));
    const r = await fetch(`${CONFIG.supabase.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: { apikey: CONFIG.supabase.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!r.ok) { this.logout(); throw new Error(tr("sessionExpired")); }
    const j = await r.json();
    this._store({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at });
  },
  async accessToken() {
    const s = this.session();
    if (!s) return null;
    if (s.expires_at * 1000 < Date.now() + 60000) await this.refresh().catch(() => {});
    return this.session()?.access_token || null;
  },
  // E-Mail steht nicht in der lokal gespeicherten Session — sie steckt aber
  // schon im Supabase-JWT selbst (email-Claim), kein Extra-Feld/-Request nötig.
  email() {
    const s = this.session();
    if (!s?.access_token) return null;
    try {
      const base64 = s.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(atob(base64).split("").map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
      return JSON.parse(json).email || null;
    } catch { return null; }
  },
};

/* ---------- Geteiltes Login/Registrierungs-Dialog (von beiden Seiten genutzt) ---------- */
function mountAuthUI({ buttonId, onChange }) {
  if (!document.getElementById("authDlg")) {
    const div = document.createElement("div");
    div.innerHTML = `
      <dialog id="authDlg" aria-labelledby="authDlgH">
        <h2 id="authDlgH" data-i18n="loginRegisterTitle">${esc(tr("loginRegisterTitle"))}</h2>
        <div class="slot-tabs" style="margin-bottom:var(--sp-3)">
          <button type="button" id="tabLogin" aria-pressed="true" data-i18n="login">${esc(tr("login"))}</button>
          <button type="button" id="tabSignup" aria-pressed="false" data-i18n="register">${esc(tr("register"))}</button>
        </div>
        <p class="hint" id="authHint" data-i18n="authHint">${esc(tr("authHint"))}</p>
        <form method="dialog" id="authForm">
          <div class="frow"><label for="authEmail" data-i18n="email">${esc(tr("email"))}</label><input type="email" id="authEmail" autocomplete="username" required></div>
          <div class="frow"><label for="authPw" data-i18n="password">${esc(tr("password"))}</label><input type="password" id="authPw" autocomplete="current-password" required minlength="6"></div>
          <p class="msg err" id="authErr" role="alert"></p>
          <p class="msg ok" id="authOk" role="status"></p>
          <div class="dactions">
            <button type="button" onclick="this.closest('dialog').close()" data-i18n="cancel">${esc(tr("cancel"))}</button>
            <button type="submit" class="primary" id="authSubmit">${esc(tr("loggingIn"))}</button>
          </div>
        </form>
      </dialog>`;
    document.body.appendChild(div.firstElementChild);
  }
  const authDlg = document.getElementById("authDlg");
  let authMode = "login";
  function setAuthMode(mode) {
    authMode = mode;
    document.getElementById("tabLogin").setAttribute("aria-pressed", String(mode === "login"));
    document.getElementById("tabSignup").setAttribute("aria-pressed", String(mode === "signup"));
    document.getElementById("authSubmit").textContent = mode === "login" ? tr("loggingIn") : tr("register");
    document.getElementById("authEmail").autocomplete = mode === "login" ? "username" : "email";
    document.getElementById("authPw").autocomplete = mode === "login" ? "current-password" : "new-password";
    document.getElementById("authErr").textContent = "";
    document.getElementById("authOk").textContent = "";
  }
  document.getElementById("tabLogin").addEventListener("click", () => setAuthMode("login"));
  document.getElementById("tabSignup").addEventListener("click", () => setAuthMode("signup"));

  const btn = document.getElementById(buttonId);
  function initialsOf(email) {
    if (!email) return "?";
    const name = email.split("@")[0];
    const parts = name.split(/[._-]+/).filter(Boolean);
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }
  function refresh() {
    const session = Auth.session();
    btn.classList.toggle("has-avatar", !!session);
    if (session) {
      btn.innerHTML = `<span class="auth-avatar" aria-hidden="true">${esc(initialsOf(Auth.email()))}<span class="auth-online-dot"></span></span>`;
      btn.title = tr("logout"); btn.setAttribute("aria-label", tr("logout"));
    } else {
      btn.textContent = tr("loginRegister");
      btn.removeAttribute("title"); btn.removeAttribute("aria-label");
    }
  }
  btn.addEventListener("click", () => {
    if (Auth.session()) { Auth.logout(); refresh(); onChange?.(); return; }
    setAuthMode("login");
    document.getElementById("authErr").textContent = "";
    document.getElementById("authOk").textContent = "";
    authDlg.showModal();
  });
  document.getElementById("authForm").addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("authEmail").value.trim();
    const pw = document.getElementById("authPw").value;
    const errEl = document.getElementById("authErr"), okEl = document.getElementById("authOk");
    errEl.textContent = ""; okEl.textContent = "";
    try {
      if (authMode === "login") { await Auth.login(email, pw); authDlg.close(); }
      else {
        const loggedIn = await Auth.signup(email, pw);
        if (loggedIn) authDlg.close();
        else { okEl.textContent = tr("authSignupPending"); return; }
      }
      refresh();
      onChange?.();
    } catch (err) { errEl.textContent = err.message; }
  });
  refresh();
  // Registrierung fürs Sprach-Umschalten: applyLang() ruft alle registrierten
  // Refresh-Funktionen auf, damit Modus-abhängiger Text (Login/Registrieren-
  // Button) nach einem Sprachwechsel korrekt bleibt.
  window.__authUIRefreshers = window.__authUIRefreshers || [];
  window.__authUIRefreshers.push(() => { setAuthMode(authMode); refresh(); });
  return { refresh, requireLogin: () => { setAuthMode("login"); authDlg.showModal(); } };
}

/* ---------- Rollen & Einladungen ---------- */
function roleBadgeHtml(role, status) {
  if (status === "pending") return `<span class="role-badge pending">${esc(tr("invitePending"))}</span>`;
  return `<span class="role-badge ${role}">${esc(role === "admin" ? tr("roleAdmin") : tr("roleEditor"))}</span>`;
}

async function inviteMember(conId, email, role) {
  const token = await Auth.accessToken();
  return supaRpc("invite_member_to_con", { target_con: conId, invite_email: email, invite_role: role }, token);
}
async function acceptInvite(conId) { return supaRpc("accept_invite", { target_con: conId }, await Auth.accessToken()); }
async function declineInvite(conId) { return supaRpc("decline_invite", { target_con: conId }, await Auth.accessToken()); }
async function listMyInvites() {
  const token = await Auth.accessToken();
  if (!token) return [];
  return supaRpc("list_my_invites", {}, token).catch(() => []);
}

// Geteilte "Du hast offene Einladungen"-Anzeige — auf jeder Seite nach Login-Status-
// Änderungen aufrufbar. Rendert nichts, wenn keine offenen Einladungen vorliegen.
async function renderPendingInvites(container, onChange) {
  const invites = await listMyInvites();
  if (!invites.length) { container.innerHTML = ""; container.hidden = true; return; }
  container.hidden = false;
  container.innerHTML = invites.map(inv => `
    <div class="invite-banner" role="status">
      <span>${tr("inviteBanner", { role: `<strong>${esc(inv.role === "admin" ? tr("roleAdmin") : tr("roleEditor"))}</strong>`, con: `<strong>${esc(inv.con_name)}</strong>` })}</span>
      <button type="button" class="primary small acceptInviteBtn" data-con="${esc(inv.con_id)}">${esc(tr("accept"))}</button>
      <button type="button" class="small declineInviteBtn" data-con="${esc(inv.con_id)}">${esc(tr("decline"))}</button>
    </div>`).join("");
  container.querySelectorAll(".acceptInviteBtn").forEach(btn => btn.addEventListener("click", async () => {
    try { await acceptInvite(btn.dataset.con); await renderPendingInvites(container, onChange); onChange?.(); }
    catch (err) { alert(tr("acceptFailed", { err: err.message })); }
  }));
  container.querySelectorAll(".declineInviteBtn").forEach(btn => btn.addEventListener("click", async () => {
    try { await declineInvite(btn.dataset.con); await renderPendingInvites(container, onChange); onChange?.(); }
    catch (err) { alert(tr("declineFailed", { err: err.message })); }
  }));
}

/* ---------- Playabl: Communities/Events (für den Con-Picker) ---------- */
async function playablApi(path) {
  const r = await fetch(`${PLAYABL}/rest/v1/${path}`, { headers: { apikey: PLAYABL_ANON, Authorization: "Bearer " + PLAYABL_ANON } });
  if (!r.ok) throw new Error("Playabl HTTP " + r.status);
  return r.json();
}
const loadPlayablEventsList = () =>
  playablApi(`community_events?select=id,title,start_time,community_id(id,name)&draft_state=eq.PUBLISHED&deleted_at=is.null&order=start_time.desc&limit=150`).catch(() => []);
