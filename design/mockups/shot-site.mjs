// Throwaway reference tool: serves the marketing site's static build on a local port and
// screenshots the real pages, so the artworks can be judged against the design they will sit in.
//   node design/mockups/shot-site.mjs            # homepage + product pages
//   node design/mockups/shot-site.mjs /pricing   # specific paths
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, stat, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../../../revio-websites/dist/client')
const OUT = path.join(HERE, '.preview')

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' }

const server = createServer(async (req, res) => {
  try {
    let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html')
    if (!path.extname(file)) file += '.html'
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const paths = process.argv.slice(2)
const pages = paths.length ? paths : ['/', '/reviolink', '/reviocrs', '/reviopms', '/reviodirect', '/compare', '/security']
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
for (const p of pages) {
  await page.goto(`http://127.0.0.1:${port}${p}`, { waitUntil: 'networkidle' })
  // Reveal-on-scroll: walk the page so nothing is left at opacity 0.
  await page.evaluate(async () => {
    const h = document.body.scrollHeight
    for (let y = 0; y < h; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)) }
    scrollTo(0, 0)
  })
  await page.waitForTimeout(400)
  const name = p === '/' ? 'home' : p.replace(/\//g, '-')
  const full = path.join(OUT, `site${name}.png`)
  await page.screenshot({ path: full, fullPage: true })
  const { width, height } = await page.evaluate(() => ({ width: document.body.scrollWidth, height: document.body.scrollHeight }))
  console.log(`${p.padEnd(14)} ${width}×${height} → ${path.relative(HERE, full)}`)
}
await browser.close()
server.close()
