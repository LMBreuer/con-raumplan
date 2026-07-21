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
];

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

// Gemeinfreie Hokusai-Scans (Wikimedia Commons, >150 Jahre alt), selbst
// gehostet statt gehotlinkt — eines zufällig pro Seitenaufruf als sehr
// dezenter Hintergrund fürs Ukiyo-e-Theme (Deckkraft steckt in theme.css).
const UKIYO_BACKGROUNDS = ["images/ukiyo/great-wave.jpg", "images/ukiyo/red-fuji.jpg", "images/ukiyo/thunderstorm.jpg"];
function pickUkiyoBackground() {
  const pick = UKIYO_BACKGROUNDS[Math.floor(Math.random() * UKIYO_BACKGROUNDS.length)];
  document.documentElement.style.setProperty("--ukiyo-bg", `url("${pick}")`);
}
function applyTheme(key) {
  document.documentElement.setAttribute("data-theme", key);
  try { localStorage.setItem("raumplan-theme", key); } catch {}
  if (key === "terminal") terminalEasterEgg();
  updateCatEasterEgg();
  if (key === "ukiyo") pickUkiyoBackground();
}

function renderThemeSwitch(container) {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  if (current === "terminal") terminalEasterEgg();
  if (current === "ukiyo") pickUkiyoBackground();
  updateCatEasterEgg();
  container.className = "theme-switch";
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", tr("themeSwitchLabel"));
  container.innerHTML = THEMES.map(th =>
    `<button type="button" data-theme-key="${th.key}" aria-pressed="${String(th.key === current)}" title="${esc(tr(th.nameKey))}" aria-label="${esc(tr(th.nameKey))}">${th.label}</button>`
  ).join("");
  container.addEventListener("click", e => {
    const btn = e.target.closest("button[data-theme-key]");
    if (!btn) return;
    applyTheme(btn.dataset.themeKey);
    container.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
  });
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
    themeDark: "Dunkel", themeLight: "Hell", themeContrast: "Kontrastreich", themeColorful: "Bunt",
    themeTerminal: "Terminal", themeCyberpunk: "Cyberpunk", themeUkiyo: "Ukiyo-e",
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
    headerLabel: "Kopfzeile", heroSub: "Wer spielt wann wo? Raum- und Tischverteilung für Tabletop-Cons — mit Playabl-Anbindung, für beliebig viele Conventions gleichzeitig.",
    loadingCons: "Lade Cons …", openConDirectly: "Con direkt öffnen", openConHint: "Link oder ID einer bestehenden Con einfügen.",
    directInputPlaceholder: "z.B. 3w6-con-2026-a1b2 oder ein plan.html-Link", open: "Öffnen",
    existingCons: "Bestehende Cons", existingConsHint: "Zeigt Cons mit verknüpftem Playabl-Event oder bewusst gelistete manuelle Cons. Bearbeiten kann nur, wer Mitglied der jeweiligen Crew ist.",
    searchCon: "Con suchen …",
    createConTitle: "Neue Con für die Raumplanung anlegen", createConHint: "Du wirst automatisch erstes Crew-Mitglied dieser Con.",
    conTypePlayabl: "Mit Playabl-Event", conTypeManual: "Rein manuell (kein Playabl)",
    community: "Community", event: "Event", eventIdDirect: "… oder Event-ID direkt",
    manualHint: "Ohne Playabl-Event gibt es keine automatisch geladenen Spiele — Spiele/Programmpunkte werden im Raumplan manuell angelegt.",
    conNameLabel: "Name der Con", conListedLabel: "In „Bestehende Cons“ öffentlich auflisten",
    createConBtn: "Con anlegen", unlisted: "ungelistet", createdOn: "angelegt {date}", playablEvent: "Playabl-Event",
    delete: "Löschen", openArrow: "Öffnen →", noConFound: "Noch keine Con gefunden.",
    confirmDeleteCon: "„{name}“ inkl. aller Räume/Tische/Zuordnungen/Änderungswünsche UNWIDERRUFLICH löschen?",
    deleteFailed: "Löschen fehlgeschlagen: {err}", pleaseLoginFirst: "Bitte zuerst einloggen oder registrieren.",
    pleaseEnterConName: "Bitte einen Namen für die Con eingeben.", createConFailed: "Anlegen fehlgeschlagen: {err}",
    dataLoadFailed: "Daten konnten nicht geladen werden ({err}).", asOf: "Stand: {date} Uhr",
    imprint: "Impressum",
    // plan.html — Kopfzeile/Dialoge (Teil 1)
    backToCons: "← alle Cons", loading: "Lädt …", loadingData: "Lade Daten …",
    globalSearchPlaceholder: "Spiel, Raum oder Tisch suchen …",
    viewLabel: "Ansicht", detailsLabel: "Details", printCurrentView: "Aktuelle Ansicht drucken",
    printBtn: "🖨️ Drucken", crewLabel: "Crew",
    footPlayabl: "Spiele werden bei jedem Öffnen live von der Playabl-API geladen; Plätze = Spielplätze + 1 anbietende Person.",
    footRequest: "Über „Änderung vorschlagen“ am Spiel kann jede*r der Crew einen Wunsch schicken — bitte kurz begründen.",
    proposeChange: "Änderung vorschlagen", concerns: "Betrifft", reqMsgLabel: "Was soll anders sein – und warum? *",
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
    selectedClickTable: "✓ ausgewählt — Tisch anklicken", selectBtn: "Auswählen", chooseTable: "– Tisch wählen –",
    assignTableFor: "Tisch zuweisen für {title}", removeFromTable: "{title} vom Tisch entfernen", deleteItemNamed: "{title} löschen",
    gamesLabel: "Spiele", roomsLabel: "Räume", tablesLabel: "Tische",
    legendColorRoom: "Farbe = Raum", legendDashedWorkshop: "gestrichelt = Workshop", legendOverCapacity: "über Kapazität (blockiert nichts)",
    noSearchResults: "Keine Treffer für diese Suche.", noGamesYet: "Noch keine Spiele.",
    tableCaption: "Alle Spiele mit Slot, Raum, Tisch und Plätzen",
    gameCol: "Spiel", slotCol: "Slot", roomCol: "Raum", tableCol: "Tisch", seatsCol: "Plätze",
    noRoomsYet: "Noch keine Räume angelegt.", noSlotsYet: "Noch keine Slots angelegt.",
    viewRaster: "Raster", viewTable: "Tabelle", viewRooms: "Räume",
    crewViewAssign: "Zuordnen", crewViewRooms: "Räume verwalten", crewViewGames: "Spiele verwalten",
    crewViewRequests: "Änderungswünsche", crewViewCrew: "Crew verwalten",
    // plan.html — Raster/Räume/Zuordnen
    noGames: "Keine Spiele", flipAxisBtn: "⇄ Achsen tauschen (aktuell: {axis})", axisSlotsRows: "Slots als Zeilen", axisRoomsRows: "Räume als Zeilen",
    chooseSlotAriaLabel: "Slot wählen", editSlotTitle: "Aktuellen Termin ({label}) umbenennen/löschen", editSlotAriaLabel: "Aktuellen Termin umbenennen oder löschen",
    addSlotTitle: "Neuen Termin anlegen (z.B. für einen weiteren Tag) — Zeitabschnitts-Vorlagen wie „Vormittag/Nachmittag“ liegen unter „Räume verwalten“",
    addSlotAriaLabel: "Neuen Termin anlegen", addSlotBtnLabel: "+ Slot",
    locationLabel: "Lage: {floor}", noTablesYet: "Noch keine Tische.", seatsCountLabel: "{n} Plätze", freeLabel: "frei",
    addFirstSlotBtn: "+ ersten Slot anlegen",
    minSeatsFilterLabel: "Spiele mit mind. {stepper} Plätzen", reqFilterLabel: "Anforderungen: {picker}",
    minTableSeatsFilterLabel: "Tische ab {stepper} Plätzen hervorheben", reqSatisfiedFilterLabel: "Anforderungen erfüllt: {picker}",
    queueHintClick: "Wähle ein Spiel aus und klicke dann auf einen Tisch (oder auf „Noch ohne Tisch“, um es dort abzulegen).",
    queueHintDnd: "Ziehe ein Spiel auf einen Tisch oder nutze das Auswahlfeld am Spiel.",
    unassignedTitle: "Noch ohne Tisch", allAssigned: "🎉 Alles zugeordnet.",
    doubleBooked: "doppelt belegt!", doesNotMeet: "Erfüllt nicht: {tags}", missingTags: "fehlt: {tags}",
    noTablesCreateInRooms: "Noch keine Tische — in „Räume verwalten“ anlegen.", noRoomsGoToManage: "Noch keine Räume angelegt. Wechsle zu „Räume verwalten“.",
    assignModeAriaLabel: "Zuordnungs-Modus", dragDropLabel: "🖐️ Drag & Drop", singleSelectLabel: "🖱️ Einzelauswahl",
    autoAssignBtn: "⚙️ Auto-Zuordnung (dieser Slot)", autoAssignInfoAriaLabel: "Was macht Auto-Zuordnung? (Erklärung öffnen)",
    unscheduledCount: "{n} Spiel(e) ohne Slot", moveToActiveSlot: "→ in diesen Slot",
    bucketTimeRange: "{start}–{end} Uhr", inactiveBadge: "inaktiv", noBucketsYet: "Noch keine Zeitabschnitte definiert.",
    editBucketAriaLabel: "Zeitabschnitt {label} bearbeiten", bucketsTitle: "Zeitabschnitte (Slot-Vorlagen)",
    bucketsHint: "Bestimmen, wie Playabl-Spiele automatisch in Tages-Slots einsortiert werden (z.B. Vormittag/Nachmittag) — beliebig viele Abschnitte möglich, wirkt erst auf neue Tage.",
    addBucketBtn: "+ Zeitabschnitt", editTableAriaLabel: "Tisch {name} bearbeiten", deleteTableAriaLabel: "Tisch {name} löschen",
    addTableBtn: "+ Tisch", editRoomAriaLabel: "Raum {name} bearbeiten", deleteRoomAriaLabel: "Raum {name} löschen", addRoomBtn: "+ Raum",
    editItemNamed: "{title} bearbeiten", editBtnLabel: "✎ bearbeiten", deleteBtnLabel: "🗑 löschen",
    noManualGamesYet: "Noch keine manuellen Spiele angelegt.", playablGamesTitle: "Spiele von Playabl",
    playablGamesHint: "Live von Playabl geladen — hier nur zur Übersicht, bearbeitbar nur direkt auf Playabl.",
    addGameBtn: "+ Spiel", manualGamesTitle: "Manuelle Spiele", manualGamesHint: "Selbst angelegt — hier bearbeitbar, inkl. optionalem Slot.",
    fromContact: "von {contact}", general: "Allgemein",
    statusOpen: "offen", statusDone: "erledigt", statusRejected: "abgelehnt",
    statusDoneBtn: "✓ erledigt", statusRejectedBtn: "✕ abgelehnt", statusOpenBtn: "↻ offen",
    crewNotePlaceholder: "Crew-Notiz", showDoneCheckbox: "auch erledigte/abgelehnte anzeigen", noOpenRequests: "Keine offenen Änderungswünsche.",
    crewTitle: "Crew", adminCanManage: "Als Admin kannst du Rollen ändern und Mitglieder entfernen.",
    onlyAdminsCanManage: "Nur Admins können die Crew verwalten — du siehst die Liste read-only.",
    inviteTitle: "Einladen", inviteEmailLabel: "E-Mail (muss bereits registriert sein)", roleLabel: "Rolle", inviteBtn: "Einladen",
    toEditor: "→ Bearbeiter", toAdmin: "→ Admin", removeBtn: "Entfernen", noMembersFound: "Keine Mitglieder gefunden.",
    saveFailed: "Speichern fehlgeschlagen: {err}", nothingToAssign: "Nichts zuzuordnen – entweder alles verteilt oder keine passenden freien Tische.",
    autoAssignResult: "Auto-Zuordnung: {n} Spiele zugeordnet{rest}.", autoAssignRest: ", {n} weiterhin ohne passenden Tisch",
    confirmDeleteGame: "Spiel löschen?", confirmDeleteRoom: "Raum samt Tischen löschen?", confirmDeleteTable: "Tisch löschen?",
    confirmRemoveCrew: "Diese Person aus der Crew entfernen?", inviteSent: "{email} wurde eingeladen — wird aktiv, sobald die Person zustimmt.",
    thanksMsg: "Danke!", thanksFullMsg: "Danke! Dein Wunsch ist bei der Crew gelandet.", sendFailed: "Senden fehlgeschlagen: {err}",
    removeFromFilterAriaLabel: "{label} aus Filter entfernen", addRequirementToFilterAriaLabel: "Anforderung zum Filter hinzufügen",
    addRequirementOption: "+ Anforderung", removeTagAriaLabel: "{label} entfernen", noneSelectedYet: "Noch keine ausgewählt.",
    addFeatureAriaLabel: "Eigenschaft hinzufügen", addFeatureOption: "+ Eigenschaft hinzufügen",
    confirmDeleteSlot: "Slot löschen? Nur möglich, wenn ihm keine Spiele mehr zugeordnet sind.",
    deleteFailedSlot: "Löschen fehlgeschlagen (sind noch Spiele in diesem Slot?): {err}",
    confirmDeleteBucket: "Zeitabschnitt löschen? Bereits angelegte Slots bleiben erhalten.",
    deleteFailed: "Löschen fehlgeschlagen: {err}",
    noSlotOption: "– kein Slot –",
    detailMinimal: "Minimal", detailMinimalName: "Minimal — nur Titel + Plätze, einzeilig",
    detailMedium: "Mittel", detailMediumName: "Mittel — zusätzlich Anbieter/Workshop",
    detailFull: "Voll", detailFullName: "Voll — alle Details (Slot, Uhrzeit, Raum/Tisch)",
    superadminBanner: "🛡️ Du bearbeitest diese Con als Super-Admin (unabhängig von einer eigenen Crew-Mitgliedschaft).",
    loggedInNotCrew: "Du bist eingeloggt, aber (noch) nicht Teil der Crew dieser Con — du siehst die öffentliche Ansicht.",
    publicViewLogin: "Öffentliche Ansicht. Crew-Mitglieder können sich oben einloggen.",
    conNotFound: "Diese Con wurde nicht gefunden.", backToOverview: "Zurück zur Übersicht",
    pageSubPlayabl: "Spiele von Playabl-Event {id}", pageSubManual: "Kein Playabl-Event verknüpft — nur manuelle Spiele.",
    backGeneric: "← zurück",
    imprintIntro: "Con-Raumplan ist ein privates, nicht-kommerzielles Community-Projekt ohne Werbung oder Bezahlschranke.",
    imprintResponsible: "Verantwortlich:", imprintContact: "Kontakt:", imprintDisclaimer: "Diese Angaben sind keine Rechtsberatung.",
  },
  en: {
    themeDark: "Dark", themeLight: "Light", themeContrast: "High contrast", themeColorful: "Colorful",
    themeTerminal: "Terminal", themeCyberpunk: "Cyberpunk", themeUkiyo: "Ukiyo-e",
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
    headerLabel: "Header", heroSub: "Who's playing what, when, where? Room and table assignment for tabletop cons — with Playabl integration, for any number of conventions at once.",
    loadingCons: "Loading cons …", openConDirectly: "Open a con directly", openConHint: "Paste a link or ID of an existing con.",
    directInputPlaceholder: "e.g. 3w6-con-2026-a1b2 or a plan.html link", open: "Open",
    existingCons: "Existing cons", existingConsHint: "Shows cons with a linked Playabl event, or manual cons that chose to be listed. Only crew members of a con can edit it.",
    searchCon: "Search cons …",
    createConTitle: "Create a new con for room planning", createConHint: "You'll automatically become that con's first crew member.",
    conTypePlayabl: "With a Playabl event", conTypeManual: "Fully manual (no Playabl)",
    community: "Community", event: "Event", eventIdDirect: "… or event ID directly",
    manualHint: "Without a Playabl event, no games load automatically — games/programme items are added manually in the room plan.",
    conNameLabel: "Con name", conListedLabel: "List publicly under “Existing cons”",
    createConBtn: "Create con", unlisted: "unlisted", createdOn: "created {date}", playablEvent: "Playabl event",
    delete: "Delete", openArrow: "Open →", noConFound: "No con found yet.",
    confirmDeleteCon: "Permanently delete “{name}” including all rooms/tables/assignments/change requests?",
    deleteFailed: "Delete failed: {err}", pleaseLoginFirst: "Please log in or register first.",
    pleaseEnterConName: "Please enter a name for the con.", createConFailed: "Creating failed: {err}",
    dataLoadFailed: "Data could not be loaded ({err}).", asOf: "As of: {date}",
    imprint: "Legal notice",
    // plan.html — header/dialogs (part 1)
    backToCons: "← all cons", loading: "Loading …", loadingData: "Loading data …",
    globalSearchPlaceholder: "Search game, room or table …",
    viewLabel: "View", detailsLabel: "Detail", printCurrentView: "Print current view",
    printBtn: "🖨️ Print", crewLabel: "Crew",
    footPlayabl: "Games are loaded live from the Playabl API on every visit; seats = game seats + 1 GM.",
    footRequest: "Anyone on the crew can send a change request via “Propose change” on a game — please explain briefly.",
    proposeChange: "Propose change", concerns: "Regarding", reqMsgLabel: "What should be different – and why? *",
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
    selectedClickTable: "✓ selected — click a table", selectBtn: "Select", chooseTable: "– choose table –",
    assignTableFor: "Assign table for {title}", removeFromTable: "Remove {title} from table", deleteItemNamed: "Delete {title}",
    gamesLabel: "Games", roomsLabel: "Rooms", tablesLabel: "Tables",
    legendColorRoom: "Color = room", legendDashedWorkshop: "dashed = workshop", legendOverCapacity: "over capacity (blocks nothing)",
    noSearchResults: "No results for this search.", noGamesYet: "No games yet.",
    tableCaption: "All games with slot, room, table and seats",
    gameCol: "Game", slotCol: "Slot", roomCol: "Room", tableCol: "Table", seatsCol: "Seats",
    noRoomsYet: "No rooms set up yet.", noSlotsYet: "No slots set up yet.",
    viewRaster: "Grid", viewTable: "Table", viewRooms: "Rooms",
    crewViewAssign: "Assign", crewViewRooms: "Manage rooms", crewViewGames: "Manage games",
    crewViewRequests: "Change requests", crewViewCrew: "Manage crew",
    // plan.html — grid/rooms/assign
    noGames: "No games", flipAxisBtn: "⇄ Swap axes (currently: {axis})", axisSlotsRows: "slots as rows", axisRoomsRows: "rooms as rows",
    chooseSlotAriaLabel: "Choose slot", editSlotTitle: "Rename/delete current slot ({label})", editSlotAriaLabel: "Rename or delete current slot",
    addSlotTitle: "Add a new slot (e.g. for another day) — time-block templates like “morning/afternoon” live under “Manage rooms”",
    addSlotAriaLabel: "Add new slot", addSlotBtnLabel: "+ Slot",
    locationLabel: "Location: {floor}", noTablesYet: "No tables yet.", seatsCountLabel: "{n} seats", freeLabel: "free",
    addFirstSlotBtn: "+ Add first slot",
    minSeatsFilterLabel: "Games with at least {stepper} seats", reqFilterLabel: "Requirements: {picker}",
    minTableSeatsFilterLabel: "Highlight tables with at least {stepper} seats", reqSatisfiedFilterLabel: "Requirements met: {picker}",
    queueHintClick: "Select a game, then click a table (or click “Unassigned” to drop it there).",
    queueHintDnd: "Drag a game onto a table, or use the dropdown on the game.",
    unassignedTitle: "Unassigned", allAssigned: "🎉 Everything's assigned.",
    doubleBooked: "double-booked!", doesNotMeet: "Doesn't meet: {tags}", missingTags: "missing: {tags}",
    noTablesCreateInRooms: "No tables yet — add some under “Manage rooms”.", noRoomsGoToManage: "No rooms yet. Switch to “Manage rooms”.",
    assignModeAriaLabel: "Assignment mode", dragDropLabel: "🖐️ Drag & drop", singleSelectLabel: "🖱️ Single-select",
    autoAssignBtn: "⚙️ Auto-assign (this slot)", autoAssignInfoAriaLabel: "What does auto-assign do? (open explanation)",
    unscheduledCount: "{n} game(s) without a slot", moveToActiveSlot: "→ to this slot",
    bucketTimeRange: "{start}–{end}", inactiveBadge: "inactive", noBucketsYet: "No time blocks defined yet.",
    editBucketAriaLabel: "Edit time block {label}", bucketsTitle: "Time blocks (slot templates)",
    bucketsHint: "Determine how Playabl games are automatically sorted into daily slots (e.g. morning/afternoon) — any number of blocks possible, only affects new days.",
    addBucketBtn: "+ Time block", editTableAriaLabel: "Edit table {name}", deleteTableAriaLabel: "Delete table {name}",
    addTableBtn: "+ Table", editRoomAriaLabel: "Edit room {name}", deleteRoomAriaLabel: "Delete room {name}", addRoomBtn: "+ Room",
    editItemNamed: "Edit {title}", editBtnLabel: "✎ edit", deleteBtnLabel: "🗑 delete",
    noManualGamesYet: "No manual games created yet.", playablGamesTitle: "Games from Playabl",
    playablGamesHint: "Loaded live from Playabl — overview only here, edit directly on Playabl.",
    addGameBtn: "+ Game", manualGamesTitle: "Manual games", manualGamesHint: "Created here — editable here, including an optional slot.",
    fromContact: "from {contact}", general: "General",
    statusOpen: "open", statusDone: "done", statusRejected: "rejected",
    statusDoneBtn: "✓ done", statusRejectedBtn: "✕ rejected", statusOpenBtn: "↻ open",
    crewNotePlaceholder: "Crew note", showDoneCheckbox: "also show done/rejected", noOpenRequests: "No open change requests.",
    crewTitle: "Crew", adminCanManage: "As an admin you can change roles and remove members.",
    onlyAdminsCanManage: "Only admins can manage the crew — you're seeing a read-only list.",
    inviteTitle: "Invite", inviteEmailLabel: "Email (must already be registered)", roleLabel: "Role", inviteBtn: "Invite",
    toEditor: "→ Editor", toAdmin: "→ Admin", removeBtn: "Remove", noMembersFound: "No members found.",
    saveFailed: "Save failed: {err}", nothingToAssign: "Nothing to assign – everything is placed, or no fitting free tables.",
    autoAssignResult: "Auto-assign: {n} games assigned{rest}.", autoAssignRest: ", {n} still without a fitting table",
    confirmDeleteGame: "Delete game?", confirmDeleteRoom: "Delete room including all its tables?", confirmDeleteTable: "Delete table?",
    confirmRemoveCrew: "Remove this person from the crew?", inviteSent: "{email} was invited — becomes active once they accept.",
    thanksMsg: "Thanks!", thanksFullMsg: "Thanks! Your request has reached the crew.", sendFailed: "Send failed: {err}",
    removeFromFilterAriaLabel: "Remove {label} from filter", addRequirementToFilterAriaLabel: "Add requirement to filter",
    addRequirementOption: "+ Requirement", removeTagAriaLabel: "Remove {label}", noneSelectedYet: "None selected yet.",
    addFeatureAriaLabel: "Add feature", addFeatureOption: "+ Add feature",
    confirmDeleteSlot: "Delete slot? Only possible if no games are assigned to it anymore.",
    deleteFailedSlot: "Delete failed (are there still games in this slot?): {err}",
    confirmDeleteBucket: "Delete time block? Slots already created stay intact.",
    deleteFailed: "Delete failed: {err}",
    noSlotOption: "– no slot –",
    detailMinimal: "Minimal", detailMinimalName: "Minimal — title + seats only, single line",
    detailMedium: "Medium", detailMediumName: "Medium — plus provider/workshop",
    detailFull: "Full", detailFullName: "Full — all details (slot, time, room/table)",
    superadminBanner: "🛡️ You're editing this con as super-admin (independent of your own crew membership).",
    loggedInNotCrew: "You're logged in, but not (yet) part of this con's crew — you're seeing the public view.",
    publicViewLogin: "Public view. Crew members can log in above.",
    conNotFound: "This con was not found.", backToOverview: "Back to overview",
    pageSubPlayabl: "Games from Playabl event {id}", pageSubManual: "No Playabl event linked — manual games only.",
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
  container.className = "theme-switch";
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
    document.getElementById("authErr").textContent = "";
    document.getElementById("authOk").textContent = "";
  }
  document.getElementById("tabLogin").addEventListener("click", () => setAuthMode("login"));
  document.getElementById("tabSignup").addEventListener("click", () => setAuthMode("signup"));

  const btn = document.getElementById(buttonId);
  function refresh() { btn.textContent = Auth.session() ? tr("logout") : tr("loginRegister"); }
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
