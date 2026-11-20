const { format, formatISO, isValid, parseISO } = require('date-fns')

// Accepts Date objects, ISO strings, and timestamps (front matter and git dates).
function toDate(value) {
  if (value instanceof Date)
    return value
  if (typeof value === 'number')
    return new Date(value)
  if (typeof value === 'string') {
    const parsed = parseISO(value)
    return isValid(parsed)
      ? parsed
      : new Date(value)
  }
  return new Date(Number.NaN)
}

function formatDate(value, pattern) {
  const date = toDate(value)
  return isValid(date)
    ? format(date, pattern)
    : ''
}

module.exports = {
  toDate,
  formatDate,
  isValidDate: value => isValid(toDate(value)),
  dateReadable: value => formatDate(value, 'MMMM do, yyyy'),
  dateReadableShort: value => formatDate(value, 'do MMM yyyy'),
  dateHtml: (value) => {
    const date = toDate(value)
    return isValid(date)
      ? date.toISOString()
      : ''
  },
  dateISO: (value) => {
    const date = toDate(value)
    return isValid(date)
      ? formatISO(date, { representation: 'date' })
      : ''
  },
}
