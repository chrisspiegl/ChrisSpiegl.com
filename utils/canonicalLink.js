const { siteName, url: siteUrl } = require('../_data/meta')

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function canonicalLink(pageUrl) {
  const path = pageUrl && pageUrl !== '/' ? String(pageUrl) : '/'
  const href = new URL(path, siteUrl).href
  const pathname = new URL(href).pathname.replace(/\/$/, '')
  const label = `${siteName}${pathname}`

  return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
}

module.exports = canonicalLink
