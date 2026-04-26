import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, '../client/public/icons/icon.svg');
const outDir = path.join(__dirname, '../client/public/icons');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const svgBuffer = fs.readFileSync(svgPath);

for (const size of sizes) {
  const outPath = path.join(outDir, `icon-${size}.png`);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`Generated: icon-${size}.png`);
}

// Also generate apple-touch-icon (180x180)
await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(outDir, 'apple-touch-icon.png'));
console.log('Generated: apple-touch-icon.png');

// Copy to public root for favicon
await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(__dirname, '../client/public/favicon.png'));
console.log('Generated: favicon.png (root)');

console.log('All icons generated!');
