// Template helpers available in every template as `helpers.*`.
const { icon } = require('../utils/icons')
const { imageAttributes, imageHtml, imageUrl } = require('../utils/images')
const { absoluteUrl, ogImageUrl, pickShareImage } = require('../utils/seo')
const { tocItems } = require('../utils/toc')

module.exports = {
  icon,
  imageAttrs: imageAttributes,
  imageHtml,
  imageUrl,
  ogImageUrl,
  absoluteUrl,
  pickShareImage,
  tocItems,
}
