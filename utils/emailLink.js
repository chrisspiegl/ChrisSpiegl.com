const { authorEmail } = require('../_data/meta')

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function emailLink(text, subject, body, address) {
  let className
  let title

  if (text && typeof text === 'object') {
    ({
      text, subject, body, address, className, title,
    } = text)
  }

  const to = address || authorEmail
  const label = text || to
  const query = []

  if (subject) query.push(`subject=${encodeURIComponent(subject)}`)
  if (body) query.push(`body=${encodeURIComponent(body)}`)

  const href = `mailto:${to}${query.length > 0 ? `?${query.join('&')}` : ''}`
  const attributes = [`href="${escapeHtml(href)}"`]

  if (className) attributes.push(`class="${escapeHtml(className)}"`)
  if (title) attributes.push(`title="${escapeHtml(title)}"`)

  return `<a ${attributes.join(' ')}>${escapeHtml(label)}</a>`
}

module.exports = emailLink
