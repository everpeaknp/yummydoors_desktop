# Backend Contracts

Primary backend repo:

- `../yummydoors_backend`

Primary env var:

- `NEXT_PUBLIC_API_BASE_URL`

Common contract rules:

- use `lib/http.ts` for API calls
- use `lib/auth-mappers.ts` for payload mapping
- do not assume every backend response is wrapped the same way

Important live areas:

- auth and admin login
- customer profile and addresses
- restaurants and restaurant detail
- favorites / wishlist
- reviews
- carts / checkout
- reservations
- merchant applications / workspaces

When something "loads forever", check:

1. current API base URL
2. auth token presence
3. backend response shape
4. page-specific loading state handling
