/* Fachliches Lageplan-Modell und bibliotheksunabhängiges SVG-Rendering. */
const FLOOR_PLAN_SCHEMA_VERSION = 1;
const FLOOR_PLAN_SIZE = {
  landscape: { width: 1120, height: 792 },
  portrait: { width: 792, height: 1120 },
};
const FLOOR_PLAN_SYMBOLS = {
  entrance: { glyph: "↳", de: "Eingang", en: "Entrance" },
  door: { glyph: "▯", de: "Tür", en: "Door" },
  stairs: { glyph: "▰", de: "Treppe", en: "Stairs" },
  lift: { glyph: "↕", de: "Lift", en: "Lift" },
  wc: { glyph: "WC", de: "WC", en: "WC" },
  kitchen: { glyph: "♨", de: "Küche", en: "Kitchen" },
  info: { glyph: "i", de: "Information", en: "Information" },
  wardrobe: { glyph: "♧", de: "Garderobe", en: "Cloakroom" },
  emergency: { glyph: "➜", de: "Notausgang", en: "Emergency exit" },
};
const FLOOR_PLAN_ROOM_GLYPHS = {
  circle: "●", triangle: "▲", square: "■", diamond: "◆", plus: "✚", cross: "✕", hexagon: "⬢",
  star: "★", sparkle: "✦", sun: "☀", moon: "☾", cloud: "☁", flower: "✿", tree: "♣",
  heart: "♥", flag: "⚑", key: "⚿", book: "▤", music: "♪", bulb: "☼", letter: "✉",
  dice: "⚄", invader: "⌘", wc: "WC", kitchen: "♨", door: "▯", coat: "♧", toy: "♟",
};

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
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

function normalizeFloorPlanObject(raw, floor) {
  if (!raw || typeof raw !== "object" || !["room", "text", "symbol"].includes(raw.type)) return null;
  const base = {
    id: String(raw.id || floorPlanId(raw.type)),
    type: raw.type,
    x: floorPlanNumber(raw.x, 80, 0, floor.width),
    y: floorPlanNumber(raw.y, 80, 0, floor.height),
    width: floorPlanNumber(raw.width, raw.type === "room" ? 250 : 120, 24, floor.width),
    height: floorPlanNumber(raw.height, raw.type === "room" ? 150 : 56, 24, floor.height),
    rotation: floorPlanNumber(raw.rotation, 0, -360, 360),
  };
  if (raw.type === "room") {
    return { ...base, roomId: raw.roomId ? String(raw.roomId) : null, fallbackLabel: String(raw.fallbackLabel || "").slice(0, 80) };
  }
  if (raw.type === "text") return { ...base, text: String(raw.text || "Text").slice(0, 240) };
  return { ...base, symbol: FLOOR_PLAN_SYMBOLS[raw.symbol] ? raw.symbol : "info", label: String(raw.label || "").slice(0, 80) };
}

function normalizeFloorPlanDocument(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const orientation = source.orientation === "portrait" ? "portrait" : "landscape";
  const expectedSize = FLOOR_PLAN_SIZE[orientation];
  const floors = (Array.isArray(source.floors) ? source.floors : []).slice(0, 20).map((item, index) => {
    const floor = {
      id: String(item?.id || floorPlanId("floor")),
      name: String(item?.name || `${tr("floorPlanFloor")} ${index + 1}`).slice(0, 80),
      width: floorPlanNumber(item?.width, expectedSize.width, 320, 2400),
      height: floorPlanNumber(item?.height, expectedSize.height, 320, 2400),
      objects: [],
    };
    floor.objects = (Array.isArray(item?.objects) ? item.objects : []).slice(0, 500).map(object => normalizeFloorPlanObject(object, floor)).filter(Boolean);
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
  if (["none", "external", "editor"].includes(stored)) return stored;
  return floorPlanUrl() ? "external" : "none";
}

function floorPlanPublicTarget() {
  const mode = floorPlanSourceMode();
  if (mode === "external") return floorPlanUrl();
  if (mode === "editor" && S.floorPlanPublic?.document) {
    return `${location.pathname}?con=${encodeURIComponent(S.con?.slug || S.con?.id || CON_PARAM)}&view=lageplan`;
  }
  return "";
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

function floorPlanRotation(object) {
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  return object.rotation ? ` transform="rotate(${object.rotation} ${cx} ${cy})"` : "";
}

function floorPlanRoomSvg(object, { interactive = false } = {}) {
  const room = floorPlanRoom(object.roomId);
  const label = room?.name || object.fallbackLabel || tr("floorPlanUnlinkedRoom");
  const color = floorPlanRoomColor(room);
  const glyph = floorPlanRoomGlyph(room);
  const lineHeight = Math.max(18, Math.min(30, object.height / 5));
  const lines = floorPlanTextLines(label, Math.max(10, Math.floor(object.width / 11)), 3);
  const textStart = object.y + object.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  const text = lines.map((line, index) => `<tspan x="${object.x + object.width / 2}" dy="${index ? lineHeight : 0}">${esc(line)}</tspan>`).join("");
  const attrs = room && interactive
    ? ` data-floor-plan-room="${esc(room.id)}" tabindex="0" role="button" aria-label="${esc(tr("floorPlanOpenRoomAria", { name: room.name }))}"`
    : ` aria-label="${esc(label)}"`;
  return `<g class="floor-plan-map-room${room ? " is-linked" : " is-orphan"}"${attrs}${floorPlanRotation(object)} style="--floor-plan-room-color:${color}">
    <rect x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="18" />
    <text class="floor-plan-map-marker" x="${object.x + 28}" y="${object.y + 35}" text-anchor="middle">${esc(glyph)}</text>
    <text class="floor-plan-map-label" x="${object.x + object.width / 2}" y="${textStart}" text-anchor="middle" dominant-baseline="middle">${text}</text>
    ${room?.floor ? `<text class="floor-plan-map-location" x="${object.x + object.width / 2}" y="${object.y + object.height - 18}" text-anchor="middle">${esc(room.floor)}</text>` : ""}
  </g>`;
}

function floorPlanObjectSvg(object, options) {
  if (object.type === "room") return floorPlanRoomSvg(object, options);
  if (object.type === "text") {
    const lines = floorPlanTextLines(object.text, Math.max(10, Math.floor(object.width / 10)), 5);
    const lineHeight = 24;
    const text = lines.map((line, index) => `<tspan x="${object.x + object.width / 2}" dy="${index ? lineHeight : 0}">${esc(line)}</tspan>`).join("");
    return `<g class="floor-plan-map-text"${floorPlanRotation(object)}><text x="${object.x + object.width / 2}" y="${object.y + object.height / 2 - ((lines.length - 1) * lineHeight) / 2}" text-anchor="middle" dominant-baseline="middle">${text}</text></g>`;
  }
  const symbol = FLOOR_PLAN_SYMBOLS[object.symbol] || FLOOR_PLAN_SYMBOLS.info;
  const label = object.label || symbol[LANG === "en" ? "en" : "de"];
  return `<g class="floor-plan-map-symbol"${floorPlanRotation(object)} aria-label="${esc(label)}">
    <circle cx="${object.x + object.width / 2}" cy="${object.y + object.height / 2}" r="${Math.max(18, Math.min(object.width, object.height) / 2 - 3)}" />
    <text x="${object.x + object.width / 2}" y="${object.y + object.height / 2}" text-anchor="middle" dominant-baseline="central">${esc(symbol.glyph)}</text>
    ${object.label ? `<text class="floor-plan-map-symbol-label" x="${object.x + object.width / 2}" y="${object.y + object.height + 18}" text-anchor="middle">${esc(object.label)}</text>` : ""}
  </g>`;
}

function floorPlanSvgHtml(documentValue, floorValue, { interactive = false, id = "" } = {}) {
  const document = normalizeFloorPlanDocument(documentValue);
  const floor = document.floors.find(item => item.id === floorValue?.id) || document.floors[0];
  const title = `${document.title || S.con?.name || tr("floorPlan")} · ${floor.name}`;
  return `<svg${id ? ` id="${esc(id)}"` : ""} class="floor-plan-map" viewBox="0 0 ${floor.width} ${floor.height}" role="img" aria-label="${esc(title)}" xmlns="http://www.w3.org/2000/svg">
    <title>${esc(title)}</title>
    <style>
      .floor-plan-map-page{fill:#fff}.floor-plan-map-room rect{fill:var(--floor-plan-room-color);fill-opacity:.16;stroke:var(--floor-plan-room-color);stroke-width:4}
      .floor-plan-map-label{fill:#172033;font:700 25px Arial,sans-serif}.floor-plan-map-marker{fill:var(--floor-plan-room-color);font:700 24px Arial,sans-serif}
      .floor-plan-map-location{fill:#596579;font:500 14px Arial,sans-serif}.floor-plan-map-text text{fill:#172033;font:600 28px Arial,sans-serif}
      .floor-plan-map-symbol circle{fill:#fff;stroke:#62708a;stroke-width:3}.floor-plan-map-symbol>text{fill:#27344d;font:700 24px Arial,sans-serif}.floor-plan-map-symbol-label{fill:#596579!important;font:500 14px Arial,sans-serif!important}
      .floor-plan-map-room.is-orphan rect{stroke:#b45309;stroke-dasharray:10 7;fill:#fef3c7}
    </style>
    <rect class="floor-plan-map-page" x="0" y="0" width="${floor.width}" height="${floor.height}" />
    <g class="floor-plan-map-content">${floor.objects.map(object => floorPlanObjectSvg(object, { interactive })).join("")}</g>
  </svg>`;
}

function floorPlanLinkedRooms(documentValue) {
  const ids = new Set(normalizeFloorPlanDocument(documentValue).floors.flatMap(floor => floor.objects.filter(object => object.type === "room" && object.roomId).map(object => object.roomId)));
  return S.rooms.filter(room => ids.has(room.id));
}
