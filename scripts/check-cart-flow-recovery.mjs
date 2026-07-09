import fs from "node:fs";
import path from "node:path";

const restaurantPage = fs.readFileSync(
  path.resolve("/home/ramon/projects/everacy/yummydoors_desktop/app/(dashboard)/restaurants/[slug]/page.tsx"),
  "utf8",
);
const checkoutPage = fs.readFileSync(
  path.resolve("/home/ramon/projects/everacy/yummydoors_desktop/app/(dashboard)/checkout/[restaurantId]/page.tsx"),
  "utf8",
);

if (restaurantPage.includes("const [cartItems, setCartItems]")) {
  throw new Error("Restaurant detail still uses client-only cartItems state.");
}

if (!restaurantPage.includes("apiFetch(`/carts/")) {
  throw new Error("Restaurant detail does not read the backend cart.");
}

if (!restaurantPage.includes("apiFetch(`/carts/${restaurantId}/items`")) {
  throw new Error("Restaurant detail does not add items to the backend cart.");
}

if (!checkoutPage.includes('cartMissing') || !checkoutPage.includes("Return to cart")) {
  throw new Error("Checkout page does not recover when the active cart is missing.");
}

console.log("Cart flow recovery is wired: restaurant detail uses backend cart and checkout recovers from missing carts.");
