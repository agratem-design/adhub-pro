# Pre-Delivery Checklist

Run through every item before saying "done".

## Visual
- [ ] No emoji icons inside UI surfaces
- [ ] All clickable elements have `cursor-pointer` and a hover state
- [ ] Contrast ≥ 4.5:1 for body text in both light + dark themes
- [ ] Spacing scale respected (4/8/12/16/24/32)
- [ ] Border radius consistent within a card (no mixing 8/12/24 randomly)

## Typography
- [ ] One display + one body font; no system fallback visible
- [ ] Arabic uses Tajawal, Latin numerals use Manrope
- [ ] Line-height ≥ 1.5 for paragraphs, 1.2 for headings

## Interaction
- [ ] Focus ring visible for keyboard nav
- [ ] All buttons have `transition-all duration-200`
- [ ] `active:scale-95` on primary CTAs
- [ ] `prefers-reduced-motion` respected

## Responsive
- [ ] Tested at 375 / 768 / 1024 / 1440
- [ ] No horizontal scroll on mobile
- [ ] Touch targets ≥ 40 px tall

## Maps specifically
- [ ] Pin tail tip sits exactly on coordinate (`anchorY === height`)
- [ ] InfoWindow / floating card opens within 4 px of marker
- [ ] Selected marker has `zIndex ≥ 9999` and a pulse animation
- [ ] Cluster bubble has a count badge