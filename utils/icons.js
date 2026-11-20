// Inline SVG icons, bundled at build time from Iconify icon sets.
// No icon font or script ships to the browser.
const { getIconData, iconToHTML, iconToSVG, replaceIDs } = require('@iconify/utils')

const sets = {
  'fa7-brands': require('@iconify-json/fa7-brands/icons.json'),
}

function icon(name, { label, className = 'icon' } = {}) {
  const [prefix, iconName] = name.split(':')
  const set = sets[prefix]
  const data = set && getIconData(set, iconName)
  if (!data)
    throw new Error(`[icons] Unknown icon "${name}"`)
  const { attributes, body } = iconToSVG(data, { height: '1em' })
  const extra = label
    ? { 'role': 'img', 'aria-label': label }
    : { 'aria-hidden': 'true', 'focusable': 'false' }
  return iconToHTML(replaceIDs(body), {
    ...attributes,
    class: className,
    ...extra,
  })
}

module.exports = { icon }
