// What search engines may show, in one place. Every page not listed here is
// indexed as usual.
//
// - robots 'noindex': the page stays out of search results. The layout adds
//   <meta name="robots" content="noindex, nofollow"> and _headers sends the
//   same X-Robots-Tag, which also covers anything that isn't HTML.
// - canonical: search engines are told to show that page instead. The page
//   stays indexable so they can read the hint.
// - A path ending in /* covers the page and everything below it.
//
// Don't block these pages in robots.txt: a crawler that may not fetch a page
// never sees its noindex, and the page can still show up as a bare link.

const rules = [
  { path: '/styleguide/*', robots: 'noindex', why: 'Internal design reference, including the email signatures.' },
  { path: '/signature', robots: 'noindex', why: 'Only for people who follow the links in an email signature.' },
  { path: '/drafts-2kf92k', robots: 'noindex', why: 'Unlisted list of draft posts.' },
  { path: '/404.html', robots: 'noindex', why: 'Error page.' },
  { path: '/tag/drafts', robots: 'noindex', why: 'Internal tag.' },
  { path: '/tag/sitemap', robots: 'noindex', why: 'Internal tag.' },
  { path: '/gear/view/*', canonical: '/uses', why: 'Old gear lists, kept online. /uses replaced them.' },
]

// '/styleguide/email-signature/' -> '/styleguide/email-signature'
function normalize(url) {
  return url.length > 1
    ? url.replace(/\/$/, '')
    : url
}

function matches(rule, url) {
  const target = normalize(url)
  if (rule.path.endsWith('/*')) {
    const base = rule.path.slice(0, -2)
    return target === base || target.startsWith(`${base}/`)
  }
  return target === rule.path
}

module.exports = {
  rules,
  // The rule for a page URL, or undefined when it is indexed as usual.
  forUrl: url => (url
    ? rules.find(rule => matches(rule, url))
    : undefined),
  // The _headers paths for a rule: the page itself and, for /*, all below it.
  headerPaths: (rule) => {
    if (rule.path.endsWith('/*')) {
      return [
        rule.path.slice(0, -2),
        rule.path,
      ]
    }
    return rule.path.includes('.')
      ? [rule.path]
      : [rule.path, `${rule.path}/`]
  },
}
