import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
try {
  await access(join(root, "index.html"));
  throw new Error("Source already exists. Bootstrap must not overwrite an existing website.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const manifest = JSON.parse(await readFile(join(root, ".bootstrap/source-manifest.json"), "utf8"));
const origin = "https://victoria-fitness-landing.victoria-fitnessyoga.chatgpt.site";
const downloaded = new Map();
const queue = [...manifest.files];
await Promise.all(Array.from({ length:6 }, async () => {
  while (queue.length) {
    const entry = queue.shift();
    if (entry.path.includes("..") || !/^(?:assets\/|tests\/|integrations\/|index\.html$|TRACKING\.md$|README\.md$|\.gitignore$)/.test(entry.path)) {
      throw new Error("Unexpected bootstrap path: " + entry.path);
    }
    let data;
    if (entry.content !== undefined) {
      data = Buffer.from(entry.content, "utf8");
    } else {
      if (!entry.path.startsWith("assets/")) throw new Error("Only public assets may be downloaded.");
      const url = origin + "/" + entry.path.split("/").map(encodeURIComponent).join("/");
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(url, { signal:AbortSignal.timeout(45000), redirect:"error" });
          if (!response.ok) throw new Error("HTTP " + response.status + ": " + entry.path);
          data = Buffer.from(await response.arrayBuffer());
          break;
        } catch (error) {
          if (attempt === 2) throw error;
        }
      }
    }
    if (data.length !== entry.size || createHash("sha256").update(data).digest("hex") !== entry.sha256) {
      throw new Error("Source integrity check failed: " + entry.path);
    }
    downloaded.set(entry.path, data);
  }
}));
for (const [path, data] of downloaded) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive:true });
  await writeFile(target, data);
}
console.log("Verified and restored " + downloaded.size + " Victoria source files.");
