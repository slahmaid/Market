# Square Market — Global mobile shell (v1)

**Date:** 2026-09-16  
**Status:** Approved for implementation  

## Summary

Unify mobile (`< md`) across the project: compact top chrome with hamburger drawer, fixed bottom-right account square (red logged-out / soft green logged-in), and shared content page spacing. Desktop keeps a fuller top chrome. Board stack from prior spec unchanged.

## Mobile chrome

| Element | Behavior |
|---------|----------|
| Hamburger (left) | Drawer: Board, Search, Messages, My squares |
| Top center | Search field (GET `/search`) |
| Account FAB | Fixed bottom-right; rounded square; user icon centered |
| FAB color | Red when logged out; soft green when logged in |
| FAB menu | Logged out → Login, Register; logged in → Log out only |

Safe-area insets on FAB and chrome. `md+`: existing-style top links; FAB optional/hidden on desktop if top auth links remain.

## Content pages

Shared shell rhythm for: search, messages, thread, store, store-edit, dashboard, login, register, buy success/cancel — consistent horizontal padding, vertical spacing, touch targets already `min-h-11` where present.

## Non-goals

Bottom tab bar; redesigning board panel stack; new brand identity.
