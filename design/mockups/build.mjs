#!/usr/bin/env node
/**
 * Renders the marketing compositions in `compositions/` to PNG files in `out/`.
 *
 * Why a renderer instead of hand-drawn images: every artwork below is built out of **real product
 * captures** — nothing is painted, invented or approximated. The screenshots are the website
 * repository's own `public/screenshots/*.png`; this script only frames, annotates and lights them.
 * That means an artwork cannot drift from the product, and re-running it after a UI change refreshes
 * every image at once.
 *
 * Usage (from the platform root):
 *   node design/mockups/build.mjs                 # every job
 *   node design/mockups/build.mjs hero workflow   # only jobs whose name contains a filter
 *   REVIO_SHOTS=/path/to/screenshots node design/mockups/build.mjs
 *
 * The captures are NOT copied into this repo — they are read from their real home:
 *   ../revio-websites/public/screenshots
 * Override with REVIO_SHOTS if that sibling checkout lives somewhere else.
 */
import { chromium } from 'playwright'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
/** Named `images/` on purpose: the root .gitignore ignores any directory called `out/`. */
const OUT = path.join(HERE, 'images')

/** Where the real captures live. Never duplicated into this repository. */
const SHOTS = path.resolve(
  process.env.REVIO_SHOTS ?? path.join(HERE, '..', '..', '..', 'revio-websites', 'public', 'screenshots'),
)

/**
 * Retina factor. 2 keeps every image crisp on the phone/tablet/desktop spread the site is read on,
 * while staying under the point where a PNG of the product UI turns into an unacceptable file size.
 */
const SCALE = Number(process.env.REVIO_SCALE ?? 2)

/**
 * One entry per artwork.
 *
 * `width`/`height` are the 1× CSS pixel canvas — chosen so the OUTPUT aspect ratio is the one the
 * website slot needs, which is what stops the page shifting when an image is dropped in:
 *
 *   1.6  (16:10) — the site's `BrowserFrame` media slot (`aspect-[16/10]`), so an image in one of
 *                  those fits with no crop at all.
 *   1.6          — also the native aspect of every product capture, so nothing is letterboxed.
 *   1.777        (16:9) — full-bleed section bands.
 *   1.904        (40:21) — the 1200×630 social card.
 */
const JOBS = [
  {
    name: 'hero-one-core',
    file: 'hero-one-core.html',
    width: 1200,
    height: 750,
    title: 'One core, three products',
    home: 'Homepage hero',
    place: 'Full width, under the headline. Replaces the single platform screenshot currently in `BrowserFrame`.',
  },
  {
    name: 'product-link',
    file: 'product-link.html',
    width: 1200,
    height: 750,
    title: 'RevioLink — annotated',
    home: 'RevioLink page',
    place: 'Full width. Three callouts name the regions a buyer asks about before they book a call.',
  },
  {
    name: 'product-crs',
    file: 'product-crs.html',
    width: 1200,
    height: 750,
    title: 'RevioCRS — annotated',
    home: 'RevioCRS page',
    place: 'Full width. Leads with the reservation record, not the analytics dashboard.',
  },
  {
    name: 'product-pms',
    file: 'product-pms.html',
    width: 1200,
    height: 750,
    title: 'RevioPMS — annotated',
    home: 'RevioPMS page',
    place: 'Full width. The front desk, where the shared record arrives.',
  },
  {
    name: 'workflow-one-record',
    file: 'workflow-one-record.html',
    width: 1200,
    height: 750,
    title: 'One shared record, three seats',
    home: 'Homepage — “How it works” band',
    place: 'Full width, or in the half column beside the copy. Makes the composable claim a diagram instead of an assertion.',
  },
  {
    name: 'channels-one-calendar',
    file: 'channels-one-calendar.html',
    width: 1200,
    height: 750,
    title: 'Many channels, one calendar',
    home: 'RevioLink page — distribution',
    place: 'Full width. The four channel nameplates drop into the layout and point at one screen.',
  },
  {
    name: 'spotlight-housekeeping',
    file: 'spotlight-housekeeping.html',
    width: 1200,
    height: 750,
    title: 'Housekeeping, at 2×',
    home: 'RevioPMS page — housekeeping',
    place: 'Full width. The magnified inset is the same capture, so the detail cannot drift from the board.',
  },
  {
    name: 'record-guest-to-folio',
    file: 'record-guest-to-folio.html',
    width: 1200,
    height: 750,
    title: 'The guest’s side and your side',
    home: 'RevioDirect page',
    place: 'Full width. The strongest structural claim on the site, shown rather than described.',
  },
  {
    name: 'security-perimeters',
    file: 'security-perimeters.html',
    width: 1200,
    height: 675,
    title: 'Two perimeters',
    home: 'Security & trust page',
    place: 'Full width or half column. ⚠️ A diagram, not a capture — it says so on the image.',
  },
  {
    name: 'og-platform',
    file: 'og-platform.html',
    width: 1200,
    height: 630,
    title: 'Social share card (2×)',
    home: 'og:image',
    place: 'The 2× master, for anywhere that wants the retina file.',
  },
  // A second render of the same composition at 1×. Social cards are the one place an exact pixel
  // size is asked for (1200×630), so the deliverable is that file rather than a specification
  // nobody reads. `scale` overrides the retina factor for one job.
  {
    name: 'og-platform-1200',
    file: 'og-platform.html',
    width: 1200,
    height: 630,
    scale: 1,
    title: 'Social share card (1200×630)',
    home: 'og:image — use this file',
    place: 'Drop-in for `public/og/revio-og.png`. The copy is baked in because a share card has no page around it.',
    master: true,
  },
]

/**
 * `{{shot:link-channels}}` → the real capture, inlined as a data URI.
 *
 * ⚠️ Not a file:// URL. Chromium refuses to load a file:// subresource from a file:// page, and it
 * does so **silently** — the frame renders as empty chrome and the artwork still writes out as a
 * valid, plausible-looking PNG. That failure mode cost one round of this build: the images came out
 * at 13 KB and nothing anywhere said why. Inlining removes the class of problem rather than working
 * around it, and keeps the render hermetic (no server, no port, no base URL).
 */
const cache = new Map()
const inline = async (file) => {
  if (!cache.has(file)) {
    if (!existsSync(file)) throw new Error(`missing asset: ${file}`)
    cache.set(file, `data:image/png;base64,${(await readFile(file)).toString('base64')}`)
  }
  return cache.get(file)
}

/** The website's own `public/` — brand marks live here, next to the captures. */
const PUBLIC = path.dirname(SHOTS)

async function resolveShots (html) {
  const used = new Set()
  for (const name of new Set([...html.matchAll(/\{\{shot:([a-z0-9-]+)\}\}/g)].map((m) => m[1]))) {
    await inline(path.join(SHOTS, `${name}.png`))
    used.add(name)
  }
  for (const rel of new Set([...html.matchAll(/\{\{asset:([^}]+)\}\}/g)].map((m) => m[1].trim()))) {
    await inline(path.join(PUBLIC, rel))
  }
  const out = html
    .replace(/\{\{shot:([a-z0-9-]+)\}\}/g, (_, name) => cache.get(path.join(SHOTS, `${name}.png`)))
    .replace(/\{\{asset:([^}]+)\}\}/g, (_, rel) => cache.get(path.join(PUBLIC, rel.trim())))
  return { html: out, used: [...used] }
}

const filters = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const jobs = filters.length ? JOBS.filter((j) => filters.some((f) => j.name.includes(f))) : JOBS

if (!jobs.length) {
  console.error(`No job matched ${filters.join(', ')}. Known jobs:\n  ${JOBS.map((j) => j.name).join('\n  ')}`)
  process.exit(1)
}
if (!existsSync(SHOTS)) {
  console.error(
    `Product captures not found at:\n  ${SHOTS}\n\n` +
      'These artworks are built from the website repository\'s own screenshots. Point REVIO_SHOTS at\n' +
      'a folder containing them, or check out ../revio-websites beside this repository.',
  )
  process.exit(1)
}

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()

/** Fonts are the one thing that can silently differ — a fallback would change every measurement. */
let fontWarned = false

const written = []
const webSizes = []
/** name → data URI, for the generated review page. */
const previews = new Map()
for (const job of jobs) {
  const source = await readFile(path.join(HERE, 'compositions', job.file), 'utf8')
  const { html, used } = await resolveShots(source)

  // Stage the resolved document on disk so `../kit.css` resolves the way it does in the source
  // file, rather than against about:blank.
  const staged = path.join(HERE, 'compositions', `.staged-${job.name}.html`)
  await writeFile(staged, html)

  // One page per job: the retina factor is fixed when a page is created, so a job that wants 1×
  // (the social card) cannot share a page with the 2× artwork jobs.
  const scale = job.scale ?? SCALE
  const page = await browser.newPage({
    viewport: { width: job.width, height: job.height },
    deviceScaleFactor: scale,
  })
  await page.goto(pathToFileURL(staged).href, { waitUntil: 'load' })

  // Wait for the captures AND the webfont, then assert both actually arrived. A silent fallback
  // face or an empty frame is exactly the kind of failure that looks like a finished image.
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() =>
    [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 })
  if (!(await page.evaluate(() => document.fonts.check('400 16px Inter'))) && !fontWarned) {
    fontWarned = true
    console.warn('⚠  Inter did not load — text is rendering in a fallback face. Check network access.')
  }
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

  const file = path.join(OUT, `${job.name}.png`)
  await page.screenshot({ path: file })

  // A web-sized JPEG of the same page, embedded in the review page.
  // ⚠️ Embedded, not linked. The review page has to open from anywhere — the desktop app's preview
  // serves the single HTML file and nothing beside it, so a relative `images/…png` there is a broken
  // image. `scale: 'css'` renders at 1× rather than the display's DPR.
  const webJpeg = await page.screenshot({ type: 'jpeg', quality: 78, scale: 'css' })
  previews.set(job.name, `data:image/jpeg;base64,${webJpeg.toString('base64')}`)
  const size = (await stat(file)).size
  webSizes.push({ name: job.name, bytes: size, jpegBytes: webJpeg.length })

  written.push(`${job.name}.png  ${job.width * scale}×${job.height * scale}  ${used.length} capture(s)`)
  await page.close()
}

await browser.close()

/**
 * The review page, written from the same table that drives the renders.
 *
 * Generated rather than hand-kept: a gallery that lists files by hand is wrong the first time a
 * composition is renamed, and a wrong gallery is how somebody ships last week's image.
 */
async function writeGallery () {
  const cards = JOBS.map((job) => `
    <figure>
      <img src="${previews.get(job.name) ?? `images/${job.name}.png`}" alt="${job.title}" loading="lazy">
      <figcaption>
        <div class="row"><h2>${job.title}</h2><code>images/${job.name}.png</code></div>
        <p class="where">${job.home}</p>
        <p class="place">${job.place}</p>
      </figcaption>
    </figure>`).join('\n')

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Revio — website artwork</title>
<style>
  :root { --accent:#00d2ff; --line:rgba(255,255,255,.1) }
  * { box-sizing:border-box }
  body { margin:0; background:#0c0c0c; color:#fff; font:15px/1.6 Inter,system-ui,-apple-system,sans-serif; -webkit-font-smoothing:antialiased }
  header, main { max-width:1180px; margin:0 auto; padding:0 28px }
  header { padding-top:64px; padding-bottom:32px; border-bottom:1px solid var(--line) }
  .eyebrow { font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:#8b9aa4 }
  h1 { margin:14px 0 12px; font-size:40px; letter-spacing:-1.2px; line-height:1.1 }
  header p { margin:0; max-width:60ch; color:#9aa8b2 }
  header p + p { margin-top:10px; font-size:13px; color:#6f7f90 }
  main { padding-bottom:80px }
  figure { margin:56px 0 0; padding:0 }
  figure img { display:block; width:100%; height:auto; border:1px solid var(--line); border-radius:14px; background:#0a0b0d }
  figcaption { padding:18px 2px 0 }
  .row { display:flex; align-items:baseline; gap:14px; flex-wrap:wrap }
  h2 { margin:0; font-size:19px; font-weight:600; letter-spacing:-.3px }
  code { font-size:11px; color:#7fd7e6; background:rgba(0,210,255,.08); border:1px solid rgba(0,210,255,.2); padding:3px 8px; border-radius:6px }
  p { margin:0 }
  .where { margin-top:8px; font-size:12px; color:#8f9fab; letter-spacing:.04em; text-transform:uppercase }
  .place { margin-top:8px; font-size:14px; color:#9aa8b2; max-width:78ch }
  footer { max-width:1180px; margin:0 auto; padding:40px 28px 90px; border-top:1px solid var(--line); font-size:12px; color:#6f7f90 }
  footer code { border:0; background:none; padding:0; color:#9aa8b2 }
</style>
</head>
<body>
<header>
  <div class="eyebrow">Marketing artwork · local preview</div>
  <h1>Images for the website sections.</h1>
  <p>Every piece below is composed from the real product screenshots in the website repository — nothing is redrawn, invented or approximated. Re-render with <code>node design/mockups/build.mjs</code>.</p>
  <p>Not the live website, and not committed until you have looked at it.</p>
</header>
<main>${cards}
</main>
<footer>
  Artwork sources: <code>design/mockups/compositions/</code> · shared design tokens: <code>design/mockups/kit.css</code> · captures: <code>revio-websites/public/screenshots/</code>
</footer>
</body>
</html>`

  await writeFile(path.join(HERE, 'index.html'), html)
}

// The staged documents are build intermediates, not source. Leaving them behind would mean the
// folder holds two copies of every composition and no way to tell which one is real.
for (const job of jobs) await rm(path.join(HERE, 'compositions', `.staged-${job.name}.html`), { force: true })

// Also full-run only, for the same reason as the gallery.
if (!filters.length) await writeHandoff()

// Only on a full run: a filtered run has just changed one artwork, and rewriting the review page
// from a half-updated folder is how it ends up describing files that are still being generated.
if (!filters.length) await writeGallery()

/**
 * The handoff pack for a second agent (Claude Code, in its own session).
 *
 * Written to `handoff/`, and deliberately **one folder with no imports outside it**: the brief,
 * a machine-readable JSON manifest, the design kit, all ten compositions, the rendered PNGs and the
 * capture set are copied in, so the folder can be pointed at, zipped, or pasted into another repo
 * without anything resolving across a checkout boundary. `revio-websites` sits beside this repo on
 * this machine; there is no reason to assume the same of the next session.
 *
 * Every word in HANDOFF.md is derived from the same JOBS table that drove the renders — the
 * screenshot inventory, which artwork uses which capture and the placement advice are stated, not
 * reconstructed by the next agent from file names.
 */
async function writeHandoff () {
  const pack = path.join(HERE, 'handoff')
  const { cp, readdir } = await import('node:fs/promises')
  await rm(pack, { recursive: true, force: true })
  await mkdir(path.join(pack, 'screenshots'), { recursive: true })

  await cp(path.join(HERE, 'kit.css'), path.join(pack, 'kit.css'))
  for (const f of await readdir(path.join(HERE, 'compositions'))) {
    if (f.endsWith('.html') && !f.startsWith('.')) await cp(path.join(HERE, 'compositions', f), path.join(pack, 'compositions', f))
  }
  await cp(SHOTS, path.join(pack, 'screenshots'), { recursive: true })
  for (const job of JOBS) {
    await cp(path.join(OUT, `${job.name}.png`), path.join(pack, 'rendered', `${job.name}.png`))
  }

  const kb = (n) => `${Math.max(1, Math.round(n / 1024))} KB`
  /*
   * ⚠️ `await` inside a `.map()` callback is a syntax error — the callback is not async, and the
   * whole file fails to PARSE, so `node build.mjs` dies before a single artwork is rendered. Both
   * of these were written that way and the script had evidently not been run since. Sizes and file
   * contents are gathered first, then mapped.
   */
  const shotFiles = (await readdir(SHOTS)).filter((f) => f.endsWith('.png')).sort()
  const shotSizes = await Promise.all(shotFiles.map((f) => stat(path.join(SHOTS, f))))
  const shotRows = shotFiles
    .map((f, i) => `| \\'${f.replace('.png', '')}\\' | ${kb(shotSizes[i].size)} |`).join('\n')

  const jobFiles = JOBS.filter((j) => !j.master)
  const jobSources = await Promise.all(
    jobFiles.map((j) => readFile(path.join(HERE, 'compositions', j.file), 'utf8')),
  )
  const rows = jobFiles.map((j, ji) => {
    const caps = [...new Set(
      jobSources[ji].match(/\{\{shot:([a-z0-9-]+)\}\}/g) ?? [],
    )].map((m) => `\\'${m.replace('{{shot:', '').replace('}}', '')}\\'`).join(', ') || 'none — a diagram, not a capture'
    return `### ${j.name} — ${j.title}\n\n- **Where it belongs:** ${j.home}\n- **Placement:** ${j.place}\n- **Captures used:** ${caps}\n- **Rendered (2×):** \\'rendered/${j.name}.png\\' — ${j.width * 2}×${j.height * 2}\n`
  }).join('\n')

  const manifest = {
    generatedBy: 'design/mockups/build.mjs',
    note: 'Every artwork is composed from the real captures in screenshots/. Copy in copy/ is the artwork\'s own; regenerate rather than hand-edit.',
    site: {
      repo: '../revio-websites (sibling checkout on this machine)',
      tokens: 'src/styles/global.css — accent vars per product, near-black #0c0c0c ground, liquid-glass borders',
      frame: 'src/components/BrowserFrame.astro — product chrome + caption strip that sections already wrap screenshots in',
      mediaAspect: '16/10 (aspect-[16/10] in BrowserFrame; captures are natively 2880×1800 = 1.6)',
    },
    background: {
      decision: 'Artworks use a near-black grid + glow backdrop. The site wants its OWN background instead.',
      instruction: 'Strip .stage background/glow layers from the compositions (keep .stage--grid mask and layout); place frames and callouts on the page background directly.',
    },
    /* Same `await`-in-a-map problem as above; `jobSources` was already read for the brief. */
    artwork: jobFiles.map((j, ji) => ({
      name: j.name, title: j.title, where: j.home, placement: j.place,
      file: `rendered/${j.name}.png`, pixels: [j.width * 2, j.height * 2], canvas: [j.width, j.height],
      captures: [...new Set((jobSources[ji].match(/\{\{shot:([a-z0-9-]+)\}\}/g) ?? []).map((m) => m.slice(7, -2)))],
    })),
    socialCard: { file: 'rendered/og-platform-1200.png', pixels: [1200, 630], replaces: 'public/og/revio-og.png' },
  }
  await writeFile(path.join(pack, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

  const brief = `# Revio website sections — handoff pack

Everything needed to build these sections is **in this folder**. Nothing imports from outside it:
the sibling repositories are not assumed to exist.

## What this is

Marketing section artworks for reviosoft.app, each composed from **real product captures** — no
redrawn or invented UI. The compositions in \\'compositions/\\' are the source of truth; the PNGs in
\\'rendered/\\' are output. Change the composition, re-render — never retouch the PNG.

## Read first

1. \\'manifest.json\\' — machine-readable inventory: every artwork, its placement, its captures, its pixel size, and the background decision.
2. \\'kit.css\\' — the shared design language, lifted from the website's own tokens (\\'src/styles/global.css\\', \\'BrowserFrame.astro\\'). If the site's tokens change, change it here too.
3. \\'compositions/*.html\\' — ten working examples. Each is a standalone page on a fixed canvas, rendered at 2× by the same pattern: frame + optional callouts/detail inset on a stage.

## The captures

All in \\'screenshots/\\' (copied from the website repo's \\'public/screenshots/\\'; every file is 2880×1800, 16:10):

| Capture | Size |
| --- | --- |
${shotRows}

## The artworks

${rows}

### og-platform-1200 — Social share card

- **File:** \\'rendered/og-platform-1200.png\\' — exactly 1200×630 (a 2× master is alongside)
- **Replaces:** the site's \\'public/og/revio-og.png\\'. Copy is baked in because a share card has no page around it.

## Decisions already made — keep them

- **Real UI only.** A screenshot may be cropped, framed, annotated, magnified — never redrawn. The magnified inset in the housekeeping artwork is the same capture scaled, which is why it cannot disagree with the screen it came from.
- **Honesty labels.** Diagrams that are not captures (security-perimeters) say so on the image. Screens arranged to show a flow say they are not one transaction. Demo figures are labelled "demo property".
- **Thin demo data is not marketing.** The CRS analytics dashboard's demo month is real but thin (1.6% occupancy); the artworks deliberately lead with the reservations record instead. Do not reverse this.
- **16:10 everywhere.** The site's frame media slot is \\'aspect-[16/10]\\' and every capture is natively 1.6. Anything else letterboxes or crops.
- **Window edges close between rows.** A view window onto a capture ends at a row boundary, never through one.

## The background — READ THIS ONE

The compositions ship with a near-black \\'#0c0c0c\\' grid-and-glow backdrop. **The site does not want it.**
It has its own background and these sections must sit on that, now; the dark stage can come back later as a deliberate choice.

What to do: keep frame chrome, callouts, detail insets and all layout exactly as they are; remove the \'stage backdrop layers\' (the stage background gradients, the grid overlay and the glow blobs) so the pieces sit directly on the page's own background. Check every label colour still reads on it — the kit was written against near-black, so any label or caption that assumed #0c0c0c needs its colour re-derived from the site's real tokens, measured rather than eyeballed.

## Porting into the Astro site

The site already wraps every screenshot in \\'BrowserFrame\\' (product chrome + caption strip). Two ways to use these:

1. **Drop-in images.** Place a rendered PNG where \\'BrowserFrame\\' would appear (full-width sections), and skip the frame — the artwork already carries one. Aspect 16:10 matches the existing slot, so nothing shifts.
2. **Native sections.** Rebuild a composition as an Astro component (frames + callouts as markup), so callout labels stay real text. \\'kit.css\\' maps almost one-to-one onto the site's existing utility classes; the capture paths become \\'/screenshots/…\\' from \\'public/\\'.

Prefer (2) for anything with text baked in at artwork size — text in images is not translatable, not searchable and cannot be corrected after publication.

## Re-rendering (optional, on this machine)

From the platform repo root: \\'node design/mockups/build.mjs\\' (needs \\'../revio-websites\\' beside it — the pack removes that requirement for reading and porting, not for re-rendering).
`
  await writeFile(path.join(pack, 'HANDOFF.md'), brief)

  const listing = []
  for (const dir of ['', 'compositions/', 'rendered/', 'screenshots/']) {
    const items = await readdir(path.join(pack, dir), { withFileTypes: true })
    const files = items.filter((i) => i.isFile())
    listing.push(`${dir || './'} — ${files.length} file(s)`) 
  }
  console.log(`\nHandoff pack: design/mockups/handoff\n  ${listing.join('\n  ')}\n  + HANDOFF.md, manifest.json, kit.css`)
}

console.log(`\nRendered ${written.length} artwork(s) to design/mockups/images\n`)
for (const line of written) console.log('  ' + line)
console.log(`\nReview them: python3 -m http.server 3012 --bind 127.0.0.1 --directory design/mockups`)
