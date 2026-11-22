// Small facts collected while Eleventy builds, for the build report that
// utils/ci.js sends after each deploy. Data files and helpers call record();
// .eleventy.js writes everything to .cache/build-stats.json when the build ends.

const fs = require('node:fs')
const path = require('node:path')

const statsFile = path.join(__dirname, '..', '.cache', 'build-stats.json')
const stats = {}

function record(key, value) {
  stats[key] = value
}

function write(extra = {}) {
  try {
    fs.mkdirSync(path.dirname(statsFile), { recursive: true })
    fs.writeFileSync(statsFile, JSON.stringify({
      ...stats,
      ...extra,
    }, null, 2))
  }
  catch (error) {
    console.warn(`[build-stats] could not write: ${error.message}`)
  }
}

module.exports = { record, statsFile, write }
