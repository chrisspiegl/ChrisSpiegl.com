// The extra caption lines for `!!! figure exif` and `!!! figure full`, built
// from the image's entry in _data/images.json.
//
//   exif        "Leica Q3 · 28 mm · f/2.8 · 1/250 s · ISO 100 · Chiang Mai, Thailand"
//   full        "View full resolution · 9,520 × 6,336 · 24.1 MB"
//   nolocation  leaves the place out of the exif line
//
// Camera and lens names come from _data/cameras.json; a `gear` slug there links
// the name to that item on /uses. Hand-set values in an entry's `overrides`
// (same keys as `exif`, plus `location`) win over what the file said.

const cameras = require('../_data/cameras.json')
const { imageInfo, originalUrl } = require('./images')

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const number = new Intl.NumberFormat('en-US')

function named(table, raw) {
  const known = cameras[table][raw]
  const name = escape(known?.name || raw)
  return known?.gear
    ? `<a href="/uses#${escape(known.gear)}">${name}</a>`
    : name
}

function shutter(seconds) {
  if (seconds >= 1)
    return `${Number(seconds.toFixed(1))} s`
  return `1/${Math.round(1 / seconds)} s`
}

function cameraName(exif) {
  if (!exif.model)
    return null
  if (cameras.cameras[exif.model] || !exif.make)
    return named('cameras', exif.model)
  // "Canon" + "Canon EOS R" -> "Canon EOS R"; "Apple" + "iPhone 15 Pro" -> "iPhone 15 Pro"
  const brand = exif.make.split(/\s+/)[0]
  const model = exif.model.toLowerCase().startsWith(brand.toLowerCase()) || /^apple$/i.test(brand)
    ? exif.model
    : `${brand} ${exif.model}`
  return escape(model)
}

function exifLine(item, { location: showLocation = true } = {}) {
  const exif = {
    ...item.exif,
    ...item.overrides,
  }
  const parts = []
  const camera = cameraName(exif)
  if (camera)
    parts.push(camera)
  const fixed = cameras.cameras[exif.model]?.fixedLens
  if (exif.lens && !fixed && !(exif.model && exif.lens.startsWith(exif.model)))
    parts.push(named('lenses', exif.lens))
  if (exif.focalLength) {
    const real = Math.round(exif.focalLength)
    const equivalent = exif.focalLength35 && Math.abs(exif.focalLength35 - exif.focalLength) > 1
      ? exif.focalLength35
      : null
    parts.push(equivalent
      ? `${equivalent} mm equiv.`
      : `${real} mm`)
  }
  if (exif.aperture)
    parts.push(`f/${Number(exif.aperture.toFixed(1))}`)
  if (exif.exposureTime)
    parts.push(shutter(exif.exposureTime))
  if (exif.iso)
    parts.push(`ISO ${exif.iso}`)
  const place = 'location' in (item.overrides || {})
    ? item.overrides.location
    : item.location
  if (showLocation && place)
    parts.push(escape([place.city, place.country].filter(Boolean).join(', ')))
  return parts.length
    ? parts.join(' · ')
    : null
}

function fullLine(src, item) {
  const megabytes = (item.bytes / 1024 / 1024).toFixed(1)
  return `<a href="${escape(originalUrl(src))}">View full resolution</a> · ${number.format(item.width)} × ${number.format(item.height)} · ${megabytes} MB`
}

// HTML for the lines under a figure's caption, or '' when there is nothing to add.
function figureMeta(srcs, { exif = false, full = false, location = true } = {}) {
  const lines = []
  srcs.forEach((src, index) => {
    const item = imageInfo(src)
    if (!item)
      return
    const parts = []
    const line = exif && exifLine(item, { location })
    if (line)
      parts.push(line)
    if (full)
      parts.push(fullLine(src, item))
    if (!parts.length)
      return
    const label = srcs.length === 2
      ? `${['Left', 'Right'][index]}: `
      : srcs.length > 2
        ? `${index + 1}: `
        : ''
    lines.push(...parts.map((part, i) => `<span class="figure-meta">${i === 0
      ? label
      : ''}${part}</span>`))
  })
  return lines.join('')
}

module.exports = { exifLine, figureMeta }
