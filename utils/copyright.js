// Who made an image, and writing that back into the copy that goes to R2.
//
// - creditFor(exif, key): the artist and copyright notice to keep.
//   A notice that names Chris in any of the spellings in _data/copyright.json
//   ("mine": Christoph Spiegl, cspiegl@cspiegl.com, chrissp.com, ...) is
//   replaced by the current one: "© <year taken> Chris Spiegl, ChrisSpiegl.com".
//   Anyone else's notice is kept word for word. An image with no notice gets
//   Chris's only when it sits in one of the "ownFolders" (FridayWallpaper);
//   everything else (gear product shots, screenshots) stays without one.
// - embedCredit(buffer, type, credit): adds the credit to a file that has no
//   metadata left (after stripMetadata), without touching the pixels:
//   EXIF Artist and Copyright, plus XMP creator, rights and, for Chris's own
//   photos, his e-mail and website as the creator's contact.

const { Buffer } = require('node:buffer')
const zlib = require('node:zlib')
const settings = require('../_data/copyright.json')

const lower = value => String(value || '').toLowerCase()

function isMine(text) {
  const value = lower(text)
  return Boolean(value) && settings.mine.some(({ match }) => value.includes(lower(match)))
}

function ownNotice(capturedAt) {
  const year = /^(\d{4})/.exec(capturedAt || '')?.[1]
  return year
    ? settings.notice.replace('{year}', year)
    : settings.noticeWithoutYear
}

// { artist, copyright, mine } or null when the image carries no credit.
function creditFor(exif, key) {
  const artist = exif?.artist
  const copyright = exif?.copyright
  const folder = String(key || '').split('/')[0]
  if (isMine(artist) || isMine(copyright) || (!artist && !copyright && settings.ownFolders.includes(folder))) {
    return {
      artist: settings.owner.name,
      copyright: ownNotice(exif?.capturedAt),
      mine: true,
    }
  }
  if (!artist && !copyright)
    return null
  return {
    artist,
    copyright,
    mine: false,
  }
}

// ---------------------------------------------------------------------------
// EXIF: a TIFF block with IFD0 Artist (0x013B) and Copyright (0x8298).

function tiff({ artist, copyright }) {
  const tags = [
    [0x013B, artist],
    [0x8298, copyright],
  ].filter(([, value]) => value)
  const header = 8
  const ifdSize = 2 + tags.length * 12 + 4
  const values = tags.map(([, value]) => Buffer.from(`${value}\0`, 'utf8'))
  const ifd = Buffer.alloc(ifdSize)
  ifd.writeUInt16BE(tags.length, 0)
  let offset = header + ifdSize
  tags.forEach(([tag], i) => {
    const at = 2 + i * 12
    const value = values[i]
    ifd.writeUInt16BE(tag, at)
    ifd.writeUInt16BE(2, at + 2) // ASCII
    ifd.writeUInt32BE(value.length, at + 4)
    if (value.length <= 4) {
      value.copy(ifd, at + 8)
    }
    else {
      ifd.writeUInt32BE(offset, at + 8)
      offset += value.length
    }
  })
  return Buffer.concat([
    Buffer.from([
      0x4D,
      0x4D,
      0x00,
      0x2A,
      0x00,
      0x00,
      0x00,
      0x08,
    ]),
    ifd,
    ...values.filter(value => value.length > 4),
  ])
}

const xmlText = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

function xmp({ artist, copyright, mine }) {
  const { email, url } = settings.owner
  const attributes = mine
    ? ` xmpRights:Marked="True" xmpRights:WebStatement="${xmlText(url)}"`
    : copyright
      ? ' xmpRights:Marked="True"'
      : ''
  return [
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    `<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/" xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"${attributes}>`,
    artist
      ? `<dc:creator><rdf:Seq><rdf:li>${xmlText(artist)}</rdf:li></rdf:Seq></dc:creator>`
      : '',
    copyright
      ? `<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${xmlText(copyright)}</rdf:li></rdf:Alt></dc:rights>`
      : '',
    mine
      ? `<Iptc4xmpCore:CreatorContactInfo rdf:parseType="Resource"><Iptc4xmpCore:CiEmailWork>${xmlText(email)}</Iptc4xmpCore:CiEmailWork><Iptc4xmpCore:CiUrlWork>${xmlText(url)}</Iptc4xmpCore:CiUrlWork></Iptc4xmpCore:CreatorContactInfo>`
      : '',
    '</rdf:Description>',
    '</rdf:RDF>',
    '</x:xmpmeta>',
    '<?xpacket end="w"?>',
  ].join('')
}

// ---------------------------------------------------------------------------
// Writing into the file formats.

function jpegSegment(marker, payload) {
  const head = Buffer.alloc(4)
  head[0] = 0xFF
  head[1] = marker
  head.writeUInt16BE(payload.length + 2, 2)
  return Buffer.concat([head, payload])
}

function embedJpeg(buf, credit) {
  const exif = jpegSegment(0xE1, Buffer.concat([
    Buffer.from('Exif\0\0', 'latin1'),
    tiff(credit),
  ]))
  const packet = jpegSegment(0xE1, Buffer.concat([
    Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1'),
    Buffer.from(xmp(credit), 'utf8'),
  ]))
  // After SOI and JFIF (APP0), before everything else.
  let at = 2
  if (buf[2] === 0xFF && buf[3] === 0xE0)
    at = 4 + buf.readUInt16BE(4)
  return Buffer.concat([
    buf.subarray(0, at),
    exif,
    packet,
    buf.subarray(at),
  ])
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([
    Buffer.from(type, 'latin1'),
    data,
  ])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(zlib.crc32(body))
  return Buffer.concat([length, body, crc])
}

function embedPng(buf, credit) {
  const exif = pngChunk('eXIf', tiff(credit))
  // iTXt: keyword, 0, compression flag 0, method 0, empty language, 0, empty translated keyword, 0, text
  const packet = pngChunk('iTXt', Buffer.concat([
    Buffer.from('XML:com.adobe.xmp\0\0\0\0\0', 'latin1'),
    Buffer.from(xmp(credit), 'utf8'),
  ]))
  // Right after IHDR (8-byte signature + 25-byte IHDR chunk).
  const at = 8 + 12 + buf.readUInt32BE(8)
  return Buffer.concat([
    buf.subarray(0, at),
    exif,
    packet,
    buf.subarray(at),
  ])
}

function webpChunk(type, data) {
  const head = Buffer.alloc(8)
  head.write(type, 0, 'latin1')
  head.writeUInt32LE(data.length, 4)
  return Buffer.concat([
    head,
    data,
    data.length % 2
      ? Buffer.alloc(1)
      : Buffer.alloc(0),
  ])
}

// WebP keeps metadata only in the extended format (VP8X). A simple file stays
// as it is.
function embedWebp(buf, credit) {
  if (buf.subarray(12, 16).toString('latin1') !== 'VP8X')
    return buf
  const header = Buffer.from(buf.subarray(0, 30))
  header[20] |= 0x0C // EXIF and XMP flags
  const body = Buffer.concat([
    header.subarray(12),
    buf.subarray(30),
    webpChunk('EXIF', tiff(credit)),
    webpChunk('XMP ', Buffer.from(xmp(credit), 'utf8')),
  ])
  header.writeUInt32LE(body.length + 4, 4)
  return Buffer.concat([
    header.subarray(0, 12),
    body,
  ])
}

function embedCredit(buf, type, credit) {
  if (!credit)
    return buf
  if (type === 'jpeg')
    return embedJpeg(buf, credit)
  if (type === 'png')
    return embedPng(buf, credit)
  if (type === 'webp')
    return embedWebp(buf, credit)
  return buf
}

module.exports = { creditFor, embedCredit, isMine }
