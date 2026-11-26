// Table of contents for pages that set `toc: true` in their front matter.
// Reads the h2 and h3 headings (with the ids markdown-it-anchor gives them)
// from the rendered HTML and nests each h3 under the h2 before it.
const HEADING = /<h([23])\s[^>]*?id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g

function decode(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function tocItems(html) {
  const items = []
  for (const [, level, id, inner] of String(html || '').matchAll(HEADING)) {
    const text = decode(inner.replace(/<[^>]+>/g, '')).trim()
    if (!text)
      continue
    const item = { id, text, children: [] }
    const parent = items.at(-1)
    if (level === '3' && parent)
      parent.children.push(item)
    else
      items.push(item)
  }
  return items
}

module.exports = { tocItems }
