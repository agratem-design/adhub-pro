# Map Pin Design Rules

## Shape

Use a **classic teardrop** for compact pins (zoom < 15) and a **pill+pointer** for wide labeled pins (zoom ≥ 15). Never use a rounded rectangle with a stubby tail — it reads as a chat bubble, not a location pin.

### Teardrop SVG geometry (compact)

```
head: circle radius R at (cx, R)
tail: M cx-(R*0.55) (R*1.35) Q cx (R*2.2) cx+(R*0.55) (R*1.35) Z
anchorY = R*2.2 (tail tip)
```

R = 16 → 36×48 pin. Centered billboard icon inside head, status badge top-right offset (cx+R*0.7, R*0.2).

### Pill+pointer (wide)

```
pill: rounded rect 84×30 at top, radius 15
pointer: M 38 30 L 42 42 L 46 30 Z
anchorY = 42
```

## Colors

Vertical gradient (lighter top → darker bottom) of the status color. White stroke 1.5 px. Drop shadow `dy=3 stdDeviation=3 opacity=0.4`.

## Selected state

- Scale ~ 1.6×
- Show billboard photo inside head (clipped to circle)
- Pulsing gold ring (#d6ac40), 2s loop, stroke-width 2 → 4 → 2
- `zIndex: 9999`

## InfoWindow / floating card

- `pixelOffset = (0, -4)`
- Hide Google default tail (`.gm-style-iw-tc { display:none !important }`)
- Card position: directly above the marker head, never bottom-pinned for selection popups