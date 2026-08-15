# Anti-Patterns — Never Ship

## Color
- Purple → pink gradients (AI cliché)
- White text on light gradient
- More than 2 accent hues per surface
- Random hex inside components (use tokens)

## Typography
- Inter / Poppins as the only font
- Mixed Arabic fonts (use Tajawal everywhere for Arabic)
- Display font smaller than body
- Justified Arabic text without `text-justify-arabic` adjustments

## Iconography
- Emoji as functional icons (📍 ✓ ✕ 💰 📞)
- Mixed icon sets in one screen (Heroicons + Material)
- Icons without `aria-label` on buttons
- Stroke width < 1.5 px (illegible at small sizes)

## Layout / spacing
- Card body padding < 12 px
- Buttons < 32 px tall on desktop, < 40 px on touch
- Two CTAs of equal weight competing for the same action

## Motion
- > 400 ms transitions for routine UI
- Pulse/glow on more than one element at the same time
- Auto-playing carousels without pause control

## Maps
- Marker icons that look like rounded squares (use real teardrop or pill+pointer)
- InfoWindow that opens more than 8 px away from the marker tip
- Default Google red pins
- Cluster markers without a count badge