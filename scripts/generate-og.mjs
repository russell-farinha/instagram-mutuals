import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'

const width = 1200
const height = 630
const pixels = Buffer.alloc((width * 4 + 1) * height)

function circle(x, y, cx, cy, radius, color) {
  const dx = x - cx
  const dy = y - cy
  if (dx * dx + dy * dy > radius * radius) return
  pixels[y * (width * 4 + 1) + 1 + x * 4] = color[0]
  pixels[y * (width * 4 + 1) + 2 + x * 4] = color[1]
  pixels[y * (width * 4 + 1) + 3 + x * 4] = color[2]
  pixels[y * (width * 4 + 1) + 4 + x * 4] = 255
}

for (let y = 0; y < height; y += 1) {
  const row = y * (width * 4 + 1)
  pixels[row] = 0
  for (let x = 0; x < width; x += 1) {
    pixels[row + 1 + x * 4] = 15
    pixels[row + 2 + x * 4] = 23
    pixels[row + 3 + x * 4] = 42
    pixels[row + 4 + x * 4] = 255
    circle(x, y, 520, 315, 150, [103, 232, 249])
    circle(x, y, 680, 315, 150, [196, 181, 253])
  }
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const name = Buffer.from(type)
  let crc = 0xffffffff
  for (const byte of Buffer.concat([name, data])) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([length, name, data, checksum])
}

const header = Buffer.alloc(13)
header.writeUInt32BE(width, 0)
header.writeUInt32BE(height, 4)
header[8] = 8
header[9] = 6
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(pixels)),
  chunk('IEND', Buffer.alloc(0)),
])
writeFileSync('public/og.png', png)
