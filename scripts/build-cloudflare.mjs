import { cp, copyFile, mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const index = join(root, "index.html");
const assets = join(root, "assets");
const output = join(root, "dist");

if (!(await stat(index)).isFile() || !(await stat(assets)).isDirectory()) {
  throw new Error("Victoria source must include index.html and the assets directory.");
}

await mkdir(output, { recursive:true });
await cp(assets, join(output, "assets"), { recursive:true });
await copyFile(index, join(output, "index.html"));
console.log("Victoria static assets are ready in dist/.");
