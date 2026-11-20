const { addUtmToExitLinks } = require('./externalLinks')

module.exports = {
  utmSource(content, outputPath) {
    if (!outputPath || !outputPath.endsWith('.html'))
      return content
    return addUtmToExitLinks(content)
  },
}
