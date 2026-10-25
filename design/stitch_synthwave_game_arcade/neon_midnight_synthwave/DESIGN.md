---
name: Neon Midnight Synthwave
colors:
  surface: '#121222'
  surface-dim: '#121222'
  surface-bright: '#38374a'
  surface-container-lowest: '#0c0c1d'
  surface-container-low: '#1a1a2b'
  surface-container: '#1e1e2f'
  surface-container-high: '#29283a'
  surface-container-highest: '#333345'
  on-surface: '#e3e0f8'
  on-surface-variant: '#cfc2d6'
  inverse-surface: '#e3e0f8'
  inverse-on-surface: '#2f2f40'
  outline: '#988d9f'
  outline-variant: '#4d4354'
  surface-tint: '#ddb7ff'
  primary: '#ddb7ff'
  on-primary: '#490080'
  primary-container: '#b76dff'
  on-primary-container: '#400071'
  inverse-primary: '#842bd2'
  secondary: '#ffb0cd'
  on-secondary: '#640039'
  secondary-container: '#aa0266'
  on-secondary-container: '#ffbad3'
  tertiary: '#4cd7f6'
  on-tertiary: '#003640'
  tertiary-container: '#009eb9'
  on-tertiary-container: '#002f38'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#f0dbff'
  primary-fixed-dim: '#ddb7ff'
  on-primary-fixed: '#2c0051'
  on-primary-fixed-variant: '#6900b3'
  secondary-fixed: '#ffd9e4'
  secondary-fixed-dim: '#ffb0cd'
  on-secondary-fixed: '#3e0022'
  on-secondary-fixed-variant: '#8c0053'
  tertiary-fixed: '#acedff'
  tertiary-fixed-dim: '#4cd7f6'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#121222'
  on-background: '#e3e0f8'
  surface-variant: '#333345'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: '0'
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Outfit
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Outfit
    fontSize: 13px
    fontWeight: '300'
    lineHeight: 20px
  label-lg:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.06em
  label-md:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.08em
  label-sm:
    fontFamily: Space Mono
    fontSize: 10px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0.1em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system synthesizes raw 1980s synthwave futurism with contemporary digital minimalism. Rather than leaning into cluttered retro clutter or skeuomorphic scanlines, it approaches cyberpunk through an editorial lens: disciplined negative space, sharp grid geometry, precise neon vectors, and high-impact optical glows.

### Aesthetic Principles
- **Atmospheric Void:** Deep midnight-navy tones form an uninterrupted, light-absorbing canvas that provides limitless dynamic range for luminance accents.
- **Controlled Luminescence:** Neon accents (purple, magenta, cyan) are used surgically as focused sources of visual energy and directional signposting, never as ambient wash or decorative noise.
- **Architectural Wireframes:** Subtle structural grids and 1px vector rails ground content areas, nodding to early vector graphics while enforcing rigorous layout discipline.
- **Precision Engineered:** Ultra-refined pill capsules, hair-thin optical borders, and sharp typographic hierarchy deliver a futuristic aesthetic tailored for data-dense, mission-critical interfaces.

## Colors

The palette revolves around deep spatial depths disrupted by electric neon spectrum highlights. High dynamic contrast ensures optimal legibility and focused interaction states.

### Palette Matrix
- **Base Surfaces:**
  - `Canvas / Background`: `#0a0a1a` (deep midnight void)
  - `Surface Container`: `#0d0f28` (midnight navy tier 1)
  - `Surface Elevated / Modal`: `#14183e` (midnight navy tier 2)
  - `Surface Highlight / Wireframe`: `rgba(34, 211, 238, 0.08)` (electric rail tone)
- **Neon Spectrum Accents:**
  - `Primary (Electric Violet)`: `#a855f7` (base), `#c084fc` (radiant hover)
  - `Secondary (Hot Synth Magenta)`: `#ec4899` (base), `#f43f5e` (active pulse)
  - `Tertiary (Cyber Cyan)`: `#06b6d4` (base), `#22d3ee` (focus highlight)
- **Text & Foreground:**
  - `Text Primary`: `#f8fafc` (high-contrast crisp white)
  - `Text Secondary`: `#94a3b8` (muted cool slate)
  - `Text Glow Accent`: `#e0e7ff` with selective cyan/purple drop-shadows

### Application Rules
- Maintain an 85/15 distribution ratio: 85% deep spatial dark surfaces, 15% combined neon accents and structural wireframes.
- Never use solid bright neon for large container fills; use them exclusively for active badges, state indicators, interactive edges, and focal CTAs.

## Typography

The type system balances technical retro-futurism with fluid readability across viewport scales.

- **Headlines (Space Grotesk):** Engineered geometric grotesque with idiosyncratic cuts that evoke digital schematics while maintaining balanced structural weight.
- **Body & Continuous Reading (Outfit):** Ultra-clean, contemporary geometric sans-serif offering maximum legibility over deep obsidian backgrounds.
- **Data, Metadata & Code (Space Mono):** Fixed-width telemetry type evoking retro terminals, telemetry HUDs, and wireframe tags. Set in small sizes with extended tracking for badges, stats, and micro-labels.

## Layout & Spacing

Layouts follow a structured 12-column grid system (4 columns on mobile, 8 on tablet) calibrated to an 8px base rhythm.

### Grid Architecture & Spacing
- **Outer Canvas Margins:** `margin` scales down from `3rem` (48px) on desktop to `1.25rem` (20px) on mobile viewports.
- **Internal Column Gutters:** `1.5rem` (24px) for desktop and tablet; compressed to `1rem` (16px) on mobile displays.
- **Structural Reticles & Grids:** Optional visual background grids use 64px x 64px subdivisions rendered in `rgba(6, 182, 212, 0.04)` to provide an architectural canvas framework without impeding foreground content.
- **Responsive Layout Adjustments:** Navigation bars collapse into a thumb-accessible bottom app capsule or a full-screen drawer layered with translucent backdrop filters on viewports below 768px.

## Elevation & Depth

Spatial layering avoids heavy drop shadows in favor of luminous backdrops, surface saturation, and laser-thin border halos.

### Layer Hierarchy
1. **Base Zero (`#0a0a1a`):** Pure background, structural grid plane.
2. **Level 1 Containers (`#0d0f28`):** Surface panels framed with `1px solid rgba(168, 85, 247, 0.15)`.
3. **Level 2 Interactive Cards (`#14183e`):** Floating modules featuring `1px solid rgba(6, 182, 212, 0.3)` and an ambient, low-spread emission blur: `box-shadow: 0 0 20px -5px rgba(6, 182, 212, 0.25)`.
4. **Level 3 Active Overlays & Modals:** Glassmorphic backing with `backdrop-filter: blur(16px)`, background tinted to `rgba(13, 15, 40, 0.85)`, and outer glow: `box-shadow: 0 0 32px -8px rgba(236, 72, 153, 0.35)`.

## Shapes

The design system employs a contrasting shape strategy: crisp pill capsules for primary interactive touchpoints, juxtaposed against clean, subtly rounded structural modules.

- **Primary Controls & Interactive Pills:** Buttons, chips, search inputs, and status badges utilize complete pill radii (`roundedness: 3`), producing aerodynamic, high-tech handheld touch targets.
- **Structural Containers & Cards:** Dashboard tiles and content enclosures retain a strict `rounded-lg` (2rem) or `rounded-md` radius to preserve the architectural, grid-based aesthetic.
- **Wireframe Accents:** Small corner brackets or micro-notches may frame card corners to echo neon HUD interfaces.

## Components

### Buttons
- **Primary Pill:** Full pill radius (`rounded-full`), solid `#a855f7` to `#ec4899` horizontal gradient fill, dark `#0a0a1a` or pure `#ffffff` text in `Space Mono` uppercase. Glow state: `0 0 16px rgba(236, 72, 153, 0.5)`.
- **Secondary Wireframe:** Full pill radius, transparent background, `1px solid #06b6d4`, electric cyan text, subtle hover inner glow: `inset 0 0 12px rgba(6, 182, 212, 0.2)`.
- **Ghost:** Monospace label with an animated underline pulse on hover.

### Chips & Badges
- Pill-shaped status indicators with a 6px circular neon LED pulse indicator.
- Translucent base `rgba(168, 85, 247, 0.12)` bounded by a `1px solid rgba(168, 85, 247, 0.4)` perimeter.

### Form Inputs & Checkboxes
- **Input Fields:** Pill-shaped or soft-rounded enclosures with `#0d0f28` fill and `1px solid rgba(148, 163, 184, 0.2)`. On focus: transition to `1px solid #06b6d4` with an ambient cyan bloom. Space Mono placeholder text.
- **Checkboxes & Radios:** Sharp geometric boundaries paired with electric magenta checkfills and soft neon blooming when checked.

### Cards & Data Modules
- Midnight navy containers (`#0d0f28`) outlined with hair-thin neon purple borders. Headers feature monospace classification tags (e.g., `SYS.01 // METRICS`).
- Subtle wireframe crosshairs (`+`) rendered in low-opacity cyan at container intersections.

### Mobile Navigation Capsule
- Floating bottom bar configured as a compact pill capsule (`backdrop-filter: blur(20px)`, `background: rgba(13, 15, 40, 0.8)`).
- Active navigation items trigger a hot magenta neon pip and cyan label illumination.