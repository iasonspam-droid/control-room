# Control Room — design system

The reference object is **an instrument panel**, not a productivity SaaS dashboard.
Chronograph faces, oscilloscope bezels, lab-notebook graph paper, mission-control
readouts. Everything below follows from that one decision.

---

## 1. Colour

**Warm black, not blue-black.** Every neutral has a yellow-brown bias. `slate-900`
is banned — it is the tell of a default Tailwind build.

```
--bg          #100F0D   page
--surface     #1A1815   panel
--surface-2   #23201C   raised panel / input
--line        #2E2924   hairline (the primary way things are separated)
--line-hot    #473F37   emphasised hairline
--text        #EDE7DC   ivory
--text-dim    #9A9187
--text-mute   #665E55
```

**One accent.** Sodium amber `#F5751F`. It means *energy in motion* — the now-line,
live XP, an active streak, the primary action. If everything is amber, nothing is.

**One support.** Instrument cyan `#4EA8B8`. It means *banked* — hours already
logged, a completed block, a filled ring. Amber is the future, cyan is the past.

**One alarm.** Brick `#B5442E`. Overdue and destructive only. Never decorative.

Category swatches are functional (you must tell Physics from Training at a glance),
so they exist — but they are held to one muted band: same lightness, same low
chroma, arranged along a single warm→cool arc. It reads as a set, not a rainbow.

```
amber #C97B3C · clay #B0614F · olive #8A9A54 · teal #4E9A8F · steel #5C7C9E · plum #8B6B94
```

## 2. Type

Two families, wide hierarchy.

- **Archivo** (variable, `wdth` axis) — UI and prose. Headings run at `wdth 118`,
  `wght 800`, tight tracking, often uppercase. The expanded width is the signature;
  it is what makes a heading read as *stencilled onto a panel*.
- **JetBrains Mono** — every number, label, timestamp, unit and key. Tabular by
  nature, which matters when hours and XP sit in columns.

Rule: **if it is a quantity, it is mono.** If it is a sentence, it is Archivo.
Display sizes jump hard — 11px mono labels next to 56px display numerals. The
contrast *is* the hierarchy; there is no 3-weights-of-Inter middle ground.

## 3. Shape

- Panels, buttons, inputs, tiles: **square corners, 0 radius**, separated by 1px
  hairlines. Borders do the work that shadows do elsewhere.
- The deliberate exception: **status chips are full pills** and rings are circles.
  Round means *state*; square means *structure*. That contrast is the system.
- Radius is never 12px on everything.

## 4. Elevation

There is no ambient shadow layer. Depth comes from the hairline grid and from
surface value steps (`bg` → `surface` → `surface-2`).

Only things genuinely floating above the page get a shadow — modal, dropdown,
popover — and it is a **hard offset** (`5px 5px 0 rgba(0,0,0,.55)`), not a soft
blur. Hard shadow reads as a physical card dropped on a panel, which is the point.

No `backdrop-filter`. No frosted glass. Anywhere.

## 5. Texture

A single 32px graph-paper grid at ~3.5% opacity sits under the app shell, plus a
faint vignette. It is the lab-notebook reference and the only decoration in the
system. It never appears on top of content.

## 6. Icons

**Lucide**, 1.5px stroke, 16/18/20px. Never an emoji as an icon — no rockets,
sparkles, targets or lightbulbs anywhere in the product.

## 7. Layout

No centered hero. No three-equal-cards grid. Each screen takes the shape its data
actually wants:

| Screen   | Structure |
|----------|-----------|
| Landing  | Full-height split; headline hard-left and bottom-anchored, live readout right |
| Today    | Asymmetric 62/38 — hour timeline left, queue and rings right |
| Week     | Full-bleed 7-column density grid, no cards at all |
| Matrix   | 2×2 filling the viewport; Q1 alone carries a hot border |
| Log      | Narrow measure with the date set in a wide left margin, lab-notebook style |
| Recap    | Editorial report — oversized numerals, rule lines, small caps |
| Settings | Two-column form, labels in the left margin |

## 8. Whitespace

Dense where density earns it — the week grid and the matrix are packed, because
scanning is the job. Generous only around the things you read slowly: the log
entry, the recap headline. Airiness is not applied uniformly as a proxy for
"clean".

## 9. Copy

Written for one specific person, in the second person, never in feature-brochure
voice. Real categories, real course names, real research. No "Feature One".
