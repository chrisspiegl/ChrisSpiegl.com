// Where the site's images live, and the manifest that describes them.
//
// Content images (everything in assets/images except the folders in
// REPO_FOLDERS) are stored in the R2 bucket behind https://r2.chrisspiegl.com
// instead of git. Markdown keeps writing /assets/images/<key>, and
// `pnpm images:push` (utils/imagesCli.js) uploads new files and records each
// one in _data/images.json: size, content hash, ThumbHash, EXIF and location.
// Builds read only that manifest, so they never need the files or R2 access.
//
// Site images the layout depends on (avatar, default share photo,
// signatures) stay in the repo, in the folders below.

const fs = require('node:fs')
const path = require('node:path')

const R2_URL = 'https://r2.chrisspiegl.com'
const SRC_PREFIX = '/assets/images/'
const REPO_FOLDERS = ['other', 'qrcodes']

const rootDir = path.join(__dirname, '..')
const imagesDir = path.join(rootDir, 'assets', 'images')
const manifestFile = path.join(rootDir, '_data', 'images.json')

// "/assets/images/gear/x.png" -> "gear/x.png" (the R2 key), or null for paths
// outside assets/images and for the folders that stay in the repo.
function keyFor(src) {
  if (typeof src !== 'string' || !src.startsWith(SRC_PREFIX))
    return null
  const key = decodeURI(src.slice(SRC_PREFIX.length).split(/[?#]/)[0])
  if (!key || REPO_FOLDERS.includes(key.split('/')[0]))
    return null
  return key
}

function srcFor(key) {
  return SRC_PREFIX + key
}

let manifest = null
function readManifest() {
  if (manifest)
    return manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  }
  catch {
    manifest = { images: {} }
  }
  manifest.images ||= {}
  return manifest
}

function writeManifest(data) {
  const sorted = Object.fromEntries(Object.entries(data.images).sort(([a], [b]) => a.localeCompare(b)))
  const out = { ...data, images: sorted }
  fs.writeFileSync(manifestFile, `${JSON.stringify(out, null, 2)}\n`)
  manifest = out
}

// Lower-case key -> real key, to catch paths that only differ in case.
let lowerIndex = null
function caseMatch(key) {
  if (!lowerIndex) {
    lowerIndex = new Map()
    for (const real of Object.keys(readManifest().images))
      lowerIndex.set(real.toLowerCase(), real)
  }
  return lowerIndex.get(key.toLowerCase()) || null
}

function entry(key) {
  return readManifest().images[key] || null
}

// Public URL of an object. The content hash in ?v= changes when a file is
// replaced, so the URL can be cached for a year.
function r2Url(key, { source = false } = {}) {
  const item = entry(key)
  const objectKey = (source && item && item.source) || key
  const version = item && item.hash
    ? `?v=${item.hash.slice(0, 8)}`
    : ''
  return `${R2_URL}/${encodeURI(objectKey)}${version}`
}

// True when the file exists on disk with exactly this spelling. macOS ignores
// case, so fs.existsSync alone would accept a wrong-case path.
function existsExactly(file) {
  const relative = path.relative(rootDir, file)
  let dir = rootDir
  for (const part of relative.split(path.sep)) {
    let names
    try {
      names = fs.readdirSync(dir)
    }
    catch {
      return false
    }
    if (!names.includes(part))
      return false
    dir = path.join(dir, part)
  }
  return true
}

// Top-level folders on R2 ("gear", "post", ...), for the redirects that keep
// old /assets/images/... links working.
function r2Folders() {
  return [
    ...new Set(Object.keys(readManifest().images).map(key => key.split('/')[0]).filter(folder => !folder.startsWith('_'))),
  ].sort()
}

module.exports = {
  r2Folders,
  R2_URL,
  REPO_FOLDERS,
  SRC_PREFIX,
  caseMatch,
  entry,
  existsExactly,
  imagesDir,
  keyFor,
  manifestFile,
  r2Url,
  readManifest,
  rootDir,
  srcFor,
  writeManifest,
}
