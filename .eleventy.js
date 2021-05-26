const { DateTime } = require("luxon");
const readingTime = require('eleventy-plugin-reading-time')
const embedEverything = require("eleventy-plugin-embed-everything")
const pluginRss = require("@11ty/eleventy-plugin-rss");
const pluginSyntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItFootnote = require("markdown-it-footnote");
const markdownItContainer = require("markdown-it-container")
const markdownItResponsive = require('@gerhobbelt/markdown-it-responsive')

const transforms = require('./utils/transforms.js')
const filters = require('./utils/filters.js')

const now = new Date()
const envLong = process.env.NODE_ENV

module.exports = (config) => {
  config.addPlugin(pluginRss);
  config.addPlugin(pluginSyntaxHighlight);
  config.addPlugin(readingTime)
  config.addPlugin(embedEverything)

  // Transforms
  Object.keys(transforms).forEach((transformName) => {
    config.addTransform(transformName, transforms[transformName]);
  });

  // Filters
  Object.keys(filters).forEach((filterName) => {
    config.addFilter(filterName, filters[filterName]);
  });

  const isDraftOrIndex = (post) => {
    if (post.data.draft) return false
    if (post.inputPath.includes('/draft')) return true
    if (post.inputPath.includes('draft.md')) return true
    if (post.inputPath.includes('index.md')) return true
    return false
  }

  // Custom collections
  const livePosts = post => {
    if (isDraftOrIndex(post)) return false
    if (post.date <= now) return true
    return false
  }

  const liveElements = post => {
    if (isDraftOrIndex(post)) return false
    return true
  }

  config.addPassthroughCopy("assets/favicon");
  config.addPassthroughCopy({ 'assets/chrisspiegl.asc': 'chrisspiegl.asc' });

  config.addCollection('posts', collection => {
    return collection.getFilteredByGlob('./post/**/*.md').filter(_ => livePosts(_)).reverse()
  })

  config.addCollection('drafts', collection => {
    return collection.getFilteredByGlob('./post/**/*.md').filter(_ => !livePosts(_)).reverse();
  })

  config.addCollection('podcasts', collection => {
    return collection.getFilteredByGlob('./podcast/**/*.md').filter(_ => livePosts(_)).reverse()
  })

  config.addCollection('books', (collection) => {
    return collection.getFilteredByGlob('./book/**/*.md').filter(_ => liveElements(_)).reverse()
  })

  config.addCollection('movies', (collection) => {
    return collection.getFilteredByGlob('./movie/**/*.md').filter(_ => liveElements(_)).reverse()
  })

  config.addCollection('gear', (collection) => {
    return collection.getFilteredByGlob('./gear/**/*.md').filter(_ => liveElements(_)).reverse()
  })

  config.addCollection("tagList", collection => {
    let uniqueTags = new Set()

    collection.getAllSorted().forEach(function(item) {
      // TODO: Currently this taglist thing shows all posts no matter that tag.
      if (! ('tags' in item.data)) return

      let tags = (typeof item.data.tags === 'string')
             ? [item.data.tags]
             : item.data.tags

        for (const tag of tags)
          tag.startsWith('_') ||  uniqueTags.add(tag)
    });

    return [...uniqueTags];
  })


  let md = markdownIt({
    html: true,
    breaks: true,
    linkify: true,
    typographer: true,
  })

  // The ever-popular markdown filter.
  config.addFilter("markdown", (content) => md.render(content))

  md.use(markdownItAnchor, {
    permalink: true,
    permalinkClass: 'direct-link',
    permalinkSymbol: '',
  })
    .use(markdownItFootnote)
    .use(markdownItContainer, 'image-hero', { marker: '!' })
    .use(markdownItContainer, 'signature', { marker: '!' })
    .use(markdownItContainer, 'image-sbs', { marker: '!' })
    .use(markdownItContainer, 'text-center', { marker: '!' })
    .use(markdownItContainer, 'side-by-side', { marker: '!' })
    .use(markdownItContainer, 'header-image-three', { marker: '!' })
    .use(markdownItContainer, 'quote-hero', { marker: '!' })
    .use(markdownItContainer, 'button', { marker: '!' })
    .use(markdownItContainer, 'container', {
      marker: '!',
      validate: function (params) {
        return true
      },
      render: function (tokens, idx) {
        var m = tokens[idx].info.trim() // .match(/^well\s+(.*)$/);
        if (tokens[idx].nesting === 1) {
          // opening tag
          let summary = m === '' ? '' : '<summary>' + md.renderInline(m) + '</summary>\n'
          return '<details>' + summary + '<aside>'
        } else {
          // closing tag
          return '</aside>\n</details>\n'
        }
      },
    })

  // Responsive Images inside Markdown

    const imageResizer = (width, height, origin) => {
      baseUrl = !origin.startsWith('https://') && !origin.startsWith('http://') ? `https://chrisspiegl.com${origin}` : origin
      if (process.env.ELEVENTY_ENV == 'production') return `https://wrender.spiegl.co/resize/${width}/${height}/${baseUrl}`
      else return `${origin}`
    }
    md.use(markdownItResponsive, {
      responsive: {
        srcset: {
          "*": [
            {
              width: 320,
              rename: { suffix: "-320w" },
            },
            {
              width: 640,
              rename: { suffix: "-640w" },
            },
            {
              width: 1280,
              rename: { suffix: "-1280w" },
            },
            {
              width: 1920,
              rename: { suffix: "-1920w" },
            },
            // {
            //   width: 3840,
            //   rename: { suffix: "-3840w" },
            // },
          ],
        },
        sizes: {
        //   "*": "(max-width: 320px), (max-width: 640px), (max-width: 1280px), 1920px",
        },
      },
    });

  md.renderer.rules.footnote_caption = (tokens, idx) => {
    let n = Number(tokens[idx].meta.id + 1).toString();

    if (tokens[idx].meta.subId > 0) {
      n += ":" + tokens[idx].meta.subId;
    }

    return n;
  };

  config.setLibrary("md", md);

  return {
    dir: {
      output: `_site_${envLong}`,
    },
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
    markdownTemplateEngine: "njk",
    passthroughFileCopy: true
  }
}
