const { siteName, url: siteUrl } = require('../_data/meta')

const siteHost = new URL(siteUrl).hostname.replace(/^www\./, '')

function isOwnHost(hostname) {
  const host = hostname.replace(/^www\./, '').toLowerCase()
  return host === siteHost || host.endsWith(`.${siteHost}`)
}

function decodeHref(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
}

function encodeHref(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
}

function withUtm(href) {
  let url
  try {
    url = new URL(decodeHref(href))
  } catch {
    return href
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return href
  if (isOwnHost(url.hostname)) return href

  const hasSource = [...url.searchParams.keys()].some((key) => key.toLowerCase() === 'utm_source')
  if (hasSource) return href

  const join = url.search ? '&' : '?'
  const next = `${url.origin}${url.pathname}${url.search}${join}utm_source=${encodeURIComponent(siteName)}${url.hash}`
  return encodeHref(next)
}

const anchorHref = /<a\b[^>]*?\bhref\s*=\s*(["'])(https?:\/\/[^"']+)\1/gi

function addUtmToExitLinks(html) {
  return html.replace(anchorHref, (match, quote, href) => {
    const next = withUtm(href)
    if (next === href) return match
    return match.replace(`${quote}${href}${quote}`, `${quote}${next}${quote}`)
  })
}

module.exports = {
  addUtmToExitLinks,
}
