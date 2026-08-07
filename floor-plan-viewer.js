/* Öffentliche, Fabric-unabhängige Lageplanansicht sowie Druck/PDF-Export. */
const FLOOR_PLAN_JSPDF_URL = "https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js";
let floorPlanPdfPromise = null;

function activeFloorPlanDocument() {
  const value = S.floorPlanPreviewDocument || S.floorPlanPublic?.document;
  return value ? normalizeFloorPlanDocument(value) : null;
}

function floorPlanViewerHtml() {
  const document = activeFloorPlanDocument();
  if (!document) return emptyState(tr("floorPlanEmptyPublic"));
  const activeFloor = document.floors.find(floor => floor.id === S.floorPlanViewerFloorId) || document.floors[0];
  S.floorPlanViewerFloorId = activeFloor.id;
  const floorTabs = document.floors.map(floor => `<button type="button" data-public-floor-plan-floor="${esc(floor.id)}" aria-pressed="${String(floor.id === activeFloor.id)}">${esc(floor.name)}</button>`).join("");
  const preview = S.floorPlanPreviewDocument ? `<div class="banner floor-plan-preview-banner">${esc(LANG === "en" ? "Draft preview – only you can see this version." : "Entwurfsvorschau – nur du siehst diesen Stand.")} <button type="button" id="floorPlanBackToEditor" class="small">${esc(LANG === "en" ? "Back to editor" : "Zurück zum Editor")}</button></div>` : "";
  return `${preview}<div class="floor-plan-public-layout">
    <section class="card floor-plan-public-card">
      <div class="floor-plan-public-head">
        <div><span class="floor-plan-editor-kicker">${esc(tr("floorPlan"))}</span><h2>${esc(document.title || S.con?.name || tr("floorPlan"))}</h2></div>
        <div class="floor-plan-public-actions"><button type="button" id="floorPlanDownloadPdfBtn">⇩ ${esc(tr("floorPlanDownloadPdf"))}</button><button type="button" id="floorPlanPrintBtn">⎙ ${esc(tr("printBtn"))}</button></div>
      </div>
      <div class="floor-plan-floor-tabs slot-tabs" role="group" aria-label="${esc(tr("floorPlanFloor"))}">${floorTabs}</div>
      <div class="floor-plan-public-stage">${floorPlanSvgHtml(document, activeFloor, { interactive: true, id: "publicFloorPlanSvg" })}</div>
      <p class="floor-plan-public-hint">${esc(LANG === "en" ? "Select a room for current games, location and direct navigation." : "Raum auswählen für aktuelle Spiele, Lagehinweis und direkte Navigation.")}</p>
    </section>
    <aside class="card floor-plan-room-detail" id="floorPlanRoomDetail" aria-live="polite">
      <span class="floor-plan-empty-glyph" aria-hidden="true">⌖</span>
      <h2>${esc(tr("floorPlanRoomDetails"))}</h2>
      <p class="hint">${esc(LANG === "en" ? "Select a coloured room on the map." : "Wähle einen farbigen Raum im Lageplan aus.")}</p>
    </aside>
  </div>`;
}

function mountFloorPlanViewer() {
  const document = activeFloorPlanDocument();
  if (!document) return;
  globalThis.document.querySelectorAll("[data-public-floor-plan-floor]").forEach(button => button.addEventListener("click", () => {
    S.floorPlanViewerFloorId = button.dataset.publicFloorPlanFloor;
    renderActive({ animate: false });
  }));
  globalThis.document.querySelectorAll("[data-floor-plan-room]").forEach(element => {
    element.addEventListener("click", () => showFloorPlanRoomDetails(element.dataset.floorPlanRoom));
    element.addEventListener("keydown", event => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault(); showFloorPlanRoomDetails(element.dataset.floorPlanRoom);
    });
  });
  globalThis.document.getElementById("floorPlanDownloadPdfBtn")?.addEventListener("click", event => downloadFloorPlanPdf(document, event.currentTarget));
  globalThis.document.getElementById("floorPlanPrintBtn")?.addEventListener("click", () => {
    S.printMode = "lageplan"; S.printReturnMode = S.mode; S.printReturnView = S.view; S.mode = "print"; renderActive();
  });
  globalThis.document.getElementById("floorPlanBackToEditor")?.addEventListener("click", () => {
    S.floorPlanPreviewDocument = null; S.mode = "crew"; S.crewView = "setup"; S.setupTab = "lageplan"; renderActive();
  });
  if (REQUESTED_ROOM && floorPlanRoom(REQUESTED_ROOM)) showFloorPlanRoomDetails(REQUESTED_ROOM);
}

function floorPlanRoomGames(roomId) {
  const slotKey = S.activeSlot || S.slots[0]?.key;
  return S.games.filter(game => game.slotKey === slotKey).map(game => {
    const assignment = asgFor(game);
    const table = assignment && S.tables.find(item => item.id === assignment.table_id);
    return table?.room_id === roomId ? { game, table } : null;
  }).filter(Boolean);
}

function showFloorPlanRoomDetails(roomId) {
  const room = floorPlanRoom(roomId);
  const detail = globalThis.document.getElementById("floorPlanRoomDetail");
  if (!room || !detail) return;
  const color = floorPlanRoomColor(room);
  const glyph = floorPlanRoomGlyph(room);
  const entries = floorPlanRoomGames(roomId);
  const slot = S.slots.find(item => item.key === (S.activeSlot || S.slots[0]?.key));
  detail.innerHTML = `<div class="floor-plan-room-detail-head" style="--floor-plan-room-color:${color}"><span class="floor-plan-room-detail-symbol" aria-hidden="true">${esc(glyph)}</span><div><span class="floor-plan-editor-kicker">${esc(tr("room"))}</span><h2>${esc(room.name)}</h2></div></div>
    ${room.floor ? `<p class="room-location"><span aria-hidden="true">⌖</span> ${esc(room.floor)}</p>` : ""}
    ${room.notes ? `<p>${esc(room.notes)}</p>` : ""}
    <div class="room-badges">${roomBadgesHtml(room)}</div>
    <div class="floor-plan-room-schedule"><h3>${esc(slot?.label || tr("slot"))}</h3>${entries.length ? entries.map(({ game, table }) => `<div class="floor-plan-room-game"><strong>${esc(game.title)}</strong><span>${esc(table.name)}${game.provider ? ` · ${esc(game.provider)}` : ""}</span></div>`).join("") : `<p class="hint">${esc(tr("floorPlanNoGamesHere"))}</p>`}</div>
    <button type="button" class="primary" id="floorPlanJumpRoomBtn" data-room-id="${esc(room.id)}">${esc(tr("floorPlanShowInRooms"))} →</button>`;
  detail.querySelector("#floorPlanJumpRoomBtn").addEventListener("click", () => jumpFromFloorPlanToRoom(room.id));
  globalThis.document.querySelectorAll("[data-floor-plan-room]").forEach(element => element.classList.toggle("is-active", element.dataset.floorPlanRoom === room.id));
}

function jumpFromFloorPlanToRoom(roomId) {
  S.floorPlanPreviewDocument = null;
  S.mode = "view"; S.view = "raeume";
  renderActive({ animate: false });
  requestAnimationFrame(() => {
    const room = globalThis.document.getElementById(`room-${roomId}`);
    if (!room) return;
    room.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    room.classList.add("pulse-highlight");
    room.addEventListener("animationend", () => room.classList.remove("pulse-highlight"), { once: true });
    history.replaceState(null, "", `${location.pathname}?con=${encodeURIComponent(S.con?.slug || S.con?.id)}&view=raeume&room=${encodeURIComponent(roomId)}`);
  });
}

function floorPlanLegendHtml(document) {
  const rooms = floorPlanLinkedRooms(document);
  if (!rooms.length) return "";
  return `<div class="floor-plan-print-legend"><h3>${esc(tr("floorPlanLegend"))}</h3><div>${rooms.map(room => `<span style="--floor-plan-room-color:${floorPlanRoomColor(room)}"><b aria-hidden="true">${esc(floorPlanRoomGlyph(room))}</b>${esc(room.name)}</span>`).join("")}</div></div>`;
}

function floorPlanPrintPagesHtml() {
  const document = activeFloorPlanDocument();
  if (!document) return emptyState(tr("floorPlanEmptyPublic"));
  const orientation = document.orientation;
  const liveUrl = `${location.origin}${location.pathname}?con=${encodeURIComponent(S.con?.slug || S.con?.id || "")}&view=lageplan`;
  return document.floors.map((floor, index) => `<div class="doc-page-stage floor-plan-print-stage"${index ? ' style="break-before:page"' : ""}><div class="doc-page floor-plan-print-page" data-orientation="${orientation}">
    <div class="doc-page-header"><span>${esc(document.title || S.con?.name || tr("floorPlan"))}</span><span>${esc(floor.name)}</span></div>
    <div class="floor-plan-print-map">${floorPlanSvgHtml(document, floor)}</div>
    ${floorPlanLegendHtml(document)}
    <div class="doc-page-footer"><span>${esc(tr("printCreatedOn", { time: new Date().toLocaleString(LANG === "en" ? "en-GB" : "de-AT", { dateStyle: "medium", timeStyle: "short" }) }))}</span><span>${esc(tr("printLiveVersion", { url: liveUrl }))}</span></div>
  </div></div>`).join("");
}

function floorPlanPrintPageHtml() {
  const document = activeFloorPlanDocument();
  if (!document) return emptyState(tr("floorPlanEmptyPublic"));
  return `<div class="print-page-wrap floor-plan-print-wrap">
    <p class="no-print" style="margin:0 0 var(--sp-3)"><button type="button" id="printBackLink" class="link-btn">${esc(tr("printBackLink"))}</button></p>
    <div class="card toolbar-card no-print floor-plan-print-toolbar"><div><span class="toolbar-label">${esc(tr("floorPlanPrintTitle"))}</span><p class="hint">${esc(LANG === "en" ? "Each floor is printed on its own A4 page." : "Jede Ebene wird auf einer eigenen A4-Seite ausgegeben.")}</p></div><button type="button" id="floorPlanPrintDownloadBtn">⇩ ${esc(tr("floorPlanDownloadPdf"))}</button><button type="button" id="doPrintBtn" class="primary">${esc(tr("printBtn"))}</button></div>
    ${floorPlanPrintPagesHtml()}
  </div>`;
}

function mountFloorPlanPrintView() {
  const document = activeFloorPlanDocument();
  globalThis.document.getElementById("floorPlanPrintDownloadBtn")?.addEventListener("click", event => downloadFloorPlanPdf(document, event.currentTarget));
}

function floorPlanSvgForExport(documentValue, floor) {
  const wrapper = globalThis.document.createElement("div");
  wrapper.innerHTML = floorPlanSvgHtml(documentValue, floor);
  const svg = wrapper.firstElementChild;
  svg.setAttribute("width", String(floor.width));
  svg.setAttribute("height", String(floor.height));
  return new XMLSerializer().serializeToString(svg);
}

function floorPlanSvgToPng(documentValue, floor, scale = 3) {
  return new Promise((resolve, reject) => {
    const svg = floorPlanSvgForExport(documentValue, floor);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = globalThis.document.createElement("canvas");
      canvas.width = floor.width * scale; canvas.height = floor.height * scale;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = error => { URL.revokeObjectURL(url); reject(error); };
    image.src = url;
  });
}

async function downloadFloorPlanPdf(documentValue, button) {
  if (!documentValue || !button) return;
  const original = button.textContent;
  button.disabled = true; button.textContent = tr("floorPlanSaving");
  try {
    floorPlanPdfPromise ||= loadFloorPlanScript(FLOOR_PLAN_JSPDF_URL, "jspdf");
    await floorPlanPdfPromise;
    const document = normalizeFloorPlanDocument(documentValue);
    const { jsPDF } = globalThis.jspdf;
    const pdf = new jsPDF({ orientation: document.orientation, unit: "mm", format: "a4", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 11;
    const allLegendRooms = floorPlanLinkedRooms(document);
    const legendRooms = allLegendRooms.slice(0, 9);
    const legendRows = Math.ceil(legendRooms.length / 3);
    const legendHeight = legendRooms.length ? Math.min(24, 7 + legendRows * 5) : 0;
    for (let index = 0; index < document.floors.length; index += 1) {
      if (index) pdf.addPage("a4", document.orientation);
      const floor = document.floors[index];
      const image = await floorPlanSvgToPng(document, floor, 3);
      pdf.setTextColor(29, 36, 51);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(document.title || S.con?.name || tr("floorPlan"), margin, 10);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(floor.name, pageWidth - margin, 10, { align: "right" });
      pdf.setDrawColor(220, 224, 232);
      pdf.line(margin, 13, pageWidth - margin, 13);

      const mapTop = 17;
      const mapBottom = pageHeight - 11 - legendHeight;
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = mapBottom - mapTop;
      const scale = Math.min(availableWidth / floor.width, availableHeight / floor.height);
      const mapWidth = floor.width * scale;
      const mapHeight = floor.height * scale;
      const mapX = (pageWidth - mapWidth) / 2;
      const mapY = mapTop + (availableHeight - mapHeight) / 2;
      pdf.addImage(image, "PNG", mapX, mapY, mapWidth, mapHeight, undefined, "FAST");

      if (legendRooms.length) {
        const legendTop = pageHeight - 8 - legendHeight;
        pdf.setDrawColor(220, 224, 232);
        pdf.line(margin, legendTop, pageWidth - margin, legendTop);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(89, 98, 115);
        pdf.text(tr("floorPlanLegend"), margin, legendTop + 4);
        const columnWidth = (pageWidth - margin * 2) / 3;
        legendRooms.forEach((room, roomIndex) => {
          const column = roomIndex % 3;
          const row = Math.floor(roomIndex / 3);
          const x = margin + column * columnWidth;
          const y = legendTop + 9 + row * 5;
          const color = floorPlanRoomColor(room).replace("#", "");
          if (/^[0-9a-f]{6}$/i.test(color)) {
            pdf.setFillColor(parseInt(color.slice(0, 2), 16), parseInt(color.slice(2, 4), 16), parseInt(color.slice(4, 6), 16));
          } else pdf.setFillColor(91, 103, 123);
          pdf.roundedRect(x, y - 2.8, 3, 3, 0.7, 0.7, "F");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7.5);
          pdf.setTextColor(29, 36, 51);
          pdf.text(room.name, x + 5, y, { maxWidth: columnWidth - 7 });
        });
        if (allLegendRooms.length > legendRooms.length) {
          pdf.setFontSize(6.5);
          pdf.setTextColor(120, 127, 141);
          pdf.text(`+ ${allLegendRooms.length - legendRooms.length}`, pageWidth - margin, legendTop + 4, { align: "right" });
        }
      }

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.setTextColor(120, 127, 141);
      pdf.text(`${index + 1} / ${document.floors.length}`, pageWidth - margin, pageHeight - 4, { align: "right" });
    }
    const name = `${(S.con?.name || "Lageplan").replace(/[^a-z0-9äöüß_-]+/gi, "-")}-Lageplan.pdf`;
    pdf.save(name);
  } catch (error) {
    button.textContent = error.message || tr("floorPlanSaveFailed", { err: "PDF" });
    return;
  } finally {
    button.disabled = false;
    setTimeout(() => { button.textContent = original; }, 1400);
  }
}
