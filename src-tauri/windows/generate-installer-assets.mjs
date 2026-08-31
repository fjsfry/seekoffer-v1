import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const windowsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(windowsDirectory, '..', '..');
const outputDirectory = path.join(windowsDirectory, 'assets');
const iconPath = path.join(
  projectRoot,
  'public',
  'desktop',
  'seekoffer-app-icon-v2.png'
);

function encodeBmp24({ data, width, height }) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelSize = rowSize * height;
  const output = Buffer.alloc(54 + pixelSize);

  output.write('BM', 0, 2, 'ascii');
  output.writeUInt32LE(output.length, 2);
  output.writeUInt32LE(54, 10);
  output.writeUInt32LE(40, 14);
  output.writeInt32LE(width, 18);
  output.writeInt32LE(height, 22);
  output.writeUInt16LE(1, 26);
  output.writeUInt16LE(24, 28);
  output.writeUInt32LE(0, 30);
  output.writeUInt32LE(pixelSize, 34);
  output.writeInt32LE(3780, 38);
  output.writeInt32LE(3780, 42);

  for (let outputRow = 0; outputRow < height; outputRow += 1) {
    const sourceRow = height - outputRow - 1;
    const outputOffset = 54 + outputRow * rowSize;
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = (sourceRow * width + x) * 3;
      const targetOffset = outputOffset + x * 3;
      output[targetOffset] = data[sourceOffset + 2];
      output[targetOffset + 1] = data[sourceOffset + 1];
      output[targetOffset + 2] = data[sourceOffset];
    }
  }

  return output;
}

async function renderBmp({
  width,
  height,
  backgroundSvg,
  iconSize,
  iconLeft,
  iconTop
}) {
  const icon = await sharp(iconPath)
    .resize(iconSize, iconSize, { fit: 'contain' })
    .png()
    .toBuffer();
  const { data, info } = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#f5f6f7'
    }
  })
    .composite([
      { input: Buffer.from(backgroundSvg) },
      { input: icon, left: iconLeft, top: iconTop }
    ])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return encodeBmp24({ data, width: info.width, height: info.height });
}

const headerSvg = [
  '<svg width="150" height="57" viewBox="0 0 150 57" xmlns="http://www.w3.org/2000/svg">',
  '  <rect width="150" height="57" fill="#F8F9FA"/>',
  '  <rect x="0" y="56" width="150" height="1" fill="#DEE0E3"/>',
  '  <text x="54" y="27" font-family="Segoe UI Variable, Microsoft YaHei UI, sans-serif" font-size="15" font-weight="600" fill="#1F2329">寻鹿</text>',
  '  <text x="54" y="40" font-family="Segoe UI Variable, sans-serif" font-size="7" font-weight="600" letter-spacing="1.2" fill="#646A73">SEEKOFFER</text>',
  '</svg>'
].join('\n');

const sidebarSvg = [
  '<svg width="164" height="314" viewBox="0 0 164 314" xmlns="http://www.w3.org/2000/svg">',
  '  <rect width="164" height="314" fill="#F5F6F7"/>',
  '  <rect x="0" y="0" width="4" height="314" fill="#0F6B61"/>',
  '  <circle cx="82" cy="80" r="52" fill="#FFFFFF"/>',
  '  <text x="82" y="166" text-anchor="middle" font-family="Segoe UI Variable, Microsoft YaHei UI, sans-serif" font-size="25" font-weight="600" fill="#1F2329">寻鹿</text>',
  '  <text x="82" y="185" text-anchor="middle" font-family="Segoe UI Variable, sans-serif" font-size="9" font-weight="600" letter-spacing="2" fill="#646A73">SEEKOFFER</text>',
  '  <line x1="40" y1="207" x2="124" y2="207" stroke="#DEE0E3" stroke-width="1"/>',
  '  <text x="82" y="231" text-anchor="middle" font-family="Microsoft YaHei UI, Segoe UI Variable, sans-serif" font-size="10" fill="#646A73">把申请节奏</text>',
  '  <text x="82" y="247" text-anchor="middle" font-family="Microsoft YaHei UI, Segoe UI Variable, sans-serif" font-size="10" fill="#646A73">放在手边</text>',
  '  <circle cx="68" cy="284" r="3" fill="#0F6B61"/>',
  '  <circle cx="82" cy="284" r="3" fill="#86BDB5"/>',
  '  <circle cx="96" cy="284" r="3" fill="#B76A00"/>',
  '</svg>'
].join('\n');

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(
    path.join(outputDirectory, 'installer-header.bmp'),
    await renderBmp({
      width: 150,
      height: 57,
      backgroundSvg: headerSvg,
      iconSize: 38,
      iconLeft: 9,
      iconTop: 9
    })
  ),
  writeFile(
    path.join(outputDirectory, 'installer-sidebar.bmp'),
    await renderBmp({
      width: 164,
      height: 314,
      backgroundSvg: sidebarSvg,
      iconSize: 88,
      iconLeft: 38,
      iconTop: 36
    })
  )
]);

console.log('Installer assets generated in ' + outputDirectory);
