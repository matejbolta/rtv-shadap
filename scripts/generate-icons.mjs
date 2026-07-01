import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const iconDir = join(root, "public/icons");
const sizes = [16, 32, 48, 128];
const scale = 4;

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * (width * 4 + 1);
    raw[rawOffset] = 0;
    rgba.copy(raw, rawOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND")
  ]);
}

function blendPixel(buffer, width, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= width) return;
  const offset = (y * width + x) * 4;
  const alpha = color[3] / 255;
  const inverse = 1 - alpha;
  buffer[offset] = Math.round(color[0] * alpha + buffer[offset] * inverse);
  buffer[offset + 1] = Math.round(color[1] * alpha + buffer[offset + 1] * inverse);
  buffer[offset + 2] = Math.round(color[2] * alpha + buffer[offset + 2] * inverse);
  buffer[offset + 3] = 255;
}

function drawRoundedRect(buffer, width, x, y, w, h, radius, color) {
  const x2 = x + w;
  const y2 = y + h;
  for (let py = Math.floor(y); py < Math.ceil(y2); py += 1) {
    for (let px = Math.floor(x); px < Math.ceil(x2); px += 1) {
      const cx = px < x + radius ? x + radius : px > x2 - radius ? x2 - radius : px;
      const cy = py < y + radius ? y + radius : py > y2 - radius ? y2 - radius : py;
      if ((px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2) {
        blendPixel(buffer, width, px, py, color);
      }
    }
  }
}

function drawLine(buffer, width, x1, y1, x2, y2, thickness, color) {
  const half = thickness / 2;
  const minX = Math.floor(Math.min(x1, x2) - half);
  const maxX = Math.ceil(Math.max(x1, x2) + half);
  const minY = Math.floor(Math.min(y1, y2) - half);
  const maxY = Math.ceil(Math.max(y1, y2) + half);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
      const closestX = x1 + t * dx;
      const closestY = y1 + t * dy;
      if ((x - closestX) ** 2 + (y - closestY) ** 2 <= half ** 2) {
        blendPixel(buffer, width, x, y, color);
      }
    }
  }
}

function downsample(buffer, size) {
  const sourceSize = size * scale;
  const output = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const totals = [0, 0, 0, 0];
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const sourceOffset = ((y * scale + sy) * sourceSize + (x * scale + sx)) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            totals[channel] += buffer[sourceOffset + channel];
          }
        }
      }
      const targetOffset = (y * size + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        output[targetOffset + channel] = Math.round(totals[channel] / (scale * scale));
      }
    }
  }
  return output;
}

function drawIcon(size) {
  const width = size * scale;
  const buffer = Buffer.alloc(width * width * 4);
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 30;
    buffer[i + 1] = 75;
    buffer[i + 2] = 135;
    buffer[i + 3] = 255;
  }

  const unit = width / 128;
  for (let offset = -width; offset < width * 2; offset += 18 * unit) {
    drawLine(buffer, width, offset, width, offset + width, 0, 7 * unit, [10, 34, 70, 55]);
  }

  const white = [255, 255, 255, 245];
  const shadow = [8, 22, 46, 60];
  const bars = [
    [37, 31, 56, 14, 7],
    [30, 39, 16, 30, 8],
    [38, 57, 52, 14, 7],
    [82, 65, 16, 31, 8],
    [35, 86, 58, 14, 7]
  ];

  for (const [x, y, w, h, radius] of bars) {
    drawRoundedRect(buffer, width, (x + 2) * unit, (y + 2) * unit, w * unit, h * unit, radius * unit, shadow);
  }
  for (const [x, y, w, h, radius] of bars) {
    drawRoundedRect(buffer, width, x * unit, y * unit, w * unit, h * unit, radius * unit, white);
  }

  drawLine(buffer, width, 99 * unit, 28 * unit, 24 * unit, 103 * unit, 9 * unit, [126, 218, 255, 230]);
  drawRoundedRect(buffer, width, 91 * unit, 23 * unit, 14 * unit, 14 * unit, 7 * unit, [126, 218, 255, 255]);

  return downsample(buffer, size);
}

await mkdir(iconDir, { recursive: true });
await rm(join(iconDir, "rtv-slo-source.png"), { force: true });

for (const size of sizes) {
  await writeFile(join(iconDir, `icon${size}.png`), writePng(size, size, drawIcon(size)));
}

console.log("Generated original RTV Shadap icons.");
