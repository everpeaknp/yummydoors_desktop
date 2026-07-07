# YummyDoors Desktop: Reservation And Restaurant Parity

## What Is Wired Now

### Customer desktop

- Restaurant detail page now reads the richer backend restaurant payload.
- Table-booking flow is live from the restaurant detail page.
- Reservation availability is fetched from backend slots and table inventory.
- Customers can:
  - choose date
  - choose guest count
  - choose time slot
  - optionally choose a table
  - submit a reservation
- Customer reservations now have:
  - `/reservations` list page
  - `/reservations/[id]` detail page
  - cancel flow from reservation detail
- Signed-in navbar dropdown now includes `My reservations`.
- Restaurant listing now uses backend-backed search, sort, and filters for:
  - food type
  - service mode
  - open now
  - free delivery

### Merchant desktop

- Merchant reservation queue is wired to live backend reservation data.
- Merchant can:
  - list reservations for active restaurant
  - filter by date
  - filter by status
  - inspect reservation detail
  - assign matching table
  - add operational note
  - update reservation status
- Merchant table inventory page is wired for:
  - create table
  - update table
  - delete table
  - list table inventory

## Backend Contracts Already In Use

### Customer

- `GET /api/v1/restaurants`
- `GET /api/v1/restaurants/{slug}`
- `GET /api/v1/restaurants/{slug}/reservations/availability`
- `POST /api/v1/restaurants/{slug}/reservations`
- `GET /api/v1/reservations`
- `GET /api/v1/reservations/{reservation_id}`
- `POST /api/v1/reservations/{reservation_id}/cancel`

### Merchant

- `GET /api/v1/merchant/restaurants/{restaurant_id}/reservations`
- `POST /api/v1/merchant/restaurants/{restaurant_id}/reservations/{reservation_id}/status`
- `GET /api/v1/merchant/restaurants/{restaurant_id}/reservation-tables`
- `POST /api/v1/merchant/restaurants/{restaurant_id}/reservation-tables`
- `PUT /api/v1/merchant/restaurants/{restaurant_id}/reservation-tables/{table_id}`
- `DELETE /api/v1/merchant/restaurants/{restaurant_id}/reservation-tables/{table_id}`

## What Is Still Missing

### Customer desktop

- Review write flow
  - create review
  - edit own review
  - delete own review
  - post-delivery eligibility messaging
- Wishlist / favorites surface
- Checkout parity
  - delivery fee breakdown
  - tax/service breakdown
  - coupon application
  - cutlery / cooking request
  - delivery-note fields
  - address-bound checkout
- Order tracking parity
  - stronger timeline UI
  - rider/live tracking when backend payload is expanded

### Merchant desktop

- Reservation analytics / summary trends
- Cleaner restaurant metadata editors for:
  - opening hours
  - facilities
  - contact data
  - service capability flags
  - about/description
- Review moderation once backend write flow lands

### Separate admin repo

- Admin reservation operations surface
- Admin override / moderation tools
- Coupon management after coupon engine expansion

## Recommended Next Build Order

1. Customer review write flow after backend write endpoints are ready.
2. Customer checkout parity against live cart payload.
3. Merchant restaurant metadata editors for the richer restaurant fields already in backend.
4. Admin reservation operations screen in `yummydoors_admin`.
