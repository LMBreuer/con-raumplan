/* ---------- Kleine Helfer ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function slugify(name) {
  const base = (name || "con").toLowerCase()
    .replace(/[äöüß]/g, c => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c]))
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "con";
  return base + "-" + Math.random().toString(36).slice(2, 6);
}
function loomspunMigrationUrl(path = "") {
  const target = new URL(path, "https://lmbreuer.github.io/loomspun/");
  target.search = location.search;
  target.hash = location.hash;
  return target.href;
}
document.addEventListener("click", event => {
  const link = event.target.closest("a[data-loomspun-path]");
  if (link) link.href = loomspunMigrationUrl(link.dataset.loomspunPath);
});
