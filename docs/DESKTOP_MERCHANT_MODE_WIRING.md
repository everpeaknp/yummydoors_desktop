# YummyDoors Desktop Merchant Mode Wiring

This repo is now wired to the new backend account model in `yummydoors_backend`.

## What changed

Desktop now understands that one YummyDoors user can have multiple account contexts:

- `customer`
- `merchant`

The same identity signs in once. The backend decides which workspaces exist for that user.

## Backend contract used by desktop

Desktop now relies on these backend responses:

## `GET /api/v1/auth/me`

The stored user shape now expects:

- `active_workspace_id`
- `active_workspace`
- `workspaces`

That data is mapped into local auth storage so the UI can show:

- current mode
- whether merchant mode exists
- merchant workspace status

## `GET /api/v1/merchant/applications/me`

Used by the merchant page to load the current onboarding/application state.

## `POST /api/v1/merchant/applications`

Creates the merchant workspace shell and the application.

## `POST /api/v1/merchant/applications/{id}/restaurant-requests`

Adds the first restaurant request under that application.

## `POST /api/v1/merchant/applications/{id}/submit`

Moves the application from draft to submitted.

## `POST /api/v1/workspaces/switch`

Lets the same signed-in user switch from customer mode to merchant mode after approval.

## `GET /api/v1/merchant/restaurants/me`

Loads the restaurants currently attached to the merchant identity plus the active restaurant context.

## `POST /api/v1/merchant/restaurants/switch`

Persists which merchant restaurant is currently active for desktop operations.

## Files changed

## Auth shape and sync

- `lib/auth-storage.ts`
- `lib/auth-mappers.ts`
- `hooks/use-auth.ts`

These changes added workspace awareness to the stored auth state and refresh `/auth/me` after hydration so older sessions can pick up the new backend shape.

## Shared nav behavior

- `lib/navigation.ts`
- `components/layout/site-navbar.tsx`
- `app/page.tsx`

Navbar options are now aligned around the same logic:

- guest: `Home`, `Restaurants`
- signed in: `Home`, `Restaurants`, `Merchant`, `Profile`

Signed-in users also see:

- `Create business` if they do not yet have a merchant workspace
- `Merchant mode` if they do

## Merchant onboarding screen

- `app/(dashboard)/merchant/page.tsx`

This page is the first desktop surface for the new backend flow.

Current behavior:

1. load current user and merchant applications
2. load merchant restaurants and active restaurant context
3. if there is no open application:
   submit a `create_external`, `claim_existing`, or `pos_link` request
4. if merchant workspace is approved:
   switch restaurant context inside the same merchant identity
5. present the merchant landing surface using the homepage visual language

## What the current desktop flow does not do yet

- edit an existing draft application
- add multiple restaurants in the same UI
- claim existing restaurant flows
- POS-link restaurant flows
- merchant dashboard/restaurant management after approval
- customer/merchant mode-specific homepage rendering

## Safe next steps later

1. Add merchant dashboard pages that only render when active workspace is `merchant`.
2. Add restaurant selection when one merchant owns multiple restaurants.
3. Add separate flows for:
   - create external restaurant
   - claim existing restaurant
   - request POS-linked restaurant access
4. Add an authenticated header switcher instead of just a merchant CTA button.

## Important note

The homepage visual design was not redesigned as part of this wiring pass.

Only the product behavior was wired:

- auth shape
- nav consistency
- merchant onboarding route
