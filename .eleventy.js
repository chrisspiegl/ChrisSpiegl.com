const pluginPug = require('@11ty/eleventy-plugin-pug').default
const pluginRss = require('@11ty/eleventy-plugin-rss').default
const pluginSyntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight')
const embedEverything = require('eleventy-plugin-embed-everything')
const markdownIt = require('markdown-it')
const markdownItAnchor = require('markdown-it-anchor')
const markdownItContainer = require('markdown-it-container')
const markdownItFootnote = require('markdown-it-footnote')

const meta = require('./_data/meta')
const searchVisibility = require('./_data/searchVisibility')
const buildStats = require('./utils/buildStats')
const canonicalLink = require('./utils/canonicalLink')
const { toDate, isValidDate } = require('./utils/dates')
const emailLink = require('./utils/emailLink')
const { figureMeta } = require('./utils/figureMeta')
const filters = require('./utils/filters.js')
const { lastCommitDate } = require('./utils/gitFileDates')
const { icon } = require('./utils/icons')
const { imageHtml, prepareRepoImageInfo, useCloudflare, verifyCloudflareImages } = require('./utils/images')
const imageStore = require('./utils/imageStore')
const { preparePlaceholders } = require('./utils/thumbhash')
const transforms = require('./utils/transforms.js')

const now = new Date()

const sitemapExcludedPrefixes = ['/tag/', '/tags/']
const sitemapExcludedPaths = new Set(['/404.html'])

function includeInSitemap(item) {
  const url = item.url
  const inputPath = item.inputPath || ''
  // Pages only: skip files such as /feed.xml or /404.html.
  if (!url || /\.[a-z0-9]+$/i.test(url))
    return false
  if (item.data && (item.data.layout === 'redirect' || item.data.redirect))
    return false
  if (sitemapExcludedPrefixes.some(prefix => url.startsWith(prefix) || `${url}/` === prefix))
    return false
  if (sitemapExcludedPaths.has(url))
    return false
  // Pages kept out of search, or pointing elsewhere (_data/searchVisibility.js).
  if (searchVisibility.forUrl(url))
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
  'side-by-side': 'half',
}

module.exports = (config) => {
  config.on('eleventy.before', () => verifyCloudflareImages(meta.url, meta.avatarImage))
  config.on('eleventy.before', preparePlaceholders)
  config.on('eleventy.before', prepareRepoImageInfo)

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
  config.ignores.add('CLAUDE.md')
  config.ignores.add('_mta-sts/**')
  config.ignores.add('mta-sts/**')

  config.addWatchTarget('./assets/scss/')

  // URLs without trailing slash: /now, not /now/. Pages are still written as now/index.html,
  // and Cloudflare (html_handling: drop-trailing-slash) serves them at /now.
  config.addUrlTransform(({ url }) => url.length > 1 && url.endsWith('/')
    ? url.slice(0, -1)
    : url)

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

  config.addGlobalData('r2Folders', () => imageStore.r2Folders())
  config.addPassthroughCopy('assets/favicon')
  // Originals only: Cloudflare Images resizes and converts them on request.
  // On CI this is just the site images in the repo; content images come from
  // R2 (utils/imageStore.js). Locally, any copies on disk are served too.
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
  config.addShortcode('image', (src, alt, sizes) => imageHtml(src, { alt, sizes, strict: true }))

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

  // !!! figure [wide] [pair] [exif] [full] [nolocation]: pictures with an optional caption below.
  //   figure            as wide as the text
  //   figure wide       wider than the text
  //   figure pair       two pictures side by side, as wide as the text
  //   figure pair wide  two pictures side by side, wider than the text
  //   exif              adds a line with camera, lens, exposure and place
  //   full              adds a "View full resolution" link to the original
  //   nolocation        leaves the place out of the exif line
  // Any paragraph after the pictures becomes the caption (utils/figureMeta.js
  // adds the exif and full lines to it).
  const figureSizes = {
    'figure': 'content',
    'figure wide': '(min-width: 1225px) 1225px, 100vw',
    'figure pair': '(min-width: 1089px) 490px, 45vw',
    'figure pair wide': '(min-width: 1225px) 612px, 50vw',
  }
  md.use(markdownItContainer, 'figure', {
    marker: '!',
    render(tokens, idx, _options, env) {
      if (tokens[idx].nesting === 1) {
        const words = tokens[idx].info.trim().split(/\s+/)
        const isWide = words.includes('wide')
        const isPair = words.includes('pair')
        env.imageSizes = figureSizes[['figure', isPair && 'pair', isWide && 'wide'].filter(Boolean).join(' ')]
        const classes = ['figure', isWide && 'figure-wide', isPair && 'figure-pair'].filter(Boolean).join(' ')
        return `<figure class="${classes}">\n`
      }
      env.imageSizes = undefined
      return '</figure>\n'
    },
  })

  // Inside a figure, the text after the pictures becomes a <figcaption>, whether
  // it follows on the next line or after a blank line.
  const isBlank = token => ['softbreak', 'hardbreak'].includes(token.type)
    || (token.type === 'text' && !token.content.trim())
  md.core.ruler.push('figure_caption', (state) => {
    const tokens = []
    const figures = []
    const paragraph = (kids, tag) => {
      const open = new state.Token('paragraph_open', tag, 1)
      const content = new state.Token('inline', '', 0)
      content.children = kids
      content.content = kids.map(kid => kid.content).join('')
      return [
        open,
        content,
        new state.Token('paragraph_close', tag, -1),
      ]
    }
    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i]
      if (token.type === 'container_figure_open') {
        const words = token.info.trim().split(/\s+/)
        figures.push({
          exif: words.includes('exif'),
          full: words.includes('full'),
          location: !words.includes('nolocation'),
          srcs: [],
          caption: null,
        })
      }
      if (token.type === 'container_figure_close') {
        const closing = figures.pop()
        const html = closing && (closing.exif || closing.full)
          ? figureMeta(closing.srcs, closing)
          : ''
        if (html) {
          const meta = new state.Token('html_inline', '', 0)
          meta.content = html
          if (closing.caption)
            closing.caption.children.push(meta)
          else
            tokens.push(...paragraph([meta], 'figcaption'))
        }
      }
      const figure = figures.at(-1)
      const inline = state.tokens[i + 1]
      if (!figure || token.type !== 'paragraph_open' || !inline || inline.type !== 'inline') {
        tokens.push(token)
        continue
      }
      const children = inline.children || []
      for (const child of children) {
        if (child.type === 'image')
          figure.srcs.push(child.attrGet('src'))
      }
      const lastImage = children.findLastIndex(child => child.type === 'image')
      const rest = children.slice(lastImage + 1)
      const captionStart = rest.findIndex(child => !isBlank(child))
      let caption = null
      if (lastImage === -1) {
        caption = paragraph(children, 'figcaption')
        tokens.push(...caption)
      }
      else if (captionStart === -1) {
        tokens.push(...paragraph(children, 'p'))
      }
      else {
        caption = paragraph(rest.slice(captionStart), 'figcaption')
        tokens.push(...paragraph(children.slice(0, lastImage + 1), 'p'), ...caption)
      }
      if (caption)
        figure.caption = caption[1]
      i += 2 // skip the original inline and paragraph_close
    }
    state.tokens = tokens
  })

  md.use(markdownItContainer, 'image-hero', sizedContainer('image-hero'))
    .use(markdownItContainer, 'signature', { marker: '!' })
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
      strict: true,
      alt: self.renderInlineAsText(token.children, options, env),
      title: token.attrGet('title') || undefined,
      sizes: (env && env.imageSizes) || 'content',
      // Header and hero photos are above the fold: load them right away.
      loading: env && ['full', 'third'].includes(env.imageSizes)
        ? 'eager'
        : 'lazy',
    })
  }

  // Links to a pushed image (such as a "full size" download link) go straight
  // to R2; _redirects covers old links from elsewhere.
  const defaultLinkOpen = md.renderer.rules.link_open || ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet('href')
    const key = imageStore.keyFor(href)
    if (key && imageStore.entry(key))
      tokens[idx].attrSet('href', imageStore.r2Url(key))
    return defaultLinkOpen(tokens, idx, options, env, self)
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
