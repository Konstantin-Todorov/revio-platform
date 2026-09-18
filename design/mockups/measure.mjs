// Dev helper: print the on-canvas geometry of a composition so callout/inset coordinates can be set
// from measurements instead of guessed. Usage:
//   node design/mockups/measure.mjs spotlight-housekeeping ".board" ".board .frame__media" ".detail" ".detail img"
import { chromium } from 'playwright'
import { readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SHOTS = path.resolve(HERE, '../../../revio-websites/public/screenshots')
const name = process.argv[2]
const selectors = process.argv.slice(3)

const src = await readFile(path.join(HERE, 'compositions', `${name}.html`), 'utf8')
const cache = new Map()
let html = src
for (const [, shot] of html.matchAll(/\{\{shot:([a-z0-9-]+)\}\}/g)) {
  if (!cache.has(shot)) cache.set(shot, `data:image/png;base64,${(await readFile(path.join(SHOTS, `${shot}.png`))).toString('base64')}`)
}
html = html.replace(/\{\{shot:([a-z0-9-]+)\}\}/g, (_, s) => cache.get(s))
const staged = path.join(HERE, 'compositions', `.measure-${name}.html`)
await writeFile(staged, html)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 750 } })
await page.goto(pathToFileURL(staged).href)
await page.evaluate(() => document.fonts.ready)

for (const sel of selectors) {
  const box = await page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), transform: cs.transform }
  }, sel)
  console.log(sel.padEnd(34), box ? `${box.x},${box.y}  ${box.w}×${box.h}` : 'NOT FOUND')
}

await browser.close()
await rm(staged, { force: true })
