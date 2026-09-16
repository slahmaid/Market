# Square Market — For-sale rail + sphere hover design (v1)

**Date:** 2026-09-16  
**Status:** Approved for implementation  

## Summary

Right rail tabs: **Activity** | **For sale**. For sale lists cheapest `platform` squares (50 + Load more). Buy on each row via existing primary Checkout. Row click focuses that square on the sphere (enlarged highlight). Sphere hover enlarges (~1.45×); **no** click-to-open SquarePanel / buy from sphere.

## Decisions

| Topic | Choice |
|-------|--------|
| List | Cheapest 50 platform, Load more |
| Row action | Focus/zoom on sphere |
| Buy | Button on For-sale row only |
| Sphere click | No buy / no SquarePanel |
| Hover | Enlarge ~1.45× (existing hover path) |

## API

`GET /api/squares/available?limit=50&offset=0`

- `where: { status: "platform" }`
- Sort by `buildPlatformQuote({x,y}).askCents` ascending (compute in app; 2500 OK)
- Response: `{ squares: [{ id, x, y, askCents }], nextOffset: number | null }`

## UI

- `BoardNotificationsRail`: tab switcher; For sale list + Buy + Load more; optional login gate on Buy (same as checkout).
- `page.tsx`: `focusedSquareId` state; pass to sphere; remove `SquarePanel` from sphere select.
- `SphereImageGrid` / `BoardSphere`: `focusedImageId`; hover scale ~1.45; focused ~1.6; clicks do not open buy UI.

## Non-goals

Secondary `listed` marketplace in this list; Activity feed redesign beyond tabs.
