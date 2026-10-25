---
name: Pixel Vanguard
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bccbb9'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#869585'
  outline-variant: '#3d4a3d'
  surface-tint: '#4ae176'
  primary: '#4be277'
  on-primary: '#003915'
  primary-container: '#22c55e'
  on-primary-container: '#004b1e'
  inverse-primary: '#006e2f'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#deb8ff'
  on-tertiary: '#490080'
  tertiary-container: '#cb94ff'
  on-tertiary-container: '#5f00a3'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6bff8f'
  primary-fixed-dim: '#4ae176'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005321'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#f0dbff'
  tertiary-fixed-dim: '#ddb7ff'
  on-tertiary-fixed: '#2c0051'
  on-tertiary-fixed-variant: '#6900b3'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-xl:
    fontFamily: Outfit
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
  headline-xl-mobile:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
  headline-lg:
    fontFamily: Outfit
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
  headline-lg-mobile:
    fontFamily: Outfit
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Outfit
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system expresses the sharp precision of modern indie game design viewed through the eyes of an inventive 11-year-old creator. It merges a sleek, dark canvas with high-energy arcade vitality—avoiding patronizing "toddler" tropes in favor of an aspirational, creator-first aesthetic reminiscent of modern game engines and developer terminals.

The mood is confident, punchy, and organized. It reflects disciplined creative work (coding, pixel craft, game mechanics) while preserving raw playful joy. The visual language blends:
- **Dark Minimalism:** Uncluttered slate surfaces, generous negative space, and disciplined layout grids that let interactive games and prototypes take center stage.
- **Electric Accentuation:** High-luminescence neon limes and emerald greens that guide focus, evoke game UI energy bars, and signal active states.
- **Tactile Softness:** Subtly rounded cards, glowing state boundaries, and distinct pill badges that make navigating engine categories (Roblox, Unity, Scratch, Python) instantly legible and rewarding.

## Colors

The palette relies on deep, light-absorbing slate foundations to create contrast for vibrant neon tones:

- **Canvas & Surfaces:** The root canvas rests on an obsidian slate (`#0b0f19`), with elevated cards and panels shifting to midnight slate (`#111827`) and elevated interactive states at `#1e293b`.
- **Primary Accent (`#22c55e` / Electric Lime Green):** The primary pulse of the UI. Used for primary CTA buttons, active game state indicators, progress rings, and key headline callouts.
- **Secondary Accent (`#06b6d4` / Cyber Cyan):** Deployed for technical tags (Python, Unity), system messages, and secondary interactive affordances.
- **Tertiary Accent (`#a855f7` / Synth Violet):** Used selectively for imaginative and prototype elements (Scratch badges, creative concept logs, experimental game mechanics).
- **Text & Hierarchy:** Primary text sits at pure high-readability off-white (`#f8fafc`). Secondary descriptions use muted silver (`#94a3b8`), while borders and structural dividers remain restrained at `#334155` with low-opacity alpha layers.

## Typography

Typography balances geometric playfulness with technical precision:

- **Headlines (Outfit):** Delivers geometric confidence, large open counters, and a modern digital arcade spirit. It makes hero game titles and section headings look punchy and accessible.
- **Body Text (Plus Jakarta Sans):** Provides supreme legibility, welcoming curves, and clean spacing for storytelling, project breakdowns, and creator reflections.
- **Metadata & Badges (JetBrains Mono):** Injects an authentic "code-literate" signature for badges, tech stacks, release dates, and version tags, celebrating the creator's genuine programming journey.

## Layout & Spacing

The layout is built around a flexible 12-column system on desktop and a direct 4-column system on mobile devices, calibrated for fast vertical browsing and immediate game exploration:

- **Desktop (min-width: 1024px):** 12 columns with a maximum content container width of 1140px centered horizontally. Generous whitespace frames every card, avoiding the dense cognitive overload typical of adult developer tools.
- **Tablet (768px - 1023px):** 8 columns with 1.25rem gutters. Dual-card game listings reflow effortlessly.
- **Mobile (< 768px):** 4 columns with 1rem gutters and 1.25rem canvas margin. Game cards collapse into single-column vertical display feeds with edge-to-edge preview headers.
- **Navigation Architecture:** A streamlined three-tab primary navigation bar (`Games`, `About Me`, `Ideas`) stays pinned or floating at the top of the viewport, maintaining an uncluttered, focused layout.

## Elevation & Depth

Visual hierarchy leverages dark surface containment paired with electric luminous halos:

- **Base Ground:** Slate canvas (`#0b0f19`) sits at ground zero.
- **Tier 1 (Surface Containers):** Game cards, bio panels, and prototype entries use `#111827` bordered by a 1px crisp outline of `rgba(255, 255, 255, 0.08)`.
- **Tier 2 (Elevated & Hover):** On hover or interaction, cards shift border color to `rgba(34, 197, 94, 0.4)` accompanied by a soft, diffused neon aura: `box-shadow: 0 12px 30px -10px rgba(34, 197, 94, 0.25)`.
- **Floating Controls (Overlays & Dialogs):** Modals, game test overlays, and mobile floating nav bars sit on `#1e293b` with a backdrop blur of `16px` and an ambient perimeter shadow (`0 20px 40px rgba(0, 0, 0, 0.6)`).

## Shapes

The design uses a balanced rounded radius structure (Level 2). This creates a friendly and touchable feel without sliding into cartoonish bubble shapes:

- Standard controls, inputs, and micro-badges use a `0.5rem` (8px) radius.
- Cards, containers, and game canvases apply `1rem` (16px) radius (`rounded-lg`).
- Feature highlight banners and major dialog frames use `1.5rem` (24px) radius (`rounded-xl`).
- Pill shapes are reserved exclusively for engine badges, status chips (e.g., "In Development", "Playable"), and primary navigation pills.

## Components

### Buttons
- **Primary Action (Play Game / Test Build):** Solid electric green (`#22c55e`) background with bold dark slate text (`#0b0f19`). Includes subtle scale-up transition on hover (`scale: 1.02`) and a localized green glow.
- **Secondary Action (View Code / Read Docs):** Transparent surface with a 1px border (`#334155`), white text (`#f8fafc`), and a slate hover background (`#1e293b`).
- **Icon Action:** High-contrast rounded square (40x40px) with central game controller or code glyphs.

### Game Cards
- **Structure:** Clean vertical card layout with a 16:9 thumbnail frame at the top, followed by generous padding (`space-lg`), headline, one-line summary, platform badges, and dual action links ("Play Now", "Details").
- **State Feedback:** Smooth micro-transform on pointer hover with vibrant green border accentuation.

### Platform & Tech Badges
- **Format:** Pill-shaped inline badges utilizing JetBrains Mono (`label-sm`).
- **Category Coding:**
  - **Roblox:** Vibrant red-orange tint (`rgba(239, 68, 68, 0.15)`) with crimson typography.
  - **Scratch:** Playful amber tint (`rgba(245, 158, 11, 0.15)`) with warm gold typography.
  - **Unity:** Crisp cyan tint (`rgba(6, 182, 212, 0.15)`) with cyan typography.
  - **Python / Logic:** Emerald lime tint (`rgba(34, 197, 94, 0.15)`) with green typography.
  - **Pixel Art:** Purple tint (`rgba(168, 85, 247, 0.15)`) with lavender typography.

### Input Fields & Search
- Low-profile charcoal fill (`#111827`), inset 1px border (`#334155`), with focus transition switching border to active neon green and a faint emerald halo.

### Selection Controls (Checkboxes & Radios)
- Rounded geometric toggles that fill with electric green and display crisp white checkmarks or inner dots.

### "Ideas" Feature Pad
- Interactive scratchpad-style cards with dashed borders (`rgba(255, 255, 255, 0.15)`), lightbulb icon badges, and status pills ("Brainstorm", "Prototyping", "Next Up") designed to display upcoming game mechanics and player feedback.