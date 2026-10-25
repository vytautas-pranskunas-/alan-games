# TOXIC ZONE // Visual Identity & Style Guide Specification
**Version:** 1.0.0
**Project:** Toxic Zone — Indie Game Developer Portfolio (Young Creator / 11yo Prodigy)
**Target Platform:** Web (Desktop First, Responsive Mobile Companion)
**Active Design Token Preset:** Pixel Vanguard (`#22C55E` Neon Green on `#060E20` Deep Obsidian)

---

## 1. Brand Identity & Creative Philosophy

### Concept & Personality
- **Name:** **TOXIC ZONE**
- **Brand Archetype:** Cyber Arcade // Indie Game Lab.
- **Narrative:** High-energy, passionate, and inspiring game maker studio run by an 11-year-old creator. It balances authentic gamer grit (radioactive neon, scanlines, HUD targeting brackets, terminal code logs) with clean, minimalist modern ergonomics (generous whitespace, pristine typography, uncluttered layouts).
- **Core Emotional Tone:** Exciting, tech-forward, welcoming, and empowering — never sloppy or childishly toy-like.

---

## 2. Color Palette & Hierarchy

### A. Deep Surface Palette (The "Dark Outframe")
The outframe and canvas leverage deep midnight tones with subtle navy undertones to provide depth and contrast against vibrant neon elements.

| Role | Token / Name | Hex Code | Purpose & Usage |
|---|---|---|---|
| **App Canvas / Deep Outframe** | `bg-base` | `#060E20` | Fullscreen backdrop, root app frame |
| **Primary Surface** | `surface-dim` | `#0B1326` | Main content container, header background |
| **Card / Elevated Surface** | `surface-card` | `#131B2E` | Game cards, incubator proposal containers |
| **High Surface / Hover** | `surface-hover` | `#1E2942` | Interactive card hovers, elevated modals |
| **Hairline Dividers** | `border-subtle` | `rgba(255, 255, 255, 0.08)` or `#1E2942` | 1px crisp borders, section dividers |

### B. Core Accent: Toxic Neon Green (Primary Signature)
Used strictly for key actions, brand marks, and active state highlights.

| Role | Hex Code | Tailwind Equiv. | Usage Rules |
|---|---|---|---|
| **Toxic Green (Primary)** | `#22C55E` | `text-green-500` / `bg-green-500` | Active navigation pills, "Play" CTAs, brand emblems |
| **Lime Glow / Core** | `#4ADE80` | `text-green-400` | Terminal code prompts, hover highlights, glowing badges |
| **Deep Forest Shade** | `#15803D` | `bg-green-700` | Gradient depths, button active states |
| **Ambient Neon Aura** | `rgba(34, 197, 94, 0.20)` | `shadow-[0_0_20px_#22c55e33]` | Ambient glow for cards, active buttons, and badges |

### C. Secondary & Multi-Engine Semantics
Accents are assigned semantically to represent different game engines and mechanics.

- **Godot 4 & Electric Tech:** `#38BDF8` (Sky / Cyan) — Engine badges, FPS telemetry, grapple mechanics.
- **Concepts & Brainstorms:** `#A855F7` (Cyber Violet) — Game ideas lab, experimental mechanics, audio tags.
- **Milestones & Trophies:** `#F59E0B` (Arcade Amber) — Community votes, game jam awards, ratings.
- **Live Status:** `#00FF66` — Pulsing "ONLINE // CODING GAMES" presence indicators.

### D. Typography & Contrast Hierarchy
- **Headline / Primary Text:** `#FFFFFF` (100% Crisp White, font-weight 700–900).
- **Secondary Body Text:** `#94A3B8` (Slate 400, high readability against `#0B1326`).
- **Muted Meta / Microcopy:** `#64748B` (Slate 500, timestamps, copyright lines).
- **Inverted Button Text:** When `#22C55E` is the button background, button label must be **Pure Pitch Black** (`#060E20` or `#000000`) with font-weight 800 for WCAG AAA compliance.

---

## 3. Typography Rules & Scales

### Typeface Pairing
1. **Primary Display & Headings:** `Outfit` (Alternative: `Space Grotesk`)
   - Geometric, crisp uppercase numbers, punchy modern curves.
2. **Body & UI Elements:** `Inter` or `system-ui, -apple-system, sans-serif`
   - Maximum clarity across both desktop and mobile resolutions.
3. **Telemetry & Terminal Labels:** `JetBrains Mono` or `Courier New, monospace`
   - Prefixed with double slashes (e.g. `// SPOTLIGHT RELEASE`, `// CATALOG`, `// SYS.CORP`).

### Hierarchy Matrix
- **Hero Title:** `clamp(2.5rem, 5vw, 4rem)` (40px–64px) / Font Weight: 900 (`font-black`)
- **Section Titles:** `1.75rem` (28px) / Font Weight: 800 (`font-extrabold`) / Tracking: `-0.02em`
- **Card Titles:** `1.25rem` (20px) / Font Weight: 700 (`font-bold`)
- **Body Regular:** `0.9375rem` (15px) / Line Height: 1.6 / Color: `#94A3B8`
- **Monospace HUD Tags:** `0.75rem` (12px) / Letter Spacing: `0.15em` / Uppercase

---

## 4. Brand Mark & Logo Usage (`Toxic Zone`)

### Official Assets
- **Primary Emblem:** Glowing radioactive hazard icon fused with retro arcade crosshair and D-pad arrows.
- **Wordmark:** Bold uppercase `TOXIC ZONE` in toxic neon green (`#22C55E`).
- **Isolation Rules:**
  - Background must always be deep obsidian (`#060E20` to `#0B1326`).
  - No subtext tags ("Game Studio", "Indie Games") — keep the mark pure and minimalist.
  - Maintain a minimum clear space equal to 50% of the emblem width on all sides.

---

## 5. UI Components & Layout Structure

### A. The Signature 3-Button Navigation Dock
The persistent top navigation header features a centered pill bar with the 3 canonical routes:
1. **Games** (Catalog of playable web builds & engine demos)
2. **About Me** (Bio, timeline, coding tools, parent-supervised contact)
3. **Ideas** (Incubator, community votes, upcoming prototypes)

**Button Styling:**
- Inactive: Ghost pill (`text-slate-300`, hover: `bg-slate-800/60 text-white`).
- Active: Solid neon pill (`bg-[#22C55E] text-[#060E20] font-extrabold shadow-[0_0_15px_rgba(34,197,94,0.4)]`).

### B. Cards & Elevating Panels
- **Border Radius:** `16px` (`rounded-2xl`) for main game cards; `8px` (`rounded-lg`) for sub-badges.
- **Borders:** `1px solid rgba(255, 255, 255, 0.08)`.
- **Hover State:** Transform `translateY(-4px)` with border color shifting to `#22C55E` at 30% opacity and subtle ambient shadow.

### C. HUD & Gamer Micro-Details
- Corner bracket accents (`M 0 0 L 12 0 L 12 12`).
- Terminal status pills: `// STATUS: ONLINE // BUILDING GAMES`.
- Interactive chips for engines: `Godot 4`, `Scratch`, `Roblox Studio`, `Pygame`.

---

## 6. Implementation Snippets (Tailwind CSS)

```html
<!-- Example: Primary Toxic Action Button -->
<button class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#22C55E] hover:bg-[#4ADE80] text-[#060E20] font-bold text-sm tracking-wide transition-all duration-200 shadow-[0_0_20px_rgba(34,197,94,0.35)] hover:shadow-[0_0_25px_rgba(34,197,94,0.6)]">
  <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
  Play Game in Browser
</button>

<!-- Example: Cyber Card Container -->
<div class="relative bg-[#131B2E] border border-white/10 hover:border-[#22C55E]/40 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(6,14,32,0.8)]">
  <div class="text-xs font-mono font-bold text-[#4ADE80] tracking-wider uppercase mb-2">// SPOTLIGHT RELEASE</div>
  <h3 class="text-xl font-extrabold text-white">Pixel Dino Quest</h3>
  <p class="text-slate-400 text-sm mt-1">Retro platformer coded in Godot 4.</p>
</div>
```
