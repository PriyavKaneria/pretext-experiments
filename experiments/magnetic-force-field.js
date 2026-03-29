import { prepareWithSegments, layoutNextLine } from "../pretext.js";

const FONT_FAMILY = 'Georgia, "Times New Roman", serif';
const STAGE_MARGIN = 24;
const MAX_LINES = 40;
const DEFAULT_TEXT = "Good editorial motion should feel less like destruction and more like persuasion. Each pass of the field nudges the paragraph off-axis, compresses the measure for a few rows, and then hands the composition back to its calm original order before the effect becomes noise. A reader should be able to sense the pressure without losing the sentence. That means the distortion has to be measured, legible, and generous enough to let the eye keep moving. When the field drifts away, the column should not look repaired so much as relieved, as if it always knew how to return to itself once the interruption passed. This is where the experiment becomes useful: it turns dynamic layout into a visible editorial decision instead of a technical side effect.";
const DEFAULT_CONFIG = { radius: 168, strength: 0.92, settle: 0.12, echoes: 2 };

const stage = document.getElementById("stage");
const sceneSvg = document.getElementById("sceneSvg");
const textInput = document.getElementById("textInput");
const resetMotionButton = document.getElementById("resetMotion");
const radiusInput = document.getElementById("radiusInput");
const strengthInput = document.getElementById("strengthInput");
const settleInput = document.getElementById("settleInput");
const echoInput = document.getElementById("echoInput");
const radiusValue = document.getElementById("radiusValue");
const strengthValue = document.getElementById("strengthValue");
const settleValue = document.getElementById("settleValue");
const echoValue = document.getElementById("echoValue");
const lineCount = document.getElementById("lineCount");
const fieldCount = document.getElementById("fieldCount");
const maxShift = document.getElementById("maxShift");
const columnWidth = document.getElementById("columnWidth");
const hudReadout = document.getElementById("hudReadout");

const preparedCache = new Map();
const measureCanvas = document.createElement("canvas");
const measureContext = measureCanvas.getContext("2d");
let stageRect = null;
let resizeObserver = null;
let animationHandle = 0;

const state = {
  config: { ...DEFAULT_CONFIG },
  pointerInside: false,
  pointer: { x: 0, y: 0 },
  leadField: { x: 0, y: 0, strength: 0 },
  echoes: [],
  displayTokens: [],
  metrics: { lines: 0, fields: 0, shift: 0, width: 0 }
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(current, target, amount) {
  return current + (target - current) * amount;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function compressToRange(value, min, max) {
  if (max <= min) return min;
  const center = (min + max) * 0.5;
  const half = (max - min) * 0.5;
  return center + half * Math.tanh((value - center) / half);
}

function escapeXml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readConfigFromControls() {
  state.config.radius = Number(radiusInput.value);
  state.config.strength = Number(strengthInput.value);
  state.config.settle = Number(settleInput.value);
  state.config.echoes = Number(echoInput.value);
  syncEchoFields();
  updateControlLabels();
}

function updateControlLabels() {
  radiusValue.textContent = `${Math.round(state.config.radius)} px`;
  strengthValue.textContent = state.config.strength.toFixed(2);
  settleValue.textContent = state.config.settle.toFixed(2);
  echoValue.textContent = String(state.config.echoes);
}

function syncEchoFields() {
  while (state.echoes.length < state.config.echoes) {
    state.echoes.push({ x: state.leadField.x, y: state.leadField.y, strength: 0 });
  }
  state.echoes.length = state.config.echoes;
}

function preparedParagraph(text, fontSize) {
  const font = `${fontSize}px ${FONT_FAMILY}`;
  const key = `${text}::${font}`;
  if (preparedCache.has(key)) return preparedCache.get(key);
  const prepared = prepareWithSegments(text, font);
  preparedCache.set(key, prepared);
  return prepared;
}

function getStageMetrics() {
  if (!stageRect) stageRect = stage.getBoundingClientRect();
  const isCompact = stageRect.width < 820;
  const fontSize = isCompact ? 18 : 22;
  const lineHeight = isCompact ? 26 : 31;
  const top = isCompact ? 82 : 94;
  const left = isCompact ? 28 : Math.min(146, stageRect.width * 0.145);
  const width = isCompact
    ? Math.max(220, stageRect.width - left - 28)
    : Math.min(620, stageRect.width - left - 88);

  return {
    width: stageRect.width,
    height: stageRect.height,
    fontSize,
    lineHeight,
    top,
    left,
    columnWidth: width
  };
}

function resetMotion() {
  const metrics = getStageMetrics();
  const startX = metrics.left + metrics.columnWidth * 0.5;
  const startY = metrics.top + metrics.lineHeight * 4;

  state.pointer = { x: startX, y: startY };
  state.leadField.x = startX;
  state.leadField.y = startY;
  state.leadField.strength = 0;
  state.echoes.forEach((field) => {
    field.x = startX;
    field.y = startY;
    field.strength = 0;
  });
}

function updateStageRect() {
  stageRect = stage.getBoundingClientRect();
  sceneSvg.setAttribute("viewBox", `0 0 ${stageRect.width} ${stageRect.height}`);
}

function onPointerMove(event) {
  const bounds = stage.getBoundingClientRect();
  state.pointerInside = true;
  state.pointer.x = event.clientX - bounds.left;
  state.pointer.y = event.clientY - bounds.top;
}

function onPointerLeave() {
  state.pointerInside = false;
}

function activeFields(metrics) {
  const fields = [];
  const sourceFields = [state.leadField, ...state.echoes];

  sourceFields.forEach((field, index) => {
    const strength = field.strength * Math.pow(0.84, index);
    if (strength < 0.025) return;

    fields.push({
      x: field.x,
      y: field.y,
      strength,
      radius: state.config.radius * Math.pow(0.87, index),
      echo: index > 0
    });
  });

  return fields.filter((field) => {
    return (
      field.x >= -metrics.columnWidth &&
      field.x <= metrics.width + metrics.columnWidth &&
      field.y >= -metrics.height &&
      field.y <= metrics.height * 2
    );
  });
}

function influenceForField(field, metrics, lineY) {
  const columnStart = metrics.left;
  const columnEnd = metrics.left + metrics.columnWidth;
  const columnCenter = columnStart + metrics.columnWidth * 0.5;
  let horizontalGap = 0;

  if (field.x < columnStart) {
    horizontalGap = columnStart - field.x;
  } else if (field.x > columnEnd) {
    horizontalGap = field.x - columnEnd;
  }

  const verticalGap = Math.abs(field.y - lineY);
  const distance = Math.hypot(horizontalGap, verticalGap);
  const radial = clamp(1 - distance / field.radius, 0, 1);
  if (radial <= 0) return { push: 0, squeeze: 0 };

  const normalizedOffset = clamp((columnCenter - field.x) / (metrics.columnWidth * 0.42), -1, 1);
  const directionCurve = normalizedOffset * (0.55 + 0.45 * Math.abs(normalizedOffset));
  const edgeBias = 0.28 + 0.72 * smoothstep(0.04, 0.92, Math.abs(normalizedOffset));
  const verticalBias = 0.72 + 0.28 * smoothstep(0, field.radius, field.radius - verticalGap);
  const push = directionCurve * radial * edgeBias * verticalBias * metrics.columnWidth * 0.16 * field.strength * state.config.strength;
  const squeeze = radial * field.strength * state.config.strength * field.radius * 0.38;

  return { push, squeeze };
}

function geometryForLine(metrics, fields, lineY) {
  let push = 0;
  let squeeze = 0;

  fields.forEach((field) => {
    const effect = influenceForField(field, metrics, lineY);
    push += effect.push;
    squeeze += effect.squeeze;
  });

  const maxShiftAmount = Math.min(metrics.columnWidth * 0.22, 124);
  const safeLeft = STAGE_MARGIN;
  const safeRight = metrics.width - STAGE_MARGIN;
  const width = clamp(metrics.columnWidth - squeeze, 148, metrics.columnWidth);
  const minX = safeLeft;
  const maxX = safeRight - width;
  const desiredX = metrics.left + clamp(push, -maxShiftAmount, maxShiftAmount);
  const x = compressToRange(desiredX, minX, maxX);

  return {
    x,
    width,
    shift: x - metrics.left
  };
}

function layoutLines() {
  const metrics = getStageMetrics();
  const text = textInput.value.trim() || DEFAULT_TEXT;
  const prepared = preparedParagraph(text, metrics.fontSize);
  const fields = activeFields(metrics);
  const lines = [];
  let cursor = { segmentIndex: 0, graphemeIndex: 0 };
  let y = metrics.top;
  let largestShift = 0;

  for (let index = 0; index < MAX_LINES; index += 1) {
    const lineY = y + metrics.lineHeight * 0.52;
    const geometry = geometryForLine(metrics, fields, lineY);
    const nextLine = layoutNextLine(prepared, cursor, geometry.width);
    if (!nextLine) break;

    lines.push({
      x: geometry.x,
      y,
      width: geometry.width,
      text: nextLine.text,
      muted: index > 0 && index === MAX_LINES - 1,
      shift: geometry.shift
    });
    cursor = nextLine.end;
    largestShift = Math.max(largestShift, Math.abs(geometry.shift));
    y += metrics.lineHeight;
  }

  state.metrics = {
    lines: lines.length,
    fields: fields.length,
    shift: largestShift,
    width: metrics.columnWidth
  };

  return { metrics, fields, lines };
}

function tokenizeLine(line, metrics, indexOffset, lineIndex) {
  if (!measureContext) return [];
  const chunks = line.text.match(/\S+\s*/g) || [];
  measureContext.font = `${metrics.fontSize}px ${FONT_FAMILY}`;

  const tokens = [];
  let advance = 0;
  let index = indexOffset;

  chunks.forEach((chunk) => {
    const visible = chunk.replace(/\s+$/g, "");
    const width = measureContext.measureText(chunk).width;
    if (visible) {
      tokens.push({
        key: index,
        text: visible,
        x: line.x + advance,
        y: line.y + metrics.fontSize,
        fontSize: metrics.fontSize,
        lineIndex,
        muted: line.muted
      });
      index += 1;
    }
    advance += width;
  });

  return tokens;
}

function buildWordTargets(lines, metrics) {
  const tokens = [];
  let wordIndex = 0;

  lines.forEach((line, lineIndex) => {
    const lineTokens = tokenizeLine(line, metrics, wordIndex, lineIndex);
    tokens.push(...lineTokens);
    wordIndex += lineTokens.length;
  });

  return tokens;
}

function buildTargets(lines, metrics) {
  return buildWordTargets(lines, metrics);
}

function reconcileDisplayTokens(targetTokens, metrics) {
  const nextTokens = [];
  const total = Math.max(state.displayTokens.length, targetTokens.length);

  for (let index = 0; index < total; index += 1) {
    const target = targetTokens[index] || null;
    const existing = state.displayTokens[index] || null;

    if (target) {
      if (!existing || existing.text !== target.text) {
        const anchor = existing || state.displayTokens[index - 1] || null;
        const crossLineJump = anchor ? Math.abs(anchor.y - target.y) > metrics.lineHeight * 0.45 : false;
        const entryDistance = anchor ? Math.hypot(target.x - anchor.x, target.y - anchor.y) : 0;
        nextTokens.push({
          text: target.text,
          x: target.x,
          y: target.y,
          fontSize: target.fontSize,
          fromX: anchor ? anchor.x : target.x,
          fromY: anchor ? anchor.y : target.y,
          fromFontSize: target.fontSize,
          targetX: target.x,
          targetY: target.y,
          targetFontSize: target.fontSize,
          elapsed: anchor ? 0 : 1,
          duration: anchor ? (crossLineJump ? clamp(0.24 + entryDistance / 900, 0.24, 0.38) : 0.22) : 0,
          opacity: 1,
          lineIndex: target.lineIndex,
          phase: crossLineJump ? "fade-out-in" : "move",
          muted: target.muted
        });
        continue;
      }

      const moved =
        Math.abs(existing.targetX - target.x) > 0.1 ||
        Math.abs(existing.targetY - target.y) > 0.1 ||
        Math.abs(existing.targetFontSize - target.fontSize) > 0.1;

      if (moved) {
        const distance = Math.hypot(target.x - existing.x, target.y - existing.y);
        const nextDuration = clamp(0.12 + distance / 900, 0.12, 0.26);
        const lineChanged =
          existing.lineIndex !== target.lineIndex ||
          Math.abs(existing.y - target.y) > metrics.lineHeight * 0.45;

        if (lineChanged) {
          existing.fromX = existing.x;
          existing.fromY = existing.y;
          existing.fromFontSize = existing.fontSize;
          existing.elapsed = 0;
          existing.duration = clamp(0.24 + distance / 900, 0.24, 0.38);
          existing.phase = "fade-out-in";
        } else {
          existing.fromX = existing.x;
          existing.fromY = existing.y;
          existing.fromFontSize = existing.fontSize;
          existing.elapsed = 0;
          existing.duration = nextDuration;
          existing.phase = "move";
        }

        existing.targetX = target.x;
        existing.targetY = target.y;
        existing.targetFontSize = target.fontSize;
      }

      existing.lineIndex = target.lineIndex;
      existing.muted = target.muted;
      nextTokens.push(existing);
      continue;
    }

    if (!existing) continue;
  }

  state.displayTokens = nextTokens;
  return nextTokens;
}

function animateDisplayTokens() {
  state.displayTokens.forEach((token) => {
    if (token.duration <= 0) {
      token.elapsed = 1;
      token.x = token.targetX;
      token.y = token.targetY;
      token.fontSize = token.targetFontSize;
      token.opacity = 1;
      return;
    }

    token.elapsed += 1 / 60;
    const progress = clamp(token.elapsed / token.duration, 0, 1);

    if (token.phase === "fade-out-in") {
      const fadeOutCutoff = 0.24;

      if (progress < fadeOutCutoff) {
        const fadeOut = progress / fadeOutCutoff;
        token.x = token.fromX;
        token.y = token.fromY;
        token.fontSize = token.fromFontSize;
        token.opacity = 1 - fadeOut;
      } else {
        const fadeIn = (progress - fadeOutCutoff) / (1 - fadeOutCutoff);
        token.x = token.targetX;
        token.y = token.targetY;
        token.fontSize = token.targetFontSize;
        token.opacity = fadeIn;
      }
      return;
    }

    token.x = token.targetX;
    token.y = token.targetY;
    token.fontSize = lerp(token.fromFontSize, token.targetFontSize, smoothstep(0, 1, progress));
    token.opacity = 1;

    const eased = smoothstep(0, 1, progress);
    token.x = lerp(token.fromX, token.targetX, eased);
    token.y = lerp(token.fromY, token.targetY, eased);
  });
}

function renderScene() {
  const { metrics, fields, lines } = layoutLines();
  const targetTokens = buildTargets(lines, metrics);
  const displayTokens = reconcileDisplayTokens(targetTokens, metrics);
  animateDisplayTokens();
  const baselines = [];
  const ghosts = [];
  const fieldMarkup = [];
  const lineMarkup = [];

  for (let index = 0; index < lines.length; index += 1) {
    const sourceLine = lines[index];
    if (!sourceLine) continue;
    const baselineY = sourceLine.y + metrics.lineHeight * 0.64;
    baselines.push(
      `<line class="guide-baseline" x1="${metrics.left}" y1="${baselineY}" x2="${metrics.left + metrics.columnWidth}" y2="${baselineY}" />`
    );
    ghosts.push(
      `<line class="ghost-line" x1="${metrics.left}" y1="${baselineY}" x2="${metrics.left + metrics.columnWidth * 0.94}" y2="${baselineY}" />`
    );
  }

  for (const word of displayTokens) {
    lineMarkup.push(
      `<text class="flow-line${word.muted ? " is-muted" : ""}" x="${word.x}" y="${word.y}" font-size="${word.fontSize}" opacity="${word.opacity ?? 1}">${escapeXml(word.text)}</text>`
    );
  }

  fields.forEach((field) => {
    const coreRadius = Math.max(12, field.radius * 0.22);
    const outerRadius = field.radius * 0.78;
    fieldMarkup.push(
      `<g>
        <circle class="field-core" cx="${field.x}" cy="${field.y}" r="${coreRadius}" opacity="${0.62 * field.strength}" />
        <circle class="field-ring${field.echo ? " echo" : ""}" cx="${field.x}" cy="${field.y}" r="${field.radius * 0.48}" opacity="${0.8 * field.strength}" />
        <circle class="field-ring${field.echo ? " echo" : ""}" cx="${field.x}" cy="${field.y}" r="${outerRadius}" opacity="${0.52 * field.strength}" />
        <line class="field-vector" x1="${field.x}" y1="${field.y - coreRadius - 10}" x2="${field.x}" y2="${field.y - field.radius}" opacity="${0.5 * field.strength}" />
        <circle class="field-dot" cx="${field.x}" cy="${field.y}" r="2.5" opacity="${0.85 * field.strength}" />
      </g>`
    );
  });

  sceneSvg.innerHTML = `
    <rect class="guide-column" x="${metrics.left}" y="${metrics.top - 28}" width="${metrics.columnWidth}" height="${Math.max(metrics.height - metrics.top - 78, metrics.lineHeight * lines.length + 52)}" rx="22" />
    ${ghosts.join("")}
    ${baselines.join("")}
    ${fieldMarkup.join("")}
    ${lineMarkup.join("")}
  `;

  lineCount.textContent = String(state.metrics.lines);
  fieldCount.textContent = String(state.metrics.fields);
  maxShift.textContent = `${Math.round(state.metrics.shift)} px`;
  columnWidth.textContent = `${Math.round(state.metrics.width)} px`;
  hudReadout.textContent = `${state.metrics.fields} field${state.metrics.fields === 1 ? "" : "s"} / ${Math.round(state.metrics.shift)} px shift`;
}

function tickFields() {
  const metrics = getStageMetrics();
  const targetStrength = state.pointerInside ? 1 : 0;
  const settle = state.config.settle;
  const pointerX = Number.isFinite(state.pointer.x) ? state.pointer.x : metrics.left + metrics.columnWidth * 0.5;
  const pointerY = Number.isFinite(state.pointer.y) ? state.pointer.y : metrics.top + metrics.lineHeight * 4;
  const targetX = clamp(pointerX, STAGE_MARGIN, metrics.width - STAGE_MARGIN);
  const targetY = clamp(pointerY, STAGE_MARGIN, metrics.height - STAGE_MARGIN);

  state.leadField.x = lerp(state.leadField.x, targetX, settle);
  state.leadField.y = lerp(state.leadField.y, targetY, settle);
  state.leadField.strength = lerp(state.leadField.strength, targetStrength, settle * 0.85);

  let previous = state.leadField;
  state.echoes.forEach((field, index) => {
    const delay = settle * (0.72 - index * 0.08);
    field.x = lerp(field.x, previous.x, Math.max(0.035, delay));
    field.y = lerp(field.y, previous.y, Math.max(0.035, delay));
    field.strength = lerp(field.strength, previous.strength * 0.88, Math.max(0.03, delay * 0.9));
    previous = field;
  });
}

function frame() {
  tickFields();
  renderScene();
  animationHandle = window.requestAnimationFrame(frame);
}

function bindEvents() {
  [radiusInput, strengthInput, settleInput, echoInput].forEach((input) => {
    input.addEventListener("input", readConfigFromControls);
  });

  resetMotionButton.addEventListener("click", () => {
    resetMotion();
  });

  textInput.addEventListener("input", () => {
    preparedCache.clear();
  });

  stage.addEventListener("pointerenter", onPointerMove);
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerdown", onPointerMove);
  stage.addEventListener("pointerleave", onPointerLeave);

  resizeObserver = new ResizeObserver(() => {
    updateStageRect();
    resetMotion();
  });
  resizeObserver.observe(stage);
}

async function init() {
  textInput.value = DEFAULT_TEXT;
  radiusInput.value = String(DEFAULT_CONFIG.radius);
  strengthInput.value = String(DEFAULT_CONFIG.strength);
  settleInput.value = String(DEFAULT_CONFIG.settle);
  echoInput.value = String(DEFAULT_CONFIG.echoes);
  updateControlLabels();
  syncEchoFields();
  updateStageRect();
  resetMotion();
  bindEvents();

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  frame();
}

window.addEventListener("beforeunload", () => {
  if (animationHandle) window.cancelAnimationFrame(animationHandle);
  resizeObserver?.disconnect();
});

init();
