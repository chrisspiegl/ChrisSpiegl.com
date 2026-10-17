const redirects = require('./redirects.json')

module.exports = redirects.filter((redirect) => !redirect.slug.includes('*'))
