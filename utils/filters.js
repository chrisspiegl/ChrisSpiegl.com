const { toDate } = require('./dates')

module.exports = {
  dateToISO(date) {
    return toDate(date).toISOString().replace(/\.\d{3}Z$/, 'Z')
  },

  obfuscate(string_) {
    const chars = []
    for (let i = string_.length - 1; i >= 0; i--) {
      chars.unshift([
        '&#',
        string_[i].codePointAt(),
        ';',
      ].join(''))
    }

    return chars.join('')
  },
}
