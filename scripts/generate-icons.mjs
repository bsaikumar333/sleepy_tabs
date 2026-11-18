import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../public/icons');

const sizes = [16, 32, 48, 128];

function getSvg(size) {
  // Top corners: 28% radius; Bottom corners: 14% radius
  const rTop = size * 0.28;
  const rBottom = size * 0.14;

  // Path with all 4 corners rounded
  const tabPath = `M ${rTop} 0 H ${size - rTop} A ${rTop} ${rTop} 0 0 1 ${size} ${rTop} V ${size - rBottom} A ${rBottom} ${rBottom} 0 0 1 ${size - rBottom} ${size} H ${rBottom} A ${rBottom} ${rBottom} 0 0 1 0 ${size - rBottom} V ${rTop} A ${rTop} ${rTop} 0 0 1 ${rTop} 0 Z`;

  // Centered cream crescent moon inside the silhouette
  const moonScale = (size * 0.52) / 24;
  const moonOffsetX = (size - 24 * moonScale) / 2;
  const moonOffsetY = (size - 24 * moonScale) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <path d="${tabPath}" fill="#3F6B4F"/>
  <g transform="translate(${moonOffsetX}, ${moonOffsetY}) scale(${moonScale})">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="#F4EFE6"/>
  </g>
</svg>`;
}

async function run() {
  await fs.mkdir(outputDir, { recursive: true });

  for (const size of sizes) {
    const svg = Buffer.from(getSvg(size));
    const outputPath = path.join(outputDir, `icon${size}.png`);
    await sharp(svg).png().toFile(outputPath);
    console.log(`Generated icon${size}.png`);
  }
}

run().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
