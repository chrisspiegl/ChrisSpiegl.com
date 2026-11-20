const process = require('node:process')

const authorName = 'Chris Spiegl'
const tagline = 'Father. Traveler. Photographer. Thinker.'
const taglineDetail = 'Chasing the good life around the world.'
// Technical URL is lowercase; the visible brand spelling stays ChrisSpiegl.com.
const siteUrl = 'https://chrisspiegl.com'
const defaultImage = '/assets/images/other/2017-07-17-at-10-33-24-mountain-hike.jpg'
const avatarImage = '/assets/images/other/avatar-spiegl-chris-leica-2022-08-20-L1010008.jpg'
const description = `${tagline} ${taglineDetail}`
const profiles = [
  { name: 'YouTube', url: 'https://youtube.com/chrisspiegl', icon: 'fa7-brands:youtube' },
  { name: 'Instagram', url: 'https://instagram.com/chrisspiegl', icon: 'fa7-brands:instagram' },
  {
    name: 'TikTok',
    url: 'https://tiktok.com/@chrisspiegl',
    icon: 'fa7-brands:tiktok',
    showIcon: false,
  },
  { name: 'Substack', url: 'https://chrisspiegl.substack.com', icon: 'fa7-brands:substack' },
  { name: 'LinkedIn', url: 'https://linkedin.com/in/chrisspiegl', icon: 'fa7-brands:linkedin' },
  { name: 'X', url: 'https://x.com/ChrisSpiegl', icon: 'fa7-brands:x-twitter' },
]

const personJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Person',
  'name': authorName,
  'url': siteUrl,
  description,
  'image': `${siteUrl}${avatarImage}`,
  'jobTitle': 'Photographer and Writer',
  'worksFor': {
    '@type': 'Organization',
    'name': 'CSX.Ventures OÜ',
    'url': 'https://csx.ventures',
  },
  'sameAs': profiles.map(profile => profile.url),
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
  defaultImage,
  avatarImage,
  authorEmail: 'chris@chrisspiegl.com',
  build: {
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date(),
  },
}
