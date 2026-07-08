import fs from "node:fs";
import path from "node:path";

const pagePath = path.resolve(
  "/home/ramon/projects/everacy/yummydoors_desktop/app/(dashboard)/restaurants/[slug]/page.tsx",
);

const source = fs.readFileSync(pagePath, "utf8");
const heroStart = source.indexOf('<section className="relative h-[400px] w-full overflow-hidden">');
const heroEnd = source.indexOf("</section>", heroStart);

if (heroStart === -1 || heroEnd === -1) {
  throw new Error("Could not locate restaurant hero section.");
}

const heroBlock = source.slice(heroStart, heroEnd);

if (!heroBlock.includes("View photos")) {
  throw new Error('Expected "View photos" action inside the hero section.');
}

if (!heroBlock.includes("Save to wishlist") && !heroBlock.includes('restaurant.is_favorited ? "Saved" : "Save to wishlist"')) {
  throw new Error("Expected wishlist action inside the hero section.");
}

if (source.includes("Action bar — outside overflow-hidden")) {
  throw new Error("Found legacy restaurant action bar below the hero.");
}

console.log("Restaurant hero actions are rendered inside the hero section.");
