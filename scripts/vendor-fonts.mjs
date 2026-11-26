import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = join(root, "assets", "fonts");
const cssUrl =
  "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@700;800&family=Lora:ital,wght@1,700&family=Poppins:wght@400;500;700;800&display=swap";

const keep = (block) => {
  const family = /font-family:\s*'([^']+)'/.exec(block)?.[1] || "";
  const weight = /font-weight:\s*(\d+)/.exec(block)?.[1] || "";
  const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1] || "";
  const latin = range.includes("U+0000-00FF");
  const vietnamese = range.includes("U+1EA0-1EF9");
  if (family === "Poppins" && ["400", "500", "700", "800"].includes(weight)) return latin;
  if (family === "Be Vietnam Pro" && ["700", "800"].includes(weight)) return latin || vietnamese;
  if (family === "Lora" && weight === "700") return latin || vietnamese;
  return false;
};

const response = await fetch(cssUrl, {
  headers: {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  },
});
if (!response.ok) throw new Error("Google Fonts CSS " + response.status);
const css = await response.text();
const faces = css.split("@font-face").slice(1).filter(keep);
if (faces.length < 8) throw new Error("Expected the Vietnamese and Latin subsets, got " + faces.length);

await mkdir(outDir, { recursive: true });
let localCss = "/* Be Vietnam Pro, Poppins and Lora subsets. Licensed under the SIL Open Font License. */\n";
let index = 0;
for (const face of faces) {
  const remote = /url\(([^)]+)\)/.exec(face)?.[1];
  if (!remote) throw new Error("Missing font URL");
  const file = await fetch(remote);
  if (!file.ok) throw new Error("Font " + file.status + " " + remote);
  const bytes = Buffer.from(await file.arrayBuffer());
  const name = `victoria-${String(index).padStart(2, "0")}.woff2`;
  index += 1;
  await writeFile(join(outDir, name), bytes);
  localCss += "@font-face" + face.replace(remote, `victoria-${String(index - 1).padStart(2, "0")}.woff2`) ;
}
await writeFile(join(outDir, "fonts.css"), localCss);
console.log("Wrote " + index + " font files.");
