# Current State

Desktop already contains:

- premium homepage with hero, categories, promos, location picker
- login and signup flows
- customer profile page
- customer discovery pages
- merchant portal shell
- wishlist, cart, reservations page shells

Current reality:

- not every page is fully wired to backend yet
- some pages can still drift from backend field names
- build health must be checked because unrelated pages can block verification

The desktop repo often has two kinds of issues:

1. contract mismatch with backend
2. UI state loading/error handling bugs
