---
name: pretext-ui-lab
description: Design and implement UI/UX experiments with the `@chenglou/pretext` multiline text measurement and layout library. Use when Codex needs to prototype or refine text-heavy interfaces that benefit from browser-free height estimation, manual line layout, shrink-wrapped text blocks, variable-width line flow, obstacle-aware editorial composition, canvas/SVG text rendering, or multilingual typography experiments.
---

# Pretext Ui Lab

## Overview

Use this skill to turn `pretext` into concrete, visually interesting interface prototypes instead of generic text demos. Favor experiments where text measurement or line breaking is the interaction primitive: responsive headlines, editorial spreads, speech bubbles, live relayout, scroll anchoring, or custom text containers.

## Quick Start

1. Read [references/pretext-reference.md](./references/pretext-reference.md) for the API surface and caveats.
2. Read [references/experiment-playbook.md](./references/experiment-playbook.md) when the user wants novel directions or a stronger visual/interaction concept.
3. Pick the right API tier:
   - Use `prepare()` + `layout()` when the goal is accurate paragraph height or line count without DOM measurement.
   - Use `prepareWithSegments()` + `layoutWithLines()` when the goal is rendering explicit lines in DOM, canvas, or SVG.
   - Use `walkLineRanges()` when the goal is searching for a pleasing width or inspecting line widths cheaply.
   - Use `layoutNextLine()` when each line may have a different width, such as obstacle avoidance or shaped containers.
4. Keep `font` and `lineHeight` aligned with the actual rendered styles. Treat mismatched typography settings as a likely bug source before changing logic.
5. Validate with multilingual and edge-case strings, not just short English labels.

## Workflow

### 1. Classify The Experiment

- Height prediction: virtualization, pre-sizing cards, preventing layout shift, preserving scroll position.
- Fixed-width line layout: balanced headlines, shrink-wrap bubbles, canvas/SVG paragraphs, custom clipping or masking.
- Variable-width flow: text around images, editorial spreads, irregular containers, shape-aware reading experiences.

### 2. Build A Minimal But Expressive Prototype

- Prefer a small runnable demo over abstract utility code.
- Keep the first prototype visually intentional. Use typography, spacing, motion, and container shape to make the text behavior obvious.
- Reach for canvas or SVG only when the experiment benefits from explicit text placement. Stay in DOM when the main need is measurement and layout intelligence.

### 3. Use Pretext As The Layout Engine

- Run `prepare()` or `prepareWithSegments()` once per text/font combination and reuse the prepared value.
- Treat `layout()` as the cheap hot path for width changes.
- For width-search problems, call `walkLineRanges()` repeatedly to test candidate widths before generating final lines.
- For path-dependent layouts, advance line-by-line with `layoutNextLine()` and derive the next width from geometry, scroll state, or surrounding content.

### 4. Stress The Edges

- Test with long words, emoji, mixed bidi content, CJK, and very narrow widths.
- Watch for font loading assumptions. If the experiment depends on a web font, make sure the font is available before trusting measurements.
- Remember that upstream recommends named fonts rather than `system-ui` on macOS when accuracy matters.

## Default Patterns

- For balanced or shrink-wrapped text blocks, search for a width that produces a visually pleasing line count and max line width, then render with `layoutWithLines()`.
- For text flowing around shapes, compute per-line available width from geometry and feed that into `layoutNextLine()`.
- For responsive cards, measure likely copy variants ahead of render with `prepare()` + `layout()` and size the shell before content swaps in.
- For expressive typography, animate width, obstacle position, or line-height-adjacent layout parameters while reusing the prepared text state.

## Output Expectations

When using this skill, default to producing:

- A runnable experiment, not only helper functions.
- A short explanation of which `pretext` API is being used and why.
- A few deliberately chosen sample strings that reveal line-breaking behavior.
- A compact note about typography assumptions: font, line height, width model, and any accuracy caveats.

## Resources

- [references/pretext-reference.md](./references/pretext-reference.md)
  Use for API selection, setup details, and correctness caveats.
- [references/experiment-playbook.md](./references/experiment-playbook.md)
  Use for ideation, composition patterns, and experiment prompts.

## Example Requests

- Build an editorial landing page where a headline reflows around a moving shape using `pretext`.
- Prototype speech bubbles that shrink-wrap multilingual text without measuring the DOM.
- Create a canvas-based poem layout where each resize recomputes balanced lines.
- Measure card copy ahead of render so a masonry grid can place items without layout shift.
