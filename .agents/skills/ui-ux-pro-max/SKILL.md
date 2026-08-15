---
name: ui-ux-pro-max
description: Professional UI/UX design rules and golden-theme design system for الفارس الذهبي للدعاية project. Use whenever building or refining UI components, pages, popups, cards, or map markers — covers color palette, typography, motion, anti-patterns, and a pre-delivery quality checklist distilled from UI/UX Pro Max and Open Design.
---

# UI/UX Pro Max — Golden Knight Design System

Distilled from the [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) and [Open Design](https://github.com/nexu-io/open-design) reasoning engines, tuned to the project's golden brand identity.

## Strict & Non-Negotiable Core Principles (Apply to Every UI/UX Change)

1. **STRICT ZERO EMOJI MANDATE (صارم وقاطع):**
   - Emojis (e.g., 📍, 📄, 📎, ⚡, 🤝, 💡, 🏷️, 🏢, 👤, 💰, 🏠, 🏛️, 👥, 🧾, 📋, 📊, 👷, ⚙️, 🔒, ✂️, 🖨️, 📷, 🖼️, 🎨, 📱, 🌙, ☀️, ☕, 🏆, 💼, 🌿, 🔴, 👑, 🖤, 🔶, 💎, 📢, ↗️, ➡️, ↘️, ↙️, ↖️, ✆, ✓, ✕, ⌛, ⏱️, 📌, 🎯) are **100% FORBIDDEN** anywhere in the system.
   - Do NOT use emojis in buttons, badges, navigation items, dialog titles, select menus, toasts, tooltips, cards, map popups/markers, printed HTML/PDF documents, or WhatsApp message templates.

2. **COLORABLE VECTOR ICONS ONLY (أيقونات موجهة قابلة للتلوين حصراً):**
   - Always use vector icons: **Lucide React** components inside React surfaces, or clean inline `<svg>` paths with `fill="currentColor"` / `stroke="currentColor"` inside SVG maps and HTML export generators.
   - All icons MUST inherit color dynamically or be styled via Tailwind CSS utility classes (e.g., `text-primary`, `text-emerald-500`, `text-amber-400`, `text-destructive`). Emojis cannot be dynamically recolored or stroke-weighted; vector icons can.

3. **HTML & PDF GENERATION ICON STANDARD:**
   - In string generators (`buildContractTableHTML.ts`, `pdfDriveWhatsApp.ts`, invoice HTML, sticker preview), replace emojis with lightweight inline SVG strings (e.g., `<svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" ...>`) so printed documents maintain sharp, color-controlled vector rendering.

4. **`cursor-pointer` & INTERACTIVE STATES:**
   - Add `cursor-pointer` on every clickable element. Hover states must use smooth transitions (`transition-all duration-200`).

5. **CONTRAST & ACCESSIBILITY:**
   - Contrast 4.5:1 minimum for body text against background, 3:1 for large text.

6. **NO GENERIC AI AESTHETICS:**
   - Avoid purple-to-pink gradients, generic Inter/Poppins pairings, or white-on-white flat containers. Use the golden brand tokens (`bg-primary`, `text-foreground`, `border-border`).

7. **STATUS BADGES & INDICATORS:**
   - Use `bg-primary/10 text-primary` or appropriate semantic status color pairs (`emerald`, `amber`, `red`, `blue`, `slate`) with a matching Lucide icon.

8. **RESPONSIVE & MOTION REGISTER:**
   - Respect `prefers-reduced-motion` with `motion-safe:` Tailwind variants. Breakpoints: 375 / 768 / 1024 / 1440 px.

## Brand Palette

- **Primary Gold:** `#d6ac40` (HSL `42 67% 55%`)
- **Gold Highlight:** `#f4c25a`
- **Gold Deep:** `#b8860b`
- **Dark Surface:** `#0a0a14` → `#15110a` (radial)
- **Light Surface:** HSL `40 20% 98%`
- **Status colors:** متاح `#22C55E` · مؤجر `#2D6BFF` · قريباً `#F59E0B` · صيانة `#EF4444` · مخفي `#94A3B8`

## Typography

- Arabic body / UI: **Tajawal**
- Latin display / numbers in pins/badges: **Manrope** (already loaded)
- Never fall back to system fonts inside generated SVG — embed `font-family="'Manrope', 'Tajawal', sans-serif"`.

## Motion Register

- Hover / press: 150–200 ms ease-out
- Card enter: 250–300 ms (use `animate-in fade-in slide-in-from-*`)
- Pulse / glow on selection: 2 s loop, opacity 0.7 → 1
- Avoid simultaneous large-area animations that fight for attention.

## Reference Files

- `references/design-systems.md` — when to pick which visual style
- `references/anti-patterns.md` — patterns to never ship
- `references/checklist.md` — pre-delivery QA
- `references/map-pins.md` — specific rules for map pin SVGs

## Anti-Patterns (NEVER SHIP)

- ❌ Emoji icons in any card, button, popup, select item, toast, PDF, HTML printout, or WhatsApp text.
- ❌ Hardcoded unicode symbols like 📍, ✓, ✕, ⚡, 💡, 🏠, 🏢, 👤, 💰 instead of styled Lucide/SVG colorable icons.
- ❌ Pop-ups floating far from their anchor (more than 8 px gap between InfoWindow tip and marker top).
- ❌ Pins that look like rounded rectangles with stubby tails — use real teardrop or pill+pointer shapes.
- ❌ Dark text on dark gradients without a scrim.
- ❌ Buttons without hover state or without `cursor-pointer`.