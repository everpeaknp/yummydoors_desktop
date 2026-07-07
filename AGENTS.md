# YummyDoors Desktop Agent Guide

## Purpose

This repo is the Next.js customer + merchant web surface for YummyDoors.

Primary responsibilities:

- homepage and customer discovery UX
- restaurant list and restaurant detail UX
- auth screens and session handling
- customer profile, wishlist, cart, checkout, reservations
- merchant portal UX for restaurant operators

## Read This First

Before re-reading the whole repo, read:

- `.codex/context/project-purpose.md`
- `.codex/context/repo-map.md`
- `.codex/context/current-state.md`
- `.codex/context/ui-flows.md`
- `.codex/context/backend-contracts.md`
- `.codex/context/known-pitfalls.md`

## Repo Boundary

Sibling repos:

- `../yummydoors_backend` = API source of truth
- `../yummydoors_admin` = admin-only control surface
- `../yummydoors_mobile` = Flutter mobile app

Do not assume backend routes from local UI state. Verify in the backend repo.

## Verify First

Useful checks:

```bash
git status --short
npm run dev
npm run build
rg -n "apiFetch\\(|NEXT_PUBLIC_API_BASE_URL|useAuth|useAuthStore" app components lib
```

## Working Rules

- Preserve homepage/navbar visual language unless explicitly asked to redesign it.
- Match the homepage aesthetic across new pages.
- Verify backend contract before calling a feature "missing".
- If a page shows loading forever, inspect both fetch handling and auth state before redesigning the UI.
