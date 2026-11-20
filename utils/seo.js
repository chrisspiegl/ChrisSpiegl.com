// Helpers for canonical URLs and social sharing (Open Graph / Twitter cards).
const { url: siteUrl, defaultImage } = require('../_data/meta')
const { useCloudflare } = require('./images')

const OG_WIDTH = 1200
const OG_HEIGHT = 630

function absoluteUrl(pathOrUrl) {
  return new URL(pathOrUrl || '/', siteUrl).href
}

// Pick the share image for a page: explicit `ogImage`, then `imageHero`,
// then the first local image in the rendered content, then the site default.
function pickShareImage({ ogImage, imageHero, content } = {}) {
  if (ogImage)
    return ogImage
  if (imageHero)
    return imageHero
  if (content) {
    // Matches both original paths and /cdn-cgi/image/<options>/assets/... URLs.
    const match = /<img[^>]+src="(?:\/cdn-cgi\/image\/[^/]+)?(\/assets\/[^"]+\.(?:jpe?g|png|webp))"/i.exec(content)
    if (match)
      return match[1]
  }
  return defaultImage
}

// A 1200x630 crop for link previews, cropped around the subject by Cloudflare.
function ogImageUrl(src) {
  if (/^https?:\/\//.test(src))
    return src
  if (!useCloudflare())
    return absoluteUrl(src)
  const options = `width=${OG_WIDTH},height=${OG_HEIGHT},fit=cover,gravity=auto,format=auto,quality=85,onerror=redirect`
  return absoluteUrl(`/cdn-cgi/image/${options}${src}`)
}

module.exports = {
  OG_HEIGHT,
  OG_WIDTH,
  absoluteUrl,
  ogImageUrl,
  pickShareImage,
}
