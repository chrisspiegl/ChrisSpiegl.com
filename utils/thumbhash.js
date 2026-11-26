// Build-time ThumbHash placeholders for images.
//
// Before each build, every image in assets/images gets a ThumbHash
// (https://evanw.github.io/thumbhash/), rendered to a tiny blurred, lossless WebP data URL.
// utils/images.js puts that data URL on the <img> as a CSS background, so a
// blurred preview shows instantly and the real image paints over it once it
// loads. No JavaScript runs in the browser.
//
// Results are cached in .cache/thumbhash.json by each image's content hash, so
// only new or changed images are processed. The hash is the git blob SHA-1:
// one `git ls-files -s` call gives it for every committed image without reading
// any file. Images that are untracked or modified locally are hashed the same
// way in Node, so their cache entries still match once they are committed.
// Keying on content (not modification time) keeps the cache valid on a fresh
// clone, such as each Cloudflare build, and when an image is renamed or moved.

const { Buffer } = require('node:buffer')
const { execFileSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const buildStats = require('./buildStats')

const rootDir = path.join(__dirname, '..')
const imagesDir = path.join(rootDir, 'assets', 'images')
const cacheFile = path.join(rootDir, '.cache', 'thumbhash.json')
const IMAGE_PATTERN = /\.(?:jpe?g|png|webp)$/i
const CONCURRENCY = 4
// Bump when the placeholder encoding changes, to rebuild the cache.
const VERSION = 3

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
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
    if (cache.version === VERSION && cache.entries)
      return cache.entries
  }
  catch {}
  return {}
}

// Path (relative to the repo, with /) -> git blob SHA-1, for every image that
// is committed and unchanged in the working tree. Empty when git is missing.
function gitHashes() {
  const git = args => execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const hashes = new Map()
  try {
    for (const line of git([
      'ls-files',
      '-s',
      '-z',
      '--',
      'assets/images',
    ]).split('\0')) {
      // "<mode> <sha> <stage>\t<path>"
      const match = /^\d+ ([0-9a-f]+) \d+\t(.+)$/s.exec(line)
      if (match)
        hashes.set(match[2], match[1])
    }
    for (const changed of git([
      'ls-files',
      '-m',
      '-z',
      '--',
      'assets/images',
    ]).split('\0'))
      hashes.delete(changed)
  }
  catch {}
  return hashes
}

// The same SHA-1 git would give this file, computed from its bytes.
function blobHash(file) {
  const data = fs.readFileSync(file)
  return crypto.createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')
}

// ThumbHash works on images up to 100x100 pixels.
function pixels(file, background) {
  let image = sharp(file).rotate().resize(100, 100, { fit: 'inside' })
  if (background)
    image = image.flatten({ background })
  return image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
}

// True when the image has real transparency (cut-outs, logos).
async function hasTransparency(file) {
  const { data } = await pixels(file)
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250)
      return true
  }
  return false
}

// `background`: the colour to put behind transparent images first (the tile
// they sit on). Without it, transparent images get no preview, because the
// blur would show through the transparent areas after the image has loaded.
// With it, the page has to drop the preview once the image is in
// (imageAttributes does that for pushed images marked `transparent`).
async function placeholderFor(file, thumbhash, { background } = {}) {
  if (await hasTransparency(file) && !background)
    return null
  const { data, info } = await pixels(file, background)

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
  const started = performance.now()
  const thumbhash = await import('thumbhash')
  const cache = readCache()
  const next = {}
  const files = walk(imagesDir)
  const fromGit = gitHashes()
  const bySrc = {}
  const todo = new Map()

  for (const file of files) {
    const relative = path.relative(rootDir, file).split(path.sep).join('/')
    const hash = fromGit.get(relative) || blobHash(file)
    bySrc[`/${relative}`] = hash
    if (hash in cache)
      next[hash] = cache[hash]
    else
      todo.set(hash, file)
  }

  let failed = 0
  const jobs = [...todo]
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    await Promise.all(jobs.slice(i, i + CONCURRENCY).map(async ([hash, file]) => {
      try {
        next[hash] = await placeholderFor(file, thumbhash)
      }
      catch {
        failed++
      }
    }))
  }

  // Rewrite when something was added, or when entries for removed images can
  // be dropped.
  if (todo.size || Object.keys(next).length !== Object.keys(cache).length) {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
    fs.writeFileSync(cacheFile, JSON.stringify({ version: VERSION, entries: next }))
  }

  placeholders = Object.fromEntries(Object.entries(bySrc).map(([src, hash]) => [src, next[hash] || null]))
  const count = Object.values(placeholders).filter(Boolean).length
  buildStats.record('thumbhash', {
    images: files.length,
    placeholders: count,
    cached: Object.keys(cache).length,
    computed: todo.size,
    hashedByGit: fromGit.size,
    failed,
    ms: Math.round(performance.now() - started),
  })
  console.log(`[thumbhash] ${count} of ${files.length} images have placeholders (${todo.size} new, ${fromGit.size} hashed by git${failed
    ? `, ${failed} failed`
    : ''})`)
}

// Data URL of the blurred preview for a local image, or null.
function placeholder(src) {
  return placeholders[src] || null
}

module.exports = {
  hasTransparency,
  placeholder,
  placeholderFor,
  preparePlaceholders,
}
