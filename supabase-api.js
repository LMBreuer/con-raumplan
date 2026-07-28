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
