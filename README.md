# Con-Raumplan

Raum- und Tischverteilung für Con-Events mit [Playabl](https://playabl.io)-Anbindung —
statisch gehostet (GitHub Pages), Spiele werden bei jedem Öffnen live von der Playabl-API geladen.

**Schwester-Projekt:** [playabl-dashboard](https://github.com/LMBreuer/playabl-dashboard) (Spielangebot pro Slot).

## Was es kann

- **Öffentliche Ansicht:** pro Slot (Vormittag/Nachmittag je Tag) alle Räume mit ihren Tischen und
  den zugeordneten Spielen; Raum-Eigenschaften als Badges (barrierefrei, ruhig, Stock, …);
  Suche; „Noch ohne Tisch"-Liste; **„Änderung vorschlagen"** an jedem Spiel → landet in der Orga-Inbox.
- **Orga-Modus** (Login): Räume & Tische anlegen/bearbeiten (Metadaten: Stock, barrierefrei,
  Akustik, Temperatur, Tageslicht, Steckdosen, Beamer, „Bewegung ok", Freitext),
  **Auto-Zuordnung** pro Slot (Kapazitäts-best-fit, Two-Shots bleiben am selben Tisch, Workshops in
  große/bewegungstaugliche Räume), Umordnen per **Drag & Drop oder Auswahlfeld**, Konfliktwarnungen
  (doppelt belegt, über Kapazität), manuelle Programmpunkte, **Änderungswünsche-Inbox** mit Status.
- **Druck-Ansicht:** „Drucken" gibt den aktiven Slot als sauberen Aushang aus.

## Setup

### 1. Supabase (Datenspeicher, kostenlos)

Die Seite braucht einen Ort für Räume/Zuordnungen/Änderungswünsche. Ohne Konfiguration läuft sie im
**Demo-Modus** (Speicherung nur im eigenen Browser) — gut zum Ausprobieren, ungeeignet für den Ernstfall.

1. Auf [supabase.com](https://supabase.com) kostenloses Konto + neues Projekt anlegen.
2. Im Projekt: **SQL Editor** → Inhalt von [`supabase-schema.sql`](supabase-schema.sql) einfügen → Run.
3. **Authentication → Sign In / Up:** „Allow new users to sign up" **deaktivieren**.
   Orga-Konten unter **Authentication → Users → Add user** anlegen (E-Mail + Passwort).
4. **Project Settings → API:** `Project URL` und `anon public`-Key kopieren und in `index.html`
   im `CONFIG`-Block eintragen:

```js
supabase: {
  url: "https://DEIN-PROJEKT.supabase.co",
  anonKey: "eyJ…",   // der "anon public" Key – ist öffentlich, kein Geheimnis
},
```

> Sicherheit: Der anon-Key darf öffentlich sein. Was wer darf, regeln die Policies aus dem Schema:
> Lesen alle, Wünsche einreichen alle, ändern nur eingeloggte Orga.

### 2. Event einstellen

Im `CONFIG`-Block die Playabl-Event-ID setzen (steht in der Event-URL:
`app.playabl.io/events/104/…` → `104`). Zum Testen per URL überschreibbar: `?event=104`.

### 3. Hosten

Repo auf GitHub, **Settings → Pages → Deploy from a branch → main** — fertig.

## Moderation / Betrieb

- Änderungswünsche erscheinen im Orga-Modus unter „Änderungswünsche" (Zähler-Badge).
  Status: offen / erledigt / abgelehnt, plus interne Notiz.
- Wer mitmoderieren soll, bekommt ein Konto (Supabase → Authentication → Users → Add user).
- Anti-Spam: Honeypot-Feld + Mindestlänge; einreichbar sind nur Status-„offen"-Wünsche.

## Zählweise

Personen pro Spiel = Playabl-Spielplätze **+ 1 anbietende Person**; Tisch-Plätze meinen dasselbe
(Spielende inkl. SL). Workshops/Panels werden erkannt und bei der Auto-Zuordnung bevorzugt in
große Räume gesetzt.
