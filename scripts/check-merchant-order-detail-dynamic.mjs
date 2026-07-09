import fs from "node:fs";
import path from "node:path";

const detailPage = fs.readFileSync(
  path.resolve("/home/ramon/projects/everacy/yummydoors_desktop/app/(dashboard)/merchant/orders/[id]/page.tsx"),
  "utf8",
);

if (detailPage.includes("ORDER_ITEMS")) {
  throw new Error("Merchant order detail still uses static mock items.");
}

if (detailPage.includes("Da Alfredo") || detailPage.includes("Mark Twain")) {
  throw new Error("Merchant order detail still renders hard-coded order data.");
}

if (!detailPage.includes('apiFetch("/orders/merchant/me"')) {
  throw new Error("Merchant order detail does not load live merchant orders.");
}

if (!detailPage.includes("/orders/merchant/") || !detailPage.includes("new_status=")) {
  throw new Error("Merchant order detail does not expose status actions.");
}

console.log("Merchant order detail is wired to live data and status actions.");
