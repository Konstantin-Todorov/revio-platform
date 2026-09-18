// Throwaway: report the exact pixel bounding box of a colour in a rendered PNG.
// node design/mockups/findbox.mjs images/spotlight-housekeeping.png 255 0 255
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const [file, r, g, b] = process.argv.slice(2)
const data = (await readFile(path.resolve(HERE, file))).toString('base64')

const browser = await chromium.launch()
const page = await browser.newPage()
const out = await page.evaluate(async ([src, R, G, B]) => {
  const img = new Image()
  img.src = 'data:image/png;base64,' + src
  await img.decode()
  const c = document.createElement('canvas')
  c.width = img.naturalWidth; c.height = img.naturalHeight
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, c.width, c.height)
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1, n = 0
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4
      if (Math.abs(data[i] - R) < 40 && Math.abs(data[i + 1] - G) < 40 && Math.abs(data[i + 2] - B) < 40) {
        n++
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      }
    }
  }
  return { size: [c.width, c.height], n, box: n ? [minX, minY, maxX, maxY] : null }
}, [data, +r, +g, +b])
console.log(file, JSON.stringify(out), '→ CSS:', out.box ? `x ${out.box[0] / 2}..${out.box[2] / 2}, y ${out.box[1] / 2}..${out.box[3] / 2}` : '')
await browser.close()
