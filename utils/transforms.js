const { url: siteUrl } = require('../_data/meta')
const { addUtmToExitLinks } = require('./externalLinks')

const siteOrigin = new URL(siteUrl).origin

// /uses/ → /uses, /uses/#gear → /uses#gear, https://chrisspiegl.com/now/ → https://chrisspiegl.com/now.
// Leaves /, files, external links and anything that isn't a plain path alone.
function dropTrailingSlash(href) {
  const match = href.match(/^((?:https?:\/\/[^/"]+)?)(\/[^"?#]*?)\/([?#].*)?$/)
  if (!match)
    return href
  const [, origin, path, rest = ''] = match
  if (!path || path.startsWith('//') || (origin && new URL(origin).origin !== siteOrigin))
    return href
  return `${origin}${path}${rest}`
}

module.exports = {
  utmSource(content, outputPath) {
    if (!outputPath || !outputPath.endsWith('.html'))
      return content
    return addUtmToExitLinks(content)
  },
  // Internal links match page.url, which has no trailing slash (see addUrlTransform in .eleventy.js).
  noTrailingSlashLinks(content, outputPath) {
    if (!outputPath || !outputPath.endsWith('.html'))
      return content
    return content.replace(/href="([^"]*)"/g, (attribute, href) => {
      const next = dropTrailingSlash(href)
      return next === href
        ? attribute
        : `href="${next}"`
    })
  },
}
