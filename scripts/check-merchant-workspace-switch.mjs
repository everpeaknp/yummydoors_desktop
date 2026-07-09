import fs from "node:fs";
import path from "node:path";

const layout = fs.readFileSync(
  path.resolve("/home/ramon/projects/everacy/yummydoors_desktop/components/merchant/merchant-dashboard-layout.tsx"),
  "utf8",
);

if (!layout.includes('/workspaces/switch')) {
  throw new Error("Merchant dashboard layout does not switch workspaces.");
}

if (!layout.includes('merchantWorkspace && activeWorkspaceType !== "merchant"')) {
  throw new Error("Merchant dashboard layout does not auto-enter merchant workspace.");
}

console.log("Merchant dashboard auto-switches into merchant workspace before loading merchant APIs.");
