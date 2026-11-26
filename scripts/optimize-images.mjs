// Local image pass. Not part of the Cloudflare build.
//   npm install --no-save sharp && node scripts/optimize-images.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const htmlPath = join(root, "index.html");
const outDir = join(root, "assets", "responsive");
const publicDir = join(root, "public");

function sizesFor(tag) {
  if (tag.includes("hero-photo")) return "100vw";
  if (tag.includes("brand-logo")) return "178px";
  if (tag.includes("footer-logo")) return "150px";
  return "(max-width: 780px) 100vw, 720px";
}

function widthsFor(sizes, sourceWidth) {
  const candidates = sizes.includes("vw") ? [480, 768, 1200] : [480];
  const usable = candidates.filter((width) => width < sourceWidth);
  return usable.length ? usable : [Math.min(sourceWidth, candidates[0])];
}

const cache = new Map();
async function variantsFor(src, sizes) {
  const key = src + "|" + sizes;
  if (cache.has(key)) return cache.get(key);
  const absolute = join(root, src);
  const image = sharp(absolute, { animated: false });
  const meta = await image.metadata();
  const sourceWidth = meta.width || 1200;
  const widths = widthsFor(sizes, sourceWidth);
  const stem = basename(src, extname(src));
  const made = [];
  for (const width of widths) {
    const pipeline = sharp(absolute, { animated: false }).rotate().resize({ width, withoutEnlargement: true });
    const webpName = `${stem}-${width}.webp`;
    const avifName = `${stem}-${width}.avif`;
    const webp = await pipeline.clone().webp({ quality: 68 }).toBuffer();
    const avif = await pipeline.clone().avif({ quality: 45, effort: 4 }).toBuffer();
    await writeFile(join(outDir, webpName), webp);
    await writeFile(join(outDir, avifName), avif);
    made.push({ width, webp: `assets/responsive/${webpName}`, avif: `assets/responsive/${avifName}`, webpBytes: webp.length, avifBytes: avif.length });
  }
  cache.set(key, made);
  return made;
}

function srcset(items, key) {
  return items.map((item) => `${item[key]} ${item.width}w`).join(", ");
}

function wrap(tag, src, made) {
  const sizes = sizesFor(tag);
  let img = tag.includes("data-responsive") ? tag : tag.replace("<img", '<img data-responsive="true"');
  return `<picture><source type="image/avif" srcset="${srcset(made, "avif")}" sizes="${sizes}"><source type="image/webp" srcset="${srcset(made, "webp")}" sizes="${sizes}">${img}</picture>`;
}

function pngToIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = 32;
  entry[1] = 32;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

await mkdir(outDir, { recursive: true });
await mkdir(publicDir, { recursive: true });

const logoPath = join(root, "assets/victoria-logo-dark.png");
const { data: logoPixels, info: logoInfo } = await sharp(logoPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let markLeft = logoInfo.width;
let markRight = 0;
let markTop = logoInfo.height;
let markBottom = 0;
for (let y = 0; y < logoInfo.height; y += 1) {
  for (let x = 0; x < 820; x += 1) {
    const offset = (y * logoInfo.width + x) * 4;
    if (logoPixels[offset + 3] > 40 && logoPixels[offset] < 240) {
      markLeft = Math.min(markLeft, x);
      markRight = Math.max(markRight, x);
      markTop = Math.min(markTop, y);
      markBottom = Math.max(markBottom, y);
    }
  }
}
const icon = sharp(logoPath).extract({
  left: markLeft,
  top: markTop,
  width: markRight - markLeft + 1,
  height: markBottom - markTop + 1,
}).resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
const png180 = await icon.png().toBuffer();
const png32 = await sharp(png180).resize(32, 32).png().toBuffer();
await writeFile(join(publicDir, "favicon-32.png"), png32);
await writeFile(join(publicDir, "apple-touch-icon.png"), png180);
await writeFile(join(publicDir, "favicon.ico"), pngToIco(png32));

let html = await readFile(htmlPath, "utf8");
const pattern = /<img\b[^>]*\bsrc="(assets\/[^"]+)"[^>]*>/g;
let count = 0;
const pieces = [];
let cursor = 0;
for (const match of html.matchAll(pattern)) {
  const tag = match[0];
  if (tag.includes("data-responsive")) continue;
  const src = match[1];
  const made = await variantsFor(src, sizesFor(tag));
  pieces.push(html.slice(cursor, match.index), wrap(tag, src, made));
  cursor = match.index + tag.length;
  count += 1;
  const hero = made.find((item) => item.width === 1200) || made[made.length - 1];
  if (src.endsWith("victoria-boxing-kettlebell-hero.jpg")) {
    console.log("hero variants", made.map((item) => `${item.width} webp ${item.webpBytes} avif ${item.avifBytes}`).join(" | "));
  }
  if (src.includes("membership-stretching") || src.includes("logo-dark")) {
    console.log(src, made.map((item) => `${item.width} webp ${item.webpBytes} avif ${item.avifBytes}`).join(" | "));
  }
}
pieces.push(html.slice(cursor));
html = pieces.join("");

const heroMade = cache.get("assets/victoria-boxing-kettlebell-hero.jpg|100vw");
if (!heroMade) throw new Error("Hero image was not optimized.");
const heroAvif = heroMade[heroMade.length - 1].avif;
html = html.replace(
  /<link rel="preload" as="image"[^>]*>/,
  `<link rel="preload" as="image" type="image/avif" href="${heroAvif}" imagesrcset="${srcset(heroMade, "avif")}" imagesizes="100vw" fetchpriority="high">`,
);
if (!html.includes('type="image/avif"')) throw new Error("Hero preload was not rewritten.");
await writeFile(htmlPath, html);
console.log("Wrapped " + count + " images.");
