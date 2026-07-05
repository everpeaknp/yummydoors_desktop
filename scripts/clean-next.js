const fs = require("fs");
const path = require("path");

const nextDir = path.join(process.cwd(), ".next");

try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log("Cleaned .next");
} catch (error) {
  console.error("Failed to clean .next", error);
  process.exit(1);
}
