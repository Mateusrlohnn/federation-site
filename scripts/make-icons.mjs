// Generates the app icon (browser tab / favicon) from the brand logo.
// Run after replacing public/rebug-dc.webp with the final logo:
//   node scripts/make-icons.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const logo = fileURLToPath(new URL("../public/rebug-dc.webp", import.meta.url));
const iconOut = fileURLToPath(new URL("../src/app/icon.png", import.meta.url));
const appleOut = fileURLToPath(new URL("../src/app/apple-icon.png", import.meta.url));

if (!existsSync(logo)) {
  console.error("Missing public/rebug-dc.webp — add your logo first.");
  process.exit(1);
}

// Square icon: logo centered ("contain") on the brand dark background (#111).
async function build(size, out, padding) {
  const inner = size - padding * 2;
  const resized = await sharp(logo)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 17, g: 17, b: 17, alpha: 1 } },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(out);
  console.log("Wrote", out);
}

await build(256, iconOut, 28);
await build(180, appleOut, 22);
