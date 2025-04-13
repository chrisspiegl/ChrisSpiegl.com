// Shamelessly modified from Eleventastic:
// https://github.com/maxboeck/eleventastic

const process = require('process')
const path = require('path')
const sass = require('sass')
const CleanCSS = require('clean-css')
const cssesc = require('cssesc')

const isProd = process.env.ELEVENTY_ENV === 'production'

// Main entry point name
const fileName = 'style.scss'

module.exports = class {
  async data() {
    const filePath = path.join(__dirname, `/scss/${fileName}`)
    return {
      permalink: '/assets/style.css',
      eleventyExcludeFromCollections: true,
      layout: 'blank',
      filePath,
    }
  }

  // Compile Sass to CSS,
  // Embed Source Map in Development
  async compile(config) {
    return new Promise((resolve, reject) => {
      const sassOptions = {
        loadPaths: [path.join(__dirname, 'scss')],
        style: isProd ? 'compressed' : 'expanded',
        sourceMap: !isProd,
        sourceMapIncludeSources: !isProd,
        quietDeps: true
      }

      try {
        const result = sass.compile(config.filePath, sassOptions)
        return resolve(result.css.toString())
      } catch (error) {
        return reject(error)
      }
    })
  }

  // Process the file
  async render({ filePath }) {
    try {
      const css = await this.compile({ filePath })
      if (isProd) {
        const minified = new CleanCSS({}).minify(css).styles
        return minified
      }
      return css
    } catch (error) {
      return this.renderError(error)
    }
  }

  // Display an error overlay when CSS build fails.
  // this brilliant idea is taken from Mike Riethmuller / Supermaya
  // @see https://github.com/MadeByMike/supermaya/blob/master/site/utils/compile-scss.js
  renderError(error) {
    return `
        /* Error compiling stylesheet */
        *,
        *::before,
        *::after {
            box-sizing: border-box;
        }
        html,
        body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            font-family: monospace;
            font-size: 1.25rem;
            line-height:1.5;
        }
        body::before {
            content: '';
            background: #000;
            top: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            opacity: 0.7;
            position: fixed;
        }
        body::after {
            content: '${cssesc(error.toString())}';
            white-space: pre;
            display: block;
            top: 0;
            padding: 30px;
            margin: 50px;
            width: calc(100% - 100px);
            color:#721c24;
            background: #f8d7da;
            border: solid 2px red;
            position: fixed;
        }`
  }
}
