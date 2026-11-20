// Build-time ThumbHash placeholders for images.
//
// Before each build, every image in assets/images gets a ThumbHash
// (https://evanw.github.io/thumbhash/), rendered to a tiny blurred, lossless WebP data URL.
// utils/images.js puts that data URL on the <img> as a CSS background, so a
// blurred preview shows instantly and the real image paints over it once it
// loads. No JavaScript runs in the browser.
//
// Results are cached in .cache/thumbhash.json by path, size and modification
// time, so only new or changed images are processed.

const { Buffer } = require('node:buffer')
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const rootDir = path.join(__dirname, '..')
const imagesDir = path.join(rootDir, 'assets', 'images')
const cacheFile = path.join(rootDir, '.cache', 'thumbhash.json')
const IMAGE_PATTERN = /\.(?:jpe?g|png|webp)$/i
const CONCURRENCY = 4
// Bump when the placeholder encoding changes, to rebuild the cache.
const VERSION = 2

let placeholders = {}

function walk(dir) {
  if (!fs.existsSync(dir))
    return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory())
      return walk(full)
    return IMAGE_PATTERN.test(entry.name)
      ? [full]
      : []
  })
}

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
  }
  catch {
    return {}
  }
}

async function placeholderFor(file, thumbhash) {
  // ThumbHash works on images up to 100x100 pixels.
  const { data, info } = await sharp(file)
    .rotate()
    .resize(100, 100, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // Skip images with real transparency (logos, cut-outs): the blur would show
  // through the transparent areas after the image has loaded.
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250)
      return null
  }

  // Decode the hash back to a tiny image and store it as a lossless WebP
  // (about 0.9 KB). Lossy WebP is smaller but shows visible blocks once the
  // browser scales it up; the library's own PNG output is uncompressed (~4 KB).
  const hash = thumbhash.rgbaToThumbHash(info.width, info.height, data)
  const { w, h, rgba } = thumbhash.thumbHashToRGBA(hash)
  const webp = await sharp(Buffer.from(rgba), {
    raw: { width: w, height: h, channels: 4 },
  })
    .removeAlpha()
    .webp({ lossless: true })
    .toBuffer()
  return `data:image/webp;base64,${webp.toString('base64')}`
}

async function preparePlaceholders() {
  const thumbhash = await import('thumbhash')
  const cache = readCache()
  const next = {}
  const files = walk(imagesDir)
  const todo = []

  for (const file of files) {
    const src = `/${path.relative(rootDir, file).split(path.sep).join('/')}`
    const { size, mtimeMs } = fs.statSync(file)
    const cached = cache[src]
    if (cached && cached.version === VERSION && cached.size === size && cached.mtimeMs === mtimeMs)
      next[src] = cached
    else
      todo.push({ file, src, size, mtimeMs })
  }

  let failed = 0
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(todo.slice(i, i + CONCURRENCY).map(async ({ file, src, size, mtimeMs }) => {
      try {
        next[src] = {
          version: VERSION,
          size,
          mtimeMs,
          dataUrl: await placeholderFor(file, thumbhash),
        }
      }
      catch {
        failed++
      }
    }))
  }

  if (todo.length) {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
    fs.writeFileSync(cacheFile, JSON.stringify(next))
  }

  placeholders = next
  const count = Object.values(next).filter(entry => entry.dataUrl).length
  console.log(`[thumbhash] ${count} placeholders (${todo.length} new${failed
    ? `, ${failed} failed`
    : ''})`)
}

// Data URL of the blurred preview for a local image, or null.
function placeholder(src) {
  return (placeholders[src] && placeholders[src].dataUrl) || null
}

module.exports = { placeholder, preparePlaceholders }
