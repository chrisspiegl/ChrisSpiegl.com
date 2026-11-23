// Follower counts for /links, fetched at build time from official/public sources.
//
// Each platform is optional. When a live lookup isn't configured or fails, the
// manual value below is used, so the build never breaks. Update the manual
// values (and `asOf`) when you notice they drift.
//
// Build environment variables (Cloudflare: Settings > Build > Variables and secrets):
//   YOUTUBE_API_KEY          YouTube Data API v3 key (Google Cloud console)
//   INSTAGRAM_ACCESS_TOKEN   Facebook Page token (doesn't expire) for the Page linked
//                            to the Instagram account; see INSTAGRAM_USER_ID below

const process = require('node:process')
const EleventyFetch = require('@11ty/eleventy-fetch')
const buildStats = require('../utils/buildStats')

const YOUTUBE_CHANNEL_ID = 'UCrfYnHuKRC-Worm7OmMMcLQ'
const SUBSTACK_HANDLE = 'chrisspiegl'
const GRAPH_VERSION = 'v21.0'
// Instagram account id (instagram_business_account of the linked Facebook Page).
const INSTAGRAM_USER_ID = process.env.INSTAGRAM_USER_ID || '17841400977130010'
const TIMEOUT_MS = 8000

const manual = {
  asOf: '2026-11-22',
  youtube: 16900,
  instagram: 13800,
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

// Each lookup returns null when it isn't configured, and throws when it is
// configured but fails, so the build report can tell the two apart.
async function youtube() {
  const key = process.env.YOUTUBE_API_KEY
  if (!key)
    return null
  const data = await fetchJson(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${YOUTUBE_CHANNEL_ID}&key=${key}`, 'YouTube')
  const count = Number(data?.items?.[0]?.statistics?.subscriberCount)
  if (!Number.isFinite(count))
    throw new TypeError('unexpected response')
  return count
}

// Instagram via the Facebook Graph API: a Page token made from a long-lived
// user token doesn't expire, so a plain build variable is enough. Meta's own
// error message is kept (no URL: it contains the token), so the build report
// says why a lookup failed.
async function instagram() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token)
    return null
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${INSTAGRAM_USER_ID}?fields=followers_count&access_token=${encodeURIComponent(token)}`
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
    .catch((error) => {
      throw new Error(`Instagram: ${error.message}`)
    })
  const data = await response.json().catch(() => ({}))
  const count = Number(data?.followers_count)
  if (!response.ok || !Number.isFinite(count))
    throw new Error(`Instagram: ${data?.error?.message || `HTTP ${response.status}`}`)
  return count
}

async function substack() {
  // Public profile data, the same numbers substack.com shows on the profile page.
  const data = await fetchJson(`https://substack.com/api/v1/user/${SUBSTACK_HANDLE}/public_profile`, 'Substack')
  const count = Number(data?.subscriberCountNumber)
  if (!Number.isFinite(count))
    throw new TypeError('unexpected response')
  return count
}

// status: "live" (from the API), "no-key" (lookup not configured) or "failed"
// (configured but the API call failed). The last two use the manual value.
async function resolve(name, lookup) {
  try {
    const live = await lookup()
    if (live !== null)
      return { count: live, live: true, status: 'live' }
    return {
      count: manual[name],
      live: false,
      status: 'no-key',
      asOf: manual.asOf,
    }
  }
  catch (error) {
    console.warn(`[followers] ${error.message}; using manual value.`)
    return {
      count: manual[name],
      live: false,
      status: 'failed',
      error: error.message,
      asOf: manual.asOf,
    }
  }
}

// Compact, pretty-bytes style, rounded down so it never overstates:
// 36 -> "36", 9250 -> "9.25K", 32336 -> "32.33K", 150400 -> "150.4K", 1234567 -> "1.23M"
function compact(count) {
  const units = ['', 'K', 'M', 'B']
  let value = count
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  const decimals = unit === 0
    ? 0
    : value < 100
      ? 2
      : 1
  // Divide the whole count once (9200 / 10 = 920), so float error can't turn 9.2 into 9.19.
  const factor = 10 ** decimals
  const floored = Math.floor(count / (1000 ** unit / factor)) / factor
  const digits = floored.toFixed(decimals)
  const trimmed = decimals
    ? digits.replace(/\.?0+$/, '')
    : digits
  return `${trimmed}${units[unit]}`
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
