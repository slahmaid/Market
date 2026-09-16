# Square Market — Mobile board panel stack (v1)

**Date:** 2026-09-16  
**Status:** Approved for implementation  

## Summary

On mobile (`< md`), the board shell stacks vertically: **Header → My squares (closed by default) → Sphere → Notifications (open by default)**. Panels expand/collapse independently (both may be open). Desktop (`md+`) keeps the current three-column side-by-side rails.

## Defaults

| Region | Mobile default |
|--------|----------------|
| My squares | Collapsed header tab (~44–48px) |
| Sphere | `flex-1`, `min-h-[30vh]` |
| Notifications | Expanded |

## Open heights

- Open My squares body: `min(40vh, 280px)`, scroll inside  
- Open Notifications body: `min(42vh, 320px)`, scroll inside  
- Closed: header row only (title + chevron)

## Interaction

- Tap panel header toggles expand/collapse  
- Opening one does **not** close the other  
- Content (MySquaresList, Activity | For sale) unchanged

## Implementation notes

- Drive layout from `page.tsx` + small collapse props on `BoardDashboardRail` / `BoardNotificationsRail`, or a thin mobile shell wrapper  
- Use CSS/`md:` so desktop is untouched  
- Preserve safe-area padding on header

## Non-goals

- Gesture drag-to-resize  
- Overlay/sheet patterns  
- Changing desktop three-column layout  
