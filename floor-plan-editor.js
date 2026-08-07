/* Crew-Lageplan-Editor. Fabric.js bleibt eine austauschbare Interaktionsschicht. */
const FLOOR_PLAN_FABRIC_URL = "https://cdn.jsdelivr.net/npm/fabric@7.4.0/dist/index.min.js";
let floorPlanFabricPromise = null;
let floorPlanCanvas = null;
let floorPlanEditorDocument = null;
let floorPlanHistory = [];
let floorPlanFuture = [];
let floorPlanSaveTimer = null;
let floorPlanSaveChain = Promise.resolve();
let floorPlanEditorAbortController = null;

function loadFloorPlanScript(src, globalName) {
  if (globalThis[globalName]) return Promise.resolve(globalThis[globalName]);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-floor-plan-src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(globalThis[globalName]), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.dataset.floorPlanSrc = src;
    script.onload = () => resolve(globalThis[globalName]);
    script.onerror = () => reject(new Error(`Bibliothek konnte nicht geladen werden: ${src}`));
    document.head.appendChild(script);
  });
}

function loadFloorPlanFabric() {
  floorPlanFabricPromise ||= loadFloorPlanScript(FLOOR_PLAN_FABRIC_URL, "fabric");
  return floorPlanFabricPromise;
}

function floorPlanSetupHtml() {
  const mode = floorPlanSourceMode();
  const sourceButtons = [
    ["none", "floorPlanModeNone"],
    ["external", "floorPlanModeExternal"],
    ["editor", "floorPlanModeEditor"],
  ].map(([key, label]) => `<button type="button" data-floor-plan-source="${key}" aria-pressed="${String(mode === key)}">${esc(tr(label))}</button>`).join("");
  let body = "";
  if (mode === "external") {
    const external = floorPlanUrl();
    body = `<div class="floor-plan-source-panel">
      <p class="hint">${esc(tr("floorPlanExternalHint"))}</p>
      <form id="floorPlanForm" class="floor-plan-form">
        <label class="sr-only" for="floorPlanUrl">${esc(tr("floorPlanUrlLabel"))}</label>
        <input id="floorPlanUrl" type="url" inputmode="url" value="${esc(S.con?.floor_plan_url || "")}" placeholder="https://…/lageplan.pdf" aria-label="${esc(tr("floorPlanUrlLabel"))}">
        ${external ? `<a class="btn" href="${esc(external)}" target="_blank" rel="noopener">${esc(tr("openFloorPlan"))}</a>` : ""}
        <button type="submit" class="primary">${esc(tr("save"))}</button>
      </form>
      <p id="floorPlanMsg" class="msg" role="status" aria-live="polite"></p>
    </div>`;
  } else if (mode === "editor") {
    body = S.floorPlanDraft?.document ? floorPlanEditorWorkspaceHtml() : `<div class="floor-plan-creator-empty">
      <span class="floor-plan-empty-glyph" aria-hidden="true">⌖</span>
      <h3>${esc(tr("floorPlanCreatorTitle"))}</h3>
      <p>${esc(tr("floorPlanCreatorHint"))}</p>
      <button type="button" id="floorPlanCreateBtn" class="primary"${S.rooms.length ? "" : " disabled"}>${esc(tr("floorPlanCreateDraft"))}</button>
      ${S.rooms.length ? "" : `<p class="hint">${esc(tr("floorPlanNoRooms"))}</p>`}
    </div>`;
  }
  return `<div class="card setup-card floor-plan-setup-card">
    <div class="setup-head-title"><h2>${esc(tr("floorPlanSetupTitle"))}</h2></div>
    <p class="hint">${esc(tr("floorPlanSetupHint"))}</p>
    <div class="floor-plan-source-switch slot-tabs" role="group" aria-label="${esc(tr("floorPlanSetupTitle"))}">${sourceButtons}</div>
    ${body}
    <p id="floorPlanSetupMsg" class="msg" role="status" aria-live="polite"></p>
  </div>`;
}

function floorPlanEditorWorkspaceHtml() {
  const document = normalizeFloorPlanDocument(S.floorPlanDraft.document);
  const activeFloor = document.floors.find(floor => floor.id === S.floorPlanEditorFloorId) || document.floors[0];
  S.floorPlanEditorFloorId = activeFloor.id;
  const floorTabs = document.floors.map(floor => `<button type="button" data-floor-plan-floor="${esc(floor.id)}" aria-pressed="${String(floor.id === activeFloor.id)}">${esc(floor.name)}</button>`).join("");
  const roomOptions = S.rooms.map(room => `<option value="${esc(room.id)}">${esc(room.name)}${room.floor ? ` · ${esc(room.floor)}` : ""}</option>`).join("");
  const symbolOptions = Object.entries(FLOOR_PLAN_SYMBOLS).map(([key, symbol]) => `<option value="${key}">${esc(symbol.glyph)} ${esc(symbol[LANG === "en" ? "en" : "de"])}</option>`).join("");
  return `<div class="floor-plan-editor" data-floor-id="${esc(activeFloor.id)}">
    <div class="floor-plan-editor-head">
      <div>
        <span class="floor-plan-editor-kicker">${esc(tr("floorPlanDraft"))}</span>
        <input id="floorPlanDocumentTitle" class="floor-plan-title-input" type="text" value="${esc(document.title)}" placeholder="${esc(S.con?.name || tr("floorPlan"))}" aria-label="${esc(tr("floorPlanTitleLabel"))}">
      </div>
      <div class="floor-plan-editor-actions">
        <span id="floorPlanSaveState" class="floor-plan-save-state">${esc(tr("floorPlanSavedAt"))}</span>
        <button type="button" id="floorPlanPreviewBtn">${esc(tr("floorPlanPreview"))}</button>
        <button type="button" id="floorPlanPublishBtn" class="primary">${esc(tr("floorPlanPublish"))}</button>
      </div>
    </div>
    <div class="floor-plan-page-controls">
      <div class="floor-plan-floor-tabs slot-tabs" role="group" aria-label="${esc(tr("floorPlanFloor"))}">${floorTabs}<button type="button" id="floorPlanAddFloorBtn" title="${esc(tr("floorPlanAddFloor"))}">＋</button></div>
      <label>${esc(tr("floorPlanRenameFloor"))}<input id="floorPlanFloorName" type="text" value="${esc(activeFloor.name)}" maxlength="80"></label>
      <label>${esc(tr("floorPlanOrientation"))}<select id="floorPlanOrientation"><option value="landscape"${document.orientation === "landscape" ? " selected" : ""}>${esc(tr("printOrientationLandscape"))}</option><option value="portrait"${document.orientation === "portrait" ? " selected" : ""}>${esc(tr("printOrientationPortrait"))}</option></select></label>
      <button type="button" id="floorPlanDeleteFloorBtn" class="small danger"${document.floors.length > 1 ? "" : " disabled"}>${esc(tr("floorPlanDeleteFloor"))}</button>
    </div>
    <div class="floor-plan-editor-shell">
      <aside class="floor-plan-toolbox" aria-label="Werkzeuge">
        <div class="floor-plan-tool-group">
          <span class="toolbar-label">${esc(tr("floorPlanAddRoom"))}</span>
          <select id="floorPlanRoomSelect" aria-label="${esc(tr("floorPlanChooseRoom"))}">${roomOptions}</select>
          <button type="button" id="floorPlanAddRoomBtn" class="primary">＋ ${esc(tr("room"))}</button>
        </div>
        <div class="floor-plan-tool-row">
          <button type="button" id="floorPlanAddTextBtn">T ${esc(tr("floorPlanAddText"))}</button>
          <button type="button" id="floorPlanAddSymbolBtn">⌖ ${esc(tr("floorPlanAddSymbol"))}</button>
        </div>
        <select id="floorPlanSymbolSelect" aria-label="${esc(tr("floorPlanSymbolLabel"))}">${symbolOptions}</select>
        <div class="floor-plan-tool-row floor-plan-history-actions">
          <button type="button" id="floorPlanUndoBtn" title="${esc(tr("floorPlanUndo"))}">↶</button>
          <button type="button" id="floorPlanRedoBtn" title="${esc(tr("floorPlanRedo"))}">↷</button>
          <button type="button" id="floorPlanDeleteObjectBtn" class="danger" title="${esc(tr("floorPlanDeleteObject"))}">⌫</button>
        </div>
      </aside>
      <div class="floor-plan-canvas-stage"><div class="floor-plan-canvas-wrap"><canvas id="floorPlanCanvas"></canvas></div><p class="floor-plan-canvas-hint">${esc(LANG === "en" ? "Drag to move · use the handles to resize · arrow keys move precisely" : "Ziehen zum Verschieben · Griffe zum Skalieren · Pfeiltasten bewegen präzise")}</p></div>
      <aside class="floor-plan-inspector" id="floorPlanInspector"><p class="hint">${esc(LANG === "en" ? "Select an item to edit it." : "Wähle ein Element aus, um es zu bearbeiten.")}</p></aside>
    </div>
  </div>`;
}

function disposeFloorPlanEditor() {
  floorPlanEditorAbortController?.abort();
  floorPlanEditorAbortController = null;
  if (floorPlanCanvas) {
    floorPlanCanvas.dispose();
    floorPlanCanvas = null;
  }
  clearTimeout(floorPlanSaveTimer);
}

async function mountFloorPlanSetup() {
  disposeFloorPlanEditor();
  document.querySelectorAll("[data-floor-plan-source]").forEach(button => button.addEventListener("click", async () => {
    const mode = button.dataset.floorPlanSource;
    const msg = document.getElementById("floorPlanSetupMsg");
    if (mode === "external" && !floorPlanUrl()) {
      S.con.floor_plan_mode = "external";
      renderActive({ animate: false });
      return;
    }
    try {
      msg.textContent = tr("floorPlanSaving");
      await S.store.setFloorPlanSource(mode, S.con.floor_plan_url || null);
      S.con.floor_plan_mode = mode;
      renderActive({ animate: false });
    } catch (error) {
      msg.className = "msg err";
      msg.textContent = tr("floorPlanSaveFailed", { err: error.message });
    }
  }));
  document.getElementById("floorPlanCreateBtn")?.addEventListener("click", createFloorPlanDraft);
  if (!document.getElementById("floorPlanCanvas")) return;
  try {
    await loadFloorPlanFabric();
    initializeFloorPlanCanvas();
    wireFloorPlanEditorControls();
  } catch (error) {
    const msg = document.getElementById("floorPlanSetupMsg");
    if (msg) { msg.className = "msg err"; msg.textContent = error.message; }
  }
}

async function createFloorPlanDraft() {
  const button = document.getElementById("floorPlanCreateBtn");
  if (button) button.disabled = true;
  const document = newFloorPlanDocument();
  try {
    const revision = await S.store.saveFloorPlanDocument(document, 0);
    S.floorPlanDraft = { document, revision: Number(revision), published_at: null, updated_at: new Date().toISOString() };
    S.floorPlanEditorFloorId = document.floors[0].id;
    renderActive({ animate: false });
  } catch (error) {
    const msg = document.getElementById("floorPlanSetupMsg");
    if (msg) { msg.className = "msg err"; msg.textContent = tr("floorPlanSaveFailed", { err: error.message }); }
    if (button) button.disabled = false;
  }
}

function floorPlanActiveFloor() {
  return floorPlanEditorDocument?.floors.find(floor => floor.id === S.floorPlanEditorFloorId) || floorPlanEditorDocument?.floors[0];
}

function floorPlanFabricStyles(object) {
  object.set({
    borderColor: "#5b8def", cornerColor: "#ffffff", cornerStrokeColor: "#5b8def",
    cornerStyle: "circle", cornerSize: 16, transparentCorners: false, borderScaleFactor: 2,
    padding: 3, lockScalingFlip: true,
  });
  return object;
}

function floorPlanFabricRoom(object) {
  const room = floorPlanRoom(object.roomId);
  const label = room?.name || object.fallbackLabel || tr("floorPlanUnlinkedRoom");
  const color = floorPlanRoomColor(room);
  const rect = new fabric.Rect({ left: 0, top: 0, originX: "center", originY: "center", width: object.width, height: object.height, rx: 18, ry: 18, fill: `${color}26`, stroke: color, strokeWidth: 4 });
  const marker = new fabric.FabricText(floorPlanRoomGlyph(room), { left: -object.width / 2 + 24, top: -object.height / 2 + 22, originX: "center", originY: "center", fontSize: 22, fill: color, fontFamily: "Arial" });
  const text = new fabric.Textbox(label, { left: 0, top: 0, originX: "center", originY: "center", width: Math.max(80, object.width - 54), textAlign: "center", fontSize: Math.max(17, Math.min(28, object.height / 5)), fontWeight: "700", fill: "#172033", fontFamily: "Arial", editable: false });
  const location = new fabric.FabricText(room?.floor || "", { left: 0, top: object.height / 2 - 18, originX: "center", originY: "center", fontSize: 13, fill: "#596579", fontFamily: "Arial" });
  const group = new fabric.Group([rect, marker, text, location], { left: object.x, top: object.y, originX: "left", originY: "top", angle: object.rotation || 0 });
  Object.assign(group, { fpId: object.id, fpType: "room", fpRoomId: object.roomId, fpFallbackLabel: label });
  return floorPlanFabricStyles(group);
}

function floorPlanFabricObject(object) {
  if (object.type === "room") return floorPlanFabricRoom(object);
  if (object.type === "text") {
    const text = new fabric.Textbox(object.text, { left: object.x, top: object.y, width: object.width, fontSize: 28, fontWeight: "600", fill: "#172033", fontFamily: "Arial", textAlign: "center", angle: object.rotation || 0 });
    Object.assign(text, { fpId: object.id, fpType: "text" });
    return floorPlanFabricStyles(text);
  }
  const symbol = FLOOR_PLAN_SYMBOLS[object.symbol] || FLOOR_PLAN_SYMBOLS.info;
  const circle = new fabric.Circle({ left: 0, top: 0, originX: "center", originY: "center", radius: Math.max(20, Math.min(object.width, object.height) / 2), fill: "#ffffff", stroke: "#62708a", strokeWidth: 3 });
  const glyph = new fabric.FabricText(symbol.glyph, { left: 0, top: 0, originX: "center", originY: "center", fontSize: Math.max(18, circle.radius * .75), fill: "#27344d", fontWeight: "700", fontFamily: "Arial" });
  const group = new fabric.Group([circle, glyph], { left: object.x, top: object.y, originX: "left", originY: "top", angle: object.rotation || 0 });
  Object.assign(group, { fpId: object.id, fpType: "symbol", fpSymbol: object.symbol, fpLabel: object.label || "" });
  return floorPlanFabricStyles(group);
}

function initializeFloorPlanCanvas() {
  floorPlanEditorAbortController = new AbortController();
  floorPlanEditorDocument = normalizeFloorPlanDocument(S.floorPlanDraft.document);
  const floor = floorPlanActiveFloor();
  floorPlanCanvas = new fabric.Canvas("floorPlanCanvas", {
    width: floor.width, height: floor.height, backgroundColor: "#ffffff", preserveObjectStacking: true,
    selectionColor: "rgba(91,141,239,.12)", selectionBorderColor: "#5b8def", selectionLineWidth: 2,
  });
  floorPlanCanvas.add(...floor.objects.map(floorPlanFabricObject));
  floorPlanCanvas.on("selection:created", renderFloorPlanInspector);
  floorPlanCanvas.on("selection:updated", renderFloorPlanInspector);
  floorPlanCanvas.on("selection:cleared", renderFloorPlanInspector);
  floorPlanCanvas.on("object:moving", event => {
    const object = event.target;
    object.set({ left: Math.round(object.left / 12) * 12, top: Math.round(object.top / 12) * 12 });
  });
  floorPlanCanvas.on("object:modified", floorPlanCanvasChanged);
  floorPlanHistory = [JSON.stringify(floorPlanEditorDocument)];
  floorPlanFuture = [];
  updateFloorPlanHistoryButtons();
  requestAnimationFrame(() => floorPlanCanvas.calcOffset());
}

function floorPlanObjectFromFabric(object) {
  const base = {
    id: object.fpId || floorPlanId(object.fpType), type: object.fpType,
    x: Math.max(0, Math.round(object.left)), y: Math.max(0, Math.round(object.top)),
    width: Math.max(24, Math.round(object.width * object.scaleX)), height: Math.max(24, Math.round(object.height * object.scaleY)),
    rotation: Math.round(object.angle || 0),
  };
  if (object.fpType === "room") return { ...base, roomId: object.fpRoomId || null, fallbackLabel: object.fpFallbackLabel || "" };
  if (object.fpType === "text") return { ...base, text: object.text || "Text" };
  return { ...base, symbol: object.fpSymbol || "info", label: object.fpLabel || "" };
}

function syncFloorPlanCanvasToDocument({ history = true } = {}) {
  const floor = floorPlanActiveFloor();
  if (!floor || !floorPlanCanvas) return;
  floor.objects = floorPlanCanvas.getObjects().map(floorPlanObjectFromFabric);
  const serialized = JSON.stringify(floorPlanEditorDocument);
  if (history && floorPlanHistory.at(-1) !== serialized) {
    floorPlanHistory.push(serialized);
    if (floorPlanHistory.length > 50) floorPlanHistory.shift();
    floorPlanFuture = [];
  }
  updateFloorPlanHistoryButtons();
}

function floorPlanCanvasChanged() {
  syncFloorPlanCanvasToDocument();
  scheduleFloorPlanSave();
  renderFloorPlanInspector();
}

function scheduleFloorPlanSave() {
  clearTimeout(floorPlanSaveTimer);
  const state = document.getElementById("floorPlanSaveState");
  if (state) state.textContent = tr("floorPlanSaving");
  const publishButton = document.getElementById("floorPlanPublishBtn");
  if (publishButton) { publishButton.disabled = false; publishButton.textContent = tr("floorPlanPublish"); }
  floorPlanSaveTimer = setTimeout(() => saveFloorPlanNow().catch(() => {}), 900);
}

function saveFloorPlanNow({ sync = true } = {}) {
  clearTimeout(floorPlanSaveTimer);
  if (sync) syncFloorPlanCanvasToDocument({ history: false });
  const snapshot = structuredClone(floorPlanEditorDocument);
  const state = document.getElementById("floorPlanSaveState");
  if (state) state.textContent = tr("floorPlanSaving");
  const operation = async () => {
    try {
      const revision = await S.store.saveFloorPlanDocument(snapshot, Number(S.floorPlanDraft?.revision || 0));
      S.floorPlanDraft = { ...S.floorPlanDraft, document: snapshot, revision: Number(revision), updated_at: new Date().toISOString() };
      const currentState = document.getElementById("floorPlanSaveState");
      if (currentState) { currentState.className = "floor-plan-save-state is-saved"; currentState.textContent = `✓ ${tr("floorPlanSavedAt")}`; }
      return revision;
    } catch (error) {
      const currentState = document.getElementById("floorPlanSaveState");
      if (currentState) { currentState.className = "floor-plan-save-state is-error"; currentState.textContent = error.message.includes("conflict") ? tr("floorPlanConflict") : error.message; }
      throw error;
    }
  };
  floorPlanSaveChain = floorPlanSaveChain.catch(() => {}).then(operation);
  return floorPlanSaveChain;
}

function addFloorPlanObject(object) {
  const fabricObject = floorPlanFabricObject(object);
  floorPlanCanvas.add(fabricObject);
  floorPlanCanvas.setActiveObject(fabricObject);
  floorPlanCanvas.requestRenderAll();
  floorPlanCanvasChanged();
}

function renderFloorPlanInspector() {
  const inspector = document.getElementById("floorPlanInspector");
  if (!inspector || !floorPlanCanvas) return;
  const object = floorPlanCanvas.getActiveObject();
  if (!object || object.type === "activeSelection") {
    inspector.innerHTML = `<p class="hint">${esc(LANG === "en" ? "Select an item to edit it." : "Wähle ein Element aus, um es zu bearbeiten.")}</p>`;
    return;
  }
  if (object.fpType === "room") {
    inspector.innerHTML = `<span class="toolbar-label">${esc(tr("floorPlanObjectRoom"))}</span><select id="floorPlanInspectorRoom">${S.rooms.map(room => `<option value="${esc(room.id)}"${room.id === object.fpRoomId ? " selected" : ""}>${esc(room.name)}</option>`).join("")}</select><p class="hint">${esc(LANG === "en" ? "Name, colour and symbol always come from the linked room." : "Name, Farbe und Symbol kommen immer aus dem verknüpften Raum.")}</p>`;
  } else if (object.fpType === "text") {
    inspector.innerHTML = `<label>${esc(tr("floorPlanTextLabel"))}<textarea id="floorPlanInspectorText" rows="4" maxlength="240">${esc(object.text || "")}</textarea></label>`;
  } else {
    inspector.innerHTML = `<label>${esc(tr("floorPlanSymbolLabel"))}<select id="floorPlanInspectorSymbol">${Object.entries(FLOOR_PLAN_SYMBOLS).map(([key, symbol]) => `<option value="${key}"${key === object.fpSymbol ? " selected" : ""}>${esc(symbol.glyph)} ${esc(symbol[LANG === "en" ? "en" : "de"])}</option>`).join("")}</select></label><label>${esc(tr("floorPlanTextLabel"))}<input id="floorPlanInspectorLabel" type="text" maxlength="80" value="${esc(object.fpLabel || "")}"></label>`;
  }
}

function rebuildSelectedFloorPlanObject(patch) {
  const selected = floorPlanCanvas?.getActiveObject();
  if (!selected) return;
  const domain = { ...floorPlanObjectFromFabric(selected), ...patch };
  const index = floorPlanCanvas.getObjects().indexOf(selected);
  floorPlanCanvas.remove(selected);
  const replacement = floorPlanFabricObject(domain);
  floorPlanCanvas.insertAt(index, replacement);
  floorPlanCanvas.setActiveObject(replacement);
  floorPlanCanvas.requestRenderAll();
  floorPlanCanvasChanged();
}

function updateFloorPlanHistoryButtons() {
  const undo = document.getElementById("floorPlanUndoBtn");
  const redo = document.getElementById("floorPlanRedoBtn");
  if (undo) undo.disabled = floorPlanHistory.length <= 1;
  if (redo) redo.disabled = floorPlanFuture.length === 0;
}

function restoreFloorPlanHistory(serialized) {
  floorPlanEditorDocument = normalizeFloorPlanDocument(JSON.parse(serialized));
  const floor = floorPlanActiveFloor();
  floorPlanCanvas.clear();
  floorPlanCanvas.backgroundColor = "#ffffff";
  floorPlanCanvas.add(...floor.objects.map(floorPlanFabricObject));
  floorPlanCanvas.requestRenderAll();
  updateFloorPlanHistoryButtons();
  scheduleFloorPlanSave();
}

async function switchFloorPlanFloor(floorId, { sync = true } = {}) {
  if (sync) syncFloorPlanCanvasToDocument({ history: false });
  await saveFloorPlanNow({ sync }).catch(() => {});
  S.floorPlanEditorFloorId = floorId;
  renderActive({ animate: false });
}

function wireFloorPlanEditorControls() {
  document.getElementById("floorPlanAddRoomBtn")?.addEventListener("click", () => {
    const roomId = document.getElementById("floorPlanRoomSelect").value;
    const room = floorPlanRoom(roomId);
    const floor = floorPlanActiveFloor();
    addFloorPlanObject({ id: floorPlanId("room"), type: "room", roomId, fallbackLabel: room?.name || "", x: floor.width / 2 - 135, y: floor.height / 2 - 80, width: 270, height: 160, rotation: 0 });
  });
  document.getElementById("floorPlanAddTextBtn")?.addEventListener("click", () => {
    const floor = floorPlanActiveFloor();
    addFloorPlanObject({ id: floorPlanId("text"), type: "text", text: tr("floorPlanAddText"), x: floor.width / 2 - 110, y: floor.height / 2 - 30, width: 220, height: 60, rotation: 0 });
  });
  document.getElementById("floorPlanAddSymbolBtn")?.addEventListener("click", () => {
    const floor = floorPlanActiveFloor();
    addFloorPlanObject({ id: floorPlanId("symbol"), type: "symbol", symbol: document.getElementById("floorPlanSymbolSelect").value, label: "", x: floor.width / 2 - 34, y: floor.height / 2 - 34, width: 68, height: 68, rotation: 0 });
  });
  document.getElementById("floorPlanDeleteObjectBtn")?.addEventListener("click", () => {
    const selected = floorPlanCanvas.getActiveObjects();
    if (!selected.length) return;
    floorPlanCanvas.discardActiveObject(); selected.forEach(object => floorPlanCanvas.remove(object)); floorPlanCanvasChanged();
  });
  document.getElementById("floorPlanUndoBtn")?.addEventListener("click", () => {
    if (floorPlanHistory.length <= 1) return;
    floorPlanFuture.push(floorPlanHistory.pop()); restoreFloorPlanHistory(floorPlanHistory.at(-1));
  });
  document.getElementById("floorPlanRedoBtn")?.addEventListener("click", () => {
    if (!floorPlanFuture.length) return;
    const next = floorPlanFuture.pop(); floorPlanHistory.push(next); restoreFloorPlanHistory(next);
  });
  document.querySelectorAll("[data-floor-plan-floor]").forEach(button => button.addEventListener("click", () => switchFloorPlanFloor(button.dataset.floorPlanFloor)));
  document.getElementById("floorPlanAddFloorBtn")?.addEventListener("click", async () => {
    syncFloorPlanCanvasToDocument({ history: false });
    const floor = newFloorPlanFloor(`${tr("floorPlanFloor")} ${floorPlanEditorDocument.floors.length + 1}`, floorPlanEditorDocument.orientation);
    floorPlanEditorDocument.floors.push(floor); await switchFloorPlanFloor(floor.id, { sync: false });
  });
  document.getElementById("floorPlanDeleteFloorBtn")?.addEventListener("click", async () => {
    if (floorPlanEditorDocument.floors.length <= 1 || !confirm(tr("floorPlanDeleteFloor") + "?")) return;
    floorPlanEditorDocument.floors = floorPlanEditorDocument.floors.filter(floor => floor.id !== S.floorPlanEditorFloorId);
    await switchFloorPlanFloor(floorPlanEditorDocument.floors[0].id, { sync: false });
  });
  document.getElementById("floorPlanFloorName")?.addEventListener("input", event => {
    floorPlanActiveFloor().name = event.target.value.trim() || tr("floorPlanDefaultFloor");
    scheduleFloorPlanSave();
  });
  document.getElementById("floorPlanDocumentTitle")?.addEventListener("input", event => { floorPlanEditorDocument.title = event.target.value; scheduleFloorPlanSave(); });
  document.getElementById("floorPlanOrientation")?.addEventListener("change", async event => {
    syncFloorPlanCanvasToDocument({ history: false });
    const oldSize = FLOOR_PLAN_SIZE[floorPlanEditorDocument.orientation];
    const newSize = FLOOR_PLAN_SIZE[event.target.value];
    const sx = newSize.width / oldSize.width, sy = newSize.height / oldSize.height;
    floorPlanEditorDocument.orientation = event.target.value;
    floorPlanEditorDocument.floors.forEach(floor => {
      floor.objects.forEach(object => { object.x *= sx; object.y *= sy; object.width *= sx; object.height *= sy; });
      floor.width = newSize.width; floor.height = newSize.height;
    });
    await saveFloorPlanNow({ sync: false }).catch(() => {});
    renderActive({ animate: false });
  });
  document.getElementById("floorPlanPublishBtn")?.addEventListener("click", async () => {
    const button = document.getElementById("floorPlanPublishBtn"); button.disabled = true;
    try {
      await saveFloorPlanNow();
      await S.store.publishFloorPlan(S.floorPlanDraft.revision);
      S.floorPlanPublic = { document: structuredClone(S.floorPlanDraft.document), revision: S.floorPlanDraft.revision, published_at: new Date().toISOString() };
      S.floorPlanDraft.published_at = S.floorPlanPublic.published_at;
      S.con.floor_plan_mode = "editor";
      button.textContent = `✓ ${tr("floorPlanPublished")}`;
      button.disabled = false;
    } catch (error) { button.disabled = false; document.getElementById("floorPlanSaveState").textContent = error.message; }
  });
  document.getElementById("floorPlanPreviewBtn")?.addEventListener("click", async () => {
    await saveFloorPlanNow().catch(() => {});
    S.floorPlanPreviewDocument = structuredClone(floorPlanEditorDocument);
    S.mode = "view"; S.view = "lageplan"; renderActive();
  });
  document.addEventListener("keydown", floorPlanEditorKeydown, { signal: floorPlanEditorAbortController.signal });
  const inspector = document.getElementById("floorPlanInspector");
  inspector?.addEventListener("change", event => {
    if (event.target.id === "floorPlanInspectorRoom") rebuildSelectedFloorPlanObject({ roomId: event.target.value, fallbackLabel: floorPlanRoom(event.target.value)?.name || "" });
    else if (event.target.id === "floorPlanInspectorSymbol") rebuildSelectedFloorPlanObject({ symbol: event.target.value });
    else if (event.target.id === "floorPlanInspectorLabel") rebuildSelectedFloorPlanObject({ label: event.target.value });
  });
  inspector?.addEventListener("input", event => {
    if (event.target.id === "floorPlanInspectorText") {
      const selected = floorPlanCanvas.getActiveObject(); selected.set("text", event.target.value); floorPlanCanvas.requestRenderAll(); floorPlanCanvasChanged();
    }
  });
}

function floorPlanEditorKeydown(event) {
  if (!floorPlanCanvas || !document.querySelector(".floor-plan-editor") || event.target.matches("input, textarea, select")) return;
  const active = floorPlanCanvas.getActiveObject();
  if (["Backspace", "Delete"].includes(event.key) && active) {
    event.preventDefault(); floorPlanCanvas.remove(...floorPlanCanvas.getActiveObjects()); floorPlanCanvas.discardActiveObject(); floorPlanCanvasChanged(); return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault(); document.getElementById(event.shiftKey ? "floorPlanRedoBtn" : "floorPlanUndoBtn")?.click(); return;
  }
  if (!active || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const step = event.shiftKey ? 12 : 2;
  if (event.key === "ArrowLeft") active.left -= step;
  if (event.key === "ArrowRight") active.left += step;
  if (event.key === "ArrowUp") active.top -= step;
  if (event.key === "ArrowDown") active.top += step;
  active.setCoords(); floorPlanCanvas.requestRenderAll(); floorPlanCanvasChanged();
}
