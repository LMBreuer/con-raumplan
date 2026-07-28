# Con-Raumplan

Raum- und Tischverteilung für Con-Events mit [Playabl](https://playabl.io)-Anbindung —
statisch gehostet (GitHub Pages), **mandantenfähig**: eine Installation kann beliebig viele
unabhängige Cons verwalten, jede mit eigener Crew und eigenem Datenbestand.

**Schwester-Projekt:** [playabl-dashboard](https://github.com/LMBreuer/playabl-dashboard) (Spielangebot pro Slot).

## Aufbau

- **`index.html`** — Landing-Seite: Login/Registrierung, Verzeichnis aller Cons, neue Con
  anlegen (Playabl-Community/-Event wählen oder Event-ID eintragen).
- **`plan.html`** — der eigentliche Raumplan einer Con (`plan.html?con=<slug>`): öffentliche
  Ansicht + Crew-Modus (Räume/Tische, Auto-Zuordnung, Drag&Drop/Dropdown, Änderungswünsche,
  Crew-Verwaltung, Druckansicht).
- **`theme-tokens.css`** — gemeinsame Theme-Grundwerte für Raumplan und Playabl-Dashboard.
- **`theme-effects.css`** — dekorative und bewegte Theme-Effekte.
- **`app.css`** — gemeinsame Komponenten sowie Landing- und Raumplan-Layouts.
- **`app-config.js`** / **`utils.js`** — Konfiguration und kleine Hilfsfunktionen.
- **`themes.js`** / **`i18n.js`** — Theme-Verhalten und Übersetzungen.
- **`supabase-api.js`** / **`auth.js`** / **`playabl-api.js`** — Datenzugriff und Authentifizierung.
- **`landing.js`** — Logik der Con-Übersicht.
- **`plan-core.js`** — Con-Auflösung, Store, Zustand und fachliche Helfer.
- **`plan-render-public.js`** / **`plan-render-crew.js`** — HTML-Erzeugung für öffentliche
  Ansichten beziehungsweise Crew-Werkzeuge.
- **`plan-print.js`** — Druckansichten und Druckoptionen.
- **`plan-commands.js`** — speichernde Raumplan-Aktionen.
- **`plan-interactions.js`** / **`plan-dialogs.js`** — Bedienereignisse, Drag-and-drop,
  Tooltips und Dialoge.
- **`plan-start.js`** — Initialisierung, Auth-Rollen und geführte Rundgänge.
- **`supabase-schema.sql`** — komplettes Datenbankschema inkl. Zugriffsregeln.

## Gemeinsame Themes

`theme-tokens.css` ist die zentrale Quelle für Farben, Typografie, Radien und Schatten beider
Schwesterprojekte. Änderungen an einem Theme erfolgen dort einmal und werden vom Playabl-Dashboard
über GitHub Pages übernommen. Komponentenregeln bleiben in `app.css` beziehungsweise
`dashboard.css`, damit Änderungen an Raumplan und Dashboard nicht gegenseitig ihr Layout brechen.

## Wie eine Con funktioniert

Jede eingeloggte Person kann über `index.html` eine neue Con anlegen und wird dabei automatisch
deren erstes Crew-Mitglied. Nur Crew-Mitglieder einer Con dürfen deren Räume/Tische/Zuordnungen
bearbeiten und die Änderungswünsche-Inbox lesen — ein Konto allein gibt nirgends automatisch
Rechte. Weitere Crew-Mitglieder werden im Raumplan unter „Crew verwalten" per E-Mail-Adresse
eingeladen (die Person muss vorher bereits ein eigenes Konto registriert haben).

## Setup (einmalig, pro Supabase-Projekt)

1. Auf [supabase.com](https://supabase.com) kostenloses Projekt anlegen.
2. **SQL Editor** → Inhalt von [`supabase-schema.sql`](supabase-schema.sql) vollständig einfügen
   → Run. Das Skript ist auch für eine bestehende aktuelle Installation geeignet, löscht keine
   Anwendungsdaten und kann für spätere Schema-Aktualisierungen erneut ausgeführt werden.
3. **Authentication → Providers → Email:**
   - **„Allow new users to sign up"** → **an** (jede Person registriert sich selbst; das Konto
     allein gibt keine Rechte, siehe oben).
   - **„Confirm email"** → **aus** empfohlen (nimmt Reibung raus, da Rechte ohnehin erst durch
     Con-Mitgliedschaft entstehen).
4. **Project Settings → API:** `Project URL` und `anon public`/`publishable` Key in `app-config.js`
   (`CONFIG.supabase`) eintragen.
5. Hosten: Repo auf GitHub, **Settings → Pages → Deploy from a branch → main**.

## Zählweise

Personen pro Spiel = Playabl-Spielplätze **+ 1 anbietende Person**; Tisch-Plätze meinen dasselbe
(Spielende inkl. SL). Workshops/Panels werden erkannt (Titel/System enthält „Workshop/Panel/
Vortrag") und bei der Auto-Zuordnung bevorzugt in Räume mit „Bewegung ok"/„laut ok" gesetzt.

## Sicherheit

Die Seite ist rein statisch — jeglicher Zugriffsschutz läuft über Postgres Row-Level-Security
in Supabase, nicht über Anwendungscode. Kurzfassung der Regeln (Details in
`supabase-schema.sql`): Räume/Tische/Zuordnungen sind öffentlich lesbar, änderbar nur für
Crew-Mitglieder der jeweiligen Con; Änderungswünsche können anonym eingereicht, aber nur von
der Crew gelesen werden; ein Tisch kann nie auf den Raum einer anderen Con zeigen
(zusammengesetzte Fremdschlüssel verhindern das schema-seitig).
