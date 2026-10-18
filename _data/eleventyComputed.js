const { lastCommitDate } = require('../utils/gitFileDates')

module.exports = {
  pageUpdated(data) {
    const publishedDate = data.page && data.page.date
    if (!data.page || !data.page.inputPath) return publishedDate || null
    return lastCommitDate(data.page.inputPath) || publishedDate || null
  },
}
