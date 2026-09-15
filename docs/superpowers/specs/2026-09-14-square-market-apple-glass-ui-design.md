# Square Market — Apple glass UI polish

**Date:** 2026-09-14  
**Status:** Approved  
**Parent:** board homepage chrome + canvas

## Summary

Polish the board shell toward an iOS / Apple aesthetic: frosted glass panels, smooth motion, and desktop hover on squares (highlight + glass tooltip with coordinates and status).

## Decisions

| Topic | Choice |
|-------|--------|
| Hover | Highlight + glass tooltip `(x, y)` + status |
| Board tech | Canvas highlight + DOM glass tooltip (not 2500 DOM cells) |
| Touch | No hover affordance; tap still selects/highlights |
| Scope | Visual polish only — no buy/list/API changes |

## Surface changes

- Chrome, zoom controls, left/right rails: frosted glass, hairline borders, softer radius
- Canvas: hovered cell lift/glow; neighbors subtly dimmed
- Tooltip: small glass chip near pointer
- Motion: ~160–280ms ease-out; honor `prefers-reduced-motion`

## Non-goals

- Dark mode, custom display fonts, notification content, SquarePanel flow changes beyond light glass styling
