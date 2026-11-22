// Responsive images served through Cloudflare Images transformations.
//
// Production builds point every <img> at /cdn-cgi/image/<options>/<original>,
// so Cloudflare resizes on demand and picks AVIF, WebP or JPEG per browser
// (format=auto). Only the originals in assets/images are deployed.
// Local and preview builds use the originals directly, since /cdn-cgi/image
// only exists on the production zone.

const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')
const { imageSize } = require('image-size')
const { placeholder } = require('./thumbhash')

// The only widths the site ever requests. Keep this list short: each width per
// image is one "unique transformation" per month (format/quality don't count).
const WIDTHS = [320, 640, 960, 1280, 1920]

// Common `sizes` values, matched to the layout in assets/scss.
const SIZES = {
  content: '(min-width: 1089px) 980px, 90vw',
  half: '(max-width: 490px) 90vw, 490px',
  third: '34vw',
  full: '100vw',
  avatar: '96px',
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

const dimensionCache = new Map()
function dimensions(src) {
  if (!isLocalImage(src))
    return null
  if (dimensionCache.has(src))
    return dimensionCache.get(src)
  let result = null
  try {
    const { width, height } = imageSize(fs.readFileSync(path.join(rootDir, src)))
    result = { width, height }
  }
  catch {
    console.warn(`[images] Could not read dimensions for ${src}`)
  }
  dimensionCache.set(src, result)
  return result
}

function transformUrl(src, width) {
  if (!useCloudflare() || !isLocalImage(src))
    return src
  const options = [
    `width=${width}`,
    'fit=scale-down',
    'format=auto',
    `quality=${QUALITY}`,
    'onerror=redirect',
  ]
  return `/cdn-cgi/image/${options.join(',')}${src}`
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
  if (!useCloudflare() || !isLocalImage(src))
    return ''
  const size = dimensions(src)
  return widthsFor(src)
    .map(w => `${transformUrl(src, w)} ${size
      ? Math.min(w, size.width)
      : w}w`)
    .join(', ')
}

// A sensible single URL (for src fallbacks, OG images, feeds).
function imageUrl(src, width = 1280) {
  return transformUrl(src, width)
}

function escapeAttr(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

// Build attributes for an <img>. `sizes` can be a key of SIZES or a raw value.
function imageAttributes(src, { alt = '', sizes = 'content', loading = 'lazy', title, className, defaultWidth = 1280 } = {}) {
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
  const preview = placeholder(src)
  if (preview) {
    attrs.style = `background:url(${preview}) center/cover no-repeat`
    if (size)
      attrs.style += `;aspect-ratio:${size.width}/${size.height}`
  }
  return attrs
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
  verifyCloudflareImages,
  SIZES,
  dimensions,
  imageAttributes,
  imageHtml,
  imageUrl,
  srcset,
  useCloudflare,
}
