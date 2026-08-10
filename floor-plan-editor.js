/* Crew-Lageplan-Editor. Fabric.js bleibt eine austauschbare Interaktionsschicht. */
const FLOOR_PLAN_FABRIC_URL = "https://cdn.jsdelivr.net/npm/fabric@7.4.0/dist/index.min.js";
const FLOOR_PLAN_PDF_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
const FLOOR_PLAN_PDF_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
let floorPlanFabricPromise = null;
let floorPlanTracePdfPromise = null;
let floorPlanCanvas = null;
let floorPlanEditorDocument = null;
let floorPlanHistory = [];
let floorPlanFuture = [];
let floorPlanSaveTimer = null;
let floorPlanSaveInFlight = null;
let floorPlanPendingSnapshot = null;
let floorPlanEditorAbortController = null;
const FLOOR_PLAN_CUSTOM_MARKERS = [...ROOM_MARKERS];
const FLOOR_PLAN_GRAPHIC_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const FLOOR_PLAN_TRACE_TYPES = new Set([...FLOOR_PLAN_GRAPHIC_TYPES, "application/pdf"]);
const FLOOR_PLAN_TRACE_MAX_BYTES = 20 * 1024 * 1024;
const floorPlanTraceReferences = new Map();
let floorPlanTraceRenderToken = 0;
let floorPlanEditorZoom = 1;
let floorPlanPanEnabled = false;
let floorPlanPanGesture = null;
let floorPlanExternalEditing = false;
let floorPlanSnapEnabled = (() => {
  try { return localStorage.getItem("floorPlanEditorSnapEnabled") !== "false"; }
  catch { return true; }
})();
let floorPlanGridVisible = (() => {
  try { return localStorage.getItem("floorPlanEditorGridVisible") !== "false"; }
  catch { return true; }
})();

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

async function loadFloorPlanPdf() {
  floorPlanTracePdfPromise ||= loadFloorPlanScript(FLOOR_PLAN_PDF_URL, "pdfjsLib");
  const pdfjsLib = await floorPlanTracePdfPromise;
  pdfjsLib.GlobalWorkerOptions.workerSrc = FLOOR_PLAN_PDF_WORKER_URL;
  return pdfjsLib;
}

function floorPlanSymbolPaletteHtml({ selected = "", inspector = false } = {}) {
  return Object.entries(FLOOR_PLAN_SYMBOL_CATEGORIES).map(([categoryKey, category]) => {
    const symbols = Object.entries(FLOOR_PLAN_SYMBOLS).filter(([, symbol]) => symbol.category === categoryKey);
    return `<section class="floor-plan-symbol-category"><h4>${esc(category[LANG === "en" ? "en" : "de"])}</h4><div class="floor-plan-symbol-grid">${symbols.map(([key, symbol]) => `<button type="button" class="floor-plan-symbol-choice${selected === key ? " is-selected" : ""}" ${inspector ? "data-inspector-symbol" : "data-floor-plan-symbol"}="${key}" title="${esc(floorPlanSymbolName(symbol))}"><b aria-hidden="true">${esc(symbol.glyph)}</b><span>${esc(floorPlanSymbolName(symbol))}</span></button>`).join("")}</div></section>`;
  }).join("");
}

function floorPlanMarkerLabel(marker) {
  return tr(`roomMarker${marker.charAt(0).toUpperCase()}${marker.slice(1)}`);
}

function floorPlanSetupHtml() {
  const externalEnabled = floorPlanExternalEnabled();
  const interactiveEnabled = floorPlanInteractiveEnabled();
  const showExternalPanel = externalEnabled || floorPlanExternalEditing;
  const external = floorPlanUrl();
  const externalPanel = showExternalPanel ? `<div class="floor-plan-source-panel" data-floor-plan-source-panel="external">
      <p class="hint">${esc(tr("floorPlanExternalHint"))}</p>
      <form id="floorPlanForm" class="floor-plan-form">
        <label class="sr-only" for="floorPlanUrl">${esc(tr("floorPlanUrlLabel"))}</label>
        <input id="floorPlanUrl" type="url" inputmode="url" value="${esc(S.con?.floor_plan_url || "")}" placeholder="https://…/lageplan.pdf" aria-label="${esc(tr("floorPlanUrlLabel"))}">
        ${external ? `<a class="btn" href="${esc(external)}" target="_blank" rel="noopener">${esc(tr("openFloorPlan"))}</a>` : ""}
        <button type="submit" class="primary">${esc(tr("save"))}</button>
      </form>
      <p id="floorPlanMsg" class="msg" role="status" aria-live="polite"></p>
    </div>` : "";
  const editorPanel = interactiveEnabled ? `<div class="floor-plan-source-panel" data-floor-plan-source-panel="interactive">${S.floorPlanDraft?.document ? floorPlanEditorWorkspaceHtml() : `<div class="floor-plan-creator-empty">
      <span class="floor-plan-empty-glyph" aria-hidden="true">⌖</span>
      <h3>${esc(tr("floorPlanCreatorTitle"))}</h3>
      <p>${esc(tr("floorPlanCreatorHint"))}</p>
      <button type="button" id="floorPlanCreateBtn" class="primary">${esc(tr("floorPlanCreateDraft"))}</button>
    </div>`}</div>` : "";
  return `<div class="card setup-card floor-plan-setup-card">
    <div class="setup-head-title"><h2>${esc(tr("floorPlanSetupTitle"))}</h2></div>
    <p class="hint">${esc(tr("floorPlanSetupHint"))}</p>
    <div class="floor-plan-source-options" role="group" aria-label="${esc(tr("floorPlanSetupTitle"))}">
      <label><input type="checkbox" data-floor-plan-source-toggle="interactive"${interactiveEnabled ? " checked" : ""}><span><strong>${esc(tr("floorPlanSourceInteractive"))}</strong><small>${esc(tr("floorPlanSourceInteractiveHint"))}</small></span></label>
      <label><input type="checkbox" data-floor-plan-source-toggle="external"${showExternalPanel ? " checked" : ""}><span><strong>${esc(tr("floorPlanSourceFile"))}</strong><small>${esc(tr("floorPlanSourceFileHint"))}</small></span></label>
    </div>
    ${externalPanel}${editorPanel}
    <p id="floorPlanSetupMsg" class="msg" role="status" aria-live="polite"></p>
  </div>`;
}

function floorPlanEditorWorkspaceHtml() {
  const document = normalizeFloorPlanDocument(S.floorPlanDraft.document);
  const activeFloor = document.floors.find(floor => floor.id === S.floorPlanEditorFloorId) || document.floors[0];
  S.floorPlanEditorFloorId = activeFloor.id;
  const floorTabs = document.floors.map(floor => `<button type="button" data-floor-plan-floor="${esc(floor.id)}" aria-pressed="${String(floor.id === activeFloor.id)}">${esc(floor.name)}</button>`).join("");
  const roomOptions = S.rooms.map(room => `<option value="${esc(room.id)}">${esc(room.name)}${room.floor ? ` · ${esc(room.floor)}` : ""}</option>`).join("");
  return `<div class="floor-plan-editor" data-floor-id="${esc(activeFloor.id)}">
    <div class="floor-plan-editor-head">
      <div>
        <span class="floor-plan-editor-kicker">${esc(tr("floorPlanDraft"))}</span>
        <input id="floorPlanDocumentTitle" class="floor-plan-title-input" type="text" value="${esc(document.title)}" placeholder="${esc(S.con?.name || tr("floorPlan"))}" aria-label="${esc(tr("floorPlanTitleLabel"))}">
      </div>
      <div class="floor-plan-editor-actions">
        <span id="floorPlanSaveState" class="floor-plan-save-state" role="status" aria-live="polite">${esc(tr("floorPlanSavedAt"))}</span>
        <button type="button" id="floorPlanVersionsBtn">${esc(tr("floorPlanVersions"))}</button>
        <button type="button" id="floorPlanPreviewBtn">${esc(tr("floorPlanPreview"))}</button>
        <details class="floor-plan-more-menu"><summary class="btn">${esc(tr("floorPlanMoreActions"))} <span aria-hidden="true">⌄</span></summary><div>
          <button type="button" id="floorPlanExportBtn">⇩ ${esc(tr("floorPlanExport"))}</button>
          <button type="button" id="floorPlanImportBtn">⇧ ${esc(tr("floorPlanImport"))}</button>
          <button type="button" id="floorPlanCopyBtn">⧉ ${esc(tr("floorPlanCopy"))}</button>
        </div></details>
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
        <section class="floor-plan-tool-section">
          <div class="floor-plan-tool-heading"><span aria-hidden="true">▭</span><div><strong>${esc(tr("floorPlanRoomsTool"))}</strong><small>${esc(tr("floorPlanRoomsToolHint"))}</small></div></div>
          ${S.rooms.length ? `<label class="floor-plan-tool-field"><span>${esc(tr("floorPlanLinkedRoom"))}</span><select id="floorPlanRoomSelect" aria-label="${esc(tr("floorPlanChooseRoom"))}">${roomOptions}</select></label><button type="button" id="floorPlanAddLinkedRoomBtn" class="primary floor-plan-tool-action">＋ ${esc(tr("floorPlanAddLinkedRoom"))}</button>` : `<p class="hint">${esc(tr("floorPlanNoRooms"))}</p>`}
          <button type="button" id="floorPlanAddCustomRoomBtn" class="floor-plan-tool-action">＋ ${esc(tr("floorPlanAddCustomRoom"))}</button>
        </section>
        <section class="floor-plan-tool-section">
          <div class="floor-plan-tool-heading"><span aria-hidden="true">T</span><div><strong>${esc(tr("floorPlanLabelsTool"))}</strong><small>${esc(tr("floorPlanLabelsToolHint"))}</small></div></div>
          <button type="button" id="floorPlanAddTextBtn" class="floor-plan-tool-action">T ${esc(tr("floorPlanAddText"))}</button>
        </section>
        <section class="floor-plan-tool-section">
          <div class="floor-plan-tool-heading"><span aria-hidden="true">⌖</span><div><strong>${esc(tr("floorPlanSymbolsTool"))}</strong><small>${esc(tr("floorPlanSymbolsToolHint"))}</small></div></div>
          <button type="button" id="floorPlanSymbolMenuBtn" class="floor-plan-tool-action" aria-expanded="false" aria-controls="floorPlanSymbolPalette">⌖ ${esc(tr("floorPlanChooseSymbol"))}<span aria-hidden="true">⌄</span></button>
          <div id="floorPlanSymbolPalette" class="floor-plan-symbol-palette" hidden>${floorPlanSymbolPaletteHtml()}</div>
        </section>
        <section class="floor-plan-tool-section">
          <div class="floor-plan-tool-heading"><span aria-hidden="true">▧</span><div><strong>${esc(tr("floorPlanGraphicsTool"))}</strong><small>${esc(tr("floorPlanGraphicsToolHint"))}</small></div></div>
          <input id="floorPlanGraphicInput" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp">
          <button type="button" id="floorPlanAddGraphicBtn" class="floor-plan-tool-action">▧ ${esc(tr("floorPlanAddGraphic"))}</button>
          <small class="floor-plan-graphic-rules">${esc(tr("floorPlanGraphicRules"))}</small>
          <p id="floorPlanGraphicMsg" class="msg floor-plan-tool-msg" role="status" aria-live="polite"></p>
        </section>
        <div class="floor-plan-tool-row floor-plan-history-actions">
          <button type="button" id="floorPlanUndoBtn" title="${esc(tr("floorPlanUndo"))}">↶</button>
          <button type="button" id="floorPlanRedoBtn" title="${esc(tr("floorPlanRedo"))}">↷</button>
          <button type="button" id="floorPlanDeleteObjectBtn" class="danger" title="${esc(tr("floorPlanDeleteObject"))}">⌫</button>
        </div>
      </aside>
      <div class="floor-plan-canvas-stage">
        <div class="floor-plan-canvas-toolbar">
          <div class="floor-plan-zoom-controls" role="group" aria-label="${esc(tr("floorPlanZoom"))}">
            <button type="button" id="floorPlanZoomOut" title="${esc(tr("floorPlanZoomOut"))}" aria-label="${esc(tr("floorPlanZoomOut"))}">−</button>
            <output id="floorPlanZoomValue" aria-live="polite">100 %</output>
            <button type="button" id="floorPlanZoomIn" title="${esc(tr("floorPlanZoomIn"))}" aria-label="${esc(tr("floorPlanZoomIn"))}">＋</button>
            <button type="button" id="floorPlanZoomFit" class="floor-plan-zoom-fit" title="${esc(tr("floorPlanZoomFit"))}" aria-label="${esc(tr("floorPlanZoomFit"))}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg></button>
            <button type="button" id="floorPlanPanToggle" class="floor-plan-pan-toggle floor-plan-grid-toggle" aria-pressed="${String(floorPlanPanEnabled)}" title="${esc(tr("floorPlanPanHint"))}" aria-label="${esc(tr("floorPlanPan"))}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v7M10 10V6a2 2 0 0 0-4 0v8M18 9a2 2 0 0 1 4 0v5a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.5L2.5 16a2 2 0 0 1 2.8-2.8L8 15.7"/></svg></button>
            <button type="button" id="floorPlanGridToggle" class="floor-plan-grid-toggle" aria-pressed="${String(floorPlanGridVisible)}" title="${esc(tr("floorPlanGridToggle"))}">▦ ${esc(tr("floorPlanGrid"))}</button>
            <button type="button" id="floorPlanSnapToggle" class="floor-plan-grid-toggle" aria-pressed="${String(floorPlanSnapEnabled)}" title="${esc(tr("floorPlanSnapHint"))}">↔ ${esc(tr("floorPlanSnap"))}</button>
          </div>
          <div class="floor-plan-trace-controls">
            <input id="floorPlanTraceInput" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp,application/pdf">
            <button type="button" id="floorPlanTraceChoose">▧ ${esc(tr("floorPlanTraceChoose"))}</button>
            <span id="floorPlanTraceName" class="floor-plan-trace-name" hidden></span>
            <label id="floorPlanTracePageLabel" hidden>${esc(tr("floorPlanTracePage"))}<select id="floorPlanTracePage"></select></label>
            <label id="floorPlanTraceOpacityLabel" hidden>${esc(tr("floorPlanTraceOpacity"))}<input id="floorPlanTraceOpacity" type="range" min="10" max="80" step="5" value="35"></label>
            <button type="button" id="floorPlanTraceRemove" class="danger" hidden>${esc(tr("floorPlanTraceRemove"))}</button>
          </div>
        </div>
        <p id="floorPlanTraceHint" class="floor-plan-trace-hint">${esc(tr("floorPlanTraceHint"))}</p>
        <div class="floor-plan-canvas-viewport"><div class="floor-plan-canvas-wrap"><canvas id="floorPlanCanvas"></canvas></div></div>
        <p class="floor-plan-canvas-hint">${esc(LANG === "en" ? "Drag to move · handles resize · the hand tool pans the view" : "Ziehen verschiebt Objekte · Griffe skalieren · das Handwerkzeug bewegt die Ansicht")}</p>
      </div>
      <aside class="floor-plan-inspector" id="floorPlanInspector"><p class="hint">${esc(LANG === "en" ? "Select an item to edit it." : "Wähle ein Element aus, um es zu bearbeiten.")}</p></aside>
    </div>
  </div>`;
}

function disposeFloorPlanEditor() {
  floorPlanTraceRenderToken += 1;
  floorPlanEditorAbortController?.abort();
  floorPlanEditorAbortController = null;
  endFloorPlanPanGesture();
  if (floorPlanCanvas) {
    floorPlanCanvas.dispose();
    floorPlanCanvas = null;
  }
  clearTimeout(floorPlanSaveTimer);
}

async function mountFloorPlanSetup() {
  disposeFloorPlanEditor();
  document.querySelectorAll("[data-floor-plan-source-toggle]").forEach(input => input.addEventListener("change", async () => {
    const source = input.dataset.floorPlanSourceToggle;
    const msg = document.getElementById("floorPlanSetupMsg");
    if (source === "external" && input.checked && !floorPlanUrl()) {
      floorPlanExternalEditing = true;
      renderActive({ animate: false });
      requestAnimationFrame(() => document.getElementById("floorPlanUrl")?.focus());
      return;
    }
    try {
      msg.textContent = tr("floorPlanSaving");
      const external = source === "external" ? input.checked : floorPlanExternalEnabled();
      const interactive = source === "interactive" ? input.checked : floorPlanInteractiveEnabled();
      const mode = floorPlanModeForSources({ external, interactive });
      await S.store.setFloorPlanSource(mode, S.con.floor_plan_url || null);
      S.con.floor_plan_mode = mode;
      floorPlanExternalEditing = false;
      renderActive({ animate: false });
    } catch (error) {
      msg.className = "msg err";
      msg.textContent = floorPlanSaveErrorMessage(error);
    }
  }));
  document.getElementById("floorPlanCreateBtn")?.addEventListener("click", createFloorPlanDraft);
  if (!document.getElementById("floorPlanCanvas")) return;
  try {
    await loadFloorPlanFabric();
    initializeFloorPlanCanvas();
    wireFloorPlanEditorControls();
    wireFloorPlanTransferControls();
  } catch (error) {
    const msg = document.getElementById("floorPlanSetupMsg");
    if (msg) { msg.className = "msg err"; msg.textContent = error.message; }
  }
}

async function createFloorPlanDraft() {
  if (!S.role) return;
  const button = document.getElementById("floorPlanCreateBtn");
  if (button) button.disabled = true;
  const floorPlanDocument = newFloorPlanDocument();
  try {
    const revision = await S.store.saveFloorPlanDocument(floorPlanDocument, 0);
    S.floorPlanDraft = { document: floorPlanDocument, revision: Number(revision), published_at: null, updated_at: new Date().toISOString() };
    S.floorPlanEditorFloorId = floorPlanDocument.floors[0].id;
    renderActive({ animate: false });
  } catch (error) {
    const msg = document.getElementById("floorPlanSetupMsg");
    if (msg) { msg.className = "msg err"; msg.textContent = floorPlanSaveErrorMessage(error); }
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
  const color = floorPlanObjectRoomColor(object, room);
  const foreground = floorPlanObjectRoomForeground(object, room);
  const labelVisible = object.labelVisible !== false;
  const locationLabel = labelVisible ? room?.floor || object.customLocation || "" : "";
  const layout = floorPlanRoomLayout(object, label, locationLabel);
  const cornerRadius = Math.min(object.cornerRadius ?? 18, object.width / 2, object.height / 2);
  const rect = new fabric.Rect({ left: 0, top: 0, originX: "center", originY: "center", width: object.width, height: object.height, rx: cornerRadius, ry: cornerRadius, fill: `${color}26`, stroke: color, strokeWidth: 4 });
  const text = new fabric.Textbox(label, { left: 0, top: layout.labelCenterY - object.height / 2, originX: "center", originY: "center", width: Math.max(80, object.width - 40), textAlign: "center", fontSize: layout.labelFontSize, lineHeight: layout.lineHeight / layout.labelFontSize, fontWeight: "700", fill: foreground, fontFamily: "Arial", editable: false, visible: labelVisible });
  const marker = new fabric.FabricText(floorPlanObjectRoomGlyph(object, room), { left: 0, top: layout.markerCenterY - object.height / 2, originX: "center", originY: "center", fontSize: layout.markerSize, fontWeight: "800", fill: foreground, fontFamily: "Arial", visible: object.markerVisible !== false });
  const location = new fabric.FabricText(locationLabel, { left: 0, top: layout.locationY - object.height / 2, originX: "center", originY: "center", fontSize: 13, fill: foreground, fontFamily: "Arial" });
  const group = new fabric.Group([rect, marker, text, location], { left: object.x, top: object.y, originX: "left", originY: "top", angle: object.rotation || 0 });
  Object.assign(group, {
    fpId: object.id,
    fpType: "room",
    fpRoomId: object.roomId,
    fpFallbackLabel: label,
    fpCustomLocation: object.customLocation || "",
    fpCustomColor: object.customColor || "#64748b",
    fpForegroundColor: object.foregroundColor || null,
    fpCustomMarker: object.customMarker || "square",
    fpLabelVisible: object.labelVisible !== false,
    fpMarkerVisible: object.markerVisible !== false,
    fpCornerRadius: object.cornerRadius ?? 18,
    fpRect: rect,
    fpMarkerText: marker,
    fpRoomLabelText: text,
    fpLocationText: location,
    fpWidth: object.width,
    fpHeight: object.height,
  });
  return floorPlanFabricStyles(group);
}

function floorPlanFabricObject(object) {
  if (object.type === "room") return floorPlanFabricRoom(object);
  if (object.type === "text") {
    const text = new fabric.Textbox(object.text, { left: object.x, top: object.y, width: object.width, fontSize: object.fontSize || 28, fontWeight: "600", fill: object.color || "#172033", fontFamily: "Arial", textAlign: "center", angle: object.rotation || 0 });
    Object.assign(text, { fpId: object.id, fpType: "text", fpColor: object.color || "#172033", fpFontSize: object.fontSize || 28 });
    return floorPlanFabricStyles(text);
  }
  if (object.type === "image") {
    const element = new Image();
    const image = new fabric.FabricImage(element, {
      left: object.x, top: object.y, width: 1, height: 1,
      scaleX: object.width, scaleY: object.height, angle: object.rotation || 0,
    });
    Object.assign(image, { fpId: object.id, fpType: "image", fpSrc: object.src, fpAlt: object.alt || "", fpWidth: 1, fpHeight: 1 });
    image.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
    element.addEventListener("load", () => {
      const naturalWidth = Math.max(1, element.naturalWidth || element.width || 1);
      const naturalHeight = Math.max(1, element.naturalHeight || element.height || 1);
      const targetWidth = Math.max(24, image.fpWidth * Math.abs(image.scaleX || 1));
      const targetHeight = Math.max(24, image.fpHeight * Math.abs(image.scaleY || 1));
      const scale = Math.max(.001, Math.min(targetWidth / naturalWidth, targetHeight / naturalHeight));
      image.set({ width: naturalWidth, height: naturalHeight, scaleX: scale, scaleY: scale, dirty: true });
      image.fpWidth = naturalWidth;
      image.fpHeight = naturalHeight;
      image.setCoords();
      floorPlanCanvas?.requestRenderAll();
    }, { once: true });
    element.src = object.src;
    return floorPlanFabricStyles(image);
  }
  const symbol = FLOOR_PLAN_SYMBOLS[object.symbol] || FLOOR_PLAN_SYMBOLS.info;
  const labelSpace = 30;
  const iconDiameter = Math.max(64, Math.min(object.width, object.height - labelSpace));
  const iconY = -labelSpace / 2;
  const backgroundVisible = object.backgroundVisible !== false;
  const circle = new fabric.Circle({ left: 0, top: iconY, originX: "center", originY: "center", radius: iconDiameter / 2 - 4, fill: backgroundVisible ? "#ffffff" : "rgba(255,255,255,0)", stroke: backgroundVisible ? "#62708a" : "rgba(98,112,138,0)", strokeWidth: 4 });
  const glyph = new fabric.FabricText(symbol.glyph, { left: 0, top: iconY, originX: "center", originY: "center", fontSize: backgroundVisible ? Math.max(30, iconDiameter * .38) : Math.max(42, iconDiameter * .58), fill: "#27344d", fontWeight: "700", fontFamily: "Arial" });
  const label = new fabric.FabricText(object.label || "", { left: 0, top: iconDiameter / 2 + 1, originX: "center", originY: "top", fontSize: 15, fill: "#596579", fontWeight: "600", fontFamily: "Arial" });
  const group = new fabric.Group([circle, glyph, label], { left: object.x, top: object.y, originX: "left", originY: "top", angle: object.rotation || 0 });
  Object.assign(group, { fpId: object.id, fpType: "symbol", fpSymbol: object.symbol, fpLabel: object.label || "", fpLabelText: label, fpBackgroundVisible: backgroundVisible, fpWidth: object.width, fpHeight: object.height });
  return floorPlanFabricStyles(group);
}

function setFloorPlanEditorZoom(value) {
  floorPlanEditorZoom = Math.min(2, Math.max(.4, Math.round(Number(value) * 10) / 10));
  const wrap = document.querySelector(".floor-plan-canvas-wrap");
  const stage = document.querySelector(".floor-plan-canvas-stage");
  if (wrap) wrap.style.width = `${floorPlanEditorZoom * 100}%`;
  stage?.classList.toggle("is-zoomed-in", floorPlanEditorZoom > 1);
  const output = document.getElementById("floorPlanZoomValue");
  if (output) output.textContent = `${Math.round(floorPlanEditorZoom * 100)} %`;
  const zoomOut = document.getElementById("floorPlanZoomOut");
  const zoomIn = document.getElementById("floorPlanZoomIn");
  if (zoomOut) zoomOut.disabled = floorPlanEditorZoom <= .4;
  if (zoomIn) zoomIn.disabled = floorPlanEditorZoom >= 2;
  requestAnimationFrame(() => floorPlanCanvas?.calcOffset());
}

function endFloorPlanPanGesture() {
  floorPlanPanGesture = null;
  document.querySelector(".floor-plan-canvas-stage")?.classList.remove("is-panning");
  if (floorPlanPanEnabled) floorPlanCanvas?.setCursor("grab");
}

function applyFloorPlanPanMode() {
  const stage = document.querySelector(".floor-plan-canvas-stage");
  const button = document.getElementById("floorPlanPanToggle");
  stage?.classList.toggle("is-pan-enabled", floorPlanPanEnabled);
  button?.setAttribute("aria-pressed", String(floorPlanPanEnabled));
  if (!floorPlanCanvas) return;
  floorPlanCanvas.selection = !floorPlanPanEnabled;
  floorPlanCanvas.skipTargetFind = floorPlanPanEnabled;
  floorPlanCanvas.defaultCursor = floorPlanPanEnabled ? "grab" : "default";
  floorPlanCanvas.hoverCursor = floorPlanPanEnabled ? "grab" : "move";
  floorPlanCanvas.moveCursor = floorPlanPanEnabled ? "grab" : "move";
  if (floorPlanPanEnabled) floorPlanCanvas.discardActiveObject();
  else endFloorPlanPanGesture();
  floorPlanCanvas.setCursor(floorPlanPanEnabled ? "grab" : "default");
  floorPlanCanvas.requestRenderAll();
}

function toggleFloorPlanPan() {
  floorPlanPanEnabled = !floorPlanPanEnabled;
  endFloorPlanPanGesture();
  applyFloorPlanPanMode();
}

function wireFloorPlanPanGesture() {
  const surface = floorPlanCanvas?.upperCanvasEl;
  const stage = document.querySelector(".floor-plan-canvas-stage");
  const viewport = document.querySelector(".floor-plan-canvas-viewport");
  const signal = floorPlanEditorAbortController?.signal;
  if (!surface || !stage || !viewport || !signal) return;
  const finish = event => {
    if (!floorPlanPanGesture || event.pointerId !== floorPlanPanGesture.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (surface.hasPointerCapture?.(event.pointerId)) surface.releasePointerCapture(event.pointerId);
    endFloorPlanPanGesture();
  };
  surface.addEventListener("pointerdown", event => {
    if (!floorPlanPanEnabled || event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    floorPlanCanvas?.discardActiveObject();
    floorPlanPanGesture = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    surface.setPointerCapture?.(event.pointerId);
    stage.classList.add("is-panning");
    floorPlanCanvas?.setCursor("grabbing");
  }, { capture: true, signal });
  surface.addEventListener("pointermove", event => {
    const gesture = floorPlanPanGesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    viewport.scrollLeft = gesture.scrollLeft - (event.clientX - gesture.x);
    viewport.scrollTop = gesture.scrollTop - (event.clientY - gesture.y);
  }, { capture: true, signal });
  surface.addEventListener("pointerup", finish, { capture: true, signal });
  surface.addEventListener("pointercancel", finish, { capture: true, signal });
  surface.addEventListener("lostpointercapture", endFloorPlanPanGesture, { signal });
}

function applyFloorPlanGridVisibility() {
  const floor = floorPlanActiveFloor();
  const container = document.querySelector(".floor-plan-canvas-wrap .canvas-container");
  if (container && floor) {
    container.classList.toggle("is-grid-visible", floorPlanGridVisible);
    container.style.setProperty("--floor-plan-grid-x", `${(12 / floor.width) * 100}%`);
    container.style.setProperty("--floor-plan-grid-y", `${(12 / floor.height) * 100}%`);
  }
  const button = document.getElementById("floorPlanGridToggle");
  if (button) button.setAttribute("aria-pressed", String(floorPlanGridVisible));
}

function toggleFloorPlanGrid() {
  floorPlanGridVisible = !floorPlanGridVisible;
  try { localStorage.setItem("floorPlanEditorGridVisible", String(floorPlanGridVisible)); }
  catch { /* Die rein lokale Komforteinstellung darf den Editor nicht blockieren. */ }
  applyFloorPlanGridVisibility();
}

function toggleFloorPlanSnap() {
  floorPlanSnapEnabled = !floorPlanSnapEnabled;
  try { localStorage.setItem("floorPlanEditorSnapEnabled", String(floorPlanSnapEnabled)); }
  catch { /* Die lokale Komforteinstellung darf den Editor nicht blockieren. */ }
  const button = document.getElementById("floorPlanSnapToggle");
  if (button) button.setAttribute("aria-pressed", String(floorPlanSnapEnabled));
  if (!floorPlanSnapEnabled) clearFloorPlanSnapGuides();
}

function floorPlanSnapCandidate(activeValues, targetValues, threshold = 8) {
  let best = null;
  for (const active of activeValues) for (const target of targetValues) {
    const delta = target - active;
    if (Math.abs(delta) <= threshold && (best == null || Math.abs(delta) < Math.abs(best.delta))) best = { delta, target };
  }
  return best;
}

function floorPlanSnapGuide(axis) {
  const container = document.querySelector(".floor-plan-canvas-wrap .canvas-container");
  if (!container) return null;
  let guide = container.querySelector(`[data-floor-plan-snap-guide="${axis}"]`);
  if (!guide) {
    guide = document.createElement("span");
    guide.className = `floor-plan-snap-guide is-${axis}`;
    guide.dataset.floorPlanSnapGuide = axis;
    guide.hidden = true;
    container.appendChild(guide);
  }
  return guide;
}

function showFloorPlanSnapGuides({ x = null, y = null } = {}) {
  const floor = floorPlanActiveFloor();
  if (!floor) return;
  const vertical = floorPlanSnapGuide("vertical");
  const horizontal = floorPlanSnapGuide("horizontal");
  if (vertical) {
    vertical.hidden = x == null;
    if (x != null) vertical.style.left = `${Math.min(100, Math.max(0, x / floor.width * 100))}%`;
  }
  if (horizontal) {
    horizontal.hidden = y == null;
    if (y != null) horizontal.style.top = `${Math.min(100, Math.max(0, y / floor.height * 100))}%`;
  }
}

function clearFloorPlanSnapGuides() {
  document.querySelectorAll("[data-floor-plan-snap-guide]").forEach(guide => { guide.hidden = true; });
}

function floorPlanSnapContext(object) {
  const floor = floorPlanActiveFloor();
  if (!floor || !floorPlanCanvas || !object) return null;
  const xTargets = [0, floor.width / 2, floor.width];
  const yTargets = [0, floor.height / 2, floor.height];
  const isActiveSelection = Boolean(object.getObjects)
    && (String(object.type || "").toLowerCase() === "activeselection" || object.isType?.("ActiveSelection"));
  const movingObjects = new Set(isActiveSelection ? object.getObjects() : [object]);
  floorPlanCanvas.getObjects().filter(other => !movingObjects.has(other)).forEach(other => {
    const target = other.getBoundingRect();
    xTargets.push(target.left, target.left + target.width / 2, target.left + target.width);
    yTargets.push(target.top, target.top + target.height / 2, target.top + target.height);
  });
  // Die Toleranz bleibt auch bei verkleinerter/vergrößerter Arbeitsfläche
  // ungefähr 14 sichtbare Pixel groß und ist damit bewusst spürbar.
  const threshold = 14 / floorPlanEditorZoom;
  return { floor, xTargets, yTargets, threshold };
}

function alignFloorPlanObject(object) {
  if (!floorPlanSnapEnabled || !object) {
    clearFloorPlanSnapGuides();
    return;
  }
  const context = floorPlanSnapContext(object);
  if (!context) return;
  object.setCoords();
  const box = object.getBoundingRect();
  const { xTargets, yTargets, threshold } = context;
  const xSnap = floorPlanSnapCandidate([box.left, box.left + box.width / 2, box.left + box.width], xTargets, threshold);
  const ySnap = floorPlanSnapCandidate([box.top, box.top + box.height / 2, box.top + box.height], yTargets, threshold);
  if (xSnap) object.set("left", object.left + xSnap.delta);
  if (ySnap) object.set("top", object.top + ySnap.delta);
  object.setCoords();
  showFloorPlanSnapGuides({ x: xSnap?.target ?? null, y: ySnap?.target ?? null });
}

function floorPlanScalingEdges(transform) {
  const corner = String(transform?.corner || "").toLowerCase();
  return {
    left: corner.includes("l"), right: corner.includes("r"),
    top: corner.includes("t"), bottom: corner.includes("b"),
  };
}

function floorPlanScaleFactor(box, edge, snap) {
  if (!snap) return null;
  const currentSize = edge === "left" || edge === "right" ? box.width : box.height;
  const desiredSize = edge === "left" || edge === "top" ? currentSize - snap.delta : currentSize + snap.delta;
  if (!Number.isFinite(desiredSize) || desiredSize < 24 || currentSize <= 0) return null;
  return desiredSize / currentSize;
}

function scaleFloorPlanObjectAroundAnchor(object, edges, axis, factor, uniform) {
  if (!Number.isFinite(factor) || factor <= 0) return;
  object.setCoords();
  const before = object.getBoundingRect();
  const anchorX = edges.left ? before.left + before.width : edges.right ? before.left : before.left + before.width / 2;
  const anchorY = edges.top ? before.top + before.height : edges.bottom ? before.top : before.top + before.height / 2;
  if (uniform || axis === "x") object.set("scaleX", Math.max(.01, object.scaleX * factor));
  if (uniform || axis === "y") object.set("scaleY", Math.max(.01, object.scaleY * factor));
  object.setCoords();
  const after = object.getBoundingRect();
  const nextAnchorX = edges.left ? after.left + after.width : edges.right ? after.left : after.left + after.width / 2;
  const nextAnchorY = edges.top ? after.top + after.height : edges.bottom ? after.top : after.top + after.height / 2;
  object.set({ left: object.left + anchorX - nextAnchorX, top: object.top + anchorY - nextAnchorY });
  object.setCoords();
}

function resizeFloorPlanObjectToSnap(object, transform) {
  if (!floorPlanSnapEnabled || !object) {
    clearFloorPlanSnapGuides();
    return;
  }
  const context = floorPlanSnapContext(object);
  if (!context) return;
  const edges = floorPlanScalingEdges(transform);
  const xEdge = edges.left ? "left" : edges.right ? "right" : null;
  const yEdge = edges.top ? "top" : edges.bottom ? "bottom" : null;
  if (!xEdge && !yEdge) {
    clearFloorPlanSnapGuides();
    return;
  }
  object.setCoords();
  const box = object.getBoundingRect();
  const activeX = xEdge === "left" ? box.left : xEdge === "right" ? box.left + box.width : null;
  const activeY = yEdge === "top" ? box.top : yEdge === "bottom" ? box.top + box.height : null;
  const xSnap = activeX == null ? null : floorPlanSnapCandidate([activeX], context.xTargets, context.threshold);
  const ySnap = activeY == null ? null : floorPlanSnapCandidate([activeY], context.yTargets, context.threshold);
  const xFactor = floorPlanScaleFactor(box, xEdge, xSnap);
  const yFactor = floorPlanScaleFactor(box, yEdge, ySnap);
  // Eckgriffe und Bilder bleiben proportional. Falls beide Achsen in Reichweite
  // sind, gewinnt die kleinere sichtbare Größenkorrektur; so springt der Griff
  // nicht zwischen zwei widersprüchlichen Seitenverhältnissen.
  const uniform = object.fpType === "image" || Boolean(xEdge && yEdge);
  let axis = null, snap = null, factor = null;
  if (uniform) {
    const choices = [
      xFactor == null ? null : { axis: "x", snap: xSnap, factor: xFactor },
      yFactor == null ? null : { axis: "y", snap: ySnap, factor: yFactor },
    ].filter(Boolean).sort((a, b) => Math.abs(a.factor - 1) - Math.abs(b.factor - 1));
    ({ axis = null, snap = null, factor = null } = choices[0] || {});
  } else if (xFactor != null) ({ axis, snap, factor } = { axis: "x", snap: xSnap, factor: xFactor });
  else if (yFactor != null) ({ axis, snap, factor } = { axis: "y", snap: ySnap, factor: yFactor });
  if (!axis || !snap || factor == null) {
    clearFloorPlanSnapGuides();
    return;
  }
  scaleFloorPlanObjectAroundAnchor(object, edges, axis, factor, uniform);
  // Bei gedrehten Objekten besteht die sichtbare Bounding-Box aus beiden
  // lokalen Achsen. Zwei kurze Korrekturschritte bringen deshalb auch deren
  // gezogene Außenkante pixelgenau auf die gewählte Hilfslinie.
  for (let pass = 0; pass < 3; pass += 1) {
    object.setCoords();
    const currentBox = object.getBoundingRect();
    const currentEdge = axis === "x"
      ? xEdge === "left" ? currentBox.left : currentBox.left + currentBox.width
      : yEdge === "top" ? currentBox.top : currentBox.top + currentBox.height;
    const residual = snap.target - currentEdge;
    if (Math.abs(residual) <= .05) break;
    const correction = floorPlanScaleFactor(currentBox, axis === "x" ? xEdge : yEdge, { delta: residual });
    if (correction == null) break;
    scaleFloorPlanObjectAroundAnchor(object, edges, axis, correction, uniform);
  }
  object.setCoords();
  const finalBox = object.getBoundingRect();
  const finalX = xEdge === "left" ? finalBox.left : xEdge === "right" ? finalBox.left + finalBox.width : null;
  const finalY = yEdge === "top" ? finalBox.top : yEdge === "bottom" ? finalBox.top + finalBox.height : null;
  const guideTolerance = 1 / floorPlanEditorZoom;
  const guideX = axis === "x" ? snap.target : xSnap && finalX != null && Math.abs(finalX - xSnap.target) <= guideTolerance ? xSnap.target : null;
  const guideY = axis === "y" ? snap.target : ySnap && finalY != null && Math.abs(finalY - ySnap.target) <= guideTolerance ? ySnap.target : null;
  showFloorPlanSnapGuides({ x: guideX, y: guideY });
  floorPlanCanvas.requestRenderAll();
}

function floorPlanTraceEntry() {
  return floorPlanTraceReferences.get(S.floorPlanEditorFloorId) || null;
}

function disposeFloorPlanTraceEntry(entry) {
  if (!entry) return;
  if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
  entry.pdfDocument?.destroy?.().catch?.(() => {});
}

function floorPlanTraceImage(elementOrUrl) {
  if (elementOrUrl instanceof HTMLCanvasElement || elementOrUrl instanceof HTMLImageElement && elementOrUrl.complete) return Promise.resolve(elementOrUrl);
  return new Promise((resolve, reject) => {
    const image = elementOrUrl instanceof HTMLImageElement ? elementOrUrl : new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(tr("floorPlanTraceUnreadable")));
    if (!(elementOrUrl instanceof HTMLImageElement)) image.src = elementOrUrl;
  });
}

async function createFloorPlanTraceEntry(file) {
  if (!file || file.size > FLOOR_PLAN_TRACE_MAX_BYTES) throw new Error(tr("floorPlanTraceFileError"));
  if (!FLOOR_PLAN_TRACE_TYPES.has(file.type)) throw new Error(tr("floorPlanTraceTypeError"));
  if (file.type === "application/pdf") {
    const pdfjsLib = await loadFloorPlanPdf();
    const pdfDocument = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    if (!pdfDocument.numPages) { await pdfDocument.destroy(); throw new Error(tr("floorPlanTraceUnreadable")); }
    return { kind: "pdf", name: file.name, opacity: .35, page: 1, pageCount: pdfDocument.numPages, pdfDocument };
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    await floorPlanTraceImage(objectUrl);
    return { kind: "image", name: file.name, opacity: .35, objectUrl };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function floorPlanTraceSource(entry, floor) {
  if (entry.kind === "image") {
    const image = await floorPlanTraceImage(entry.objectUrl);
    return { element: image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
  }
  const page = await entry.pdfDocument.getPage(entry.page);
  const initialViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(3, Math.max(1, floor.width / initialViewport.width, floor.height / initialViewport.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport }).promise;
  return { element: canvas, width: canvas.width, height: canvas.height };
}

async function applyFloorPlanTraceReference() {
  const canvas = floorPlanCanvas;
  const floor = floorPlanActiveFloor();
  const entry = floorPlanTraceEntry();
  const token = ++floorPlanTraceRenderToken;
  if (!canvas || !floor || !entry) {
    if (canvas) { canvas.backgroundImage = undefined; canvas.requestRenderAll(); }
    return;
  }
  const source = await floorPlanTraceSource(entry, floor);
  if (token !== floorPlanTraceRenderToken || canvas !== floorPlanCanvas || entry !== floorPlanTraceEntry()) return;
  const scale = Math.min(floor.width / source.width, floor.height / source.height);
  const background = new fabric.FabricImage(source.element, {
    left: (floor.width - source.width * scale) / 2,
    top: (floor.height - source.height * scale) / 2,
    originX: "left", originY: "top", scaleX: scale, scaleY: scale,
    opacity: entry.opacity, selectable: false, evented: false, excludeFromExport: true,
  });
  canvas.backgroundImage = background;
  canvas.requestRenderAll();
}

function updateFloorPlanTraceControls(message = "", isError = false) {
  const entry = floorPlanTraceEntry();
  const name = document.getElementById("floorPlanTraceName");
  const pageLabel = document.getElementById("floorPlanTracePageLabel");
  const pageSelect = document.getElementById("floorPlanTracePage");
  const opacityLabel = document.getElementById("floorPlanTraceOpacityLabel");
  const opacity = document.getElementById("floorPlanTraceOpacity");
  const remove = document.getElementById("floorPlanTraceRemove");
  const hint = document.getElementById("floorPlanTraceHint");
  if (name) { name.hidden = !entry; name.textContent = entry?.name || ""; name.title = entry?.name || ""; }
  if (opacityLabel) opacityLabel.hidden = !entry;
  if (opacity && entry) opacity.value = String(Math.round(entry.opacity * 100));
  if (remove) remove.hidden = !entry;
  if (pageLabel) pageLabel.hidden = !entry || entry.kind !== "pdf" || entry.pageCount <= 1;
  if (pageSelect && entry?.kind === "pdf") pageSelect.innerHTML = Array.from({ length: entry.pageCount }, (_, index) => `<option value="${index + 1}"${entry.page === index + 1 ? " selected" : ""}>${index + 1} / ${entry.pageCount}</option>`).join("");
  if (hint) { hint.className = `floor-plan-trace-hint${isError ? " is-error" : ""}`; hint.textContent = message || tr(entry ? "floorPlanTraceActiveHint" : "floorPlanTraceHint"); }
}

function initializeFloorPlanCanvas() {
  floorPlanEditorAbortController = new AbortController();
  floorPlanEditorDocument = normalizeFloorPlanDocument(S.floorPlanDraft.document);
  const floor = floorPlanActiveFloor();
  floorPlanCanvas = new fabric.Canvas("floorPlanCanvas", {
    width: floor.width, height: floor.height, backgroundColor: "transparent", preserveObjectStacking: true,
    uniformScaling: true,
    selectionColor: "rgba(91,141,239,.12)", selectionBorderColor: "#5b8def", selectionLineWidth: 2,
  });
  floorPlanCanvas.add(...floor.objects.map(floorPlanFabricObject));
  floorPlanCanvas.on("selection:created", renderFloorPlanInspector);
  floorPlanCanvas.on("selection:updated", renderFloorPlanInspector);
  floorPlanCanvas.on("selection:cleared", () => { clearFloorPlanSnapGuides(); renderFloorPlanInspector(); });
  floorPlanCanvas.on("object:moving", event => {
    const object = event.target;
    if (floorPlanGridVisible) object.set({ left: Math.round(object.left / 12) * 12, top: Math.round(object.top / 12) * 12 });
    alignFloorPlanObject(object);
    containFloorPlanFabricPosition(object);
  });
  floorPlanCanvas.on("object:scaling", event => {
    const object = event.target;
    if (object?.fpType === "image") object.set("scaleY", object.scaleX);
    resizeFloorPlanObjectToSnap(object, event.transform);
  });
  floorPlanCanvas.on("object:modified", event => {
    clearFloorPlanSnapGuides();
    normalizeFloorPlanFabricObject(event.target);
    floorPlanCanvasChanged();
  });
  floorPlanCanvas.on("mouse:up", clearFloorPlanSnapGuides);
  wireFloorPlanPanGesture();
  floorPlanHistory = [JSON.stringify(floorPlanEditorDocument)];
  floorPlanFuture = [];
  updateFloorPlanHistoryButtons();
  updateFloorPlanTraceControls();
  setFloorPlanEditorZoom(floorPlanEditorZoom);
  applyFloorPlanGridVisibility();
  applyFloorPlanPanMode();
  applyFloorPlanTraceReference().catch(error => updateFloorPlanTraceControls(error.message, true));
  requestAnimationFrame(() => floorPlanCanvas.calcOffset());
}

function floorPlanObjectFromFabric(object) {
  const objectWidth = Number.isFinite(object.fpWidth) ? object.fpWidth : object.width;
  const objectHeight = Number.isFinite(object.fpHeight) ? object.fpHeight : object.height;
  const base = {
    id: object.fpId || floorPlanId(object.fpType), type: object.fpType,
    x: Math.max(0, Math.round(object.left)), y: Math.max(0, Math.round(object.top)),
    width: Math.max(24, Math.round(objectWidth * object.scaleX)), height: Math.max(24, Math.round(objectHeight * object.scaleY)),
    rotation: Math.round(object.angle || 0),
  };
  if (object.fpType === "room") return {
    ...base,
    roomId: object.fpRoomId || null,
    fallbackLabel: object.fpFallbackLabel || "",
    customLocation: object.fpCustomLocation || "",
    customColor: object.fpCustomColor || "#64748b",
    foregroundColor: /^#[0-9a-f]{6}$/i.test(String(object.fpForegroundColor || "")) ? object.fpForegroundColor : null,
    customMarker: object.fpCustomMarker || "square",
    labelVisible: object.fpLabelVisible !== false,
    markerVisible: object.fpMarkerVisible !== false,
    cornerRadius: Number.isFinite(object.fpCornerRadius) ? object.fpCornerRadius : 18,
  };
  if (object.fpType === "text") return { ...base, text: object.text || "Text", color: object.fpColor || "#172033", fontSize: Number.isFinite(object.fpFontSize) ? object.fpFontSize : 28 };
  if (object.fpType === "image") return { ...base, src: object.fpSrc || "", alt: object.fpAlt || "" };
  return { ...base, symbol: object.fpSymbol || "info", label: object.fpLabel || "", backgroundVisible: object.fpBackgroundVisible !== false };
}

function containFloorPlanFabricPosition(object) {
  const floor = floorPlanActiveFloor();
  if (!object || !floor) return object;
  const raw = floorPlanObjectFromFabric(object);
  const domain = normalizeFloorPlanObject(raw, floor);
  object.set({ left: domain.x, top: domain.y });
  object.setCoords();
  return object;
}

function normalizeFloorPlanFabricObject(object) {
  const floor = floorPlanActiveFloor();
  if (!object || !floor) return object;
  const raw = floorPlanObjectFromFabric(object);
  const domain = normalizeFloorPlanObject(raw, floor);
  const scaled = Math.abs((object.scaleX || 1) - 1) >= .001 || Math.abs((object.scaleY || 1) - 1) >= .001;
  if (!scaled) {
    object.set({ left: domain.x, top: domain.y });
    object.setCoords();
    return object;
  }
  const canvas = floorPlanCanvas;
  const index = canvas.getObjects().indexOf(object);
  const replacement = floorPlanFabricObject(domain);
  canvas.remove(object);
  canvas.insertAt(index, replacement);
  canvas.setActiveObject(replacement);
  replacement.setCoords();
  canvas.requestRenderAll();
  renderFloorPlanInspector();
  return replacement;
}

function floorPlanSaveErrorMessage(error) {
  const code = String(error?.code || "").toUpperCase();
  const status = Number(error?.status || 0);
  const message = String(error?.message || error || "");
  if (code === "PT409" || status === 409 || message.toLowerCase().includes("revision conflict")) return tr("floorPlanConflict");
  if (code === "PT429" || code === "PT503" || status === 429 || status === 503) return tr("floorPlanSaveBusy");
  if (code === "PT413" || status === 413) return tr("floorPlanSaveTooLarge");
  if (code === "RPC_TIMEOUT" || code === "PT504" || status === 504) return tr("floorPlanSaveTimeout");
  if (code === "42501" || status === 401 || status === 403) return tr("floorPlanSaveUnauthorized");
  return tr("floorPlanSaveFailed", { err: message });
}

function syncFloorPlanCanvasToDocument({ history = true } = {}) {
  const floor = floorPlanActiveFloor();
  if (!floor || !floorPlanCanvas) return;
  floor.objects = floorPlanCanvas.getObjects().map(object => normalizeFloorPlanObject(floorPlanObjectFromFabric(object), floor)).filter(Boolean);
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
  if (state) { state.className = "floor-plan-save-state"; state.textContent = tr("floorPlanSaving"); }
  const publishButton = document.getElementById("floorPlanPublishBtn");
  if (publishButton) { publishButton.disabled = false; publishButton.textContent = tr("floorPlanPublish"); }
  floorPlanSaveTimer = setTimeout(() => saveFloorPlanNow().catch(() => {}), 900);
}

function saveFloorPlanNow({ sync = true } = {}) {
  clearTimeout(floorPlanSaveTimer);
  if (sync) syncFloorPlanCanvasToDocument({ history: false });
  floorPlanPendingSnapshot = structuredClone(floorPlanEditorDocument);
  S.floorPlanDraft = { ...S.floorPlanDraft, document: structuredClone(floorPlanEditorDocument) };
  const state = document.getElementById("floorPlanSaveState");
  if (state) { state.className = "floor-plan-save-state"; state.textContent = tr("floorPlanSaving"); }
  if (floorPlanSaveInFlight) return floorPlanSaveInFlight;
  floorPlanSaveInFlight = (async () => {
    try {
      let revision = Number(S.floorPlanDraft?.revision || 0);
      while (floorPlanPendingSnapshot) {
        const snapshot = floorPlanPendingSnapshot;
        floorPlanPendingSnapshot = null;
        revision = Number(await S.store.saveFloorPlanDocument(snapshot, revision));
        S.floorPlanDraft = { ...S.floorPlanDraft, document: snapshot, revision, updated_at: new Date().toISOString() };
      }
      const currentState = document.getElementById("floorPlanSaveState");
      if (currentState) { currentState.className = "floor-plan-save-state is-saved"; currentState.textContent = `✓ ${tr("floorPlanSavedAt")}`; }
      return revision;
    } catch (error) {
      const currentState = document.getElementById("floorPlanSaveState");
      if (currentState) { currentState.className = "floor-plan-save-state is-error"; currentState.textContent = floorPlanSaveErrorMessage(error); }
      throw error;
    } finally {
      floorPlanSaveInFlight = null;
    }
  })();
  return floorPlanSaveInFlight;
}

function addFloorPlanObject(object) {
  const fabricObject = floorPlanFabricObject(object);
  floorPlanCanvas.add(fabricObject);
  floorPlanCanvas.setActiveObject(fabricObject);
  floorPlanCanvas.requestRenderAll();
  floorPlanCanvasChanged();
}

function floorPlanCornerRadiusHtml(object) {
  const radius = Math.round(Number.isFinite(object.fpCornerRadius) ? object.fpCornerRadius : 18);
  return `<label class="floor-plan-radius-control"><span>${esc(tr("floorPlanCornerRadius"))}<output id="floorPlanCornerRadiusValue">${radius} px</output></span><input id="floorPlanCornerRadius" type="range" min="0" max="60" step="1" value="${radius}"></label>`;
}

function floorPlanMarkerVisibilityHtml(object) {
  return `<label class="floor-plan-property-toggle"><input id="floorPlanMarkerVisible" type="checkbox"${object.fpMarkerVisible === false ? "" : " checked"}><span>${esc(tr("floorPlanShowMarker"))}</span></label>`;
}

function floorPlanLabelVisibilityHtml(object) {
  return `<label class="floor-plan-property-toggle"><input id="floorPlanLabelVisible" type="checkbox"${object.fpLabelVisible === false ? "" : " checked"}><span>${esc(tr("floorPlanShowLabel"))}</span></label>`;
}

function floorPlanRoomForegroundHtml(object) {
  const automatic = !/^#[0-9a-f]{6}$/i.test(String(object.fpForegroundColor || ""));
  const resolved = floorPlanObjectRoomForeground(floorPlanObjectFromFabric(object));
  return `<fieldset class="floor-plan-room-foreground"><legend>${esc(tr("floorPlanRoomTextColor"))}</legend><label class="floor-plan-property-toggle"><input id="floorPlanRoomTextColorAuto" type="checkbox"${automatic ? " checked" : ""}><span>${esc(tr("floorPlanRoomTextColorAuto"))}</span></label><label><span>${esc(tr("floorPlanRoomTextColorCustom"))}</span><input id="floorPlanRoomTextColor" class="floor-plan-color-input" type="color" value="${esc(object.fpForegroundColor || resolved)}"${automatic ? " disabled" : ""}></label></fieldset>`;
}

function floorPlanArrangementHtml(object) {
  const objects = floorPlanCanvas?.getObjects() || [];
  const index = objects.indexOf(object);
  const last = objects.length - 1;
  return `<fieldset class="floor-plan-arrangement"><legend>${esc(tr("floorPlanArrangement"))}</legend><div>
    <button type="button" data-floor-plan-arrange="back"${index <= 0 ? " disabled" : ""}><span aria-hidden="true">⇊</span>${esc(tr("floorPlanSendToBack"))}</button>
    <button type="button" data-floor-plan-arrange="backward"${index <= 0 ? " disabled" : ""}><span aria-hidden="true">↓</span>${esc(tr("floorPlanSendBackward"))}</button>
    <button type="button" data-floor-plan-arrange="forward"${index < 0 || index >= last ? " disabled" : ""}><span aria-hidden="true">↑</span>${esc(tr("floorPlanBringForward"))}</button>
    <button type="button" data-floor-plan-arrange="front"${index < 0 || index >= last ? " disabled" : ""}><span aria-hidden="true">⇈</span>${esc(tr("floorPlanBringToFront"))}</button>
  </div></fieldset>`;
}

function floorPlanRoomGeometryHtml(object) {
  const floor = floorPlanActiveFloor();
  const geometry = floorPlanObjectFromFabric(object);
  const fields = [
    ["X", "x", geometry.x, Math.max(0, floor.width - geometry.width)],
    ["Y", "y", geometry.y, Math.max(0, floor.height - geometry.height)],
    [tr("floorPlanWidth"), "width", geometry.width, floor.width],
    [tr("floorPlanHeight"), "height", geometry.height, floor.height],
  ];
  return `<fieldset class="floor-plan-geometry"><legend>${esc(tr("floorPlanGeometry"))}</legend><div>${fields.map(([label, key, value, max]) => `<label><span>${esc(label)}</span><span class="floor-plan-number-input"><input type="number" inputmode="numeric" id="floorPlanGeometry${key.charAt(0).toUpperCase()}${key.slice(1)}" data-floor-plan-geometry="${key}" min="${key === "width" || key === "height" ? 24 : 0}" max="${Math.round(max)}" step="1" value="${Math.round(value)}"><small aria-hidden="true">px</small></span></label>`).join("")}</div><p>${esc(tr("floorPlanGeometryHint"))}</p></fieldset>`;
}

function updateSelectedRoomGeometry() {
  const selected = floorPlanCanvas?.getActiveObject();
  const floor = floorPlanActiveFloor();
  if (!selected || selected.fpType !== "room" || !floor) return;
  const current = floorPlanObjectFromFabric(selected);
  const read = key => {
    const input = document.querySelector(`[data-floor-plan-geometry="${key}"]`);
    if (!input?.value.trim()) return current[key];
    const value = Number(input.value);
    return Number.isFinite(value) ? Math.round(value) : current[key];
  };
  const width = Math.min(floor.width, Math.max(24, read("width")));
  const height = Math.min(floor.height, Math.max(24, read("height")));
  const x = Math.min(Math.max(0, floor.width - width), Math.max(0, read("x")));
  const y = Math.min(Math.max(0, floor.height - height), Math.max(0, read("y")));
  rebuildSelectedFloorPlanObject({ x, y, width, height });
}

function updateSelectedFloorPlanTextStyle(patch) {
  const selected = floorPlanCanvas?.getActiveObject();
  if (!selected || selected.fpType !== "text") return;
  if (Object.hasOwn(patch, "color") && /^#[0-9a-f]{6}$/i.test(patch.color)) {
    selected.fpColor = patch.color;
    selected.set("fill", patch.color);
  }
  if (Object.hasOwn(patch, "fontSize") && Number.isFinite(Number(patch.fontSize))) {
    const fontSize = Math.min(96, Math.max(12, Math.round(Number(patch.fontSize))));
    selected.fpFontSize = fontSize;
    selected.set("fontSize", fontSize);
    const input = document.getElementById("floorPlanInspectorTextSize");
    if (input) input.value = String(fontSize);
  }
  selected.initDimensions?.();
  selected.dirty = true;
  selected.setCoords();
  floorPlanCanvas.requestRenderAll();
  syncFloorPlanCanvasToDocument();
  scheduleFloorPlanSave();
}

function applySelectedRoomForeground(object) {
  if (!object || object.fpType !== "room") return;
  const foreground = floorPlanObjectRoomForeground(floorPlanObjectFromFabric(object));
  object.fpRoomLabelText?.set("fill", foreground);
  object.fpMarkerText?.set("fill", foreground);
  object.fpLocationText?.set("fill", foreground);
  object.dirty = true;
}

function updateSelectedRoomForeground(value) {
  const selected = floorPlanCanvas?.getActiveObject();
  if (!selected || selected.fpType !== "room") return;
  selected.fpForegroundColor = /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : null;
  applySelectedRoomForeground(selected);
  floorPlanCanvas.requestRenderAll();
  syncFloorPlanCanvasToDocument();
  scheduleFloorPlanSave();
}

function arrangeSelectedFloorPlanObject(direction) {
  const selected = floorPlanCanvas?.getActiveObject();
  if (!selected || selected.type === "activeSelection") return;
  const before = floorPlanCanvas.getObjects().indexOf(selected);
  const last = floorPlanCanvas.getObjects().length - 1;
  const target = direction === "back" ? 0
    : direction === "backward" ? Math.max(0, before - 1)
      : direction === "forward" ? Math.min(last, before + 1)
        : direction === "front" ? last : before;
  floorPlanCanvas.moveObjectTo(selected, target);
  const after = floorPlanCanvas.getObjects().indexOf(selected);
  if (before === after) return;
  floorPlanCanvas.setActiveObject(selected);
  floorPlanCanvas.requestRenderAll();
  floorPlanCanvasChanged();
  renderFloorPlanInspector();
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
    if (object.fpRoomId) {
      inspector.innerHTML = `<div class="floor-plan-inspector-title"><span aria-hidden="true">▭</span><div><strong>${esc(tr("floorPlanObjectRoom"))}</strong><small>${esc(tr("floorPlanLinkedRoom"))}</small></div></div><label>${esc(tr("floorPlanLinkedRoom"))}<select id="floorPlanInspectorRoom">${S.rooms.map(room => `<option value="${esc(room.id)}"${room.id === object.fpRoomId ? " selected" : ""}>${esc(room.name)}</option>`).join("")}</select></label><p class="hint">${esc(LANG === "en" ? "Name, colour and symbol come from the linked room." : "Name, Farbe und Symbol kommen aus dem verknüpften Raum.")}</p>${floorPlanRoomGeometryHtml(object)}${floorPlanLabelVisibilityHtml(object)}${floorPlanMarkerVisibilityHtml(object)}${floorPlanCornerRadiusHtml(object)}`;
    } else {
      inspector.innerHTML = `<div class="floor-plan-inspector-title"><span aria-hidden="true">▭</span><div><strong>${esc(tr("floorPlanObjectRoom"))}</strong><small>${esc(tr("floorPlanCustomRoom"))}</small></div></div>
        <label>${esc(tr("floorPlanRoomName"))}<input id="floorPlanInspectorRoomName" type="text" maxlength="80" value="${esc(object.fpFallbackLabel || "")}"></label>
        <label>${esc(tr("floorPlanRoomLocation"))}<input id="floorPlanInspectorRoomLocation" type="text" maxlength="80" value="${esc(object.fpCustomLocation || "")}" placeholder="${esc(tr("floorPlanRoomLocationPlaceholder"))}"></label>
        <label>${esc(tr("floorPlanRoomColor"))}<input id="floorPlanInspectorRoomColor" class="floor-plan-color-input" type="color" value="${esc(object.fpCustomColor || "#64748b")}"></label>
        ${floorPlanRoomGeometryHtml(object)}
        ${floorPlanLabelVisibilityHtml(object)}
        ${floorPlanCornerRadiusHtml(object)}
        <fieldset class="floor-plan-marker-picker"><legend>${esc(tr("floorPlanRoomMarker"))}</legend><div><button type="button" data-inspector-marker="none" class="${object.fpMarkerVisible === false ? "is-selected" : ""}" aria-pressed="${String(object.fpMarkerVisible === false)}" aria-label="${esc(tr("floorPlanNoMarker"))}" title="${esc(tr("floorPlanNoMarker"))}">∅</button>${FLOOR_PLAN_CUSTOM_MARKERS.map(marker => `<button type="button" data-inspector-marker="${marker}" class="${object.fpMarkerVisible !== false && marker === object.fpCustomMarker ? "is-selected" : ""}" aria-pressed="${String(object.fpMarkerVisible !== false && marker === object.fpCustomMarker)}" aria-label="${esc(floorPlanMarkerLabel(marker))}" title="${esc(floorPlanMarkerLabel(marker))}">${esc(FLOOR_PLAN_ROOM_GLYPHS[marker])}</button>`).join("")}</div></fieldset>`;
    }
  } else if (object.fpType === "text") {
    inspector.innerHTML = `<div class="floor-plan-inspector-title"><span aria-hidden="true">T</span><div><strong>${esc(tr("floorPlanAddText"))}</strong><small>${esc(tr("floorPlanLabelsToolHint"))}</small></div></div><label>${esc(tr("floorPlanTextLabel"))}<textarea id="floorPlanInspectorText" rows="4" maxlength="240">${esc(object.text || "")}</textarea></label><div class="floor-plan-text-style"><label><span>${esc(tr("floorPlanTextColor"))}</span><input id="floorPlanInspectorTextColor" class="floor-plan-color-input" type="color" value="${esc(object.fpColor || "#172033")}"></label><label><span>${esc(tr("floorPlanTextSize"))}</span><span class="floor-plan-number-input"><input id="floorPlanInspectorTextSize" type="number" inputmode="numeric" min="12" max="96" step="1" value="${Math.round(object.fpFontSize || 28)}"><small aria-hidden="true">px</small></span></label></div>`;
  } else if (object.fpType === "symbol") {
    inspector.innerHTML = `<div class="floor-plan-inspector-title"><span aria-hidden="true">⌖</span><div><strong>${esc(tr("floorPlanSymbolLabel"))}</strong><small>${esc(tr("floorPlanSymbolsToolHint"))}</small></div></div><div class="floor-plan-symbol-palette is-inspector">${floorPlanSymbolPaletteHtml({ selected: object.fpSymbol, inspector: true })}</div><label>${esc(tr("floorPlanTextLabel"))}<input id="floorPlanInspectorLabel" type="text" maxlength="80" value="${esc(object.fpLabel || "")}"></label><label class="floor-plan-property-toggle"><input id="floorPlanSymbolBackgroundVisible" type="checkbox"${object.fpBackgroundVisible === false ? "" : " checked"}><span>${esc(tr("floorPlanShowSymbolCircle"))}</span></label>`;
  } else {
    inspector.innerHTML = `<div class="floor-plan-inspector-title"><span aria-hidden="true">▧</span><div><strong>${esc(tr("floorPlanGraphic"))}</strong><small>${esc(tr("floorPlanGraphicsToolHint"))}</small></div></div>
      <label>${esc(tr("floorPlanGraphicAlt"))}<input id="floorPlanInspectorGraphicAlt" type="text" maxlength="120" value="${esc(object.fpAlt || "")}"></label>
      <p class="hint">${esc(tr("floorPlanGraphicResizeHint"))}</p>`;
  }
  if (object.fpType === "room") inspector.insertAdjacentHTML("beforeend", floorPlanRoomForegroundHtml(object));
  inspector.insertAdjacentHTML("beforeend", floorPlanArrangementHtml(object));
}

function floorPlanGraphicCount() {
  return floorPlanEditorDocument?.floors.reduce((count, floor) => count + floor.objects.filter(object => object.type === "image").length, 0) || 0;
}

function floorPlanLoadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(tr("floorPlanGraphicUnreadable"))); };
    image.src = url;
  });
}

function floorPlanCanvasBlob(canvas, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
}

function floorPlanBlobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(tr("floorPlanGraphicUnreadable")));
    reader.readAsDataURL(blob);
  });
}

async function prepareFloorPlanGraphic(file) {
  if (!FLOOR_PLAN_GRAPHIC_TYPES.has(file?.type)) throw new Error(tr("floorPlanGraphicTypeError"));
  if (file.size > FLOOR_PLAN_GRAPHIC_LIMITS.inputBytes) throw new Error(tr("floorPlanGraphicFileError"));
  const source = await floorPlanLoadImage(file);
  if (!source.naturalWidth || !source.naturalHeight || source.naturalWidth > FLOOR_PLAN_GRAPHIC_LIMITS.sourcePixels || source.naturalHeight > FLOOR_PLAN_GRAPHIC_LIMITS.sourcePixels) throw new Error(tr("floorPlanGraphicPixelError"));
  const initialScale = Math.min(1, FLOOR_PLAN_GRAPHIC_LIMITS.outputPixels / Math.max(source.naturalWidth, source.naturalHeight));
  let width = Math.max(1, Math.round(source.naturalWidth * initialScale));
  let height = Math.max(1, Math.round(source.naturalHeight * initialScale));
  const canvas = document.createElement("canvas");
  let blob = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    context.clearRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    blob = await floorPlanCanvasBlob(canvas, Math.max(.48, .86 - attempt * .06));
    if (blob && blob.size <= FLOOR_PLAN_GRAPHIC_LIMITS.outputBytes) break;
    width = Math.max(1, Math.round(width * .86));
    height = Math.max(1, Math.round(height * .86));
  }
  if (!blob || blob.size > FLOOR_PLAN_GRAPHIC_LIMITS.outputBytes) throw new Error(tr("floorPlanGraphicCompressError"));
  const src = await floorPlanBlobDataUrl(blob);
  if (!FLOOR_PLAN_GRAPHIC_DATA_URL.test(src) || src.length > 390000) throw new Error(tr("floorPlanGraphicCompressError"));
  return { src, width, height, alt: file.name.replace(/\.[^.]+$/, "").slice(0, 120) };
}

async function addFloorPlanGraphic(file) {
  const msg = document.getElementById("floorPlanGraphicMsg");
  if (floorPlanGraphicCount() >= FLOOR_PLAN_GRAPHIC_LIMITS.count) throw new Error(tr("floorPlanGraphicCountError"));
  if (msg) { msg.className = "msg floor-plan-tool-msg"; msg.textContent = tr("floorPlanGraphicPreparing"); }
  const graphic = await prepareFloorPlanGraphic(file);
  const floor = floorPlanActiveFloor();
  const displayScale = Math.min(320 / graphic.width, 220 / graphic.height);
  const width = Math.max(32, Math.round(graphic.width * displayScale));
  const height = Math.max(32, Math.round(graphic.height * displayScale));
  addFloorPlanObject({ id: floorPlanId("image"), type: "image", src: graphic.src, alt: graphic.alt, x: floor.width / 2 - width / 2, y: floor.height / 2 - height / 2, width, height, rotation: 0 });
  if (msg) { msg.className = "msg ok floor-plan-tool-msg"; msg.textContent = tr("floorPlanGraphicAdded"); }
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

function updateSelectedCustomRoom(patch) {
  const selected = floorPlanCanvas?.getActiveObject();
  if (!selected || selected.fpType !== "room" || selected.fpRoomId) return;
  if (Object.hasOwn(patch, "fallbackLabel")) {
    selected.fpFallbackLabel = patch.fallbackLabel.trim() || tr("floorPlanCustomRoomDefault");
    selected.fpRoomLabelText?.set("text", selected.fpFallbackLabel);
  }
  if (Object.hasOwn(patch, "customLocation")) {
    selected.fpCustomLocation = patch.customLocation;
    selected.fpLocationText?.set("text", patch.customLocation);
  }
  if (Object.hasOwn(patch, "customColor") && /^#[0-9a-f]{6}$/i.test(patch.customColor)) {
    selected.fpCustomColor = patch.customColor;
    selected.fpRect?.set({ fill: `${patch.customColor}26`, stroke: patch.customColor });
    applySelectedRoomForeground(selected);
  }
  selected.dirty = true;
  selected.setCoords();
  floorPlanCanvas.requestRenderAll();
  syncFloorPlanCanvasToDocument();
  scheduleFloorPlanSave();
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
  floorPlanCanvas.backgroundColor = "transparent";
  floorPlanCanvas.add(...floor.objects.map(floorPlanFabricObject));
  floorPlanCanvas.requestRenderAll();
  applyFloorPlanGridVisibility();
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
  document.getElementById("floorPlanZoomOut")?.addEventListener("click", () => setFloorPlanEditorZoom(floorPlanEditorZoom - .1));
  document.getElementById("floorPlanZoomIn")?.addEventListener("click", () => setFloorPlanEditorZoom(floorPlanEditorZoom + .1));
  document.getElementById("floorPlanZoomFit")?.addEventListener("click", () => setFloorPlanEditorZoom(1));
  document.getElementById("floorPlanPanToggle")?.addEventListener("click", toggleFloorPlanPan);
  document.getElementById("floorPlanGridToggle")?.addEventListener("click", toggleFloorPlanGrid);
  document.getElementById("floorPlanSnapToggle")?.addEventListener("click", toggleFloorPlanSnap);
  const traceInput = document.getElementById("floorPlanTraceInput");
  document.getElementById("floorPlanTraceChoose")?.addEventListener("click", () => traceInput?.click());
  traceInput?.addEventListener("change", async () => {
    const file = traceInput.files?.[0];
    traceInput.value = "";
    if (!file) return;
    const floorId = S.floorPlanEditorFloorId;
    updateFloorPlanTraceControls(tr("floorPlanTracePreparing"));
    try {
      const entry = await createFloorPlanTraceEntry(file);
      disposeFloorPlanTraceEntry(floorPlanTraceReferences.get(floorId));
      floorPlanTraceReferences.set(floorId, entry);
      updateFloorPlanTraceControls();
      if (floorId === S.floorPlanEditorFloorId) await applyFloorPlanTraceReference();
    } catch (error) {
      updateFloorPlanTraceControls(error.message, true);
    }
  });
  document.getElementById("floorPlanTracePage")?.addEventListener("change", async event => {
    const entry = floorPlanTraceEntry();
    if (!entry || entry.kind !== "pdf") return;
    entry.page = Math.min(entry.pageCount, Math.max(1, Number(event.target.value) || 1));
    try { await applyFloorPlanTraceReference(); }
    catch (error) { updateFloorPlanTraceControls(error.message, true); }
  });
  document.getElementById("floorPlanTraceOpacity")?.addEventListener("input", event => {
    const entry = floorPlanTraceEntry();
    if (!entry) return;
    entry.opacity = Math.min(.8, Math.max(.1, Number(event.target.value) / 100));
    floorPlanCanvas.backgroundImage?.set("opacity", entry.opacity);
    floorPlanCanvas.requestRenderAll();
  });
  document.getElementById("floorPlanTraceRemove")?.addEventListener("click", () => {
    const floorId = S.floorPlanEditorFloorId;
    disposeFloorPlanTraceEntry(floorPlanTraceReferences.get(floorId));
    floorPlanTraceReferences.delete(floorId);
    floorPlanTraceRenderToken += 1;
    floorPlanCanvas.backgroundImage = undefined;
    floorPlanCanvas.requestRenderAll();
    updateFloorPlanTraceControls();
  });
  document.getElementById("floorPlanAddLinkedRoomBtn")?.addEventListener("click", () => {
    const roomId = document.getElementById("floorPlanRoomSelect").value;
    const room = floorPlanRoom(roomId);
    const floor = floorPlanActiveFloor();
    addFloorPlanObject({ id: floorPlanId("room"), type: "room", roomId, fallbackLabel: room?.name || "", labelVisible: true, markerVisible: true, cornerRadius: 18, x: floor.width / 2 - 135, y: floor.height / 2 - 80, width: 270, height: 160, rotation: 0 });
  });
  document.getElementById("floorPlanAddCustomRoomBtn")?.addEventListener("click", () => {
    const floor = floorPlanActiveFloor();
    addFloorPlanObject({ id: floorPlanId("room"), type: "room", roomId: null, fallbackLabel: tr("floorPlanCustomRoomDefault"), customLocation: "", customColor: "#64748b", customMarker: "square", labelVisible: true, markerVisible: true, cornerRadius: 18, x: floor.width / 2 - 135, y: floor.height / 2 - 80, width: 270, height: 160, rotation: 0 });
  });
  document.getElementById("floorPlanAddTextBtn")?.addEventListener("click", () => {
    const floor = floorPlanActiveFloor();
    addFloorPlanObject({ id: floorPlanId("text"), type: "text", text: tr("floorPlanAddText"), color: "#172033", fontSize: 28, x: floor.width / 2 - 110, y: floor.height / 2 - 30, width: 220, height: 60, rotation: 0 });
  });
  const symbolMenuButton = document.getElementById("floorPlanSymbolMenuBtn");
  const symbolPalette = document.getElementById("floorPlanSymbolPalette");
  symbolMenuButton?.addEventListener("click", () => {
    const open = symbolMenuButton.getAttribute("aria-expanded") !== "true";
    symbolMenuButton.setAttribute("aria-expanded", String(open));
    symbolPalette.hidden = !open;
  });
  symbolPalette?.querySelectorAll("[data-floor-plan-symbol]").forEach(button => button.addEventListener("click", () => {
    const floor = floorPlanActiveFloor();
    const symbol = FLOOR_PLAN_SYMBOLS[button.dataset.floorPlanSymbol];
    addFloorPlanObject({ id: floorPlanId("symbol"), type: "symbol", symbol: button.dataset.floorPlanSymbol, label: floorPlanSymbolName(symbol), backgroundVisible: false, x: floor.width / 2 - 52, y: floor.height / 2 - 62, width: 104, height: 124, rotation: 0 });
    symbolPalette.hidden = true;
    symbolMenuButton.setAttribute("aria-expanded", "false");
  }));
  const graphicInput = document.getElementById("floorPlanGraphicInput");
  document.getElementById("floorPlanAddGraphicBtn")?.addEventListener("click", () => {
    const msg = document.getElementById("floorPlanGraphicMsg");
    if (floorPlanGraphicCount() >= FLOOR_PLAN_GRAPHIC_LIMITS.count) {
      if (msg) { msg.className = "msg err floor-plan-tool-msg"; msg.textContent = tr("floorPlanGraphicCountError"); }
      return;
    }
    graphicInput.click();
  });
  graphicInput?.addEventListener("change", async () => {
    const file = graphicInput.files?.[0];
    graphicInput.value = "";
    if (!file) return;
    try { await addFloorPlanGraphic(file); }
    catch (error) {
      const msg = document.getElementById("floorPlanGraphicMsg");
      if (msg) { msg.className = "msg err floor-plan-tool-msg"; msg.textContent = error.message; }
    }
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
    disposeFloorPlanTraceEntry(floorPlanTraceReferences.get(S.floorPlanEditorFloorId));
    floorPlanTraceReferences.delete(S.floorPlanEditorFloorId);
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
      S.con.floor_plan_mode = floorPlanModeForSources({ external: floorPlanExternalEnabled(), interactive: true });
      button.textContent = `✓ ${tr("floorPlanPublished")}`;
      button.disabled = false;
    } catch (error) {
      button.disabled = false;
      const saveState = document.getElementById("floorPlanSaveState");
      if (saveState) { saveState.className = "floor-plan-save-state is-error"; saveState.textContent = floorPlanSaveErrorMessage(error); }
    }
  });
  document.getElementById("floorPlanPreviewBtn")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    syncFloorPlanCanvasToDocument({ history: false });
    try {
      await saveFloorPlanNow({ sync: false });
      S.floorPlanPreviewDocument = structuredClone(floorPlanEditorDocument);
      S.mode = "view"; S.view = "lageplan"; renderActive();
    } catch {
      button.disabled = false;
    }
  });
  document.addEventListener("keydown", floorPlanEditorKeydown, { signal: floorPlanEditorAbortController.signal });
  const inspector = document.getElementById("floorPlanInspector");
  inspector?.addEventListener("change", event => {
    if (event.target.id === "floorPlanInspectorRoom") rebuildSelectedFloorPlanObject({ roomId: event.target.value, fallbackLabel: floorPlanRoom(event.target.value)?.name || "" });
    if (event.target.matches("[data-floor-plan-geometry]")) updateSelectedRoomGeometry();
    if (event.target.id === "floorPlanLabelVisible") rebuildSelectedFloorPlanObject({ labelVisible: event.target.checked });
    if (event.target.id === "floorPlanMarkerVisible") rebuildSelectedFloorPlanObject({ markerVisible: event.target.checked });
    if (event.target.id === "floorPlanSymbolBackgroundVisible") rebuildSelectedFloorPlanObject({ backgroundVisible: event.target.checked });
    if (event.target.id === "floorPlanInspectorTextSize") updateSelectedFloorPlanTextStyle({ fontSize: event.target.value });
    if (event.target.id === "floorPlanRoomTextColorAuto") {
      const colorInput = document.getElementById("floorPlanRoomTextColor");
      if (colorInput) colorInput.disabled = event.target.checked;
      updateSelectedRoomForeground(event.target.checked ? null : colorInput?.value);
    }
  });
  inspector?.addEventListener("keydown", event => {
    if (event.key !== "Enter" || !event.target.matches("[data-floor-plan-geometry], #floorPlanInspectorTextSize")) return;
    event.preventDefault();
    if (event.target.id === "floorPlanInspectorTextSize") updateSelectedFloorPlanTextStyle({ fontSize: event.target.value });
    else updateSelectedRoomGeometry();
  });
  inspector?.addEventListener("click", event => {
    const symbolButton = event.target.closest("[data-inspector-symbol]");
    if (symbolButton) rebuildSelectedFloorPlanObject({ symbol: symbolButton.dataset.inspectorSymbol });
    const markerButton = event.target.closest("[data-inspector-marker]");
    if (markerButton) {
      const marker = markerButton.dataset.inspectorMarker;
      rebuildSelectedFloorPlanObject(marker === "none" ? { roomId: null, markerVisible: false } : { roomId: null, customMarker: marker, markerVisible: true });
    }
    const arrangeButton = event.target.closest("[data-floor-plan-arrange]");
    if (arrangeButton) arrangeSelectedFloorPlanObject(arrangeButton.dataset.floorPlanArrange);
  });
  inspector?.addEventListener("input", event => {
    if (event.target.id === "floorPlanInspectorText") {
      const selected = floorPlanCanvas.getActiveObject(); selected.set("text", event.target.value); selected.initDimensions?.(); selected.setCoords(); floorPlanCanvas.requestRenderAll(); floorPlanCanvasChanged();
    } else if (event.target.id === "floorPlanInspectorTextColor") {
      updateSelectedFloorPlanTextStyle({ color: event.target.value });
    } else if (event.target.id === "floorPlanInspectorRoomName") {
      updateSelectedCustomRoom({ fallbackLabel: event.target.value });
    } else if (event.target.id === "floorPlanInspectorRoomLocation") {
      updateSelectedCustomRoom({ customLocation: event.target.value });
    } else if (event.target.id === "floorPlanInspectorRoomColor") {
      updateSelectedCustomRoom({ customColor: event.target.value });
    } else if (event.target.id === "floorPlanRoomTextColor") {
      updateSelectedRoomForeground(event.target.value);
    } else if (event.target.id === "floorPlanCornerRadius") {
      const selected = floorPlanCanvas.getActiveObject();
      if (!selected || selected.fpType !== "room") return;
      const radius = Math.min(60, Math.max(0, Number(event.target.value) || 0));
      selected.fpCornerRadius = radius;
      const renderedRadius = Math.min(radius, (selected.fpRect?.width || 0) / 2, (selected.fpRect?.height || 0) / 2);
      selected.fpRect?.set({ rx: renderedRadius, ry: renderedRadius });
      selected.dirty = true;
      document.getElementById("floorPlanCornerRadiusValue").textContent = `${Math.round(radius)} px`;
      floorPlanCanvas.requestRenderAll(); syncFloorPlanCanvasToDocument(); scheduleFloorPlanSave();
    } else if (event.target.id === "floorPlanInspectorLabel") {
      const selected = floorPlanCanvas.getActiveObject();
      selected.fpLabel = event.target.value;
      selected.fpLabelText?.set("text", event.target.value);
      selected.setCoords(); floorPlanCanvas.requestRenderAll(); syncFloorPlanCanvasToDocument(); scheduleFloorPlanSave();
    } else if (event.target.id === "floorPlanInspectorGraphicAlt") {
      const selected = floorPlanCanvas.getActiveObject();
      selected.fpAlt = event.target.value;
      syncFloorPlanCanvasToDocument(); scheduleFloorPlanSave();
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
  containFloorPlanFabricPosition(active);
  active.setCoords(); floorPlanCanvas.requestRenderAll(); floorPlanCanvasChanged();
}
