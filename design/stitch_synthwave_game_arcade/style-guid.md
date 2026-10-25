# Dragon Play — AI Agent Styling & Design System Guide

This guide establishes the complete visual identity, UX guidelines, and implementation rules for any AI agent or frontend engineer developing screens, components, and game showcases for **Dragon Play** (formerly Leo's Arcade).

---

## 1. Brand Essence & Persona

- **Website Name**: Dragon Play (`DRAGON PLAY`)
- **Brand Identity**: Clean 80s Synthwave meets Modern Cyberpunk Arcade.
- **Creator Context**: 11-year-old passionate indie game creator building browser games (Godot, JavaScript, Aseprite).
- **Core Design Ethos**:
  - **Minimalist & Uncluttered**: Generous whitespace, clean visual hierarchy, breathable layouts (never cramped or overwhelming).
  - **Kid-Safe & Friendly**: Wholesome, welcoming, parent-monitored copy and interactions.
  - **Retro-Vibrant**: Deep dark space canvas contrasted with electric neon magenta, cyber purple, and cyan highlights.

---

## 2. Color Palette & Tokens

| Token Name | Hex Code | Purpose / Usage |
| :--- | :--- | :--- |
| **Canvas Background** | `#0a0a16` / `#0c0c1d` | Root background for desktop and canvas screens |
| **Surface Dark** | `#121222` | Card backgrounds, section containers |
| **Surface Container Low** | `#1a1a2b` | Inset blocks, terminal boxes, card footers |
| **Surface High / Hover** | `#242338` | Interactive cards, modal overlays, hovered states |
| **Border Stroke Subdued** | `#25243d` | Subtle dividers and component outlines |
| **Border Stroke Active** | `#3b385e` | Focused inputs, card borders on hover |
| **Neon Cyan (Accent 1)** | `#00f2fe` / `#38bdf8` | Terminal text, highlights, game badges, live status |
| **Neon Magenta (Accent 2)** | `#ec4899` / `#f43f5e` | Primary CTAs, play triggers, hot badges |
| **Electric Purple (Primary)** | `#a855f7` | Active navigation pills, branding gradients, icons |
| **Text High Contrast** | `#f8fafc` | Main headings, game titles, bold statements |
| **Text Muted / Body** | `#94a3b8` / `#cbd5e1` | Descriptions, metadata, stats explanations |

### Signature Gradients
- **Primary CTA Button**: `linear-gradient(135deg, #a855f7 0%, #ec4899 100%)`
- **Cyan Cyber Accent**: `linear-gradient(135deg, #00f2fe 0%, #3b82f6 100%)`
- **Subtle Surface Glow**: `radial-gradient(ellipse at top, rgba(168, 85, 247, 0.12) 0%, transparent 70%)`

---

## 3. Typography Rules

- **Primary Font**: `Space Grotesk` (headings, titles, badges, navigation).
- **Monospace Font**: `JetBrains Mono` / `ui-monospace` (terminal snippets, stats, tech stack labels, version tags like `v1.2`).
- **Hierarchy Rules**:
  - **H1 / Page Titles**: Large, tight letter-spacing (`font-weight: 800` or `700`), frequently highlighting the key word in glowing purple or cyan (e.g., `Dragon <span class="text-pink-500">Play</span>`).
  - **Subheadings**: Simple and warm copy, maximum 2 lines.
  - **Uppercase Meta Labels**: `text-xs font-mono tracking-widest text-cyan-400` with prepended system indicators (e.g., `SYS.VAULT // ROSTER READY`).

---

## 4. Layout & Grid Standards

- **Target Device Default**: **Desktop Browser** (`1280px` – `1440px` content container, max-w-6xl or max-w-7xl centered).
- **Whitespace / Rhythm**:
  - Sections must have at least `py-16` or `py-20` spacing.
  - Card grids should use generous gaps (`gap-8` or `gap-10`).
  - Avoid dense walls of text or tight element packing.
- **Persistent Header / Navigation**:
  - Top Navigation Bar (Logo left, primary links center/right: `Games`, `About Me`, `Ideas`, optional Kid/Dev profile avatar far right).
  - Active page is signified with a glowing pill background (`bg-purple-600 text-white rounded-full px-5 py-2`).

---

## 5. Component Patterns

### A. Game Cards (Showcase Grid)
- **Aspect Ratio**: 16:9 thumbnail preview featuring high-contrast pixel/synthwave graphics.
- **Corner Radius**: `rounded-2xl` with a crisp `border border-[#25243d]`.
- **Badges**: Top corners carry pill tags (`Platformer`, `Cyber Runner`, `v1.4`).
- **Actions**: Dual button layout:
  - Primary button: Glowing gradient `Play Game` or `Play in Browser` with game controller/play icon.
  - Secondary button: Subtle border outline `How I Made It` or `Devlog`.

### B. Form & Interaction Fields
- Inset dark input containers (`bg-[#121222]` or `#1a1a2b`), border `#2a2942`, rounded corners (`rounded-xl`).
- Kid-Safe disclaimer badge beneath submissions: *"Parent-monitored. All ideas reviewed before publishing."*

### C. Stats & Badges
- Modular cards featuring giant numbers (`text-3xl` or `text-4xl font-bold`) with brief friendly descriptions (e.g. `14,820 Plays`, `4 Games Shipped`, `120+ Sodas & Snacks`).

---

## 6. Implementation Instructions for AI Agents

1. **Keep it Spacious**: If a screen looks crowded, increase margins and reduce extraneous borders.
2. **Preserve Kid-Safe Tone**: Never introduce gritty, mature, or overly aggressive cyberpunk tropes. It should be energetic, fun, and encouraging.
3. **Logo & Branding Placement**:
   - Header must feature the **Dragon Play** logo alongside the `DRAGON PLAY` wordmark.
   - Retain the 3 core navigation routes: `Games`, `About Me`, `Ideas`.
4. **CSS & Styling Stack**: Tailwind CSS with dark theme tokens, vanilla JavaScript for interactive tabs, modals, and playable demo triggers.