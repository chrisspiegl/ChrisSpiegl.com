const process = require('process')
const htmlmin = require('html-minifier')
const critical = require('critical')

const buildDir = '_site'

const shouldTransformHTML = (outputPath) => outputPath && outputPath.endsWith('.html') && process.env.ELEVENTY_ENV === 'production'

const isHomePage = (outputPath) => outputPath === `${buildDir}/index.html`

process.setMaxListeners(Number.POSITIVE_INFINITY)
module.exports = {
  htmlmin(content, outputPath) {
    // Minify all html when in production mode
    if (shouldTransformHTML(outputPath)) {
      return htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
      })
    }

    return content
  },

  async critical(content, outputPath) {
    if (shouldTransformHTML(outputPath) && isHomePage(outputPath)) {
      // Do the transform for critical CSS on all html pages when in production mode.
      // if (shouldTransformHTML(outputPath)) {
      try {
        const config = {
          base: `${buildDir}/`,
          html: content,
          inline: true,
          width: 1280,
          height: 800,
        }
        const { html } = await critical.generate(config)
        return html
      } catch (error) {
        console.error(error)
      }
    }

    return content
  },
}
