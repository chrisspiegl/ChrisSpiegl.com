// Template helpers available in every template as `helpers.*`.
const { icon } = require('../utils/icons')
const { hasImage, imageAttributes, imageHtml, imageUrl, inlineImageAttributes } = require('../utils/images')
const { absoluteUrl, ogImageUrl, pickShareImage } = require('../utils/seo')
const { tocItems } = require('../utils/toc')

module.exports = {
  hasImage,
  icon,
  imageAttrs: imageAttributes,
  inlineImageAttrs: inlineImageAttributes,
  imageHtml,
  imageUrl,
  ogImageUrl,
  absoluteUrl,
  pickShareImage,
  tocItems,
}
