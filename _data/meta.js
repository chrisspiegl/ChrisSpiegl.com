const process = require('process')
const path = require('path')

const authorName = 'Chris Spiegl'
const tagline = 'Father. Traveler. Photographer. Thinker.'
const taglineDetail = 'Chasing the good life around the world.'
const siteUrl = 'https://ChrisSpiegl.com'
const description = `${tagline} ${taglineDetail}`
const profiles = [
  { name: 'YouTube', url: 'https://youtube.com/chrisspiegl', icon: 'fa-brands fa-youtube' },
  { name: 'Instagram', url: 'https://instagram.com/chrisspiegl', icon: 'fa-brands fa-instagram' },
  { name: 'TikTok', url: 'https://tiktok.com/@chrisspiegl', icon: 'fa-brands fa-tiktok', showIcon: false },
  { name: 'Substack', url: 'https://chrisspiegl.substack.com', icon: 'fa-brands fa-substack' },
  { name: 'LinkedIn', url: 'https://linkedin.com/in/chrisspiegl', icon: 'fa-brands fa-linkedin' },
  { name: 'X', url: 'https://x.com/ChrisSpiegl', icon: 'fa-brands fa-x-twitter' },
]

const personJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: authorName,
  url: siteUrl,
  description,
  sameAs: profiles.map((profile) => profile.url),
})

module.exports = {
  authorName,
  siteTitle: authorName,
  tagline,
  taglineDetail,
  description,
  profiles,
  personJsonLd,
  siteName: 'ChrisSpiegl.com',
  url: siteUrl,
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
