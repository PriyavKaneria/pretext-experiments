import { prepareWithSegments, layoutNextLine } from "../pretext.js";

const STORY = "A decade is but a flicker, yet those ten years refuse to fade into the gray haze of my memory. I once thought knowing a name and a few favorite spells was enough to say I truly knew a person. \n I was wrong. Human lives are like shooting stars that shine blindingly and vanish before the eyes can even adjust. I used to see their haste as a defect, but now I see it as their strength. Because their time is so short, every word they speak carries the weight of an entire lifetime.\n I have watched forests turn to deserts, yet the most profound change was not the shifting of continents. It was the way a smile softened a face I hadn't looked at closely enough until it was too late. We are all just collectors of moments. The journey is never about the destination at the end of the world. Instead, it is about the person who walked beside you for a few miles and changed how you see the sky. It is a terrifying thing to finally care about such fleeting things, but it is the only thing that makes eternity bearable.";

const DAY_THEME = {
  skyTop: "#5f90c8",
  skyMid: "#b9d8ff",
  skyBottom: "#f6ead0",
  ink: "#3c2b1d",
  accent: "#9d6d32",
  rule: "#cfb185",
  sun: "#e6b255",
  moon: "#dbe4f2",
  orbOutline: "#8a6e47",
  villageOpacity: "0.92"
};

const NIGHT_THEME = {
  skyTop: "#040814",
  skyMid: "#152344",
  skyBottom: "#304260",
  ink: "#f2eadb",
  accent: "#caa56b",
  rule: "#8e795a",
  sun: "#c38f3a",
  moon: "#f2f7ff",
  orbOutline: "#d2c0a3",
  villageOpacity: "0.98"
};

const root = document.documentElement;
const scene = document.getElementById("scene");
const masthead = document.getElementById("masthead");
const settingsPanel = document.getElementById("settingsPanel");
const lineLayer = document.getElementById("lineLayer");
const sunOrb = document.getElementById("sunOrb");
const moonOrb = document.getElementById("moonOrb");
const villageImage = document.getElementById("villageImage");
const statLines = document.getElementById("statLines");
const statPhase = document.getElementById("statPhase");
const statTheme = document.getElementById("statTheme");
const fontSizeInput = document.getElementById("fontSize");
const lineHeightInput = document.getElementById("lineHeight");
const fontSizeValue = document.getElementById("fontSizeValue");
const lineHeightValue = document.getElementById("lineHeightValue");
const resetOrbitButton = document.getElementById("resetOrbit");

const preparedCache = new Map();
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const ORBIT_SPEED = 0.00014;
const RELAYOUT_INTERVAL = 1000 / 48;
const RELAYOUT_DISTANCE = 1.6;
const LAYOUT_LOOKAHEAD_MS = 120;
const LOOKAHEAD_RADIUS_BOOST = 22;
const VILLAGE_ALPHA_THRESHOLD = 255;
const VILLAGE_SAMPLE_STEP = 3;
const VILLAGE_CLEARANCE = 8;
const SUN_SIZE = 132;
const MOON_SIZE = 94;
const state = {
  text: STORY,
  fontSize: 18,
  lineHeight: 29,
  orbitOffset: -Math.PI * 0.22,
  orbitPhase: -Math.PI * 0.22,
  metrics: null,
  topClearance: null,
  layoutKey: "",
  lineNodes: [],
  villageMaskProfile: null,
  villageContour: null,
  lastLayoutBodies: null,
  lastLayoutTime: 0,
  sun: { x: 0, y: 0, radius: SUN_SIZE * 0.5, visible: true, progress: 0 },
  moon: { x: 0, y: 0, radius: MOON_SIZE * 0.5, visible: false, progress: 0 }
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function parseHexColor(hex) {
  const clean = hex.replace("#", "");
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16)
  };
}

function mixHex(left, right, t) {
  const a = parseHexColor(left);
  const b = parseHexColor(right);
  return `rgb(${Math.round(mix(a.r, b.r, t))}, ${Math.round(mix(a.g, b.g, t))}, ${Math.round(mix(a.b, b.b, t))})`;
}

function mixUnit(a, b, t, unit = "") {
  return `${round(mix(a, b, t))}${unit}`;
}

function smoothstep(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function accelerateContrast(blend, factor = 1.35) {
  if (blend <= 0.5) {
    return clamp(blend * factor, 0, 1);
  }
  return clamp(1 - (1 - blend) * factor, 0, 1);
}

function getPrepared(text, fontSize) {
  const font = `${fontSize}px Georgia, "Iowan Old Style", "Times New Roman", serif`;
  const key = `${text}::${font}`;
  if (!preparedCache.has(key)) preparedCache.set(key, prepareWithSegments(text, font));
  return preparedCache.get(key);
}

function storyBlocks(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks = [];
  let pendingGap = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      pendingGap += 1;
      continue;
    }

    blocks.push({
      text: line,
      gapBefore: pendingGap
    });
    pendingGap = 0;
  }

  return blocks.length ? blocks : [{ text: "", gapBefore: 0 }];
}

function ensureVillageMaskProfile() {
  if (state.villageMaskProfile || !villageImage?.complete || !villageImage.naturalWidth || !villageImage.naturalHeight) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = villageImage.naturalWidth;
  canvas.height = villageImage.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;

  context.drawImage(villageImage, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const topByX = new Array(width).fill(Infinity);

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      if (data[(y * width + x) * 4 + 3] >= VILLAGE_ALPHA_THRESHOLD) {
        topByX[x] = y;
        break;
      }
    }
  }

  state.villageMaskProfile = { width, height, topByX };
}

function measureVillageContour() {
  ensureVillageMaskProfile();
  if (!state.villageMaskProfile) {
    state.villageContour = null;
    return;
  }

  const sceneRect = scene.getBoundingClientRect();
  const imageRect = villageImage.getBoundingClientRect();
  if (!imageRect.width || !imageRect.height) {
    state.villageContour = null;
    return;
  }

  const xStart = imageRect.left - sceneRect.left;
  const yStart = imageRect.top - sceneRect.top;
  const xEnd = xStart + imageRect.width;
  const bottomY = yStart + imageRect.height;
  const step = VILLAGE_SAMPLE_STEP;
  const samples = [];

  for (let x = 0; x <= imageRect.width; x += step) {
    const sourceX = clamp(
      Math.round((x / imageRect.width) * (state.villageMaskProfile.width - 1)),
      0,
      state.villageMaskProfile.width - 1
    );
    const top = state.villageMaskProfile.topByX[sourceX];
    const topY = Number.isFinite(top)
      ? yStart + (top / state.villageMaskProfile.height) * imageRect.height
      : Infinity;

    samples.push(topY);
  }

  state.villageContour = {
    xStart,
    xEnd,
    bottomY,
    step,
    samples,
    minTop: samples.reduce((min, value) => Math.min(min, value), Infinity)
  };
}

function measureTopClearance() {
  const sceneRect = scene.getBoundingClientRect();
  const mastheadRect = masthead.getBoundingClientRect();
  const settingsRect = settingsPanel.getBoundingClientRect();
  const topClearance = Math.max(
    mastheadRect.bottom - sceneRect.top,
    settingsRect.bottom - sceneRect.top
  );
  state.topClearance = topClearance;
  root.style.setProperty("--story-top", `${Math.round(topClearance + 26)}px`);
}

function getSceneMetrics() {
  const width = scene.clientWidth;
  const height = scene.clientHeight;
  const isMobile = width < 720;
  const styles = window.getComputedStyle(scene);
  const sceneRect = scene.getBoundingClientRect();
  const mastheadRect = masthead.getBoundingClientRect();
  const settingsRect = settingsPanel.getBoundingClientRect();
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
  const pagePadding = isMobile ? 4 : 12;
  const villageHeight = clamp(width * 0.18, 140, 230);
  if (state.topClearance === null) measureTopClearance();
  const topPadding = Math.max(paddingTop + (isMobile ? 0 : 6), state.topClearance + 26);
  const bottomPadding = Math.max(paddingBottom, villageHeight + (isMobile ? 96 : 10));
  const mastheadLeft = Math.max(paddingLeft + pagePadding, mastheadRect.left - sceneRect.left);
  const settingsLeft = settingsRect.left - sceneRect.left;
  const rightLimit = isMobile
    ? width - paddingRight - pagePadding
    : Math.max(mastheadLeft + 260, width - paddingRight - pagePadding);
  const maxColumnWidth = Math.max(260, rightLimit - mastheadLeft);
  const desiredColumnWidth = isMobile ? maxColumnWidth : maxColumnWidth;
  const columnWidth = clamp(desiredColumnWidth, 260, maxColumnWidth);
  const columnLeft = clamp(mastheadLeft, paddingLeft + pagePadding, width - paddingRight - columnWidth - pagePadding);
  const columnTop = topPadding;
  const columnBottom = height - bottomPadding;

  root.style.setProperty("--village-height", `${Math.round(villageHeight)}px`);

  return {
    width,
    height,
    columnLeft,
    columnTop,
    columnWidth,
    columnBottom,
    settingsLeft,
    horizonY: height - villageHeight + 8,
    sunRadius: SUN_SIZE * 0.5,
    moonRadius: MOON_SIZE * 0.5
  };
}

function orbitBodies(metrics, phase) {
  const cycle = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const normalized = cycle / (Math.PI * 2);
  const horizonY = metrics.horizonY;
  const orbitOverscan = Math.max(metrics.sunRadius, metrics.moonRadius) * 2.6;
  const leftX = -orbitOverscan;
  const rightX = metrics.width + orbitOverscan;
  const dayArcHeight = Math.max(160, (metrics.columnBottom - metrics.columnTop) * 0.72);
  const nightArcHeight = Math.max(138, (metrics.columnBottom - metrics.columnTop) * 0.66);

  const sunProgress = clamp(normalized / 0.5, 0, 1);
  const moonProgress = clamp((normalized - 0.5) / 0.5, 0, 1);
  const sunVisible = normalized < 0.5;
  const moonVisible = !sunVisible;

  const sun = {
    x: mix(leftX, rightX, sunProgress),
    y: horizonY - Math.sin(sunProgress * Math.PI) * dayArcHeight,
    radius: metrics.sunRadius,
    visible: sunVisible,
    progress: sunProgress
  };

  const moon = {
    x: mix(leftX, rightX, moonProgress),
    y: horizonY - Math.sin(moonProgress * Math.PI) * nightArcHeight,
    radius: metrics.moonRadius,
    visible: moonVisible,
    progress: moonProgress
  };

  if (!sunVisible) {
    sun.y = metrics.height + metrics.sunRadius * 2;
  }
  if (!moonVisible) {
    moon.y = metrics.height + metrics.moonRadius * 2;
  }

  return { sun, moon };
}

function cloneBody(body, overrides = {}) {
  return { ...body, ...overrides };
}

function layoutObstaclesForPhase(metrics, phase) {
  const current = orbitBodies(metrics, phase);
  const future = orbitBodies(metrics, phase + ORBIT_SPEED * LAYOUT_LOOKAHEAD_MS);
  const obstacles = [];

  if (current.sun.visible) {
    obstacles.push(current.sun);
    if (future.sun.visible) {
      obstacles.push(cloneBody(future.sun, { radius: future.sun.radius + LOOKAHEAD_RADIUS_BOOST }));
    }
  }

  if (current.moon.visible) {
    obstacles.push(current.moon);
    if (future.moon.visible) {
      obstacles.push(cloneBody(future.moon, { radius: future.moon.radius + LOOKAHEAD_RADIUS_BOOST }));
    }
  }

  return {
    bodies: current,
    obstacles
  };
}

function obstacleIntervalsAtY(obstacles, y) {
  return obstacles.flatMap((obstacle) => {
    const dy = y - obstacle.y;
    if (Math.abs(dy) >= obstacle.radius) return [];
    const dx = Math.sqrt(obstacle.radius * obstacle.radius - dy * dy);
    return [{ start: obstacle.x - dx, end: obstacle.x + dx }];
  }).sort((left, right) => left.start - right.start);
}

function villageIntervalsAtY(metrics, y) {
  const contour = state.villageContour;
  if (!contour || y < contour.minTop - VILLAGE_CLEARANCE || y > contour.bottomY) {
    return [];
  }

  const start = Math.max(metrics.columnLeft, contour.xStart);
  const end = Math.min(metrics.columnLeft + metrics.columnWidth, contour.xEnd);
  if (end <= start) return [];

  const intervals = [];
  let runStart = null;

  for (let x = start; x <= end; x += contour.step) {
    const index = clamp(
      Math.floor((x - contour.xStart) / contour.step),
      0,
      contour.samples.length - 1
    );
    const blocked = y >= contour.samples[index] - VILLAGE_CLEARANCE;

    if (blocked && runStart === null) {
      runStart = x;
    } else if (!blocked && runStart !== null) {
      intervals.push({ start: runStart, end: x });
      runStart = null;
    }
  }

  if (runStart !== null) {
    intervals.push({ start: runStart, end });
  }

  return intervals;
}

function mergeIntervals(intervals) {
  const merged = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
    } else {
      last.end = Math.max(last.end, interval.end);
    }
  }
  return merged;
}

function freeIntervalsForLine(obstacles, metrics, y) {
  const blocked = mergeIntervals([
    ...obstacleIntervalsAtY(obstacles, y),
    ...villageIntervalsAtY(metrics, y)
  ]);
  const start = metrics.columnLeft;
  const end = metrics.columnLeft + metrics.columnWidth;
  const free = [];
  let cursor = start;

  for (const interval of blocked) {
    const blockStart = clamp(interval.start, start, end);
    const blockEnd = clamp(interval.end, start, end);
    if (blockStart > cursor) free.push({ start: cursor, end: blockStart });
    cursor = Math.max(cursor, blockEnd);
  }

  if (cursor < end) free.push({ start: cursor, end });
  return free.filter((interval) => interval.end - interval.start > 20);
}

function buildLayout(metrics, obstacles) {
  const fragments = [];
  const blocks = storyBlocks(state.text);
  let y = metrics.columnTop;

  for (const block of blocks) {
    y += block.gapBefore * state.lineHeight * 0.82;
    if (y + state.lineHeight > metrics.columnBottom) {
      return fragments;
    }

    const prepared = getPrepared(block.text, state.fontSize);
    let cursor = { segmentIndex: 0, graphemeIndex: 0 };

    while (y + state.lineHeight <= metrics.columnBottom) {
      const intervals = freeIntervalsForLine(obstacles, metrics, y + state.lineHeight * 0.56);
      if (!intervals.length) {
        y += state.lineHeight;
        continue;
      }

      let advancedOnRow = false;
      for (const interval of intervals) {
        const line = layoutNextLine(prepared, cursor, Math.max(44, interval.end - interval.start - 8));
        if (!line || !line.text) {
          break;
        }

        fragments.push({
          text: line.text,
          x: interval.start + 4,
          y
        });

        cursor = line.end;
        advancedOnRow = true;

        if (cursor.segmentIndex >= prepared.widths.length) {
          break;
        }
      }

      if (cursor.segmentIndex >= prepared.widths.length) {
        y += state.lineHeight;
        break;
      }

      if (!advancedOnRow) {
        y += state.lineHeight;
        continue;
      }

      y += state.lineHeight;
    }
  }

  return fragments;
}

function syncLineNodes(count) {
  while (state.lineNodes.length < count) {
    const node = document.createElement("div");
    node.className = "line";
    lineLayer.appendChild(node);
    state.lineNodes.push(node);
  }

  while (state.lineNodes.length > count) {
    const node = state.lineNodes.pop();
    node.remove();
  }
}

function renderLines(lines) {
  lineLayer.style.setProperty("--font-size", `${state.fontSize}px`);
  lineLayer.style.setProperty("--line-height", `${state.lineHeight}px`);
  syncLineNodes(lines.length);

  lines.forEach((line, index) => {
    const node = state.lineNodes[index];
    node.style.setProperty("--x", `${round(line.x)}px`);
    node.style.setProperty("--y", `${round(line.y)}px`);
    if (node.textContent !== line.text) node.textContent = line.text;
  });

  statLines.textContent = String(lines.length);
}

function layoutSignature(metrics, obstacles) {
  return [
    metrics.width,
    metrics.height,
    metrics.columnLeft,
    metrics.columnWidth,
    metrics.columnBottom,
    state.fontSize,
    state.lineHeight,
    state.text,
    ...obstacles.flatMap((obstacle) => [
      round(obstacle.x),
      round(obstacle.y),
      round(obstacle.radius)
    ])
  ].join("|");
}

function paintOrb(element, body, sizeProperty) {
  element.style.setProperty("--orb-x", `${round(body.x)}px`);
  element.style.setProperty("--orb-y", `${round(body.y)}px`);
  element.style.setProperty(sizeProperty, `${Math.round(body.radius * 2)}px`);
  element.style.opacity = body.visible ? "1" : "0";
}

function applyTheme(blend, sun, moon, metrics) {
  const active = sun.visible ? sun : moon;
  const activeX = metrics.width ? `${round((active.x / metrics.width) * 100)}%` : "50%";
  const activeY = metrics.height ? `${round((active.y / metrics.height) * 100)}%` : "65%";
  const twilight = sun.visible ? 1 - Math.sin(sun.progress * Math.PI) : 0;
  const moonlight = moon.visible ? Math.sin(moon.progress * Math.PI) : 0;
  const inkBlend = accelerateContrast(blend, 1.42);
  const accentBlend = accelerateContrast(blend, 1.28);

  root.style.setProperty("--sky-top", mixHex(DAY_THEME.skyTop, NIGHT_THEME.skyTop, blend));
  root.style.setProperty("--sky-mid", mixHex(DAY_THEME.skyMid, NIGHT_THEME.skyMid, blend));
  root.style.setProperty("--sky-bottom", mixHex(DAY_THEME.skyBottom, NIGHT_THEME.skyBottom, blend));
  root.style.setProperty("--sky-glow-x", activeX);
  root.style.setProperty("--sky-glow-y", activeY);
  root.style.setProperty(
    "--sky-horizon-glow",
    sun.visible
      ? `rgba(255, ${Math.round(mix(170, 206, twilight))}, ${Math.round(mix(110, 158, twilight))}, ${round(mix(0.12, 0.44, twilight))})`
      : `rgba(184, 202, 255, ${round(mix(0.08, 0.18, moonlight))})`
  );
  root.style.setProperty(
    "--sky-zenith-glow",
    sun.visible
      ? `rgba(255, 234, 192, ${round(mix(0.04, 0.2, twilight))})`
      : `rgba(122, 162, 255, ${round(mix(0.06, 0.16, moonlight))})`
  );
  root.style.setProperty("--ink", mixHex(DAY_THEME.ink, NIGHT_THEME.ink, inkBlend));
  root.style.setProperty("--accent", mixHex(DAY_THEME.accent, NIGHT_THEME.accent, accentBlend));
  root.style.setProperty("--rule", mixHex(DAY_THEME.rule, NIGHT_THEME.rule, inkBlend));
  root.style.setProperty("--sun", mixHex(DAY_THEME.sun, NIGHT_THEME.sun, blend));
  root.style.setProperty("--moon", mixHex(DAY_THEME.moon, NIGHT_THEME.moon, blend));
  root.style.setProperty("--orb-outline", mixHex(DAY_THEME.orbOutline, NIGHT_THEME.orbOutline, blend));
  root.style.setProperty("--village-opacity", String(mix(Number(DAY_THEME.villageOpacity), Number(NIGHT_THEME.villageOpacity), blend)));
  root.style.setProperty("--wash-opacity", mixUnit(0.94, 0.34, blend));
  root.style.setProperty("--wash-brightness", mixUnit(1.08, 0.58, blend));
  root.style.setProperty("--wash-saturation", mixUnit(1.04, 0.72, blend));
  root.style.setProperty("--grain-opacity", mixUnit(0.08, 0.22, blend));
  root.style.setProperty("--star-opacity", mixUnit(0, smoothstep(Math.max(0, (blend - 0.5) / 0.5)) * 0.96, 1));
  root.style.setProperty("--star-twinkle", mixUnit(0.26, 0.54, blend));
  root.style.setProperty("--cloud-opacity", mixUnit(0.42, 0.16, blend));
  root.style.setProperty(
    "--village-filter",
    `saturate(${mixUnit(0.86, 0.68, blend)}) brightness(${mixUnit(0.96, 0.42, blend)})`
  );
  root.style.setProperty("color-scheme", blend > 0.52 ? "dark" : "light");
  statTheme.textContent = `${Math.round(blend * 100)}%`;
}

function phaseLabel(blend) {
  if (blend < 0.18) return "Dawn";
  if (blend < 0.36) return "Noon";
  if (blend < 0.54) return "Vespers";
  if (blend < 0.76) return "Moonrise";
  return "Night Office";
}

function themeBlendForBodies(sun, moon) {
  if (sun.visible) {
    const daylight = smoothstep(Math.sin(sun.progress * Math.PI));
    return mix(0.46, 0, daylight);
  }
  const moonlight = smoothstep(Math.sin(moon.progress * Math.PI));
  return mix(0.46, 1, moonlight);
}

function render(force = false) {
  const metrics = getSceneMetrics();
  state.metrics = metrics;
  const layoutState = layoutObstaclesForPhase(metrics, state.orbitPhase);
  state.sun = layoutState.bodies.sun;
  state.moon = layoutState.bodies.moon;

  paintOrb(sunOrb, state.sun, "--sun-size");
  paintOrb(moonOrb, state.moon, "--moon-size");

  const blend = themeBlendForBodies(state.sun, state.moon);
  applyTheme(blend, state.sun, state.moon, metrics);
  statPhase.textContent = phaseLabel(blend);

  const key = layoutSignature(metrics, layoutState.obstacles);
  if (!force && key === state.layoutKey) return;
  state.layoutKey = key;

  const lines = buildLayout(metrics, layoutState.obstacles);
  renderLines(lines);
  state.lastLayoutBodies = {
    sunX: state.sun.x,
    sunY: state.sun.y,
    moonX: state.moon.x,
    moonY: state.moon.y
  };
}

function requestRender() {
  measureTopClearance();
  measureVillageContour();
  state.layoutKey = "";
  render(true);
}

function animate(now) {
  if (!prefersReducedMotion.matches) {
    state.orbitPhase = state.orbitOffset + now * ORBIT_SPEED;
  } else {
    state.orbitPhase = state.orbitOffset;
  }

  const metrics = getSceneMetrics();
  const bodies = orbitBodies(metrics, state.orbitPhase);
  const last = state.lastLayoutBodies;
  const maxMove = last
    ? Math.max(
      Math.hypot(bodies.sun.x - last.sunX, bodies.sun.y - last.sunY),
      Math.hypot(bodies.moon.x - last.moonX, bodies.moon.y - last.moonY)
    )
    : Infinity;

  const blend = themeBlendForBodies(bodies.sun, bodies.moon);
  applyTheme(blend, bodies.sun, bodies.moon, metrics);
  statPhase.textContent = phaseLabel(blend);
  state.metrics = metrics;
  state.sun = bodies.sun;
  state.moon = bodies.moon;
  paintOrb(sunOrb, state.sun, "--sun-size");
  paintOrb(moonOrb, state.moon, "--moon-size");

  if (!state.lastLayoutBodies || (now - state.lastLayoutTime >= RELAYOUT_INTERVAL && maxMove >= RELAYOUT_DISTANCE)) {
    state.lastLayoutTime = now;
    requestRender();
  }

  window.requestAnimationFrame(animate);
}

function syncControls() {
  fontSizeValue.textContent = `${state.fontSize} px`;
  lineHeightValue.textContent = `${state.lineHeight} px`;
}

function resetOrbit() {
  state.orbitOffset = -Math.PI * 0.22;
  state.orbitPhase = state.orbitOffset;
  requestRender();
}

fontSizeInput.addEventListener("input", () => {
  state.fontSize = Number(fontSizeInput.value);
  syncControls();
  requestRender();
});

lineHeightInput.addEventListener("input", () => {
  state.lineHeight = Number(lineHeightInput.value);
  syncControls();
  requestRender();
});

resetOrbitButton.addEventListener("click", resetOrbit);

window.addEventListener("resize", requestRender);
prefersReducedMotion.addEventListener("change", requestRender);
villageImage?.addEventListener("load", requestRender);

if (document.fonts?.ready) {
  document.fonts.ready.then(() => requestRender());
}

syncControls();
requestRender();
window.requestAnimationFrame(animate);
