# Pretext Reference

## Overview

`pretext` is a JavaScript/TypeScript library for multiline text measurement and layout. Its main value is avoiding DOM reads such as `getBoundingClientRect()` and `offsetHeight` by doing its own measurement pass and then running layout as cheap arithmetic over cached widths.

Package:

```sh
npm install @chenglou/pretext
```

Upstream demo workflow:

```sh
bun install
bun start
```

## API Selection

### 1. Height-Only Measurement

Use when the UI needs reliable text height or line count without rendering first.

```ts
import { prepare, layout } from "@chenglou/pretext";

const prepared = prepare(text, "16px Inter");
const result = layout(prepared, maxWidth, 24);
```

Use this for:

- virtualization and occlusion
- pre-sizing cards or list items
- preventing layout shift during async text updates
- preserving scroll anchoring during content swaps

### 2. Fixed-Width Manual Line Layout

Use when the UI needs explicit line strings.

```ts
import { prepareWithSegments, layoutWithLines } from "@chenglou/pretext";

const prepared = prepareWithSegments(text, '18px "Helvetica Neue"');
const { lines, height } = layoutWithLines(prepared, 320, 26);
```

Use this for:

- canvas or SVG text rendering
- balanced headlines
- speech bubbles and shrink-wrap containers
- text masks, reveals, and per-line effects

### 3. Width Search And Inspection

Use `walkLineRanges()` when the experiment needs line widths or repeated speculative passes before building final strings.

```ts
import { prepareWithSegments, walkLineRanges } from "@chenglou/pretext";

const prepared = prepareWithSegments(text, "16px Inter");
let widest = 0;

walkLineRanges(prepared, 320, line => {
  if (line.width > widest) widest = line.width;
});
```

Useful for:

- shrink-wrap containers
- binary-searching a "nice" width
- computing max line width
- evaluating alternate text widths during interaction

### 4. Variable-Width Line Flow

Use `layoutNextLine()` when each line may have a different width.

```ts
import { prepareWithSegments, layoutNextLine } from "@chenglou/pretext";

const prepared = prepareWithSegments(text, "16px Inter");
let cursor = { segmentIndex: 0, graphemeIndex: 0 };
let y = 0;

while (true) {
  const lineWidth = y < obstacleBottom ? narrowWidth : wideWidth;
  const line = layoutNextLine(prepared, cursor, lineWidth);
  if (line === null) break;
  drawLine(line.text, y);
  cursor = line.end;
  y += 24;
}
```

Useful for:

- text around images or floating objects
- editorial spreads
- irregular or path-driven text containers
- adaptive geometry during animation

## Correctness Rules

- Keep the `font` string synchronized with the actual rendered font shorthand.
- Keep `lineHeight` synchronized with the real line height used by the UI.
- Reuse prepared states when width changes often.
- Treat multilingual testing as required, not optional.
- Use a named font when accuracy matters on macOS; upstream calls out `system-ui` as unsafe for accurate layout there.

## Useful Helpers

- `clearCache()` clears shared internal caches.
- `setLocale(locale?)` changes the locale used for future `prepare()` and `prepareWithSegments()` calls and also clears cache.

## Assumed Text Model

The current target is the common web text setup:

- `white-space: normal`
- `word-break: normal`
- `overflow-wrap: break-word`
- `line-break: auto`

Very narrow widths may still break inside words, but only at grapheme boundaries.

## Good Validation Strings

Use a mix like:

- `AGI 春天到了. بدأت الرحلة`
- `The quick brown fox jumps over the lazy dog.`
- `A button label that is slightly too long for its shell`
- `👨‍👩‍👧‍👦✨📚 mixed emoji + text`
