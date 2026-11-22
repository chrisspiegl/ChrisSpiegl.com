// The Worker behind ChrisSpiegl.com. Pages and files are served from static
// assets before this code runs (see wrangler.jsonc); fetch() only sees the
// rare request that matches no asset and hands it back to the assets, which
// answer with the 404 page.
//
// scheduled() runs daily at 03:00 UTC and starts a production rebuild through
// the Workers Builds deploy hook. The build itself reports success or failure
// to PushNotice (utils/ci.js); this only reports when the hook can't be called.
//
// Secrets (Worker > Settings > Variables and secrets):
//   DEPLOY_HOOK              Workers Builds deploy hook URL
//   PUSHNOTICE_CHAT_IDCHAT   PushNotice chat id
//   PUSHNOTICE_CHAT_SECRET   PushNotice chat secret

export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request)
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(rebuild(controller, env))
  },
}

async function rebuild(controller, env) {
  const when = new Date(controller.scheduledTime).toISOString()
  if (!env.DEPLOY_HOOK) {
    await notify(env, 'error', `⏰ Cron ${when}: DEPLOY_HOOK is not set, no rebuild started.`)
    return
  }
  try {
    const response = await fetch(env.DEPLOY_HOOK, { method: 'POST' })
    const body = await response.text()
    if (!response.ok)
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`)
    console.log(`Rebuild started for cron ${controller.cron} at ${when}: ${body.slice(0, 300)}`)
  }
  catch (error) {
    console.error(`Rebuild failed to start: ${error.message}`)
    await notify(env, 'error', `⏰ Cron ${when}: could not start the rebuild.\n${error.message}`)
  }
}

async function notify(env, level, text) {
  if (!env.PUSHNOTICE_CHAT_IDCHAT || !env.PUSHNOTICE_CHAT_SECRET)
    return
  await fetch('https://api.pushnotice.chat/v1/chatnotice/', {
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
}
