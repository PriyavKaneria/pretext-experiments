# Diginova Experiment Roadmap

This document is the working order for the full experiment series.

Use it as:
- the canonical sequence for what to build
- a parallel work queue when multiple experiments can move at once
- a quick reminder of the visual and technical bar for each piece

## Shared Direction

All experiments should feel:
- clean
- minimal
- dark and editorial
- interactive for normal people, not internal demos
- typography-led rather than effect-led

Keep the same overall quality bar across the series:
- no noisy UI chrome
- text remains readable even when the interaction is dramatic
- controls should feel like creative tools, not dev controls
- each page should be a standalone experience inside the common dashboard

## Status

### Live Now

1. Text-in-Any-Shape Studio

### Next In Order

2. Typographic Eclipse
3. Magnetic Force-Field Text
4. Sentence Metamorphosis
5. Morphing Logo Fill
6. Liquid Mercury Text
7. Editorial Obstacle Playground
8. Translation Ribbon
9. Music-Responsive Kinetic Lyrics
10. Data Rivers & Typographic Sculptures
11. Scroll-Balanced Poetry
12. Multilingual Text Fireworks
13. Particle Text Universes
14. Infinite 3D Text Worlds

## Build Order

### 1. Text-in-Any-Shape Studio

Goal:
Build the core shape-bound text editor and composition engine.

Why first:
It establishes the reusable geometry, layout, export, and editing primitives that later pages can borrow.

Core interactions:
- multiple closed shapes
- per-shape text binding
- point editing
- SVG import
- font controls
- export

Parallel notes:
- Keep refining this while later experiments begin
- This is the base system others will reuse

### 2. Typographic Eclipse

Goal:
A drifting circle or lens bends paragraphs around a moving void.

Why second:
It can reuse the obstacle and text-routing logic from the shape work, but presents it in a much more focused, cinematic way.

Core interactions:
- draggable eclipse body
- live rerouting around the eclipse
- subtle motion and atmospheric gradients

Parallel notes:
- can start once obstacle-aware routing is stable
- should stay visually quieter than most other pieces

### 3. Magnetic Force-Field Text

Goal:
Text flows around one or more cursor-driven magnetic fields and snaps back into order.

Why third:
It extends live geometry deformation and is a strong showcase for interactive layout.

Core interactions:
- cursor magnets
- optional multiple magnets
- smooth settle-back behavior

Parallel notes:
- can share field math and camera patterns with Eclipse

### 4. Sentence Metamorphosis

Goal:
One sentence transforms into another through beautifully measured intermediate states.

Why fourth:
This is more choreography and transition design than geometry editing, so it benefits from the typography system already being mature.

Core interactions:
- source/target sentence pair
- scrub or autoplay morph
- multilingual support

Parallel notes:
- can be developed independently from the shape editor

### 5. Morphing Logo Fill

Goal:
A logo or mark becomes a text vessel and reshapes as the mark changes.

Why fifth:
This leverages the shape-bound text engine directly and makes it brand-friendly.

Core interactions:
- upload or paste logo SVG
- animate between logo states
- keep text readable inside the mark

Parallel notes:
- can share large chunks of the Text-in-Any-Shape code

### 6. Liquid Mercury Text

Goal:
Type drips, merges, and reforms while remaining readable.

Why sixth:
This needs a more mature motion system to avoid looking gimmicky.

Core interactions:
- drag to deform
- resize/scroll responsive reflow
- controlled fluidity, not chaos

Parallel notes:
- strong art direction required before implementation expands

### 7. Editorial Obstacle Playground

Goal:
Move editorial blocks, images, and rules around a page while article text reflows around them.

Why seventh:
It is a more design-system-like application of the same routing primitives.

Core interactions:
- draggable obstacles
- multi-column composition
- live editorial page balance

Parallel notes:
- shares routing logic with Eclipse

### 8. Translation Ribbon

Goal:
A sentence glides between languages and scripts while keeping rhythm and composition.

Why eighth:
This is a cleaner, more focused multilingual transition study before the louder multilingual fireworks piece.

Core interactions:
- language sequence
- smooth language-to-language morph
- script-aware typography

Parallel notes:
- can share parts of Sentence Metamorphosis

### 9. Music-Responsive Kinetic Lyrics

Goal:
Lyrics pulse, stretch, and rejustify to music in real time.

Why ninth:
Audio analysis and timing add more complexity, so it should come after the visual language is stable.

Core interactions:
- audio input
- beat-responsive motion
- lyric reflow

Parallel notes:
- likely deserves its own small playback/control system

### 10. Data Rivers & Typographic Sculptures

Goal:
Live data streams become readable moving typographic forms.

Why tenth:
By here the project can support richer motion, live inputs, and more ambitious composition.

Core interactions:
- live or simulated feeds
- river/sculpture layouts
- readable yet expressive data motion

Parallel notes:
- can begin with mocked data before real integrations

### 11. Scroll-Balanced Poetry

Goal:
Poems subtly rebalance while the reader scrolls.

Why eleventh:
This is a quieter piece that can refine the series after several bigger demos exist.

Core interactions:
- scroll-driven rebalance
- minimal interface
- elegant pacing

Parallel notes:
- should be the calmest page in the set

### 12. Multilingual Text Fireworks

Goal:
Mixed-language text explodes into glyph particles and reforms into coherent paragraphs.

Why twelfth:
This should come after multilingual correctness is already trusted.

Core interactions:
- explosion/reassembly
- mixed scripts
- clear reformation into readable layout

Parallel notes:
- shares some DNA with particle and metamorph pieces

### 13. Particle Text Universes

Goal:
Text becomes constellations or particle fields, then reforms into messages.

Why thirteenth:
It is visually fun, but less foundational than the layout-first experiments above.

Core interactions:
- click to disperse
- particle simulation
- snap-back into text

Parallel notes:
- should only proceed if it can still feel tasteful

### 14. Infinite 3D Text Worlds

Goal:
Words wrap onto rotating 3D forms and moving worlds.

Why last:
This is the most technically and aesthetically risky piece, so it should come after the 2D language is fully established.

Core interactions:
- 3D object-bound text
- hover or interaction-driven sentence changes
- readable placement on complex surfaces

Parallel notes:
- likely requires a separate rendering stack

## Parallel Work Plan

If working in parallel, use this grouping:

### Track A: Core Layout Systems

1. Text-in-Any-Shape Studio
2. Typographic Eclipse
3. Editorial Obstacle Playground
4. Morphing Logo Fill

### Track B: Motion And Transformation

1. Sentence Metamorphosis
2. Translation Ribbon
3. Liquid Mercury Text
4. Magnetic Force-Field Text

### Track C: Spectacle Pieces

1. Music-Responsive Kinetic Lyrics
2. Data Rivers & Typographic Sculptures
3. Multilingual Text Fireworks
4. Particle Text Universes
5. Infinite 3D Text Worlds

## Reuse Opportunities

These pieces should share infrastructure wherever possible:

- shape-bound text layout:
  Text-in-Any-Shape Studio
  Morphing Logo Fill
  Typographic Eclipse
  Editorial Obstacle Playground

- transition systems:
  Sentence Metamorphosis
  Translation Ribbon

- particle/motion systems:
  Magnetic Force-Field Text
  Multilingual Text Fireworks
  Particle Text Universes

- live input systems:
  Music-Responsive Kinetic Lyrics
  Data Rivers & Typographic Sculptures

## Definition Of Done For Each Experiment

Before considering a page done:

1. It should feel good to a normal person with no explanation.
2. The typography should remain readable during the core interaction.
3. The control surface should feel intentional and minimal.
4. It should fit cleanly inside the shared dashboard.
5. It should look good on both desktop and mobile, unless the experiment is explicitly desktop-first.
