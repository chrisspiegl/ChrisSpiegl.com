// Responsive images served through Cloudflare Images transformations.
//
// Production builds point every <img> at /cdn-cgi/image/<options>/<source>,
// so Cloudflare resizes on demand and picks AVIF, WebP or JPEG per browser
// (format=auto). The source is either a file in the repo (site images in
// assets/images/other) or an object on https://r2.chrisspiegl.com (content
// images, listed in _data/images.json; see utils/imageStore.js).
//
// Local and preview builds use repo images as they are. R2 images use the
// local file when it is on disk (local dev), otherwise the production
// transformation URL on https://chrisspiegl.com, which works from any host.

const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')
const { imageSize } = require('image-size')
const store = require('./imageStore')
const { placeholder: thumbhashPlaceholder } = require('./thumbhash')

// The only widths the site ever requests. Keep this list short: each width per
// image is one "unique transformation" per month (format/quality don't count).
// 1200 rather than 1280: Cloudflare encodes AVIF only up to 1,200 px, so one
// more step gets AVIF.
const WIDTHS = [320, 640, 960, 1200, 1920]
const SITE_URL = 'https://chrisspiegl.com'

// Common `sizes` values, matched to the layout in assets/scss.
const SIZES = {
  content: '(min-width: 1089px) 980px, 90vw',
  half: '(max-width: 490px) 90vw, 490px',
  third: '34vw',
  full: '100vw',
  avatar: '96px',
  // /uses cards: one column on phones, then a grid of cards at least 20rem wide.
  card: '(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 420px',
}

const QUALITY = 82
const rootDir = path.join(__dirname, '..')

function useCloudflare() {
  if (process.env.IMAGES_CDN === 'cloudflare')
    return true
  if (process.env.IMAGES_CDN === 'local')
    return false
  // Cloudflare Pages sets CF_PAGES_BRANCH, Workers Builds WORKERS_CI_BRANCH.
  // Only production serves /cdn-cgi/image.
  const branch = process.env.CF_PAGES_BRANCH || process.env.WORKERS_CI_BRANCH
  return branch === (process.env.PRODUCTION_BRANCH || 'main')
}

function isLocalImage(src) {
  return typeof src === 'string' && src.startsWith('/assets/') && /\.(?:jpe?g|png|gif|webp)$/i.test(src)
}

const warned = new Set()
function warnOnce(message) {
  if (!warned.has(message)) {
    warned.add(message)
    console.warn(message)
  }
}

// What an image path points at:
//   repo     a file committed in assets/images (or not an image path at all)
//   r2       a content image listed in _data/images.json
//   local    a content image on disk that hasn't been pushed yet (local dev)
//   missing  nothing at all
// A path that only differs in case from a pushed image is always an error:
// it works on a Mac and breaks on the live site. With `strict` (Markdown
// images), a missing image is an error too.
const resolved = new Map()
function resolve(src, { strict = false } = {}) {
  const key = store.keyFor(src)
  if (!key || !isLocalImage(src))
    return { kind: 'repo' }
  if (resolved.has(src) && !strict)
    return resolved.get(src)
  let result
  const item = store.entry(key)
  const onDisk = store.existsExactly(path.join(rootDir, src))
  if (item) {
    result = { kind: 'r2', key, item, onDisk }
    // Recorded with --no-upload but never uploaded: the live site would show
    // a broken image, so production stops; other builds only warn.
    if (!item.uploadedAt && (process.env.WORKERS_CI || process.env.CI)) {
      const message = `[images] ${src} is in _data/images.json but not uploaded yet. Run pnpm images:push.`
      if (useCloudflare())
        throw new Error(message)
      warnOnce(message)
    }
  }
  else if (onDisk) {
    result = { kind: 'local', key }
    if (process.env.WORKERS_CI || process.env.CI)
      throw new Error(`[images] ${src} is on disk but not in _data/images.json. Run pnpm images:push.`)
    warnOnce(`[images] ${src} is not pushed to R2 yet (pnpm images:push).`)
  }
  else {
    const real = store.caseMatch(key)
    if (real)
      throw new Error(`[images] ${src} differs only in case from a pushed image. Did you mean ${store.srcFor(real)}?`)
    if (strict)
      throw new Error(`[images] ${src} doesn't exist. Add the file to assets/images and run pnpm images:push.`)
    result = { kind: 'missing', key }
  }
  resolved.set(src, result)
  return result
}

const dimensionCache = new Map()
function dimensions(src) {
  if (!isLocalImage(src))
    return null
  if (dimensionCache.has(src))
    return dimensionCache.get(src)
  let result = null
  const target = resolve(src)
  if (target.kind === 'r2') {
    result = { width: target.item.width, height: target.item.height }
  }
  else if (target.kind !== 'missing') {
    try {
      const { width, height } = imageSize(fs.readFileSync(path.join(rootDir, src)))
      result = { width, height }
    }
    catch {
      console.warn(`[images] Could not read dimensions for ${src}`)
    }
  }
  dimensionCache.set(src, result)
  return result
}

// How to serve an image: through a Cloudflare transformation (base is '' on
// production, the site URL elsewhere) or as a plain URL.
function delivery(src) {
  if (!isLocalImage(src))
    return { plain: src }
  const target = resolve(src)
  if (target.kind === 'r2') {
    const source = store.r2Url(target.key, { source: true })
    if (process.env.IMAGES_CDN === 'local') {
      return {
        plain: target.onDisk ? src : source,
      }
    }
    if (useCloudflare())
      return { base: '', source }
    return target.onDisk
      ? { plain: src }
      : { base: SITE_URL, source }
  }
  if (target.kind === 'repo' && useCloudflare())
    return { base: '', source: src }
  return { plain: src }
}

// Cloudflare transformation URL for any options, or the plain URL when the
// image isn't transformed in this build.
function transformedUrl(src, options) {
  const how = delivery(src)
  if (how.plain)
    return how.plain
  const separator = how.source.startsWith('/')
    ? ''
    : '/'
  return `${how.base}/cdn-cgi/image/${options}${separator}${how.source}`
}

function transformUrl(src, width) {
  return transformedUrl(src, [
    `width=${width}`,
    'fit=scale-down',
    'format=auto',
    `quality=${QUALITY}`,
    'onerror=redirect',
  ].join(','))
}

function isTransformed(src) {
  return !delivery(src).plain
}

// Widths to offer for an image: every step below its real width, plus the step
// that covers it, so we never ask Cloudflare to upscale.
function widthsFor(src) {
  const size = dimensions(src)
  if (!size)
    return WIDTHS
  const below = WIDTHS.filter(w => w < size.width)
  const cover = WIDTHS.find(w => w >= size.width)
  return cover
    ? [...below, cover]
    : below
}

function srcset(src) {
  if (!isTransformed(src))
    return ''
  const size = dimensions(src)
  return widthsFor(src)
    .map(w => `${transformUrl(src, w)} ${size
      ? Math.min(w, size.width)
      : w}w`)
    .join(', ')
}

// A sensible single URL (for src fallbacks, OG images, feeds).
function imageUrl(src, width = 1200) {
  return transformUrl(src, width)
}

function escapeAttr(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

// Build attributes for an <img>. `sizes` can be a key of SIZES or a raw value.
function imageAttributes(src, { alt = '', sizes = 'content', loading = 'lazy', title, className, defaultWidth = 1200, strict = false, shape = true } = {}) {
  resolve(src, { strict })
  // Reuse one of the srcset URLs as the fallback src, so it costs no extra transformation.
  const offered = widthsFor(src)
  const fallbackWidth = offered.filter(w => w <= defaultWidth).pop() || offered[0] || defaultWidth
  const attrs = {
    src: imageUrl(src, fallbackWidth),
    alt,
  }
  const set = srcset(src)
  if (set) {
    attrs.srcset = set
    attrs.sizes = SIZES[sizes] || sizes
  }
  const size = dimensions(src)
  if (size) {
    attrs.width = size.width
    attrs.height = size.height
  }
  if (loading)
    attrs.loading = loading
  attrs.decoding = 'async'
  if (title)
    attrs.title = title
  if (className)
    attrs.class = className
  // Blurred ThumbHash preview behind the image until it has loaded (no JS needed).
  // aspect-ratio keeps the box (and the preview) at the image's shape even
  // while the image is missing; class-level width/height still win.
  // `shape: false` leaves the shape to the CSS (fixed-shape tiles).
  const preview = placeholder(src)
  if (preview) {
    attrs.style = `background:url(${preview}) center/cover no-repeat`
    if (size && shape)
      attrs.style += `;aspect-ratio:${size.width}/${size.height}`
    // A transparent image would show the blur through its empty areas:
    // drop the preview once it has loaded, back to the CSS background (without
    // JavaScript it stays).
    if (resolve(src).item?.transparent)
      attrs.onload = 'this.style.background=\'\''
  }
  return attrs
}

// Blurred ThumbHash preview: from the manifest for R2 images, else computed
// at build time (utils/thumbhash.js).
function placeholder(src) {
  const target = resolve(src)
  if (target.kind === 'r2')
    return target.item.thumbhash || null
  return thumbhashPlaceholder(src)
}

// Shooting data for the site images in the repo, read before each build so
// `!!! figure exif` works for them too (pushed images have it in the manifest).
const repoInfo = new Map()
async function prepareRepoImageInfo() {
  const { readMeta } = require('./imageMeta')
  for (const folder of store.REPO_FOLDERS) {
    const dir = path.join(store.imagesDir, folder)
    if (!fs.existsSync(dir))
      continue
    for (const name of fs.readdirSync(dir)) {
      const src = `${store.SRC_PREFIX}${folder}/${name}`
      if (!isLocalImage(src) || repoInfo.has(src))
        continue
      const buffer = fs.readFileSync(path.join(dir, name))
      const size = dimensions(src)
      if (!size)
        continue
      const { exif, location } = await readMeta(buffer)
      repoInfo.set(src, {
        ...size,
        bytes: buffer.length,
        exif,
        location,
      })
    }
  }
}

// Size, EXIF and location of an image: the manifest entry of a pushed image,
// or what the file says for a site image in the repo. Null when unknown.
function imageInfo(src) {
  const target = resolve(src)
  if (target.kind === 'r2')
    return target.item
  return repoInfo.get(src) || null
}

// False when an image path points at nothing (not pushed, not in the repo),
// so templates can leave out a broken <img>.
function hasImage(src) {
  return resolve(src).kind !== 'missing'
}

// The original file on R2, for "View full resolution" links.
function originalUrl(src) {
  const target = resolve(src)
  return target.kind === 'r2'
    ? store.r2Url(target.key)
    : src
}

function imageHtml(src, options) {
  const attrs = imageAttributes(src, options)
  return `<img ${Object.entries(attrs).map(([k, v]) => `${k}="${escapeAttr(v)}"`).join(' ')}>`
}

// On production builds, check once that the zone actually serves
// transformations. If not (feature switched off), fall back to originals
// instead of shipping broken images.
async function verifyCloudflareImages(siteUrl, sampleSrc) {
  if (process.env.IMAGES_CDN || !useCloudflare())
    return
  const probe = `${siteUrl}/cdn-cgi/image/width=${WIDTHS[0]},format=auto${sampleSrc}`
  try {
    const response = await fetch(probe, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
    })
    if (response.ok && (response.headers.get('content-type') || '').startsWith('image/'))
      return
    console.warn(`[images] Cloudflare Images not available (HTTP ${response.status}); using original images.`)
  }
  catch (error) {
    console.warn(`[images] Cloudflare Images check failed (${error.message}); using original images.`)
  }
  process.env.IMAGES_CDN = 'local'
}

module.exports = {
  WIDTHS,
  hasImage,
  prepareRepoImageInfo,
  imageInfo,
  originalUrl,
  transformedUrl,
  verifyCloudflareImages,
  SIZES,
  dimensions,
  imageAttributes,
  imageHtml,
  imageUrl,
  srcset,
  useCloudflare,
}
