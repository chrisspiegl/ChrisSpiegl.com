const pluginPug = require('@11ty/eleventy-plugin-pug').default
const pluginRss = require('@11ty/eleventy-plugin-rss').default
const pluginSyntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight')
const embedEverything = require('eleventy-plugin-embed-everything')
const markdownIt = require('markdown-it')
const markdownItAnchor = require('markdown-it-anchor')
const markdownItContainer = require('markdown-it-container')
const markdownItFootnote = require('markdown-it-footnote')

const meta = require('./_data/meta')
const buildStats = require('./utils/buildStats')
const canonicalLink = require('./utils/canonicalLink')
const { toDate, isValidDate } = require('./utils/dates')
const emailLink = require('./utils/emailLink')
const filters = require('./utils/filters.js')
const { lastCommitDate } = require('./utils/gitFileDates')
const { icon } = require('./utils/icons')
const { imageHtml, useCloudflare, verifyCloudflareImages } = require('./utils/images')
const { preparePlaceholders } = require('./utils/thumbhash')
const transforms = require('./utils/transforms.js')

const now = new Date()

const sitemapExcludedPrefixes = ['/tag/', '/tags/', '/gear/view/']
const sitemapExcludedPaths = new Set(['/styleguide/', '/404.html'])

function includeInSitemap(item) {
  const url = item.url
  const inputPath = item.inputPath || ''
  if (!url || !url.endsWith('/'))
    return false
  if (item.data && (item.data.layout === 'redirect' || item.data.redirect))
    return false
  if (sitemapExcludedPrefixes.some(prefix => url.startsWith(prefix)))
    return false
  if (sitemapExcludedPaths.has(url))
    return false
  if (inputPath.includes('/draft') || inputPath.includes('draft.md') || inputPath.includes('draft-'))
    return false
  return true
}

function sitemapLastMod(item) {
  const updated = item.data && item.data.pageUpdated
  if (updated && isValidDate(updated)) {
    return toDate(updated).toISOString().replace(/\.\d{3}Z$/, 'Z')
  }

  if (item.date instanceof Date && !Number.isNaN(item.date.getTime())) {
    return item.date.toISOString().slice(0, 10)
  }

  return null
}

// `sizes` for Markdown images, set by the !!! container they sit in.
const containerImageSizes = {
  'image-hero': 'full',
  'header-image-three': 'third',
  'image-sbs': 'half',
  'side-by-side': 'half',
}

module.exports = (config) => {
  config.on('eleventy.before', () => verifyCloudflareImages(meta.url, meta.avatarImage))
  config.on('eleventy.before', preparePlaceholders)

  // Facts for the build report sent by utils/ci.js (see utils/buildStats.js).
  let buildStarted = 0
  config.on('eleventy.before', () => {
    buildStarted = performance.now()
  })
  config.on('eleventy.after', ({ results }) => {
    const pages = results.filter(result => result.outputPath && result.outputPath.endsWith('.html'))
    const words = pages.reduce((sum, page) => {
      const text = String(page.content || '')
        .replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
      return sum + (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length
    }, 0)
    buildStats.write({
      eleventy: {
        ms: Math.round(performance.now() - buildStarted),
        files: results.length,
        pages: pages.length,
        words,
      },
      images: useCloudflare()
        ? 'Cloudflare Images'
        : 'original files',
    })
  })

  config.addPlugin(pluginPug)
  config.addPlugin(pluginRss)
  config.addPlugin(pluginSyntaxHighlight)
  config.addPlugin(embedEverything)

  // Keep repo docs and server-config notes out of the public build.
  config.ignores.add('README.md')
  config.ignores.add('_mta-sts/**')
  config.ignores.add('mta-sts/**')

  config.addWatchTarget('./assets/scss/')

  // Transforms
  Object.keys(transforms).forEach((transformName) => {
    config.addTransform(transformName, transforms[transformName])
  })

  // Filters
  Object.keys(filters).forEach((filterName) => {
    config.addFilter(filterName, filters[filterName])
  })

  const isDraftOrIndex = (post) => {
    if (post.data.draft)
      return false
    if (post.inputPath.includes('/draft'))
      return true
    if (post.inputPath.includes('draft.md'))
      return true
    if (post.inputPath.includes('index.md'))
      return true
    return false
  }

  // Custom collections
  const livePosts = (post) => {
    if (isDraftOrIndex(post))
      return false
    if (post.date <= now)
      return true
    return false
  }

  const liveElements = (post) => {
    if (isDraftOrIndex(post))
      return false
    return true
  }

  config.addPassthroughCopy('_headers')
  config.addPassthroughCopy('assets/favicon')
  // Originals only: Cloudflare Images resizes and converts them on request.
  config.addPassthroughCopy('assets/images')
  config.addPassthroughCopy({ 'assets/chrisspiegl.asc': 'chrisspiegl.asc' })
  config.addCollection('posts', (collection) => {
    return collection.getFilteredByGlob('./post/**/*.md').filter(_ => livePosts(_)).reverse()
  })

  config.addCollection('drafts', (collection) => {
    return collection.getFilteredByGlob('./post/**/*.md').filter(_ => !livePosts(_)).reverse()
  })

  const byGitLastChange = (a, b) => {
    const aTime = Date.parse(lastCommitDate(a.inputPath) || '') || (a.date instanceof Date
      ? a.date.getTime()
      : 0)
    const bTime = Date.parse(lastCommitDate(b.inputPath) || '') || (b.date instanceof Date
      ? b.date.getTime()
      : 0)
    return bTime - aTime
  }

  config.addCollection('books', (collection) => {
    return collection.getFilteredByGlob('./book/**/*.md').filter(_ => liveElements(_)).sort(byGitLastChange)
  })

  config.addCollection('movies', (collection) => {
    return collection.getFilteredByGlob('./movie/**/*.md').filter(_ => liveElements(_)).sort(byGitLastChange)
  })

  config.addCollection('gear', (collection) => {
    return collection.getFilteredByGlob('./gear/**/*.md').filter(_ => liveElements(_)).reverse()
  })

  config.addCollection('sitemap', (collection) => {
    return collection.getAll()
      .filter(item => includeInSitemap(item))
      .map((item) => {
        item.data.sitemapLastmod = sitemapLastMod(item)
        return item
      })
      .sort((a, b) => a.url.localeCompare(b.url))
  })

  config.addCollection('tagList', (collection) => {
    const uniqueTags = new Set()

    collection.getAllSorted().forEach((item) => {
      // TODO: Currently this taglist thing shows all posts no matter that tag.
      if (!('tags' in item.data))
        return

      const tags = (typeof item.data.tags === 'string')
        ? [item.data.tags]
        : item.data.tags

      for (const tag of tags)
        tag.startsWith('_') || uniqueTags.add(tag)
    })

    return [...uniqueTags]
  })

  // The ever-popular markdown filter.

  const md = markdownIt({
    html: true,
    breaks: true,
    linkify: true,
    typographer: true,
  })

  config.addFilter('markdown', content => md.render(content))
  config.addShortcode('email', emailLink)
  config.addShortcode('canonical', function () {
    return canonicalLink(this.page && this.page.url)
  })
  // {% icon "fa7-brands:youtube" %} → inline SVG, bundled at build time.
  config.addShortcode('icon', (name, label) => icon(name, { label }))
  // {% image "/assets/images/x.jpg", "Alt text", "content" %} → responsive <img>.
  config.addShortcode('image', (src, alt, sizes) => imageHtml(src, { alt, sizes }))

  md.use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.headerLink({ safariReaderFix: true }),
  })

  md.use(markdownItFootnote)

  const sizedContainer = name => ({
    marker: '!',
    render(tokens, idx, _options, env) {
      if (tokens[idx].nesting === 1) {
        env.imageSizes = containerImageSizes[name]
        return `<div class="${name}">\n`
      }
      env.imageSizes = undefined
      return '</div>\n'
    },
  })

  md.use(markdownItContainer, 'image-hero', sizedContainer('image-hero'))
    .use(markdownItContainer, 'signature', { marker: '!' })
    .use(markdownItContainer, 'image-sbs', sizedContainer('image-sbs'))
    .use(markdownItContainer, 'text-center', { marker: '!' })
    .use(markdownItContainer, 'side-by-side', sizedContainer('side-by-side'))
    .use(markdownItContainer, 'header-image-three', sizedContainer('header-image-three'))
    .use(markdownItContainer, 'quote-hero', { marker: '!' })
    .use(markdownItContainer, 'button', { marker: '!' })
    .use(markdownItContainer, 'container', {
      marker: '!',
      validate() {
        return true
      },
      render(tokens, idx) {
        const m = tokens[idx].info.trim() // .match(/^well\s+(.*)$/)
        if (tokens[idx].nesting === 1) {
          // opening tag
          const summary = m === ''
            ? ''
            : `<summary>${md.renderInline(m)}</summary>\n`
          return `<details>${summary}<aside>`
        }
        else {
          // closing tag
          return '</aside>\n</details>\n'
        }
      },
    })

  // Responsive images inside Markdown, delivered through Cloudflare Images (utils/images.js).
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const src = token.attrGet('src')
    if (!src || !src.startsWith('/assets/'))
      return self.renderToken(tokens, idx, options)
    return imageHtml(src, {
      alt: self.renderInlineAsText(token.children, options, env),
      title: token.attrGet('title') || undefined,
      sizes: (env && env.imageSizes) || 'content',
      // Header and hero photos are above the fold: load them right away.
      loading: env && ['full', 'third'].includes(env.imageSizes)
        ? 'eager'
        : 'lazy',
    })
  }

  md.renderer.rules.footnote_caption = (tokens, idx) => {
    let n = Number(tokens[idx].meta.id + 1).toString()

    if (tokens[idx].meta.subId > 0) {
      n += `:${tokens[idx].meta.subId}`
    }

    return n
  }

  config.setLibrary('md', md)

  return {
    // dir: {
    //   output: "dist",
    //   input:  "src",
    //     includes: "_includes", //  These are inside the `input` directory
    //     data:     "_data"
    // },
    // templateFormats: [
    //   "md",
    //   "njk",
    //   "html"
    // ],
    // dataTemplateEngine: "njk",
    // htmlTemplateEngine: "njk",
    markdownTemplateEngine: 'njk',
  }
}
