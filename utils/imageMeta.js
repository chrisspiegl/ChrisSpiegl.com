// Reading and cleaning image metadata for `pnpm images:push`.
//
// - readMeta(file): the shooting data worth keeping (camera, lens, exposure,
//   capture time with its time zone) plus city and country. Location comes
//   from the IPTC/XMP fields first (what Lightroom writes), else from the GPS
//   coordinates, looked up offline against GeoNames towns (all-the-cities).
//   Coordinates themselves are never kept.
// - stripMetadata(buffer, type): a copy without EXIF, XMP, IPTC and comments,
//   keeping the colour profile. JPEG, PNG and WebP are cleaned losslessly by
//   dropping metadata segments; the pixels are not re-encoded.

const { Buffer } = require('node:buffer')

// ---------------------------------------------------------------------------
// Reading

const pick = (...values) => values.find(value => value !== undefined && value !== null && value !== '' && !(typeof value === 'string' && !value.trim()))
function clean(value) {
  return typeof value === 'string'
    ? value.replace(/\0/g, '').trim() || undefined
    : value
}
function round(value, digits = 1) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(digits))
    : undefined
}

// "2026:11:26 11:30:00" + "+07:00" -> "2026-11-26T11:30:00+07:00"
function captureTime(raw, offset) {
  if (typeof raw !== 'string')
    return undefined
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw)
  if (!match)
    return undefined
  const [, y, m, d, hh, mm, ss] = match
  const zone = typeof offset === 'string' && /^[+-]\d{2}:\d{2}$/.test(offset.trim())
    ? offset.trim()
    : ''
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${zone}`
}

function flashFired(flash) {
  if (typeof flash === 'number')
    return Boolean(flash & 1)
  if (typeof flash === 'string')
    return /fired/i.test(flash) && !/did not fire|no flash/i.test(flash)
  return undefined
}

function dropEmpty(object) {
  const out = Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== ''))
  return Object.keys(out).length
    ? out
    : null
}

let cities = null
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const toRad = Math.PI / 180

function distanceKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * toRad
  const dLon = (lon2 - lon1) * toRad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

// The town a photo was taken in. Every town gets a rough radius from its
// population (2 km for a village, ~15 km for Munich, ~30 km for Bangkok). Of
// the towns whose radius covers the point, the biggest wins, so a photo in
// central Munich says Munich, not the suburb that happens to be nearest.
// Outside every radius, the nearest town wins.
function nearestTown(lat, lon) {
  cities ||= require('all-the-cities')
  let best = null
  let nearest = null
  for (const city of cities) {
    const [cityLon, cityLat] = city.loc.coordinates
    if (Math.abs(cityLat - lat) > 0.5)
      continue
    const d = distanceKm(lat, lon, cityLat, cityLon)
    if (d > 40)
      continue
    if (!nearest || d < nearest.d)
      nearest = { city, d }
    const radius = 2 + 0.012 * Math.sqrt(city.population || 0)
    if (d <= radius && (!best || city.population > best.city.population))
      best = { city, d }
  }
  const found = (best || nearest)
  return found
    ? { city: found.city.name, countryCode: found.city.country }
    : null
}

function countryName(code) {
  try {
    return regionNames.of(code)
  }
  catch {
    return undefined
  }
}

function locationFrom(parsed) {
  const iptc = parsed.iptc || {}
  const photoshop = parsed.photoshop || {}
  const core = parsed.Iptc4xmpCore || {}
  const written = dropEmpty({
    city: clean(pick(photoshop.City, iptc.City)),
    region: clean(pick(photoshop.State, iptc.State, iptc['Province-State'])),
    country: clean(pick(photoshop.Country, iptc.Country, iptc.CountryName, iptc['Country-PrimaryLocationName'])),
    countryCode: clean(pick(core.CountryCode, iptc.CountryCode, iptc['Country-PrimaryLocationCode'])),
  })
  if (written && (written.city || written.country)) {
    if (written.countryCode && written.countryCode.length === 3)
      delete written.countryCode // IPTC often has ISO 3166 alpha-3; keep only alpha-2
    if (written.countryCode)
      written.countryCode = written.countryCode.toUpperCase()
    if (!written.country && written.countryCode)
      written.country = countryName(written.countryCode)
    return { ...written, source: 'iptc' }
  }
  const gps = parsed.gps || {}
  if (typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
    const town = nearestTown(gps.latitude, gps.longitude)
    if (town) {
      return dropEmpty({
        city: town.city,
        country: countryName(town.countryCode),
        countryCode: town.countryCode,
        source: 'gps',
      })
    }
  }
  return null
}

async function readMeta(input) {
  const exifr = (await import('exifr')).default
  let parsed
  try {
    parsed = await exifr.parse(input, {
      tiff: true,
      exif: true,
      gps: true,
      iptc: true,
      xmp: true,
      icc: false,
      ifd1: false,
      mergeOutput: false,
      reviveValues: false,
      translateValues: false,
    }) || {}
  }
  catch {
    parsed = {}
  }
  const ifd0 = parsed.ifd0 || {}
  const exif = parsed.exif || {}
  const aux = parsed.aux || {}
  const exifEX = parsed.exifEX || {}
  const dc = parsed.dc || {}
  const iptc = parsed.iptc || {}

  const rights = typeof dc.rights === 'object'
    ? dc.rights.value
    : dc.rights
  const exifData = dropEmpty({
    make: clean(ifd0.Make),
    model: clean(ifd0.Model),
    lens: clean(pick(exif.LensModel, exifEX.LensModel, aux.Lens)),
    lensMake: clean(exif.LensMake),
    focalLength: round(exif.FocalLength),
    focalLength35: round(exif.FocalLengthIn35mmFormat, 0),
    aperture: round(exif.FNumber),
    exposureTime: typeof exif.ExposureTime === 'number'
      ? exif.ExposureTime
      : undefined,
    iso: pick(exif.ISO, exif.PhotographicSensitivity, exif.ISOSpeedRatings),
    exposureCompensation: round(exif.ExposureCompensation),
    flash: flashFired(exif.Flash),
    capturedAt: captureTime(exif.DateTimeOriginal || exif.CreateDate, exif.OffsetTimeOriginal || exif.OffsetTime),
    software: clean(ifd0.Software),
    artist: clean(pick(ifd0.Artist, iptc.Byline)),
    // As found in the file; utils/copyright.js decides what is kept.
    copyright: clean(pick(ifd0.Copyright, rights, iptc.CopyrightNotice)),
  })
  const orientation = typeof ifd0.Orientation === 'number'
    ? ifd0.Orientation
    : 1
  return {
    exif: exifData,
    location: locationFrom(parsed),
    orientation,
  }
}

// ---------------------------------------------------------------------------
// Cleaning

// JPEG: keep JFIF (APP0), the ICC profile (APP2 "ICC_PROFILE"), Adobe (APP14,
// needed for colour) and everything that makes up the picture. Drop EXIF and
// XMP (APP1), IPTC (APP13), other APPn and comments, and anything after the
// end of the image (embedded previews, which carry their own metadata).
function stripJpeg(buf) {
  if (buf[0] !== 0xFF || buf[1] !== 0xD8)
    throw new Error('Not a JPEG file')
  const parts = [
    buf.subarray(0, 2),
  ]
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xFF)
      throw new Error(`Unexpected JPEG data at byte ${i}`)
    const marker = buf[i + 1]
    if (marker === 0xFF) { // fill byte
      i++
      continue
    }
    if (marker === 0xD9) { // end of image
      parts.push(buf.subarray(i, i + 2))
      break
    }
    const length = buf.readUInt16BE(i + 2)
    const segment = buf.subarray(i, i + 2 + length)
    const isApp = marker >= 0xE0 && marker <= 0xEF
    const keep = !isApp && marker !== 0xFE
      ? true
      : marker === 0xE0
        || marker === 0xEE
        || (marker === 0xE2 && segment.subarray(4, 16).toString('latin1') === 'ICC_PROFILE\0')
    if (keep)
      parts.push(segment)
    i += 2 + length
    if (marker === 0xDA) { // start of scan: copy the entropy-coded data up to the next marker
      const start = i
      while (i < buf.length) {
        if (buf[i] === 0xFF && buf[i + 1] !== 0x00 && !(buf[i + 1] >= 0xD0 && buf[i + 1] <= 0xD7))
          break
        i++
      }
      parts.push(buf.subarray(start, i))
    }
  }
  return Buffer.concat(parts)
}

// PNG: keep the picture and colour chunks, drop text, EXIF and timestamps.
const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'])
function stripPng(buf) {
  const parts = [
    buf.subarray(0, 8),
  ]
  let i = 8
  while (i < buf.length) {
    const length = buf.readUInt32BE(i)
    const type = buf.subarray(i + 4, i + 8).toString('latin1')
    const end = i + 12 + length
    if (!PNG_DROP.has(type))
      parts.push(buf.subarray(i, end))
    i = end
    if (type === 'IEND')
      break
  }
  return Buffer.concat(parts)
}

// WebP: drop the EXIF and XMP chunks and their flags in the VP8X header.
function stripWebp(buf) {
  if (buf.subarray(0, 4).toString('latin1') !== 'RIFF' || buf.subarray(8, 12).toString('latin1') !== 'WEBP')
    throw new Error('Not a WebP file')
  const chunks = []
  let i = 12
  while (i + 8 <= buf.length) {
    const type = buf.subarray(i, i + 4).toString('latin1')
    const size = buf.readUInt32LE(i + 4)
    const end = i + 8 + size + (size % 2)
    if (type !== 'EXIF' && type !== 'XMP ') {
      const chunk = Buffer.from(buf.subarray(i, end))
      if (type === 'VP8X')
        chunk[8] &= ~0x0C // clear the EXIF (0x08) and XMP (0x04) flags
      chunks.push(chunk)
    }
    i = end
  }
  const body = Buffer.concat(chunks)
  const header = Buffer.alloc(12)
  header.write('RIFF', 0, 'latin1')
  header.writeUInt32LE(body.length + 4, 4)
  header.write('WEBP', 8, 'latin1')
  return Buffer.concat([header, body])
}

function stripMetadata(buf, type) {
  if (type === 'jpeg')
    return stripJpeg(buf)
  if (type === 'png')
    return stripPng(buf)
  if (type === 'webp')
    return stripWebp(buf)
  return buf // GIF carries no camera metadata
}

module.exports = { nearestTown, readMeta, stripMetadata }
