// Follower counts for /linktree, fetched at build time from official/public sources.
//
// Each platform is optional. When a live lookup isn't configured or fails, the
// manual value below is used, so the build never breaks. Update the manual
// values (and `asOf`) when you notice they drift.
//
// Environment variables (set them in Cloudflare Pages > Settings > Variables):
//   YOUTUBE_API_KEY          YouTube Data API v3 key (Google Cloud console)
//   INSTAGRAM_ACCESS_TOKEN   Instagram API token for a Business/Creator account
//   INSTAGRAM_USER_ID        optional; with it the Facebook Graph host is used,
//                            without it graph.instagram.com/me (Instagram Login)

const process = require('node:process')
const EleventyFetch = require('@11ty/eleventy-fetch')

const YOUTUBE_CHANNEL_ID = 'UCrfYnHuKRC-Worm7OmMMcLQ'
const SUBSTACK_HANDLE = 'chrisspiegl'
const GRAPH_VERSION = 'v21.0'
const TIMEOUT_MS = 8000

const manual = {
  asOf: '2026-10-14',
  youtube: 16900,
  instagram: 15400,
  substack: 36,
}

async function fetchJson(url, label) {
  return EleventyFetch(url, {
    duration: '6h',
    type: 'json',
    directory: '.cache',
    fetchOptions: {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  }).catch((error) => {
    // Never log the URL: it can contain API keys.
    throw new Error(`${label}: ${error.message.replace(/https?:\/\/\S+/g, '[url]')}`)
  })
}

async function youtube() {
  const key = process.env.YOUTUBE_API_KEY
  if (!key)
    return null
  const data = await fetchJson(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${YOUTUBE_CHANNEL_ID}&key=${key}`, 'YouTube')
  const count = Number(data?.items?.[0]?.statistics?.subscriberCount)
  return Number.isFinite(count)
    ? count
    : null
}

async function instagram() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token)
    return null
  const userId = process.env.INSTAGRAM_USER_ID
  const url = userId
    ? `https://graph.facebook.com/${GRAPH_VERSION}/${userId}?fields=followers_count&access_token=${token}`
    : `https://graph.instagram.com/${GRAPH_VERSION}/me?fields=followers_count&access_token=${token}`
  const data = await fetchJson(url, 'Instagram')
  const count = Number(data?.followers_count)
  return Number.isFinite(count)
    ? count
    : null
}

async function substack() {
  // Public profile data, the same numbers substack.com shows on the profile page.
  const data = await fetchJson(`https://substack.com/api/v1/user/${SUBSTACK_HANDLE}/public_profile`, 'Substack')
  const count = Number(data?.subscriberCountNumber)
  return Number.isFinite(count)
    ? count
    : null
}

async function resolve(name, lookup) {
  try {
    const live = await lookup()
    if (live !== null)
      return { count: live, live: true }
  }
  catch (error) {
    console.warn(`[followers] ${error.message}; using manual value.`)
  }
  return { count: manual[name], live: false }
}

// 16934 -> "16.9K", 36 -> "36"
function short(count) {
  if (count >= 1_000_000)
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (count >= 1000)
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return String(count)
}

module.exports = async function () {
  const [yt, ig, ss] = await Promise.all([
    resolve('youtube', youtube),
    resolve('instagram', instagram),
    resolve('substack', substack),
  ])

  const platforms = {
    youtube: {
      ...yt,
      label: short(yt.count),
    },
    instagram: {
      ...ig,
      label: short(ig.count),
    },
    substack: {
      ...ss,
      label: short(ss.count),
    },
  }
  const total = yt.count + ig.count + ss.count
  // Round down so the headline never overstates: 32,336 -> "32,300+"
  const step = total >= 10_000
    ? 100
    : 10
  const rounded = Math.floor(total / step) * step

  return {
    platforms,
    total,
    totalLabel: `${rounded.toLocaleString('en-US')}+`,
    manualAsOf: manual.asOf,
    allLive: yt.live && ig.live && ss.live,
    updated: new Date().toISOString(),
  }
}
