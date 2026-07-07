# Repo Map

## App Router Areas

- `app/page.tsx` = homepage, hero, location selection, discovery surface
- `app/(auth)/` = login, signup, password reset flows
- `app/(dashboard)/restaurants/page.tsx` = restaurant discovery map/list page
- `app/(dashboard)/categories/page.tsx` = category discovery page
- `app/(dashboard)/menu-items/page.tsx` = menu item exploration page
- `app/(dashboard)/profile/page.tsx` = customer profile and saved addresses
- `app/(dashboard)/wishlist/page.tsx` = favorites UI
- `app/(dashboard)/cart/page.tsx` = cart and checkout starter flow
- `app/(dashboard)/reservations/page.tsx` = reservation customer flow
- `app/(dashboard)/merchant/page.tsx` = merchant portal shell
- `app/(dashboard)/promos/page.tsx` = promo-related surface

## Shared Code

- `components/` = shared UI and page-level pieces
- `hooks/use-auth.ts` = auth session hook
- `stores/auth-store.ts` = client auth store
- `lib/http.ts` = API fetch wrapper with refresh retry
- `lib/auth-mappers.ts` = backend-to-store payload mapping
- `lib/auth-storage.ts` = local auth persistence
- `lib/config.ts` = frontend env usage

## Config

- `.env` = current local API base URL and Google Maps key
- `next.config.mjs` = image host config
- `scripts/clean-next.js` = `.next` cleanup helper
