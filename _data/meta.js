const process = require('process')
const path = require('path')

module.exports = {
  siteTitle: 'Chris Spiegl — Content Creator, World Traveler, and Consultant',
  siteName: 'ChrisSpiegl.com',
  url: 'https://ChrisSpiegl.com',
  imageResizer(width, height, origin) {
    const ext = path.extname(origin)
    const base = path.basename(origin, ext)
    const dir = path.dirname(origin)
    const imagePath = path.join(dir, `${base}-${width}w${ext}`)
    return imagePath
  },
  authorEmail: 'chris@chrisspiegl.com',
  build: {
    env: process.env.ELEVENTY_ENV || process.env.NODE_ENV || 'development',
    timestamp: new Date(),
  },
}
