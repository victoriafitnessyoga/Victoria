import { cp, copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const index = join(root, "index.html");
const assets = join(root, "assets");
const publicDir = join(root, "public");
const output = join(root, "dist");

if (!(await stat(index)).isFile() || !(await stat(assets)).isDirectory() || !(await stat(publicDir)).isDirectory()) {
  throw new Error("Victoria source must include index.html, assets/, and public/.");
}

await mkdir(output, { recursive: true });
await cp(assets, join(output, "assets"), { recursive: true });
await copyFile(index, join(output, "index.html"));
for (const entry of await readdir(publicDir)) {
  await cp(join(publicDir, entry), join(output, entry), { recursive: true });
}
console.log("Victoria static assets are ready in dist/.");
