/**
 * Single source of truth for the order status / realtime event contract with
 * the backend. Mirrors `OrderStatus` in
 * yummydoors_backend/app/modules/orders/models.py and the frozen event name
 * set locked down by yummydoors_backend/tests/test_order_event_contract.py.
 *
 * Previously each page under app/(dashboard) redeclared its own local
 * `OrderStatus` union, and they had drifted from each other (some included
 * "picked_up"/"rider_assigned" as if they were `order.status` values, which
 * the backend never actually sends — those are realtime event names, not
 * statuses). Import from here instead of redeclaring the union.
 */

/** The only values `order.status` can ever hold. */
export type OrderStatus = "toPay" | "placed" | "preparing" | "delivered" | "cancelled";

/**
 * Realtime WebSocket / push event names for orders and rider dispatch.
 * These are distinct from `OrderStatus` — e.g. "picked_up" and
 * "rider_assigned" are finer-grained timeline milestones that arrive as an
 * event while `order.status` itself stays "preparing".
 */
export type OrderEventName =
  | "order_update"
  | "new_order"
  | "rider_assigned"
  | "picked_up"
  | "delivered"
  | "rider_offer"
  | "rider_team_invitation";
