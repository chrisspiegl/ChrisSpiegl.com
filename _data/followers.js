// Follower counts for /linktree, fetched at build time from official/public sources.
//
// Each platform is optional. When a live lookup isn't configured or fails, the
// manual value below is used, so the build never breaks. Update the manual
// values (and `asOf`) when you notice they drift.
//
// Build environment variables (Cloudflare: Settings > Build > Variables and secrets):
//   YOUTUBE_API_KEY          YouTube Data API v3 key (Google Cloud console)
//   INSTAGRAM_ACCESS_TOKEN   Instagram API token for a Business/Creator account
//   INSTAGRAM_USER_ID        optional; with it the Facebook Graph host is used,
//                            without it graph.instagram.com/me (Instagram Login)

const process = require('node:process')
const EleventyFetch = require('@11ty/eleventy-fetch')
const buildStats = require('../utils/buildStats')

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

// Compact, pretty-bytes style, rounded down so it never overstates:
// 36 -> "36", 9250 -> "9.2K", 32336 -> "32.3K", 150400 -> "150K", 1234567 -> "1.2M"
function compact(count) {
  const units = ['', 'K', 'M', 'B']
  let value = count
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  const decimals = unit > 0 && value < 100
    ? 1
    : 0
  const factor = 10 ** decimals
  const floored = Math.floor(value * factor) / factor
  return `${floored.toFixed(decimals).replace(/\.0$/, '')}${units[unit]}`
}

module.exports = async function () {
  const [yt, ig, ss] = await Promise.all([
    resolve('youtube', youtube),
    resolve('instagram', instagram),
    resolve('substack', substack),
  ])

  const platforms = { youtube: yt, instagram: ig, substack: ss }
  const total = yt.count + ig.count + ss.count

  buildStats.record('followers', {
    platforms,
    total,
    totalLabel: compact(total),
  })

  return {
    platforms,
    total,
    totalLabel: compact(total),
    manualAsOf: manual.asOf,
    allLive: yt.live && ig.live && ss.live,
    updated: new Date().toISOString(),
  }
}
