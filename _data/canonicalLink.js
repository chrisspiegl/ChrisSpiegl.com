const canonicalLink = require('../utils/canonicalLink')

// Eleventy calls a function export and uses the return value as the data.
module.exports = () => canonicalLink
