// The Worker behind ChrisSpiegl.com. Pages and files are served from static
// assets before this code runs (see wrangler.jsonc). Only paths under
// /_worker/ come here first (run_worker_first); everything else that reaches
// fetch() is handed back to the assets, which answer with the 404 page.
//
// 1. Daily rebuild. scheduled() runs daily at 03:00 UTC and starts a
//    production rebuild through the Workers Builds deploy hook. The build
//    itself reports success or failure to PushNotice (utils/ci.js); this only
//    reports when the hook can't be called or the Instagram token can't be
//    renewed.
//
// 2. Instagram follower count. Instagram tokens expire after 60 days, and a
//    build variable can't renew itself. So the token lives here: the Worker
//    keeps it in KV (binding INSTAGRAM), renews it every 7 days and stores the
//    latest follower count. The build reads only the count, from
//    /_worker/instagram.json; the token never leaves the Worker.
//    Setup: add the long-lived token as the secret INSTAGRAM_ACCESS_TOKEN
//    (Settings > Variables and Secrets). Pasting a new token there later
//    replaces the stored one on the next run.
//
//    Facebook login instead (no business portfolio needed): set
//    INSTAGRAM_USER_ID to the Instagram account id (instagram_business_account
//    of the linked Facebook Page) and INSTAGRAM_ACCESS_TOKEN to a Page token
//    made from a long-lived user token. Such a Page token doesn't expire, so
//    the Worker uses it as it is and skips renewal.
//
// Worker secrets / vars (Settings > Variables and Secrets):
//   DEPLOY_HOOK              Workers Builds deploy hook URL (secret)
//   INSTAGRAM_ACCESS_TOKEN   long-lived Instagram token, or Facebook Page token (secret)
//   INSTAGRAM_USER_ID        only with a Facebook Page token: Instagram account id (secret or var)
//   PUSHNOTICE_CHAT_IDCHAT   PushNotice chat id (var in wrangler.jsonc)
//   PUSHNOTICE_CHAT_SECRET   PushNotice chat secret (secret)

const GRAPH = 'https://graph.instagram.com'
const FACEBOOK_GRAPH = 'https://graph.facebook.com/v21.0'
const DAY = 24 * 60 * 60 * 1000
const REFRESH_AFTER = 7 * DAY // tokens last 60 days; renew well before that
const COUNT_MAX_AGE = 12 * 60 * 60 * 1000
const RETRY_AFTER = 60 * 60 * 1000

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [
    ...new Uint8Array(digest),
  ].map(b => b.toString(16).padStart(2, '0')).join('')
}

// The current token: the stored (renewed) one, unless a new secret was pasted.
async function currentToken(env) {
  const secret = env.INSTAGRAM_ACCESS_TOKEN
  const stored = await env.INSTAGRAM.get('token', 'json')
  const seed = secret
    ? await sha256(secret)
    : null
  if (stored?.token && (!seed || stored.seed === seed))
    return stored
  if (!secret)
    return null
  // New (or first) secret: start from it. It may be fresh, so renew it later.
  const entry = {
    token: secret,
    seed,
    refreshedAt: Date.now(),
  }
  await env.INSTAGRAM.put('token', JSON.stringify(entry))
  return entry
}

async function renewIfDue(env, entry) {
  if (Date.now() - entry.refreshedAt < REFRESH_AFTER)
    return entry
  const url = `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(entry.token)}`
  const response = await fetch(url)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.access_token) {
    const reason = `${response.status}: ${data?.error?.message || 'no token in answer'}`
    console.error(`[instagram] Token renewal failed (${reason})`)
    const daysLeft = Math.round((entry.refreshedAt + 60 * DAY - Date.now()) / DAY)
    await notify(env, 'error', `📸 Instagram token renewal failed (${reason}).\nAbout ${daysLeft} days left. Paste a new token into the Worker secret INSTAGRAM_ACCESS_TOKEN.`)
    return entry
  }
  const renewed = {
    ...entry,
    token: data.access_token,
    refreshedAt: Date.now(),
  }
  await env.INSTAGRAM.put('token', JSON.stringify(renewed))
  console.log(`[instagram] Token renewed, valid for ${Math.round((data.expires_in || 0) / 86400)} days.`)
  return renewed
}

// Renew the token when due and store the follower count. Returns the stored count entry.
// A Page token made from a long-lived user token has no expiry date, but Meta
// can still set one (expires_at) or stop its data access (data_access_expires_at).
// Warn two weeks ahead, so there is time to make a new token. Silent when the
// check itself fails: the daily lookup reports real failures.
const WARN_BEFORE = 14 * DAY

async function warnBeforeExpiry(env) {
  const token = encodeURIComponent(env.INSTAGRAM_ACCESS_TOKEN)
  const data = await fetch(`${FACEBOOK_GRAPH}/debug_token?input_token=${token}&access_token=${token}`)
    .then(response => response.json())
    .then(body => body?.data)
    .catch(() => null)
  if (!data)
    return
  if (data.is_valid === false) {
    await notify(env, 'error', `📸 Instagram token is no longer valid (${data.error?.message || 'no reason given'}).\nMake a new Page token and paste it into the Worker secret INSTAGRAM_ACCESS_TOKEN.`)
    return
  }
  const ends = [data.expires_at, data.data_access_expires_at]
    .filter(seconds => seconds > 0)
    .map(seconds => seconds * 1000)
  const soonest = Math.min(...ends)
  if (Number.isFinite(soonest) && soonest - Date.now() < WARN_BEFORE) {
    const days = Math.max(0, Math.round((soonest - Date.now()) / DAY))
    await notify(env, 'warning', `📸 Instagram token stops working in about ${days} days (${new Date(soonest).toISOString().slice(0, 10)}).\nMake a new Page token and paste it into the Worker secret INSTAGRAM_ACCESS_TOKEN.`)
  }
}

// With { report: true } (the daily cron) a failed lookup also sends a PushNotice,
// so an expired or revoked token is noticed within a day.
async function updateInstagram(env, { report = false } = {}) {
  if (!env.INSTAGRAM)
    return null
  let url
  if (env.INSTAGRAM_USER_ID) {
    // Facebook login: the Page token doesn't expire, nothing to renew.
    if (!env.INSTAGRAM_ACCESS_TOKEN)
      return null
    url = `${FACEBOOK_GRAPH}/${encodeURIComponent(env.INSTAGRAM_USER_ID)}?fields=followers_count&access_token=${encodeURIComponent(env.INSTAGRAM_ACCESS_TOKEN)}`
    if (report)
      await warnBeforeExpiry(env)
  }
  else {
    let entry = await currentToken(env)
    if (!entry)
      return null
    entry = await renewIfDue(env, entry)
    url = `${GRAPH}/me?fields=followers_count&access_token=${encodeURIComponent(entry.token)}`
  }
  const response = await fetch(url)
  const data = await response.json().catch(() => ({}))
  const count = Number(data?.followers_count)
  const result = Number.isFinite(count) && response.ok
    ? {
        count,
        updatedAt: new Date().toISOString(),
      }
    : {
        error: data?.error?.message || `HTTP ${response.status}`,
        failedAt: Date.now(),
      }
  if (result.error)
    console.error(`[instagram] Follower count failed: ${result.error}`)
  if (result.error && report)
    await notify(env, 'error', `📸 Instagram follower count failed: ${result.error}\nThe site keeps the last count. If the token expired or was revoked, paste a new one into the Worker secret INSTAGRAM_ACCESS_TOKEN.`)
  const previous = await env.INSTAGRAM.get('count', 'json')
  // Keep the last good count when a lookup fails.
  const stored = result.error && previous?.count
    ? { ...previous, failedAt: result.failedAt }
    : result
  await env.INSTAGRAM.put('count', JSON.stringify(stored))
  return stored
}

// GET /_worker/instagram.json -> {"count": 2843, "updatedAt": "..."} (public numbers only)
async function instagramJson(env) {
  let stored = env.INSTAGRAM
    ? await env.INSTAGRAM.get('count', 'json')
    : null
  const age = stored?.updatedAt
    ? Date.now() - Date.parse(stored.updatedAt)
    : Infinity
  const recentFailure = stored?.failedAt && Date.now() - stored.failedAt < RETRY_AFTER
  if (age > COUNT_MAX_AGE && !recentFailure)
    stored = await updateInstagram(env)
  const body = stored?.count
    ? { count: stored.count, updatedAt: stored.updatedAt }
    // Setup check: which part is missing (no secrets are shown).
    : {
        count: null,
        kv: Boolean(env.INSTAGRAM),
        token: Boolean(env.INSTAGRAM_ACCESS_TOKEN),
        error: stored?.error,
      }
  return new Response(JSON.stringify(body), {
    status: body.count ? 200 : 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  })
}

async function rebuild(controller, env) {
  const when = new Date(controller.scheduledTime).toISOString()
  const hook = env.DEPLOY_HOOK || env.DEPLOY_HOOK_URL
  if (!hook) {
    await notify(env, 'error', `⏰ Cron ${when}: DEPLOY_HOOK is not set, no rebuild started.`)
    return
  }
  try {
    const response = await fetch(hook, { method: 'POST' })
    const body = await response.text()
    if (!response.ok)
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`)
    console.log(`[rebuild] Build started for cron ${controller.cron} at ${when}: ${body.slice(0, 300)}`)
  }
  catch (error) {
    console.error(`[rebuild] Rebuild failed to start: ${error.message}`)
    await notify(env, 'error', `⏰ Cron ${when}: could not start the rebuild.\n${error.message}`)
  }
}

async function notify(env, level, text) {
  if (!env.PUSHNOTICE_CHAT_IDCHAT || !env.PUSHNOTICE_CHAT_SECRET)
    return
  const response = await fetch('https://api.pushnotice.chat/v1/chatnotice/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      idChat: env.PUSHNOTICE_CHAT_IDCHAT,
      secret: env.PUSHNOTICE_CHAT_SECRET,
      level,
      env: 'production',
      namespace: 'CF:ChrisSpieglCom:Cron',
      silent: false,
      text,
    }),
  }).catch(error => console.error(`PushNotice failed: ${error.message}`))
  if (response && !response.ok) {
    const data = await response.json().catch(() => ({}))
    console.error(`PushNotice: HTTP ${response.status}: ${data?.message || 'no reason given'}`)
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (pathname === '/_worker/instagram.json' && request.method === 'GET')
      return instagramJson(env)
    return env.ASSETS.fetch(request)
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      // Count first, so the build that follows reads today's number.
      try {
        await updateInstagram(env, { report: true })
      }
      catch (error) {
        console.error(`[instagram] ${error.message}`)
      }
      await rebuild(controller, env)
    })())
  },
}
