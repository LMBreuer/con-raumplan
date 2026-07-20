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
  { key: "dark", label: "🌙", name: "Dunkel" },
  { key: "light", label: "☀️", name: "Hell" },
  { key: "contrast", label: "◐", name: "Kontrastreich" },
  { key: "colorful", label: "🎨", name: "Bunt" },
];

function applyTheme(key) {
  document.documentElement.setAttribute("data-theme", key);
  try { localStorage.setItem("raumplan-theme", key); } catch {}
}

function renderThemeSwitch(container) {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  container.className = "theme-switch";
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", "Farbschema wählen");
  container.innerHTML = THEMES.map(t =>
    `<button type="button" data-theme-key="${t.key}" aria-pressed="${String(t.key === current)}" title="${esc(t.name)}" aria-label="${esc(t.name)}">${t.label}</button>`
  ).join("");
  container.addEventListener("click", e => {
    const btn = e.target.closest("button[data-theme-key]");
    if (!btn) return;
    applyTheme(btn.dataset.themeKey);
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
    if (!r.ok) throw new Error(j.error_description || j.msg || "Registrierung fehlgeschlagen");
    if (j.access_token) { this._store({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at }); return true; }
    return false; // Bestätigungsmail nötig (falls "Confirm email" doch aktiv ist)
  },
  async login(email, password) {
    const r = await fetch(`${CONFIG.supabase.url}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: CONFIG.supabase.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error_description || j.msg || "Login fehlgeschlagen");
    this._store({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at });
  },
  async refresh() {
    const s = this.session();
    if (!s) throw new Error("keine Sitzung");
    const r = await fetch(`${CONFIG.supabase.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: { apikey: CONFIG.supabase.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!r.ok) { this.logout(); throw new Error("Sitzung abgelaufen"); }
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
        <h2 id="authDlgH">Login / Registrierung</h2>
        <div class="slot-tabs" style="margin-bottom:var(--sp-3)">
          <button type="button" id="tabLogin" aria-pressed="true">Login</button>
          <button type="button" id="tabSignup" aria-pressed="false">Registrieren</button>
        </div>
        <p class="hint" id="authHint">Ein Konto allein gibt noch keine Rechte — die bekommst du erst als Crew-Mitglied einer Con.</p>
        <form method="dialog" id="authForm">
          <div class="frow"><label for="authEmail">E-Mail</label><input type="email" id="authEmail" autocomplete="username" required></div>
          <div class="frow"><label for="authPw">Passwort</label><input type="password" id="authPw" autocomplete="current-password" required minlength="6"></div>
          <p class="msg err" id="authErr" role="alert"></p>
          <p class="msg ok" id="authOk" role="status"></p>
          <div class="dactions">
            <button type="button" onclick="this.closest('dialog').close()">Abbrechen</button>
            <button type="submit" class="primary" id="authSubmit">Einloggen</button>
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
    document.getElementById("authSubmit").textContent = mode === "login" ? "Einloggen" : "Registrieren";
    document.getElementById("authErr").textContent = "";
    document.getElementById("authOk").textContent = "";
  }
  document.getElementById("tabLogin").addEventListener("click", () => setAuthMode("login"));
  document.getElementById("tabSignup").addEventListener("click", () => setAuthMode("signup"));

  const btn = document.getElementById(buttonId);
  function refresh() { btn.textContent = Auth.session() ? "Logout" : "Login / Registrieren"; }
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
        else { okEl.textContent = "Fast fertig — bitte den Bestätigungslink in deinem Postfach anklicken, dann hier erneut einloggen."; return; }
      }
      refresh();
      onChange?.();
    } catch (err) { errEl.textContent = err.message; }
  });
  refresh();
  return { refresh, requireLogin: () => { setAuthMode("login"); authDlg.showModal(); } };
}

/* ---------- Playabl: Communities/Events (für den Con-Picker) ---------- */
async function playablApi(path) {
  const r = await fetch(`${PLAYABL}/rest/v1/${path}`, { headers: { apikey: PLAYABL_ANON, Authorization: "Bearer " + PLAYABL_ANON } });
  if (!r.ok) throw new Error("Playabl HTTP " + r.status);
  return r.json();
}
const loadPlayablEventsList = () =>
  playablApi(`community_events?select=id,title,start_time,community_id(id,name)&draft_state=eq.PUBLISHED&deleted_at=is.null&order=start_time.desc&limit=150`).catch(() => []);
