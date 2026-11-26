// The woff2 files in assets/fonts are subset with fontTools so each
// Inter and Be Vietnam Pro file contains Latin, Latin Extended and
// Vietnamese, at a real weight (400–900). Do not replace them with the
// split Google Fonts CSS files: those left Vietnamese letters on a
// heavier fallback. Lora italic 700 has no U+20AB in the upstream font,
// so its unicode-range omits that character.
console.error("assets/fonts is already subsetted. Refusing to download split Google Fonts files.");
process.exit(1);
