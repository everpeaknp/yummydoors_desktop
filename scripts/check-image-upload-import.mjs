import fs from "node:fs";
import path from "node:path";

const imageUpload = fs.readFileSync(
  path.resolve("/home/ramon/projects/everacy/yummydoors_desktop/components/ui/image-upload.tsx"),
  "utf8",
);

if (imageUpload.includes("readErrorMessage")) {
  throw new Error("Image upload still imports the missing readErrorMessage helper.");
}

if (!imageUpload.includes("extractApiErrorMessage") || !imageUpload.includes("readJsonSafely")) {
  throw new Error("Image upload no longer uses the shared API error helpers.");
}

console.log("Image upload imports valid API helpers.");
