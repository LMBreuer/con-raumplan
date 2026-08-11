/* Fachliches Lageplan-Modell und bibliotheksunabhängiges SVG-Rendering. */
const FLOOR_PLAN_SCHEMA_VERSION = 1;
const FLOOR_PLAN_SIZE = {
  landscape: { width: 1120, height: 792 },
  portrait: { width: 792, height: 1120 },
};
const FLOOR_PLAN_GRAPHIC_LIMITS = {
  count: 4,
  inputBytes: 2 * 1024 * 1024,
  sourcePixels: 4096,
  outputPixels: 1200,
  outputBytes: 280 * 1024,
};
const FLOOR_PLAN_GRAPHIC_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;
const FLOOR_PLAN_SYMBOLS = {
  entrance: { glyph: "⇥", category: "access", de: "Eingang", en: "Entrance" },
  exit: { glyph: "↗", category: "access", de: "Ausgang", en: "Exit" },
  door: { glyph: "▯", category: "access", de: "Tür", en: "Door" },
  stairs: { glyph: "≋", category: "access", de: "Treppe", en: "Stairs" },
  lift: { glyph: "↕", category: "access", de: "Lift", en: "Lift" },
  accessible: { glyph: "♿", category: "access", de: "Barrierefrei", en: "Accessible" },
  wc: { glyph: "WC", category: "service", de: "WC", en: "WC" },
  kitchen: { glyph: "K", category: "service", de: "Küche", en: "Kitchen" },
  info: { glyph: "i", category: "service", de: "Information", en: "Information" },
  wardrobe: { glyph: "G", category: "service", de: "Garderobe", en: "Cloakroom" },
  firstAid: { glyph: "+", category: "service", de: "Erste Hilfe", en: "First aid" },
  route: { glyph: "→", category: "orientation", de: "Wegpfeil", en: "Direction" },
  assembly: { glyph: "◎", category: "orientation", de: "Sammelpunkt", en: "Assembly point" },
  parking: { glyph: "P", category: "orientation", de: "Parkplatz", en: "Parking" },
  emergency: { glyph: "!", category: "orientation", de: "Notausgang", en: "Emergency exit" },
};
const FLOOR_PLAN_SYMBOL_CATEGORIES = {
  access: { de: "Zugänge & Wege", en: "Access & movement" },
  service: { de: "Service", en: "Services" },
  orientation: { de: "Orientierung", en: "Wayfinding" },
};
const FLOOR_PLAN_ROOM_GLYPHS = {
  circle: "●", triangle: "▲", square: "■", diamond: "◆", plus: "✚", cross: "✕", hexagon: "⬢",
  star: "★", sparkle: "✦", sun: "☀", moon: "☾", cloud: "☁", flower: "✿", tree: "♣",
  heart: "♥", flag: "⚑", key: "⚿", book: "▤", music: "♪", bulb: "☼", letter: "✉",
  dice: "⚄", invader: "⌘", wc: "WC", kitchen: "♨", door: "▯", coat: "♧", toy: "♟",
};
const floorPlanRoomMarkerNameKey = marker => `roomMarker${marker.charAt(0).toUpperCase()}${marker.slice(1)}`;
const FLOOR_PLAN_ROOM_MARKER_SYMBOLS = Object.fromEntries(ROOM_MARKERS.map(marker => [`room-marker-${marker}`, {
  glyph: FLOOR_PLAN_ROOM_GLYPHS[marker], category: "roomMarkers", nameKey: floorPlanRoomMarkerNameKey(marker),
}]));
Object.assign(FLOOR_PLAN_SYMBOLS, FLOOR_PLAN_ROOM_MARKER_SYMBOLS);
FLOOR_PLAN_SYMBOL_CATEGORIES.roomMarkers = { de: "Raumsymbole", en: "Room symbols" };

function floorPlanSymbolName(symbol) {
  return symbol?.nameKey ? tr(symbol.nameKey) : symbol?.[LANG === "en" ? "en" : "de"] || "";
}

function floorPlanId(prefix = "fp") {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

function newFloorPlanFloor(name, orientation = "landscape") {
  const size = FLOOR_PLAN_SIZE[orientation] || FLOOR_PLAN_SIZE.landscape;
  return { id: floorPlanId("floor"), name: name || tr("floorPlanDefaultFloor"), width: size.width, height: size.height, objects: [] };
}

function newFloorPlanDocument() {
  return {
    schemaVersion: FLOOR_PLAN_SCHEMA_VERSION,
    orientation: "landscape",
    title: "",
    floors: [newFloorPlanFloor(tr("floorPlanDefaultFloor"), "landscape")],
  };
}

const floorPlanNumber = (value, fallback, min = -10000, max = 10000) => {
  const number = Number(value);
  const resolved = Number.isFinite(number) ? number : Number(fallback);
  return Math.min(max, Math.max(min, Number.isFinite(resolved) ? resolved : 0));
};

function normalizeFloorPlanObject(raw, floor) {
  if (!raw || typeof raw !== "object" || !["room", "text", "symbol", "image"].includes(raw.type)) return null;
  const width = floorPlanNumber(raw.width, raw.type === "room" ? 250 : 120, 24, floor.width);
  const height = floorPlanNumber(raw.height, raw.type === "room" ? 150 : 56, 24, floor.height);
  const base = {
    id: String(raw.id || floorPlanId(raw.type)),
    type: raw.type,
    x: floorPlanNumber(raw.x, 80, 0, Math.max(0, floor.width - width)),
    y: floorPlanNumber(raw.y, 80, 0, Math.max(0, floor.height - height)),
    width,
    height,
    rotation: floorPlanNumber(raw.rotation, 0, -360, 360),
    outlineVisible: raw.outlineVisible !== false,
  };
  if (raw.type === "room") {
    const customColor = /^#[0-9a-f]{6}$/i.test(String(raw.customColor || "")) ? String(raw.customColor) : "#64748b";
    const foregroundColor = /^#[0-9a-f]{6}$/i.test(String(raw.foregroundColor || "")) ? String(raw.foregroundColor) : null;
    return {
      ...base,
      roomId: raw.roomId ? String(raw.roomId) : null,
      fallbackLabel: String(raw.fallbackLabel || "").slice(0, 80),
      customLocation: String(raw.customLocation || "").slice(0, 80),
      customColor,
      foregroundColor,
      customMarker: FLOOR_PLAN_ROOM_GLYPHS[raw.customMarker] ? raw.customMarker : "square",
      labelVisible: raw.labelVisible !== false,
      markerVisible: raw.markerVisible !== false,
      cornerRadius: floorPlanNumber(raw.cornerRadius, 18, 0, 60),
    };
  }
  if (raw.type === "text") {
    const color = /^#[0-9a-f]{6}$/i.test(String(raw.color || "")) ? String(raw.color) : "#172033";
    return { ...base, text: String(raw.text || "Text").slice(0, 240), color, fontSize: floorPlanNumber(raw.fontSize, 28, 12, 96) };
  }
  if (raw.type === "image") {
    const src = String(raw.src || "");
    if (!FLOOR_PLAN_GRAPHIC_DATA_URL.test(src) || src.length > 390000) return null;
    return { ...base, src, alt: String(raw.alt || "").slice(0, 120) };
  }
  return { ...base, symbol: FLOOR_PLAN_SYMBOLS[raw.symbol] ? raw.symbol : "info", label: String(raw.label || "").slice(0, 80), backgroundVisible: raw.backgroundVisible !== false };
}

function normalizeFloorPlanDocument(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const orientation = source.orientation === "portrait" ? "portrait" : "landscape";
  const expectedSize = FLOOR_PLAN_SIZE[orientation];
  let graphicCount = 0;
  const floors = (Array.isArray(source.floors) ? source.floors : []).slice(0, 20).map((item, index) => {
    const floor = {
      id: String(item?.id || floorPlanId("floor")),
      name: String(item?.name || `${tr("floorPlanFloor")} ${index + 1}`).slice(0, 80),
      width: floorPlanNumber(item?.width, expectedSize.width, 320, 2400),
      height: floorPlanNumber(item?.height, expectedSize.height, 320, 2400),
      objects: [],
    };
    floor.objects = (Array.isArray(item?.objects) ? item.objects : []).slice(0, 500).map(object => normalizeFloorPlanObject(object, floor)).filter(object => {
      if (!object) return false;
      if (object.type !== "image") return true;
      if (graphicCount >= FLOOR_PLAN_GRAPHIC_LIMITS.count) return false;
      graphicCount += 1;
      return true;
    });
    return floor;
  });
  return {
    schemaVersion: FLOOR_PLAN_SCHEMA_VERSION,
    orientation,
    title: String(source.title || "").slice(0, 120),
    floors: floors.length ? floors : [newFloorPlanFloor(tr("floorPlanDefaultFloor"), orientation)],
  };
}

function floorPlanSourceMode() {
  const stored = S.con?.floor_plan_mode;
  if (["none", "external", "editor", "both"].includes(stored)) return stored;
  return floorPlanUrl() ? "external" : "none";
}

function floorPlanExternalEnabled() {
  return ["external", "both"].includes(floorPlanSourceMode()) && !!floorPlanUrl();
}

function floorPlanInteractiveEnabled() {
  return ["editor", "both"].includes(floorPlanSourceMode());
}

function floorPlanModeForSources({ external = false, interactive = false } = {}) {
  if (external && interactive) return "both";
  if (interactive) return "editor";
  if (external) return "external";
  return "none";
}

function floorPlanPublicTarget() {
  if (floorPlanInteractiveEnabled() && S.floorPlanPublic?.document) {
    return `${location.pathname}?con=${encodeURIComponent(S.con?.slug || S.con?.id || CON_PARAM)}&view=lageplan`;
  }
  if (floorPlanExternalEnabled()) return floorPlanUrl();
  return "";
}

function floorPlanPublicSources() {
  const sources = [];
  if (floorPlanInteractiveEnabled() && S.floorPlanPublic?.document) {
    sources.push({ key: "interactive", href: `${location.pathname}?con=${encodeURIComponent(S.con?.slug || S.con?.id || CON_PARAM)}&view=lageplan`, external: false });
  }
  if (floorPlanExternalEnabled()) sources.push({ key: "file", href: floorPlanUrl(), external: true });
  return sources;
}

function floorPlanFloorForRoom(documentValue, roomId) {
  if (!documentValue || !roomId) return null;
  const document = normalizeFloorPlanDocument(documentValue);
  return document.floors.find(floor => floor.objects.some(object => object.type === "room" && object.roomId === roomId)) || null;
}

function floorPlanRoom(roomId) {
  return S.rooms.find(room => room.id === roomId) || null;
}

function floorPlanRoomColor(room) {
  if (validRoomColor(room?.color)) return room.color;
  return room ? automaticRoomColorHex(room) : "#64748b";
}

function floorPlanRoomGlyph(room) {
  const marker = validRoomMarker(room?.marker) ? room.marker : ROOM_MARKERS[Math.max(0, S.rooms.indexOf(room)) % ROOM_MARKERS.length];
  return FLOOR_PLAN_ROOM_GLYPHS[marker] || "●";
}

function floorPlanObjectRoomColor(object, room = floorPlanRoom(object?.roomId)) {
  if (room) return floorPlanRoomColor(room);
  return /^#[0-9a-f]{6}$/i.test(object?.customColor || "") ? object.customColor : "#64748b";
}

function floorPlanColorLuminance(color) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(color || ""));
  if (!match) return 1;
  const channels = [0, 2, 4].map(offset => parseInt(match[1].slice(offset, offset + 2), 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

function floorPlanContrastRatio(background, foreground) {
  const values = [floorPlanColorLuminance(background), floorPlanColorLuminance(foreground)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

function floorPlanColorOnWhite(color, opacity = .16) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(color || ""));
  if (!match) return "#ffffff";
  const channels = [0, 2, 4].map(offset => parseInt(match[1].slice(offset, offset + 2), 16))
    .map(value => Math.round(value * opacity + 255 * (1 - opacity)).toString(16).padStart(2, "0"));
  return `#${channels.join("")}`;
}

function floorPlanObjectRoomForeground(object, room = floorPlanRoom(object?.roomId)) {
  if (/^#[0-9a-f]{6}$/i.test(String(object?.foregroundColor || ""))) return object.foregroundColor;
  const background = floorPlanColorOnWhite(floorPlanObjectRoomColor(object, room));
  return floorPlanContrastRatio(background, "#ffffff") > floorPlanContrastRatio(background, "#172033") ? "#ffffff" : "#172033";
}

function floorPlanObjectRoomGlyph(object, room = floorPlanRoom(object?.roomId)) {
  if (room) return floorPlanRoomGlyph(room);
  return FLOOR_PLAN_ROOM_GLYPHS[object?.customMarker] || "■";
}

function floorPlanTextLines(text, maxChars = 22, maxLines = 3) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  for (const word of words) {
    const current = lines.at(-1);
    if (!current || (current.length + 1 + word.length > maxChars && lines.length < maxLines)) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
  }
  if (lines.length > maxLines) lines.splice(maxLines);
  return lines.length ? lines : [""];
}

function floorPlanRoomLayout(object, label, location) {
  const labelVisible = object.labelVisible !== false;
  const markerVisible = object.markerVisible !== false;
  const labelFontSize = Math.max(18, Math.min(26, object.width / 10));
  const lineHeight = Math.max(20, Math.min(30, labelFontSize * 1.12));
  const lines = labelVisible ? floorPlanTextLines(label, Math.max(10, Math.floor(object.width / 11)), 3) : [];
  const markerSize = markerVisible ? Math.max(30, Math.min(64, object.width * .2, object.height * .34)) : 0;
  const topInset = 12;
  const contentBottom = object.height - (labelVisible && location ? 34 : 12);
  const labelHeight = lines.length * lineHeight;
  const gap = markerVisible && labelVisible ? Math.max(6, Math.min(12, object.height * .06)) : 0;
  const contentHeight = labelHeight + gap + markerSize;
  const contentTop = topInset + Math.max(0, (contentBottom - topInset - contentHeight) / 2);
  return {
    lines,
    labelFontSize,
    lineHeight,
    labelCenterY: labelVisible ? contentTop + labelHeight / 2 : contentTop,
    markerCenterY: markerVisible ? contentTop + labelHeight + gap + markerSize / 2 : contentTop + labelHeight / 2,
    markerSize,
    locationY: object.height - 16,
  };
}

function floorPlanRotation(object) {
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  return object.rotation ? ` transform="rotate(${object.rotation} ${cx} ${cy})"` : "";
}

function floorPlanRoomSvg(object, { interactive = false } = {}) {
  const room = floorPlanRoom(object.roomId);
  const label = room?.name || object.fallbackLabel || tr("floorPlanUnlinkedRoom");
  const color = floorPlanObjectRoomColor(object, room);
  const foreground = floorPlanObjectRoomForeground(object, room);
  const glyph = floorPlanObjectRoomGlyph(object, room);
  const labelVisible = object.labelVisible !== false;
  const location = labelVisible ? room?.floor || object.customLocation : "";
  const isCustom = !object.roomId;
  const layout = floorPlanRoomLayout(object, label, location);
  const textStart = object.y + layout.labelCenterY - ((layout.lines.length - 1) * layout.lineHeight) / 2;
  const text = layout.lines.map((line, index) => `<tspan x="${object.x + object.width / 2}" dy="${index ? layout.lineHeight : 0}">${esc(line)}</tspan>`).join("");
  const attrs = room && interactive
    ? ` data-floor-plan-room="${esc(room.id)}" tabindex="0" role="button" aria-label="${esc(tr("floorPlanOpenRoomAria", { name: room.name }))}"`
    : ` aria-label="${esc(label)}"`;
  const cornerRadius = Math.min(object.cornerRadius ?? 18, object.width / 2, object.height / 2);
  return `<g class="floor-plan-map-room${room ? " is-linked" : isCustom ? " is-custom" : " is-orphan"}${object.outlineVisible === false ? " is-outline-hidden" : ""}"${attrs}${floorPlanRotation(object)} style="--floor-plan-room-color:${color};--floor-plan-room-foreground:${foreground}">
    <rect x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="${cornerRadius}" />
    ${labelVisible ? `<text class="floor-plan-map-label" x="${object.x + object.width / 2}" y="${textStart}" text-anchor="middle" dominant-baseline="middle" style="font-size:${layout.labelFontSize}px">${text}</text>` : ""}
    ${object.markerVisible === false ? "" : `<text class="floor-plan-map-marker" x="${object.x + object.width / 2}" y="${object.y + layout.markerCenterY}" text-anchor="middle" dominant-baseline="central" style="font-size:${layout.markerSize}px">${esc(glyph)}</text>`}
    ${location ? `<text class="floor-plan-map-location" x="${object.x + object.width / 2}" y="${object.y + layout.locationY}" text-anchor="middle">${esc(location)}</text>` : ""}
  </g>`;
}

function floorPlanSvgViewport(floor) {
  return { x: 0, y: 0, width: floor.width, height: floor.height };
}

function floorPlanObjectSvg(object, options) {
  if (object.type === "room") return floorPlanRoomSvg(object, options);
  if (object.type === "text") {
    const fontSize = object.fontSize || 28;
    const lines = floorPlanTextLines(object.text, Math.max(6, Math.floor(object.width / Math.max(7, fontSize * .55))), 5);
    const lineHeight = fontSize * 1.2;
    const text = lines.map((line, index) => `<tspan x="${object.x + object.width / 2}" dy="${index ? lineHeight : 0}">${esc(line)}</tspan>`).join("");
    return `<g class="floor-plan-map-text"${floorPlanRotation(object)}><text x="${object.x + object.width / 2}" y="${object.y + object.height / 2 - ((lines.length - 1) * lineHeight) / 2}" text-anchor="middle" dominant-baseline="middle" style="fill:${object.color || "#172033"};font-size:${fontSize}px">${text}</text></g>`;
  }
  if (object.type === "image") return `<g class="floor-plan-map-image"${floorPlanRotation(object)} aria-label="${esc(object.alt || tr("floorPlanGraphic"))}">
    <image href="${esc(object.src)}" x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" preserveAspectRatio="xMidYMid meet" />
  </g>`;
  const symbol = FLOOR_PLAN_SYMBOLS[object.symbol] || FLOOR_PLAN_SYMBOLS.info;
  const label = object.label || floorPlanSymbolName(symbol);
  const symbolSize = object.backgroundVisible === false
    ? Math.max(42, Math.min(96, Math.min(object.width, object.height) * .58))
    : Math.max(30, Math.min(64, Math.min(object.width, object.height) * .38));
  return `<g class="floor-plan-map-symbol${object.outlineVisible === false ? " is-outline-hidden" : ""}"${floorPlanRotation(object)} aria-label="${esc(label)}">
    ${object.backgroundVisible === false ? "" : `<circle cx="${object.x + object.width / 2}" cy="${object.y + object.height / 2}" r="${Math.max(18, Math.min(object.width, object.height) / 2 - 3)}" />`}
    <text x="${object.x + object.width / 2}" y="${object.y + object.height / 2}" text-anchor="middle" dominant-baseline="central" style="font-size:${symbolSize}px">${esc(symbol.glyph)}</text>
    ${object.label ? `<text class="floor-plan-map-symbol-label" x="${object.x + object.width / 2}" y="${object.y + object.height + 18}" text-anchor="middle">${esc(object.label)}</text>` : ""}
  </g>`;
}

function floorPlanSvgHtml(documentValue, floorValue, { interactive = false, id = "" } = {}) {
  const document = normalizeFloorPlanDocument(documentValue);
  const floor = document.floors.find(item => item.id === floorValue?.id) || document.floors[0];
  const title = `${document.title || S.con?.name || tr("floorPlan")} · ${floor.name}`;
  const viewport = floorPlanSvgViewport(floor);
  return `<svg${id ? ` id="${esc(id)}"` : ""} class="floor-plan-map" viewBox="${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}" data-floor-plan-width="${viewport.width}" data-floor-plan-height="${viewport.height}" role="img" aria-label="${esc(title)}" xmlns="http://www.w3.org/2000/svg">
    <title>${esc(title)}</title>
    <style>
      .floor-plan-map-page{fill:#fff}.floor-plan-map-room rect{fill:var(--floor-plan-room-color);fill-opacity:.149;stroke:var(--floor-plan-room-color);stroke-width:4}
      .floor-plan-map-label{fill:var(--floor-plan-room-foreground);font:700 25px Arial,sans-serif}.floor-plan-map-marker{fill:var(--floor-plan-room-foreground);font:800 48px Arial,sans-serif}
      .floor-plan-map-location{fill:var(--floor-plan-room-foreground);font:500 13px Arial,sans-serif}.floor-plan-map-text text{fill:#172033;font:600 28px Arial,sans-serif}
      .floor-plan-map-symbol circle{fill:#fff;stroke:#62708a;stroke-width:4}.floor-plan-map-symbol.is-outline-hidden circle{stroke:none}.floor-plan-map-symbol>text{fill:#27344d;font:700 32px Arial,sans-serif}.floor-plan-map-symbol-label{fill:#596579!important;font:600 16px Arial,sans-serif!important}
      .floor-plan-map-room.is-orphan rect{stroke:#b45309;stroke-dasharray:10 7;fill:#fef3c7}.floor-plan-map-room.is-outline-hidden rect{stroke:none;stroke-dasharray:none}
    </style>
    <rect class="floor-plan-map-page" x="0" y="0" width="${floor.width}" height="${floor.height}" />
    <g class="floor-plan-map-content">${floor.objects.map(object => floorPlanObjectSvg(object, { interactive })).join("")}</g>
  </svg>`;
}

function floorPlanLinkedRooms(documentValue) {
  const ids = new Set(normalizeFloorPlanDocument(documentValue).floors.flatMap(floor => floor.objects.filter(object => object.type === "room" && object.roomId).map(object => object.roomId)));
  return S.rooms.filter(room => ids.has(room.id));
}

function floorPlanLegendItems(documentValue) {
  const document = normalizeFloorPlanDocument(documentValue);
  const items = [];
  const seenRooms = new Set();
  document.floors.forEach(floor => floor.objects.filter(object => object.type === "room").forEach(object => {
    const room = floorPlanRoom(object.roomId);
    if (room) {
      if (seenRooms.has(room.id)) return;
      seenRooms.add(room.id);
      items.push({ id: room.id, name: room.name, color: floorPlanRoomColor(room), glyph: floorPlanRoomGlyph(room) });
      return;
    }
    items.push({ id: object.id, name: object.fallbackLabel || tr("floorPlanUnlinkedRoom"), color: floorPlanObjectRoomColor(object), glyph: floorPlanObjectRoomGlyph(object) });
  }));
  return items;
}
