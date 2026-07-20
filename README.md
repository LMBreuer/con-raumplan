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
- **`theme.css`** — vier Farbschemata (Dunkel/Hell/Kontrastreich/Bunt), umschaltbar im Header.
- **`common.js`** — geteilte Konfiguration, Auth, Supabase- und Playabl-Helfer.
- **`supabase-schema.sql`** — komplettes Datenbankschema inkl. Zugriffsregeln.

## Wie eine Con funktioniert

Jede eingeloggte Person kann über `index.html` eine neue Con anlegen und wird dabei automatisch
deren erstes Crew-Mitglied. Nur Crew-Mitglieder einer Con dürfen deren Räume/Tische/Zuordnungen
bearbeiten und die Änderungswünsche-Inbox lesen — ein Konto allein gibt nirgends automatisch
Rechte. Weitere Crew-Mitglieder werden im Raumplan unter „Crew verwalten" per E-Mail-Adresse
eingeladen (die Person muss vorher bereits ein eigenes Konto registriert haben).

## Setup (einmalig, pro Supabase-Projekt)

1. Auf [supabase.com](https://supabase.com) kostenloses Projekt anlegen.
2. **SQL Editor** → Inhalt von [`supabase-schema.sql`](supabase-schema.sql) einfügen → Run.
   ⚠️ Der Script-Teil unter „TESTDATEN VERWERFEN" leert `rooms`/`tables`/`assignments`/`requests`
   komplett — nur auf einer frischen bzw. absichtlich zurückgesetzten Datenbank ausführen.
3. **Authentication → Providers → Email:**
   - **„Allow new users to sign up"** → **an** (jede Person registriert sich selbst; das Konto
     allein gibt keine Rechte, siehe oben).
   - **„Confirm email"** → **aus** empfohlen (nimmt Reibung raus, da Rechte ohnehin erst durch
     Con-Mitgliedschaft entstehen).
4. **Project Settings → API:** `Project URL` und `anon public`/`publishable` Key in `common.js`
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
