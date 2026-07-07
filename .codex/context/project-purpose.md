# Project Purpose

This repo is the YummyDoors web surface built with Next.js.

It currently combines:

- customer-facing web flows
- merchant-facing portal flows

It is separate from:

- `../yummydoors_backend` = FastAPI backend
- `../yummydoors_admin` = super-admin panel
- `../yummydoors_mobile` = Flutter app

The desktop repo should consume backend contracts, not redefine them locally.
