# Design System Library

Pick one per surface and commit. Never mix two systems on the same screen.

| System | Use when | Key signals |
| --- | --- | --- |
| **Golden Editorial** (default for this project) | Contracts, invoices, reports, dashboards | Tajawal + Manrope, gold #d6ac40 accents on charcoal, generous whitespace, hairline gold rules |
| **Soft UI / Neumorphism Lite** | Settings, preferences, calm forms | Soft shadows both sides, very low contrast, never for primary CTAs |
| **Glassmorphism** | Map overlays, floating cards, dialogs over imagery | `backdrop-blur-xl bg-slate-950/85`, 1px gold-tinted borders |
| **Brutalist** | Admin warning banners, destructive flows | Mono numerals, hard borders, no shadow, no radius > 4px |
| **Premium Dark** | Studio, design tools, KPI dashboard | Near-black `#0a0a14`, gold/blue accents only, OLED-safe contrast |
| **Print-faithful A4** | PDFs and printables | Real serif/sans pairing, exact mm spacing, no animation, fixed colors |

## Composition rules

- One primary CTA per viewport.
- Negative space ≥ 24 px between independent groups.
- Max 3 type sizes per card (display / body / meta).
- Max 2 accent colors per surface besides neutrals.