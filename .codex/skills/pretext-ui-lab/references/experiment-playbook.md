# Experiment Playbook

## Goal

Use `pretext` for interfaces where text layout is an active design material, not just a final rendering detail.

## Strong Experiment Directions

### Balanced Headline Composer

- Search for a width that yields a visually satisfying line count and low rag.
- Render per-line motion, opacity, or mask effects after `layoutWithLines()`.
- Use for hero sections, poem layouts, or title cards.

### Shrink-Wrap Bubble System

- Use `walkLineRanges()` or `layoutWithLines()` to derive the tightest useful container width.
- Drive bubble size from text instead of CSS guesswork.
- Use for chat UIs, annotations, captions, or comic-style callouts.

### Obstacle-Aware Editorial Flow

- Compute a different available width for each row.
- Feed widths into `layoutNextLine()` while an image, logo, or shape occupies part of the column.
- Use for magazine layouts, kinetic landing pages, or narrative scrollytelling.

### Scroll-Stable Copy Swaps

- Measure incoming text before it renders.
- Pre-size containers to reduce layout shift and maintain anchored reading positions.
- Use for localization previews, live content refreshes, or AI-generated copy.

### Shape-Reactive Typography

- Animate the obstacle or container geometry and relayout on each frame or interaction step.
- Keep the visual emphasis on how lines redistribute.
- Use for playful hero sections and exploratory storytelling pieces.

## Design Bias

- Make the text behavior legible. The viewer should understand what changed and why.
- Prefer one bold interaction idea over many small effects.
- Pair the layout logic with typography, spacing, and background treatment that support the concept.
- Avoid "generic app" styling unless the user explicitly wants product UI instead of an experiment.

## Build Strategy

1. Start with one paragraph and one interaction rule.
2. Make the geometry visible with guides, outlines, or overlays while iterating.
3. Once the line logic works, refine the visual system.
4. Add controls only if they help explore the layout space.

## Useful Prompt Shapes

- "Build a poetic landing page where text wraps around a drifting orb."
- "Prototype a multilingual bubble layout using `pretext` instead of DOM measurement."
- "Make a canvas text composition that rebalances lines as the viewport changes."
- "Create an editorial spread with a fixed-height column and obstacle-aware text flow."

## Anti-Patterns

- Do not use `pretext` if plain CSS already solves the request cleanly and the experiment is not about custom text behavior.
- Do not trust measurements if the loaded font does not match the `font` shorthand passed into `pretext`.
- Do not validate only with short ASCII strings.
