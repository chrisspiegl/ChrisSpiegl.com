#!/usr/bin/env node
// Content images on R2: `pnpm images:push` and `pnpm images:pull`.
//
// push  Finds every content image in assets/images (all folders except the
//       ones in REPO_FOLDERS, utils/imageStore.js), and for each new or
//       changed file:
//       1. renames it to a URL-safe name that keeps your casing
//          ("Leica Walk 01.JPG" -> "Leica-Walk-01.jpg"),
//       2. reads the shooting data and city/country (utils/imageMeta.js),
//       3. uploads a copy without metadata (no GPS, serial numbers or names;
//          the colour profile stays) at the size you exported,
//       4. adds a smaller copy for Cloudflare Images when the file is over
//          its limits (100 MP, 12,000 px per side, 100 MB),
//       5. records it in _data/images.json, and uploads a backup of that file.
//       Options: --dry-run (show what would happen), --no-upload (only update
//       the manifest), --force (process every file again).
// pull  Downloads every image in the manifest that isn't on disk, for a new
//       computer or a fresh clone. These are the cleaned copies.
//
// Uploads go through Wrangler, so `wrangler login` once (or set
// CLOUDFLARE_API_TOKEN). R2_BUCKET, R2_JURISDICTION and CLOUDFLARE_ACCOUNT_ID
// override the defaults below.

const { Buffer } = require('node:buffer')
const { execFile } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const process = require('node:process')
const { promisify } = require('node:util')
const sharp = require('sharp')
const { creditFor, embedCredit, isMine } = require('./copyright')
const { readMeta, stripMetadata } = require('./imageMeta')
const store = require('./imageStore')
const { hasTransparency, placeholderFor } = require('./thumbhash')

const BUCKET = process.env.R2_BUCKET || 'chrisspiegl-com-r2-production'
const JURISDICTION = process.env.R2_JURISDICTION || 'eu'
// CSX.Ventures, where the chrisspiegl-com Worker lives.
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '98a15ec912c10e09ccb4ba8951ded69f'
const CACHE_CONTROL = 'public, max-age=31536000, immutable'
const CONCURRENCY = 3

// Cloudflare Images limits for images stored outside Images (R2 included):
// https://developers.cloudflare.com/images/get-started/limits/
const MAX_PIXELS = 100_000_000
const MAX_SIDE = 12_000
const MAX_BYTES = 100 * 1024 * 1024

// Tags that must never reach R2. Artist and Copyright are written back on
// purpose (utils/copyright.js) and checked separately in assertClean.
const SENSITIVE = /^(?:GPS|latitude|longitude|Make|Model|Lens|SerialNumber|BodySerialNumber|CameraSerialNumber|InternalSerialNumber|OwnerName|CameraOwnerName|Byline|By-line|DateTimeOriginal|City|State|Country|Sub-?location|Location)/i

const INPUT = /\.(?:jpe?g|png|webp|gif|heic|heif|tiff?)$/i
const TYPES = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}
const EXTENSIONS = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
  gif: '.gif',
}

const run = promisify(execFile)
const args = new Set(process.argv.slice(3))
const dryRun = args.has('--dry-run')
const noUpload = args.has('--no-upload') || dryRun
const force = args.has('--force')

// "Leica Walk 01.JPG" -> "Leica-Walk-01.jpg". Keeps the casing, spells out
// umlauts, drops accents and anything that isn't a letter, digit, dot or dash.
function safeName(name, extension) {
  const base = name.slice(0, name.length - path.extname(name).length)
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w.-]/g, '')
    .replace(/_/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  return `${base || 'image'}${extension}`
}

function walk(dir, top = true) {
  if (!fs.existsSync(dir))
    return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.'))
      return []
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return top && store.REPO_FOLDERS.includes(entry.name)
        ? []
        : walk(full, false)
    }
    return INPUT.test(entry.name)
      ? [full]
      : []
  })
}

// When a file first entered git, for images that were in the repo before R2.
async function firstCommitDate(file) {
  try {
    const { stdout } = await run('git', [
      'log',
      '--diff-filter=A',
      '--follow',
      '--format=%aI',
      '--',
      file,
    ], { cwd: store.rootDir })
    const dates = stdout.trim().split('\n').filter(Boolean)
    return dates.length
      ? new Date(dates.at(-1)).toISOString()
      : null
  }
  catch {
    return null
  }
}

const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex')
const keyOf = file => path.relative(store.imagesDir, file).split(path.sep).join('/')

async function wrangler(params) {
  const bin = path.join(store.rootDir, 'node_modules', '.bin', 'wrangler')
  try {
    return await run(bin, params, {
      cwd: store.rootDir,
      env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID },
      maxBuffer: 16 * 1024 * 1024,
    })
  }
  catch (error) {
    throw new Error(`wrangler ${params.slice(0, 4).join(' ')} failed:\n${(error.stderr || error.stdout || error.message).trim()}`)
  }
}

async function upload(key, buffer, contentType, cacheControl = CACHE_CONTROL) {
  const temp = path.join(os.tmpdir(), `r2-${crypto.randomUUID()}`)
  fs.writeFileSync(temp, buffer)
  try {
    await wrangler([
      'r2',
      'object',
      'put',
      `${BUCKET}/${key}`,
      '--file',
      temp,
      '--content-type',
      contentType,
      '--cache-control',
      cacheControl,
      '--remote',
      '--jurisdiction',
      JURISDICTION,
    ])
  }
  finally {
    fs.rmSync(temp, { force: true })
  }
}

// Same format, re-encoded only when the pixels must change (rotation,
// conversion, downscaling). Quality stays high: Cloudflare compresses again.
function encode(image, format) {
  image = image.keepIccProfile()
  if (format === 'png')
    return image.png({ compressionLevel: 9 })
  if (format === 'webp')
    return image.webp({ quality: 95 })
  return image.jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
}

// The file as it goes to R2: no metadata, upright, in a web format.
async function cleanCopy(buffer, format, orientation) {
  if (!TYPES[format]) {
    try {
      return { buffer: await encode(sharp(buffer).rotate(), 'jpeg').toBuffer(), format: 'jpeg' }
    }
    catch {
      throw new Error(`can't read this ${format || 'file'}; export it as JPEG, PNG or WebP`)
    }
  }
  if (orientation !== 1 && format !== 'gif')
    return { buffer: await encode(sharp(buffer).rotate(), format).toBuffer(), format }
  return {
    buffer: stripMetadata(buffer, format),
    format,
  }
}

// Never upload a file that still says where it was taken or who owns the camera.
// Two checks: cleaning it again and adding the credit gives the same bytes
// (so nothing but the credit is left, in every format, WebP included), and
// exifr finds no sensitive tag.
async function assertClean(buffer, format, credit) {
  if (!embedCredit(stripMetadata(buffer, format), format, credit).equals(buffer))
    throw new Error('metadata survived cleaning')
  const exifr = (await import('exifr')).default
  const left = await exifr.parse(buffer, {
    gps: true,
    tiff: true,
    exif: true,
    iptc: true,
    xmp: true,
    mergeOutput: true,
  }).catch(() => null) || {}
  const found = Object.keys(left).filter(name => SENSITIVE.test(name))
  if (found.length)
    throw new Error(`metadata survived cleaning (${found.slice(0, 5).join(', ')})`)
  if ((left.Artist || credit?.artist) && left.Artist !== credit?.artist)
    throw new Error(`unexpected artist in the upload (${left.Artist})`)
}

function overLimits({ width, height }, bytes) {
  return width * height > MAX_PIXELS || Math.max(width, height) > MAX_SIDE || bytes > MAX_BYTES
}

// A copy just under Cloudflare's limits, only used as the source for resizing.
async function displayCopy(buffer, format, { width, height }) {
  const scale = Math.min(1, Math.sqrt((MAX_PIXELS * 0.99) / (width * height)), MAX_SIDE / Math.max(width, height))
  const out = await encode(sharp(buffer).resize(Math.floor(width * scale)), format === 'png'
    ? 'png'
    : format).toBuffer()
  return out.length > MAX_BYTES
    ? encode(sharp(out), 'jpeg').toBuffer()
    : out
}

async function processFile(file, images, now) {
  // 1. A URL-safe name.
  const originalName = path.basename(file)
  const sourceFormat = (await sharp(file).metadata().catch(() => ({}))).format
  const target = TYPES[sourceFormat]
    ? EXTENSIONS[sourceFormat]
    : '.jpg'
  // The real format decides the extension: a PNG saved as .jpg stays a PNG
  // (crisp text and graphics, transparency) and is renamed to .png, so the
  // links to it need the new name.
  const name = safeName(originalName, target)
  if (name !== originalName) {
    const renamed = path.join(path.dirname(file), name)
    if (fs.existsSync(renamed) && fs.realpathSync(renamed) !== fs.realpathSync(file))
      throw new Error(`can't rename to ${name}: that file already exists`)
    if (!dryRun)
      fs.renameSync(file, renamed)
    console.log(`  renamed ${originalName} -> ${name}`)
    file = renamed
  }
  const key = keyOf(file)
  const buffer = fs.readFileSync(dryRun && name !== originalName
    ? path.join(path.dirname(file), originalName)
    : file)
  const hash = sha256(buffer)
  const existing = images[key]

  // A copy downloaded with `pnpm images:pull` has no metadata left: never
  // read it again, even with --force, or its EXIF and place would be lost.
  if (existing && existing.uploadedHash === hash && existing.hash !== hash)
    return { key, status: 'unchanged' }
  // Unchanged.
  if (existing && !force && existing.hash === hash && (existing.uploadedAt || noUpload))
    return { key, status: 'unchanged' }

  // 2. Shooting data and place, read before the metadata goes.
  const meta = await readMeta(buffer)
  const clean = await cleanCopy(buffer, sourceFormat, meta.orientation)

  // Copyright: Chris's old notices become the current one, anyone else's stay
  // as they are, and the credit goes back into the uploaded copy.
  // A hand-set artist or copyright in `overrides` is used exactly as written.
  let credit = creditFor(meta.exif, key)
  const hand = existing?.overrides || {}
  if (hand.artist || hand.copyright) {
    credit = {
      artist: hand.artist || credit?.artist,
      copyright: hand.copyright || credit?.copyright,
      mine: isMine(hand.artist) || isMine(hand.copyright) || Boolean(credit?.mine),
    }
  }
  const exif = { ...meta.exif }
  delete exif.artist
  delete exif.copyright
  if (credit?.artist)
    exif.artist = credit.artist
  if (credit?.copyright)
    exif.copyright = credit.copyright
  clean.buffer = embedCredit(clean.buffer, clean.format, credit)
  await assertClean(clean.buffer, clean.format, credit)
  const info = await sharp(clean.buffer).metadata()
  const size = { width: info.width, height: info.height }

  const item = {
    originalName: existing?.originalName || originalName,
    width: size.width,
    height: size.height,
    bytes: clean.buffer.length,
    type: TYPES[clean.format],
    hash,
    uploadedHash: sha256(clean.buffer),
    // Transparent cut-outs (gear product shots) are previewed on white, the
    // tile colour they sit on; the page drops the preview once they load.
    thumbhash: await placeholderFor(clean.buffer, await import('thumbhash'), { background: '#ffffff' }),
    transparent: await hasTransparency(clean.buffer) || undefined,
    exif: Object.keys(exif).length
      ? exif
      : null,
    // `"location": false` in the manifest keeps a photo's place off the site for good.
    location: existing?.location === false
      ? false
      : meta.location,
    createdAt: existing?.createdAt || await firstCommitDate(file) || now,
    updatedAt: existing && existing.hash === hash
      ? existing.updatedAt
      : now,
  }
  if (existing?.overrides)
    item.overrides = existing.overrides

  // 4. Over Cloudflare's limits: a smaller copy to resize from.
  let display = null
  if (overLimits(size, clean.buffer.length)) {
    display = await displayCopy(clean.buffer, clean.format, size)
    display = embedCredit(display, (await sharp(display).metadata()).format, credit)
    item.source = key.replace(/(\.\w+)$/, '@display$1')
  }

  // 3. Upload.
  if (!noUpload) {
    await upload(key, clean.buffer, item.type)
    if (display)
      await upload(item.source, display, item.type)
    item.uploadedAt = now
  }
  else if (existing?.uploadedAt && existing.hash === hash) {
    item.uploadedAt = existing.uploadedAt
  }
  images[key] = item
  return {
    key,
    status: existing ? 'updated' : 'new',
    display: Boolean(display),
  }
}

async function push() {
  const manifest = store.readManifest()
  const images = { ...manifest.images }
  const now = new Date().toISOString()
  const files = walk(store.imagesDir)
  console.log(`[images] ${files.length} content images in assets/images${dryRun
    ? ' (dry run)'
    : noUpload
      ? ' (manifest only, no upload)'
      : ` -> R2 ${BUCKET} (${JURISDICTION})`}`)

  const counts = {
    new: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
  }
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    await Promise.all(files.slice(i, i + CONCURRENCY).map(async (file) => {
      try {
        const result = await processFile(file, images, now)
        counts[result.status]++
        if (result.status !== 'unchanged')
          console.log(`  ${result.status.padEnd(7)} ${store.srcFor(result.key)}${result.display ? ' (plus a smaller copy for resizing)' : ''}`)
      }
      catch (error) {
        counts.failed++
        console.error(`  failed  ${path.relative(store.rootDir, file)}: ${error.message}`)
      }
    }))
  }

  if (!dryRun && (counts.new || counts.updated)) {
    store.writeManifest({ ...manifest, images })
    if (!noUpload)
      await upload('_manifest/images.json', fs.readFileSync(store.manifestFile), 'application/json', 'no-cache')
  }
  console.log(`[images] ${counts.new} new, ${counts.updated} updated, ${counts.unchanged} unchanged${counts.failed
    ? `, ${counts.failed} failed`
    : ''}.${counts.new || counts.updated
    ? ' Commit _data/images.json.'
    : ''}`)
  if (counts.failed)
    process.exitCode = 1
}

async function pull() {
  const { images } = store.readManifest()
  let fetched = 0
  for (const key of Object.keys(images)) {
    const file = path.join(store.imagesDir, ...key.split('/'))
    if (fs.existsSync(file))
      continue
    const response = await fetch(store.r2Url(key))
    if (!response.ok) {
      console.error(`  failed  ${key}: HTTP ${response.status}`)
      process.exitCode = 1
      continue
    }
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()))
    fetched++
  }
  console.log(`[images] downloaded ${fetched} of ${Object.keys(images).length} images.`)
}

const command = process.argv[2]
const commands = { push, pull }
if (!commands[command]) {
  console.log('Usage: node utils/imagesCli.js push [--dry-run|--no-upload|--force] | pull')
  process.exit(1)
}
commands[command]().catch((error) => {
  console.error(error)
  process.exit(1)
})
