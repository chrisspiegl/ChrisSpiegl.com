const emailLink = require('../utils/emailLink')

// Eleventy calls a function export and uses the return value as the data.
// Return the helper so templates can call `emailLink(...)`.
module.exports = () => emailLink
