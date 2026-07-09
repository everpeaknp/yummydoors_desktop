import fs from "node:fs";
import path from "node:path";

const ordersPage = fs.readFileSync(
  path.resolve("/home/ramon/projects/everacy/yummydoors_desktop/app/(dashboard)/orders/page.tsx"),
  "utf8",
);
const navbar = fs.readFileSync(
  path.resolve("/home/ramon/projects/everacy/yummydoors_desktop/components/layout/site-navbar.tsx"),
  "utf8",
);

if (!ordersPage.includes('apiFetch("/orders"')) {
  throw new Error("Customer orders page does not load the backend orders list.");
}

if (!ordersPage.includes('My Orders')) {
  throw new Error("Customer orders page missing customer-facing heading.");
}

if (!navbar.includes('href="/orders"')) {
  throw new Error("Navbar does not expose a link to the customer orders page.");
}

console.log("Customer orders page is wired and reachable from the navbar.");
