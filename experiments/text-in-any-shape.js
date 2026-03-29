import { prepareWithSegments, layoutNextLine } from "../pretext.js";

const STAGE_PADDING = 28;
const helperSvg = document.getElementById("helperSvg");
const sceneSvg = document.getElementById("sceneSvg");
const stage = document.getElementById("stage");
const message = document.getElementById("message");
const shapeList = document.getElementById("shapeList");
const shapeText = document.getElementById("shapeText");
const noWordBreakInput = document.getElementById("noWordBreak");
const fontPreset = document.getElementById("fontPreset");
const googleFontInput = document.getElementById("googleFontInput");
const fontUpload = document.getElementById("fontUpload");
const fontUploadName = document.getElementById("fontUploadName");
const fontSizeInput = document.getElementById("fontSize");
const lineHeightInput = document.getElementById("lineHeight");
const shapePaddingInput = document.getElementById("shapePadding");
const fontSizeValue = document.getElementById("fontSizeValue");
const lineHeightValue = document.getElementById("lineHeightValue");
const shapePaddingValue = document.getElementById("shapePaddingValue");
const toggleShapeButton = document.getElementById("toggleShape");
const addPointModeButton = document.getElementById("addPointMode");
const exportPngButton = document.getElementById("exportPng");
const zoomOutButton = document.getElementById("zoomOut");
const zoomResetButton = document.getElementById("zoomReset");
const zoomInButton = document.getElementById("zoomIn");
const importSvgButton = document.getElementById("importSvg");
const addBlankShapeButton = document.getElementById("addBlankShape");
const svgPaste = document.getElementById("svgPaste");
const sampleButtons = Array.from(document.querySelectorAll(".sample-btn"));
const statShapes = document.getElementById("statShapes");
const statLines = document.getElementById("statLines");
const statActive = document.getElementById("statActive");
const statZoom = document.getElementById("statZoom");
const statView = document.getElementById("statView");
const statState = document.getElementById("statState");

const preparedCache = new Map();
let shapeCounter = 0;
let activeShapeId = null;
let addPointMode = false;
let pointerSession = null;
let renderedShapes = [];
let focusClaimTimer = null;
let camera = { x: 0, y: 0, zoom: 1 };

const state = {
  status: "loading",
  shapes: []
};

function setStatus(kind, text = "") {
  state.status = kind;
  statState.textContent = kind;
  if (text) {
    message.textContent = text;
    message.style.display = "grid";
  } else {
    message.style.display = "none";
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function nextShapeName() {
  shapeCounter += 1;
  return `Shape ${shapeCounter}`;
}

function defaultText() {
  return "Double-click the shape, edit this text, or bind a new paragraph to the form.";
}

function stageSize() {
  const rect = stage.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height
  };
}

function worldToScreen(point) {
  return {
    x: (point.x - camera.x) * camera.zoom,
    y: (point.y - camera.y) * camera.zoom
  };
}

function screenToWorld(point) {
  return {
    x: point.x / camera.zoom + camera.x,
    y: point.y / camera.zoom + camera.y
  };
}

function updateGrid() {
  const grid = 40 * camera.zoom;
  const x = ((-camera.x * camera.zoom) % grid + grid) % grid;
  const y = ((-camera.y * camera.zoom) % grid + grid) % grid;
  stage.style.backgroundSize = `${grid}px ${grid}px, ${grid}px ${grid}px, auto, auto`;
  stage.style.setProperty("--grid-x", `${x}px`);
  stage.style.setProperty("--grid-y", `${y}px`);
}

function createPolygon(points, overrides = {}) {
  return {
    id: `shape-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`,
    name: overrides.name || nextShapeName(),
    points,
    text: overrides.text || defaultText(),
    visible: overrides.visible ?? true,
    fontFamily: overrides.fontFamily || 'Georgia, Palatino, "Times New Roman", serif',
    fontLabel: overrides.fontLabel || "Georgia",
    fontSize: overrides.fontSize || 19,
    lineHeight: overrides.lineHeight || 29,
    padding: overrides.padding || 18,
    noWordBreak: overrides.noWordBreak || false
  };
}

function createTemplateShape(template) {
  const { width, height } = stageSize();
  const cx = camera.x + width * 0.5;
  const cy = camera.y + height * 0.52;
  const size = Math.min(width, height) * 0.19;

  let points;
  if (template === "orb") {
    points = Array.from({ length: 12 }, (_, index) => {
      const angle = index / 12 * Math.PI * 2;
      return { x: cx + Math.cos(angle) * size * 1.1, y: cy + Math.sin(angle) * size * 1.08 };
    });
  } else if (template === "drop") {
    points = [
      { x: cx, y: cy - size * 1.4 },
      { x: cx + size * 0.9, y: cy - size * 0.5 },
      { x: cx + size * 1.05, y: cy + size * 0.4 },
      { x: cx + size * 0.45, y: cy + size * 1.25 },
      { x: cx, y: cy + size * 1.45 },
      { x: cx - size * 0.45, y: cy + size * 1.25 },
      { x: cx - size * 1.05, y: cy + size * 0.4 },
      { x: cx - size * 0.9, y: cy - size * 0.5 }
    ];
  } else if (template === "diamond") {
    points = [
      { x: cx, y: cy - size * 1.35 },
      { x: cx + size * 0.98, y: cy - size * 0.35 },
      { x: cx + size * 0.55, y: cy + size * 1.1 },
      { x: cx, y: cy + size * 1.48 },
      { x: cx - size * 0.55, y: cy + size * 1.1 },
      { x: cx - size * 0.98, y: cy - size * 0.35 }
    ];
  } else {
    points = [
      { x: cx, y: cy - size * 0.2 },
      { x: cx + size * 0.92, y: cy - size * 0.92 },
      { x: cx + size * 1.45, y: cy - size * 0.15 },
      { x: cx + size * 1.12, y: cy + size * 0.92 },
      { x: cx, y: cy + size * 1.65 },
      { x: cx - size * 1.12, y: cy + size * 0.92 },
      { x: cx - size * 1.45, y: cy - size * 0.15 },
      { x: cx - size * 0.92, y: cy - size * 0.92 }
    ];
  }

  return createPolygon(points, { text: defaultText() });
}

function addShape(shape) {
  state.shapes.push(shape);
  activeShapeId = shape.id;
  syncControlsFromActiveShape();
  renderAll();
}

function getActiveShape() {
  return state.shapes.find((shape) => shape.id === activeShapeId) || null;
}

function polygonBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

function midpoint(a, b) {
  return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
}

function pointsToPath(points) {
  if (!points.length) return "";
  return `${points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")} Z`;
}

function getIntervalsAtY(points, y) {
  const xs = [];
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const intersects = (a.y > y) !== (b.y > y);
    if (!intersects) continue;
    const t = (y - a.y) / (b.y - a.y);
    xs.push(a.x + (b.x - a.x) * t);
  }
  xs.sort((left, right) => left - right);
  const intervals = [];
  for (let index = 0; index < xs.length - 1; index += 2) {
    intervals.push({ start: xs[index], end: xs[index + 1] });
  }
  return intervals;
}

function widestInterval(points, y) {
  const intervals = getIntervalsAtY(points, y);
  let best = null;
  for (const interval of intervals) {
    if (best === null || interval.end - interval.start > best.end - best.start) best = interval;
  }
  return best;
}

function escapeXml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function preparedForShape(shape) {
  const fontString = `${shape.fontSize}px ${shape.fontFamily}`;
  const key = `${shape.text}::${fontString}`;
  if (preparedCache.has(key)) return preparedCache.get(key);
  const prepared = prepareWithSegments(shape.text, fontString);
  preparedCache.set(key, prepared);
  return prepared;
}

function layoutShape(shape) {
  const bounds = polygonBounds(shape.points);
  const insetX = Math.max(8, shape.padding);
  const insetY = Math.max(8, shape.padding);
  const prepared = preparedForShape(shape);
  const lines = [];
  let cursor = { segmentIndex: 0, graphemeIndex: 0 };
  let top = bounds.minY + insetY;

  while (top + shape.lineHeight <= bounds.maxY - insetY) {
    const slot = widestInterval(shape.points, top + shape.lineHeight * 0.52);
    if (!slot) {
      top += shape.lineHeight;
      continue;
    }

    const availableWidth = slot.end - slot.start - insetX * 2;
    if (availableWidth <= 24) {
      top += shape.lineHeight;
      continue;
    }

    let line = layoutNextLine(prepared, cursor, availableWidth);
    if (!line) break;
    if (shape.noWordBreak && line.end.graphemeIndex !== 0) {
      const unbrokenLine = layoutNextLine(prepared, cursor, 1_000_000);
      if (unbrokenLine) line = unbrokenLine;
    }

    lines.push({
      x: slot.start + insetX,
      y: top,
      text: line.text,
      width: line.width
    });
    cursor = line.end;
    top += shape.lineHeight;
  }

  return lines;
}

function syncControlsFromActiveShape() {
  const shape = getActiveShape();
  if (!shape) {
    shapeText.value = "";
    noWordBreakInput.checked = false;
    toggleShapeButton.textContent = "Hide shape";
    return;
  }
  shapeText.value = shape.text;
  noWordBreakInput.checked = Boolean(shape.noWordBreak);
  const existingOption = Array.from(fontPreset.options).find((option) => option.value === shape.fontFamily);
  let customOption = fontPreset.querySelector('[data-custom-font="true"]');
  if (!existingOption) {
    if (!customOption) {
      customOption = document.createElement("option");
      customOption.dataset.customFont = "true";
      fontPreset.appendChild(customOption);
    }
    customOption.value = shape.fontFamily;
    customOption.textContent = `${shape.fontLabel} (Custom)`;
  } else if (customOption) {
    customOption.remove();
  }
  fontPreset.value = shape.fontFamily;
  fontSizeInput.value = String(shape.fontSize);
  lineHeightInput.value = String(shape.lineHeight);
  shapePaddingInput.value = String(shape.padding);
  fontSizeValue.textContent = `${shape.fontSize}px`;
  lineHeightValue.textContent = `${shape.lineHeight}px`;
  shapePaddingValue.textContent = `${shape.padding}px`;
  toggleShapeButton.textContent = shape.visible ? "Hide shape" : "Show shape";
}

function focusTextEditor() {
  shapeText.scrollIntoView({ block: "center", behavior: "smooth" });
  shapeText.focus();
  const cursor = shapeText.value.length;
  shapeText.setSelectionRange(cursor, cursor);
  shapeText.classList.remove("focus-claim");
  void shapeText.offsetWidth;
  shapeText.classList.add("focus-claim");
  if (focusClaimTimer !== null) window.clearTimeout(focusClaimTimer);
  focusClaimTimer = window.setTimeout(() => {
    shapeText.classList.remove("focus-claim");
  }, 900);
}

function selectShape(shapeId) {
  activeShapeId = shapeId;
  syncControlsFromActiveShape();
  renderAll();
}

function deselectShape() {
  activeShapeId = null;
  syncControlsFromActiveShape();
  renderAll();
}

function renderShapeList() {
  shapeList.innerHTML = "";
  state.shapes.forEach((shape, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `shape-chip${shape.id === activeShapeId ? " active" : ""}`;
    button.innerHTML = `
      <span class="shape-chip-main">
        <span class="shape-chip-title">${escapeXml(shape.name)}</span>
      </span>
      <span class="shape-chip-meta">${shape.visible ? "visible" : "hidden"} · ${index + 1}</span>
    `;
    button.addEventListener("click", () => selectShape(shape.id));
    if (shape.id === activeShapeId) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "shape-chip-delete";
      remove.setAttribute("aria-label", `Delete ${shape.name}`);
      remove.textContent = "×";
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteShapeById(shape.id);
      });
      button.appendChild(remove);
    }
    shapeList.appendChild(button);
  });
}

function pointerToStage(event) {
  const rect = stage.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function pointerToWorld(event) {
  return screenToWorld(pointerToStage(event));
}

function beginPointDrag(event, shapeId, pointIndex) {
  const point = pointerToWorld(event);
  pointerSession = {
    type: "point",
    shapeId,
    pointIndex,
    startPointer: point
  };
  event.target.setPointerCapture?.(event.pointerId);
}

function beginShapeDrag(event, shapeId) {
  const shape = state.shapes.find((item) => item.id === shapeId);
  if (!shape) return;
  selectShape(shapeId);
  const point = pointerToWorld(event);
  pointerSession = {
    type: "shape",
    shapeId,
    startPointer: point,
    originalPoints: shape.points.map((item) => ({ ...item }))
  };
  event.target.setPointerCapture?.(event.pointerId);
}

function beginPan(event) {
  if (event.target.closest(".shape-path, .vertex, .midpoint, .transform-handle")) return;
  if (activeShapeId !== null) {
    deselectShape();
  }
  const point = pointerToStage(event);
  pointerSession = {
    type: "pan",
    startPointer: point,
    startCamera: { ...camera }
  };
  stage.classList.add("is-panning");
}

function polygonCenter(points) {
  const bounds = polygonBounds(points);
  return {
    x: (bounds.minX + bounds.maxX) * 0.5,
    y: (bounds.minY + bounds.maxY) * 0.5
  };
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function scaleAround(point, center, ratio) {
  return {
    x: center.x + (point.x - center.x) * ratio,
    y: center.y + (point.y - center.y) * ratio
  };
}

function rotateAround(point, center, angle) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

function beginScale(event, shapeId) {
  const shape = state.shapes.find((item) => item.id === shapeId);
  if (!shape) return;
  selectShape(shapeId);
  const center = polygonCenter(shape.points);
  const start = pointerToWorld(event);
  pointerSession = {
    type: "scale",
    shapeId,
    center,
    startDistance: distanceBetween(start, center),
    originalPoints: shape.points.map((item) => ({ ...item }))
  };
  event.target.setPointerCapture?.(event.pointerId);
}

function beginRotate(event, shapeId) {
  const shape = state.shapes.find((item) => item.id === shapeId);
  if (!shape) return;
  selectShape(shapeId);
  const center = polygonCenter(shape.points);
  const start = pointerToWorld(event);
  pointerSession = {
    type: "rotate",
    shapeId,
    center,
    startAngle: Math.atan2(start.y - center.y, start.x - center.x),
    originalPoints: shape.points.map((item) => ({ ...item }))
  };
  event.target.setPointerCapture?.(event.pointerId);
}

function updatePointerSession(event) {
  if (!pointerSession) return;
  if (pointerSession.type === "pan") {
    const point = pointerToStage(event);
    camera = {
      x: pointerSession.startCamera.x - (point.x - pointerSession.startPointer.x),
      y: pointerSession.startCamera.y - (point.y - pointerSession.startPointer.y),
      zoom: pointerSession.startCamera.zoom
    };
    renderAll();
    return;
  }

  const shape = state.shapes.find((item) => item.id === pointerSession.shapeId);
  if (!shape) return;
  const point = pointerToWorld(event);

  if (pointerSession.type === "point") {
    shape.points[pointerSession.pointIndex] = point;
  } else if (pointerSession.type === "shape") {
    const dx = point.x - pointerSession.startPointer.x;
    const dy = point.y - pointerSession.startPointer.y;
    shape.points = pointerSession.originalPoints.map((original) => ({
      x: original.x + dx,
      y: original.y + dy
    }));
  } else if (pointerSession.type === "scale") {
    const nextDistance = distanceBetween(point, pointerSession.center);
    const ratio = clamp(nextDistance / Math.max(pointerSession.startDistance, 1), 0.15, 12);
    shape.points = pointerSession.originalPoints.map((original) =>
      scaleAround(original, pointerSession.center, ratio)
    );
  } else if (pointerSession.type === "rotate") {
    const nextAngle = Math.atan2(point.y - pointerSession.center.y, point.x - pointerSession.center.x);
    const delta = nextAngle - pointerSession.startAngle;
    shape.points = pointerSession.originalPoints.map((original) =>
      rotateAround(original, pointerSession.center, delta)
    );
  }

  renderAll();
}

function endPointerSession() {
  stage.classList.remove("is-panning");
  pointerSession = null;
}

function deleteShapeById(shapeId) {
  if (shapeId === null) return;
  const index = state.shapes.findIndex((shape) => shape.id === shapeId);
  if (index === -1) return;
  state.shapes.splice(index, 1);
  activeShapeId = state.shapes[index - 1]?.id || state.shapes[index]?.id || null;
  syncControlsFromActiveShape();
  renderAll();
}

function deleteActiveShape() {
  deleteShapeById(activeShapeId);
}

function renderSvg() {
  const { width, height } = stageSize();
  sceneSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  sceneSvg.innerHTML = "";
  renderedShapes = [];
  updateGrid();

  let totalLines = 0;

  state.shapes.forEach((shape) => {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const screenPoints = shape.points.map(worldToScreen);
    const pathData = pointsToPath(screenPoints);
    const isActive = shape.id === activeShapeId;
    const shouldShowGuide = shape.visible || isActive;

    path.setAttribute("d", pathData);
    path.dataset.shapeId = shape.id;
    path.classList.add("shape-path");
    if (isActive) path.classList.add("active");
    if (!shape.visible) path.classList.add("hidden-guide");
    path.style.display = shouldShowGuide ? "block" : "none";
    path.addEventListener("pointerdown", (event) => beginShapeDrag(event, shape.id));
    path.addEventListener("dblclick", () => {
      selectShape(shape.id);
      focusTextEditor();
    });
    group.appendChild(path);

    const lines = layoutShape({
      ...shape,
      points: screenPoints,
      fontSize: shape.fontSize * camera.zoom,
      lineHeight: shape.lineHeight * camera.zoom,
      padding: shape.padding * camera.zoom
    });
    renderedShapes.push({ shape, lines, screenPoints });
    totalLines += lines.length;

    lines.forEach((line) => {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.classList.add("shape-text");
      text.setAttribute("x", String(line.x));
      text.setAttribute("y", String(line.y));
      text.setAttribute("xml:space", "preserve");
      text.setAttribute("style", `font-family:${shape.fontFamily};font-size:${shape.fontSize * camera.zoom}px;dominant-baseline:text-before-edge;`);
      text.textContent = line.text;
      group.appendChild(text);
    });

    if (isActive) {
      const box = polygonBounds(screenPoints);
      const bbox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bbox.setAttribute("x", String(box.minX));
      bbox.setAttribute("y", String(box.minY));
      bbox.setAttribute("width", String(box.maxX - box.minX));
      bbox.setAttribute("height", String(box.maxY - box.minY));
      bbox.classList.add("bbox");
      group.appendChild(bbox);

      screenPoints.forEach((point, index) => {
        const vertex = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        vertex.setAttribute("cx", String(point.x));
        vertex.setAttribute("cy", String(point.y));
        vertex.setAttribute("r", "5.5");
        vertex.classList.add("vertex");
        vertex.addEventListener("pointerdown", (event) => {
          event.stopPropagation();
          beginPointDrag(event, shape.id, index);
        });
        group.appendChild(vertex);

        const next = screenPoints[(index + 1) % screenPoints.length];
        const middle = midpoint(point, next);
        const midpointHandle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        midpointHandle.setAttribute("cx", String(middle.x));
        midpointHandle.setAttribute("cy", String(middle.y));
        midpointHandle.setAttribute("r", addPointMode ? "4.5" : "3.5");
        midpointHandle.classList.add("midpoint");
        midpointHandle.style.opacity = addPointMode ? "1" : "0.55";
        midpointHandle.addEventListener("pointerdown", (event) => {
          event.stopPropagation();
          const inserted = screenToWorld(middle);
          shape.points.splice(index + 1, 0, inserted);
          renderAll();
          const newIndex = index + 1;
          beginPointDrag(event, shape.id, newIndex);
        });
        group.appendChild(midpointHandle);
      });

      const scaleHandle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      scaleHandle.setAttribute("cx", String(box.maxX + 18));
      scaleHandle.setAttribute("cy", String(box.maxY + 18));
      scaleHandle.setAttribute("r", "6");
      scaleHandle.classList.add("transform-handle", "scale");
      scaleHandle.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        beginScale(event, shape.id);
      });
      group.appendChild(scaleHandle);

      const rotateHandle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      rotateHandle.setAttribute("cx", String((box.minX + box.maxX) * 0.5));
      rotateHandle.setAttribute("cy", String(box.minY - 26));
      rotateHandle.setAttribute("r", "6");
      rotateHandle.classList.add("transform-handle", "rotate");
      rotateHandle.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        beginRotate(event, shape.id);
      });
      group.appendChild(rotateHandle);

      const deleteHandle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      deleteHandle.setAttribute("cx", String(box.maxX + 18));
      deleteHandle.setAttribute("cy", String(box.minY - 26));
      deleteHandle.setAttribute("r", "6");
      deleteHandle.classList.add("transform-handle", "delete");
      deleteHandle.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        deleteShapeById(shape.id);
      });
      group.appendChild(deleteHandle);
    }

    sceneSvg.appendChild(group);
  });

  statShapes.textContent = String(state.shapes.length);
  statLines.textContent = String(totalLines);
  statActive.textContent = getActiveShape()?.name || "none";
  statZoom.textContent = `${Math.round(camera.zoom * 100)}%`;
  statView.textContent = `${Math.round(camera.x)}, ${Math.round(camera.y)}`;
}

function renderAll() {
  if (!state.shapes.length) {
    setStatus("idle", "Add a shape to begin.");
    shapeList.innerHTML = "";
    sceneSvg.innerHTML = "";
    statShapes.textContent = "0";
    statLines.textContent = "0";
    statActive.textContent = "none";
    statZoom.textContent = `${Math.round(camera.zoom * 100)}%`;
    statView.textContent = `${Math.round(camera.x)}, ${Math.round(camera.y)}`;
    return;
  }

  setStatus("ready", "");
  renderShapeList();
  renderSvg();
  toggleShapeButton.classList.toggle("is-active", !getActiveShape()?.visible);
  addPointModeButton.classList.toggle("is-active", addPointMode);
}

function updateActiveShape(mutator) {
  const shape = getActiveShape();
  if (!shape) return;
  mutator(shape);
  renderAll();
}

function fitImportedShapes(shapes) {
  const { width, height } = stageSize();
  const allPoints = shapes.flatMap((shape) => shape.points);
  const bounds = polygonBounds(allPoints);
  const sourceWidth = Math.max(1, bounds.maxX - bounds.minX);
  const sourceHeight = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min((width * 0.72) / sourceWidth, (height * 0.72) / sourceHeight);
  const targetWidth = sourceWidth * scale;
  const targetHeight = sourceHeight * scale;
  const offsetX = width * 0.5 / camera.zoom - targetWidth * 0.5 - bounds.minX * scale + camera.x;
  const offsetY = height * 0.5 / camera.zoom - targetHeight * 0.5 - bounds.minY * scale + camera.y;

  shapes.forEach((shape) => {
    shape.points = shape.points.map((point) => ({
      x: point.x * scale + offsetX,
      y: point.y * scale + offsetY
    }));
  });
}

function zoomAt(factor, screenPoint = null) {
  const previousZoom = camera.zoom;
  const nextZoom = clamp(previousZoom * factor, 0.35, 3);
  const anchor = screenPoint || { x: stage.clientWidth * 0.5, y: stage.clientHeight * 0.5 };
  const worldX = anchor.x / previousZoom + camera.x;
  const worldY = anchor.y / previousZoom + camera.y;
  camera.zoom = nextZoom;
  camera.x = worldX - anchor.x / nextZoom;
  camera.y = worldY - anchor.y / nextZoom;
  renderAll();
}

function samplePathElement(element, count = 28) {
  const temp = element.cloneNode(true);
  helperSvg.innerHTML = "";
  helperSvg.appendChild(temp);
  const length = temp.getTotalLength();
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const point = temp.getPointAtLength(length * (index / count));
    points.push({ x: point.x, y: point.y });
  }
  return points;
}

function parsePointsList(value) {
  return value
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number))
    .filter((pair) => pair.length === 2 && pair.every((entry) => Number.isFinite(entry)))
    .map(([x, y]) => ({ x, y }));
}

function sampleEllipse(cx, cy, rx, ry, count = 28) {
  return Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });
}

function importSvgShapes(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg") {
    throw new Error("Paste a full <svg>…</svg> document.");
  }

  const figures = Array.from(root.querySelectorAll("path, polygon, rect, circle, ellipse"));
  if (!figures.length) throw new Error("No closed figures found in the pasted SVG.");

  const imported = [];
  figures.forEach((figure, index) => {
    const tag = figure.tagName.toLowerCase();
    let points = [];

    if (tag === "polygon") {
      points = parsePointsList(figure.getAttribute("points") || "");
    } else if (tag === "rect") {
      const x = Number(figure.getAttribute("x") || 0);
      const y = Number(figure.getAttribute("y") || 0);
      const width = Number(figure.getAttribute("width") || 0);
      const height = Number(figure.getAttribute("height") || 0);
      points = [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height }
      ];
    } else if (tag === "circle") {
      points = sampleEllipse(
        Number(figure.getAttribute("cx") || 0),
        Number(figure.getAttribute("cy") || 0),
        Number(figure.getAttribute("r") || 0),
        Number(figure.getAttribute("r") || 0)
      );
    } else if (tag === "ellipse") {
      points = sampleEllipse(
        Number(figure.getAttribute("cx") || 0),
        Number(figure.getAttribute("cy") || 0),
        Number(figure.getAttribute("rx") || 0),
        Number(figure.getAttribute("ry") || 0)
      );
    } else if (tag === "path") {
      points = samplePathElement(figure);
    }

    if (points.length >= 3) {
      imported.push(
        createPolygon(points, {
          name: `Imported ${index + 1}`,
          text: `Imported shape ${index + 1}. Double-click the figure or edit this text here.`,
          fontLabel: "Georgia"
        })
      );
    }
  });

  if (!imported.length) throw new Error("The SVG did not contain usable closed figures.");
  fitImportedShapes(imported);
  imported.forEach((shape) => state.shapes.push(shape));
  activeShapeId = imported[0].id;
  syncControlsFromActiveShape();
  renderAll();
}

async function loadGoogleFont(family) {
  const trimmed = family.trim();
  if (!trimmed) return;
  const id = `gf-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${trimmed.replace(/\s+/g, "+")}:wght@400;500;600&display=swap`;
    document.head.appendChild(link);
  }
  await document.fonts.load(`16px "${trimmed}"`);
  updateActiveShape((shape) => {
    shape.fontFamily = `"${trimmed}", sans-serif`;
    shape.fontLabel = trimmed;
  });
}

async function loadUploadedFont(file) {
  if (!file) return;
  const family = file.name.replace(/\.[^.]+$/, "");
  const buffer = await file.arrayBuffer();
  const fontFace = new FontFace(family, buffer);
  await fontFace.load();
  document.fonts.add(fontFace);
  updateActiveShape((shape) => {
    shape.fontFamily = `"${family}"`;
    shape.fontLabel = family;
  });
}

async function exportPng() {
  const rect = stage.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);

  ctx.fillStyle = "#08080e";
  ctx.fillRect(0, 0, rect.width, rect.height);

  renderedShapes.forEach(({ shape, lines, screenPoints }) => {
    if (shape.visible) {
      ctx.beginPath();
      screenPoints.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.018)";
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = "#e8e4dc";
    ctx.textBaseline = "top";
    ctx.font = `${shape.fontSize * camera.zoom}px ${shape.fontFamily}`;
    lines.forEach((line) => {
      ctx.fillText(line.text, line.x, line.y);
    });
  });

  const link = document.createElement("a");
  link.download = "text-in-any-shape.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

document.getElementById("shapeTemplates").addEventListener("click", (event) => {
  const button = event.target.closest("[data-template]");
  if (!button) return;
  addShape(createTemplateShape(button.dataset.template));
});

shapeText.addEventListener("input", () => {
  updateActiveShape((shape) => {
    shape.text = shapeText.value;
  });
});

noWordBreakInput.addEventListener("change", () => {
  updateActiveShape((shape) => {
    shape.noWordBreak = noWordBreakInput.checked;
  });
});

shapeText.addEventListener("focus", () => {
  shapeText.classList.add("is-focused");
});

shapeText.addEventListener("blur", () => {
  shapeText.classList.remove("is-focused");
});

fontPreset.addEventListener("change", () => {
  updateActiveShape((shape) => {
    shape.fontFamily = fontPreset.value;
    shape.fontLabel = fontPreset.selectedOptions[0]?.textContent || "Preset";
  });
});

fontSizeInput.addEventListener("input", () => {
  fontSizeValue.textContent = `${fontSizeInput.value}px`;
  updateActiveShape((shape) => {
    shape.fontSize = Number(fontSizeInput.value);
  });
});

lineHeightInput.addEventListener("input", () => {
  lineHeightValue.textContent = `${lineHeightInput.value}px`;
  updateActiveShape((shape) => {
    shape.lineHeight = Number(lineHeightInput.value);
  });
});

shapePaddingInput.addEventListener("input", () => {
  shapePaddingValue.textContent = `${shapePaddingInput.value}px`;
  updateActiveShape((shape) => {
    shape.padding = Number(shapePaddingInput.value);
  });
});

sampleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    sampleButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    shapeText.value = button.dataset.copy || "";
    updateActiveShape((shape) => {
      shape.text = shapeText.value;
    });
  });
});

toggleShapeButton.addEventListener("click", () => {
  updateActiveShape((shape) => {
    shape.visible = !shape.visible;
  });
});

addPointModeButton.addEventListener("click", () => {
  addPointMode = !addPointMode;
  renderAll();
});

exportPngButton.addEventListener("click", () => {
  exportPng().catch((error) => {
    setStatus("error", error instanceof Error ? error.message : "Could not export PNG.");
  });
});

document.getElementById("loadGoogleFont").addEventListener("click", async () => {
  try {
    await loadGoogleFont(googleFontInput.value);
  } catch (error) {
    setStatus("error", error instanceof Error ? error.message : "Could not load the Google Font.");
  }
});

fontUpload.addEventListener("change", async () => {
  try {
    fontUploadName.textContent = fontUpload.files?.[0]?.name || "No file selected";
    await loadUploadedFont(fontUpload.files?.[0] || null);
  } catch (error) {
    setStatus("error", error instanceof Error ? error.message : "Could not load the uploaded font.");
  }
});

importSvgButton.addEventListener("click", () => {
  try {
    importSvgShapes(svgPaste.value);
    svgPaste.value = "";
  } catch (error) {
    setStatus("error", error instanceof Error ? error.message : "Could not import the SVG.");
  }
});

addBlankShapeButton.addEventListener("click", () => {
  addShape(createTemplateShape("diamond"));
});

zoomInButton.addEventListener("click", () => {
  zoomAt(1.2);
});

zoomOutButton.addEventListener("click", () => {
  zoomAt(1 / 1.2);
});

zoomResetButton.addEventListener("click", () => {
  camera.zoom = 1;
  renderAll();
});

window.addEventListener("pointermove", updatePointerSession);
window.addEventListener("pointerup", endPointerSession);
window.addEventListener("resize", renderAll);
window.addEventListener("keydown", (event) => {
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return;
  }
  event.preventDefault();
  deleteActiveShape();
});
stage.addEventListener("pointerdown", beginPan);

addShape(createTemplateShape("heart"));
sampleButtons[0]?.classList.add("active");
setStatus("ready", "");
