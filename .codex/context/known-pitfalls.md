# Known Pitfalls

- This repo previously got confused with `yummy-desktop-nextjs`; do not drift into the POS repo.
- `.next` chunk corruption can cause fake source-level bugs; clean `.next` before deeper runtime changes.
- Browser issues against prod can be CORS, stale auth, or wrong env, not always backend route absence.
- Google Maps needs working key, enabled APIs, and the right frontend restrictions.
- Preserve homepage visual language unless a full redesign is explicitly requested.
- When the user asks for parity with Flutter, inspect actual mobile fields before changing contracts.
