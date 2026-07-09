import fs from "node:fs";
import path from "node:path";

const checkoutPage = fs.readFileSync(
  path.resolve(
    "/home/ramon/projects/everacy/yummydoors_desktop/app/(dashboard)/checkout/[restaurantId]/page.tsx",
  ),
  "utf8",
);

if (!checkoutPage.includes("Array.isArray(addressesPayload)")) {
  throw new Error(
    "Checkout page still only reads the /me/addresses envelope form.",
  );
}

if (!checkoutPage.includes("nextAddresses = Array.isArray(addressesPayload)")) {
  throw new Error(
    "Checkout page does not normalize raw saved addresses before rendering.",
  );
}

console.log("Checkout address parsing accepts raw arrays and envelope responses.");
