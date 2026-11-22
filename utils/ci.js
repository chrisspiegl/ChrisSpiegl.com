#!/usr/bin/env node
// Build and deploy wrapper for Cloudflare, with a PushNotice build report.
//
//   node utils/ci.js build              run `pnpm run build:clean`
//   node utils/ci.js deploy [command]   run the deploy command (default: wrangler deploy)
//   node utils/ci.js report             print the report for the last local run
//
// Workers Builds runs `build` as the build command and `deploy` as the deploy
// command. Cloudflare Pages has no deploy step, so on Pages the report is sent
// right after `build`. Each step streams its output as usual and exits with the
// wrapped command's exit code, so a failed build still fails.
//
// Build variables and secrets (Worker > Settings > Build):
//   PUSHNOTICE_CHAT_IDCHAT   PushNotice chat id          (without it: report is only logged)
//   PUSHNOTICE_CHAT_SECRET   PushNotice chat secret
//   CF_BUILDS_API_TOKEN      optional, "Workers CI Read" token: exact trigger,
//                            queue time and PR link from the Workers Builds API
//   PUSHNOTICE_MARKDOWN      "0" sends plain text instead of a <pre> block

const { spawn, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')
const { stripVTControlCharacters } = require('node:util')
const zlib = require('node:zlib')

const rootDir = path.join(__dirname, '..')
const siteDir = path.join(rootDir, '_site')
const cacheDir = path.join(rootDir, '.cache')
const runFile = path.join(cacheDir, 'ci-run.json')
const statsFile = path.join(cacheDir, 'build-stats.json')
const SITE_URL = 'https://chrisspiegl.com'
const PRODUCTION_BRANCH = process.env.PRODUCTION_BRANCH || 'main'

// --- small helpers ---------------------------------------------------------

function readJson(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  }
  catch {
    return fallback
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

function git(...args) {
  try {
    return execFileSync('git', args, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  }
  catch {
    return ''
  }
}

function packageVersion(name) {
  return readJson(path.join(rootDir, 'node_modules', name, 'package.json')).version || '?'
}

function bytes(n) {
  if (!Number.isFinite(n))
    return '?'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = n
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(unit && value < 10
    ? 1
    : 0)} ${units[unit]}`
}

function duration(ms) {
  if (!Number.isFinite(ms))
    return '?'
  if (ms < 1000)
    return `${Math.round(ms)}ms`
  if (ms < 60_000)
    return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

function number(n) {
  return Number.isFinite(n)
    ? n.toLocaleString('en-US')
    : '?'
}

function truncate(text, max) {
  return text.length > max
    ? `${text.slice(0, max - 1)}…`
    : text
}

// Run a command, streaming its output, and keep the output for parsing.
function run(command, args) {
  return new Promise((resolve) => {
    const started = performance.now()
    const child = spawn(command, args, { cwd: rootDir, shell: process.platform === 'win32', env: process.env })
    let output = ''
    const collect = stream => (chunk) => {
      stream.write(chunk)
      output += chunk
      if (output.length > 200_000)
        output = output.slice(-100_000)
    }
    child.stdout.on('data', collect(process.stdout))
    child.stderr.on('data', collect(process.stderr))
    child.on('error', (error) => {
      output += `\n${error.message}`
    })
    child.on('close', code => resolve({ code: code ?? 1, output, ms: performance.now() - started }))
  })
}

// --- facts -------------------------------------------------------------------

function environment() {
  const branch = process.env.WORKERS_CI_BRANCH || process.env.CF_PAGES_BRANCH || git('rev-parse', '--abbrev-ref', 'HEAD') || '?'
  return {
    platform: process.env.WORKERS_CI
      ? 'Workers Builds'
      : process.env.CF_PAGES ? 'Cloudflare Pages' : 'local',
    branch,
    production: branch === PRODUCTION_BRANCH,
    sha: process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || git('rev-parse', 'HEAD'),
    buildId: process.env.WORKERS_CI_BUILD_UUID || '',
    pagesUrl: process.env.CF_PAGES_URL || '',
  }
}

function commitInfo() {
  const [subject = '', author = '', time = '0'] = git('log', '-1', '--format=%s%x00%an%x00%ct').split('\0')
  const commits = Number(git('rev-list', '--count', 'HEAD')) || null
  const first = Number(git('log', '--reverse', '--format=%ct', '--max-parents=0').split('\n')[0]) || null
  return {
    subject,
    author,
    date: new Date(Number(time) * 1000),
    commits,
    firstCommit: first
      ? new Date(first * 1000)
      : null,
  }
}

// What is in .cache before the build: tells whether Cloudflare restored the
// build cache, and how warm it is.
function cacheSnapshot() {
  const thumbhash = readJson(path.join(cacheDir, 'thumbhash.json'), null)
  let fetches = 0
  try {
    fetches = fs.readdirSync(cacheDir).filter(name => name.startsWith('eleventy-fetch-') && !name.endsWith('.json')).length
  }
  catch {}
  return {
    restored: Boolean(thumbhash || fetches),
    thumbhashEntries: thumbhash?.entries
      ? Object.keys(thumbhash.entries).length
      : 0,
    fetches,
  }
}

function siteSize() {
  const result = {
    files: 0,
    bytes: 0,
    html: 0,
    htmlBytes: 0,
    largest: null,
    homeGzip: null,
  }
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      const { size } = fs.statSync(full)
      result.files++
      result.bytes += size
      if (entry.name.endsWith('.html')) {
        result.html++
        result.htmlBytes += size
        if (!result.largest || size > result.largest.size)
          result.largest = { size, url: `/${path.relative(siteDir, full).split(path.sep).join('/').replace(/index\.html$/, '')}` }
      }
    }
  }
  try {
    walk(siteDir)
    result.homeGzip = zlib.gzipSync(fs.readFileSync(path.join(siteDir, 'index.html'))).length
  }
  catch {}
  return result
}

function parseDeploy(output) {
  const uploaded = /Uploaded (\d+) (?:new )?files? \((\d+) already uploaded\)/.exec(output)
  return {
    newFiles: uploaded
      ? Number(uploaded[1])
      : /No updated asset files to upload/.test(output)
        ? 0
        : null,
    unchanged: uploaded
      ? Number(uploaded[2])
      : null,
    versionId: (/(?:Current|Worker) Version ID: ([\w-]+)/.exec(output) || [])[1] || '',
    previewUrl: (/(?:Version )?Preview URLs?:\s+(https:\/\/\S+)/.exec(stripVTControlCharacters(output)) || [])[1] || '',
    workerSize: (/Total Upload: ([\d.]+ \w+) \/ gzip: ([\d.]+ \w+)/.exec(output) || []).slice(1).join(' / gzip '),
    startup: (/Worker Startup Time: (\d+ ms)/.exec(output) || [])[1] || '',
  }
}

// Exact trigger from the Workers Builds API, when a read token is set.
async function buildDetails(env) {
  const token = process.env.CF_BUILDS_API_TOKEN
  const account = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID
  if (!token || !account || !env.buildId)
    return null
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/builds/builds/${env.buildId}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    const body = await response.json()
    return body.success ? body.result : null
  }
  catch {
    return null
  }
}

function describeTrigger(env, commit, details) {
  const meta = details?.build_trigger_metadata
  if (meta?.build_trigger_source) {
    // The API reports e.g. "push_event", "pull_request", "manual", "retry",
    // "api"; a deploy hook build carries the hook's name.
    const hook = details.deploy_hook?.deploy_hook_name
    if (hook)
      return `⏰ deploy hook "${hook}"`
    const source = meta.build_trigger_source.replace(/_event$/, '')
    return {
      push: '📦 git push',
      pull_request: '🔀 pull request',
      manual: '👆 manual build',
      retry: '🔁 retry',
      api: '🤖 API',
    }[source] || source
  }
  if (!env.production)
    return '🔀 branch / PR preview'
  // Without the API: a rebuild of a commit that is already a while old is the
  // daily cron (or a manual retry); a fresh commit is a push.
  return Date.now() - commit.date.getTime() > 15 * 60_000
    ? '⏰ scheduled rebuild (likely the 03:00 cron)'
    : '📦 git push'
}

// --- the report --------------------------------------------------------------
//
// One compact report per build. When any live data source is not live (API
// failed, or no key so a manual value was used), a second message lists what
// needs a check. A failed build or deploy adds the last log lines.

// Live data sources, with what to do when one isn't live.
function liveSources(stats) {
  const f = stats.followers?.platforms || {}
  return [
    { name: 'YouTube', data: f.youtube, fix: 'check YOUTUBE_API_KEY / quota' },
    { name: 'Instagram', data: f.instagram, fix: 'Worker secret INSTAGRAM_ACCESS_TOKEN set? check /_worker/instagram.json' },
    { name: 'Substack', data: f.substack, fix: 'Substack profile API changed?' },
    { name: 'Nomad List', data: stats.location, fix: 'nomads.com profile JSON changed?' },
  ].filter(source => source.data)
}

const MARK = { 'live': '✓', 'no-key': '⚠', 'failed': '✗' }

// PushNotice sends Telegram HTML: a <pre> block shows as a real code block
// (tested 22 Nov 2026; ``` blocks were dropped). Links go outside the block
// so they stay clickable. PUSHNOTICE_MARKDOWN=0 sends plain text instead.
function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function fence(lines) {
  const kept = lines.filter(line => typeof line === 'string')
  if (process.env.PUSHNOTICE_MARKDOWN === '0')
    return kept.join('\n')
  const links = kept.filter(line => line.startsWith('https://'))
  const body = kept.filter(line => !line.startsWith('https://')).join('\n').replace(/^\n+|\n+$/g, '')
  return [`<pre>${escapeHtml(body)}</pre>`, ...links].join('\n')
}

async function report({ state, deploy, failed, logTail }) {
  const env = environment()
  const commit = commitInfo()
  const stats = readJson(statsFile)
  const site = siteSize()
  const details = await buildDetails(env)
  const trigger = describeTrigger(env, commit, details)
  const cache = state.cacheBefore || {}
  const th = stats.thumbhash || {}
  const f = stats.followers?.platforms || {}
  const sources = liveSources(stats)
  const issues = sources.filter(source => source.data.status !== 'live')
  const totalMs = Date.now() - (state.startedAt || Date.now())
  const url = env.production
    ? SITE_URL
    : (deploy?.previewUrl || env.pagesUrl || '')

  let headline
  if (failed === 'build')
    headline = `❌ ChrisSpiegl.com build failed (${env.branch})`
  else if (failed === 'deploy')
    headline = `❌ ChrisSpiegl.com deploy failed (${env.branch})`
  else if (env.platform === 'Cloudflare Pages')
    headline = `✅ ChrisSpiegl.com built on Pages, deploying now (${env.branch})`
  else if (env.production)
    headline = '✅ ChrisSpiegl.com is live'
  else
    headline = `👀 Preview ready (${env.branch})`

  const mark = data => MARK[data.status] || '?'
  const follower = (name, data) => data && `${name} ${number(data.count)} ${mark(data)}`
  const followers = [
    follower('YouTube', f.youtube),
    follower('Instagram', f.instagram),
    follower('Substack', f.substack),
  ].filter(Boolean)
  const location = stats.location

  // Short lines (phone width): a title line per topic, details indented below.
  const sub = text => `   ${text}`
  const short = text => truncate(text, 34)
  const pages = stats.eleventy
    ? `${number(stats.eleventy.pages)} pages · ${number(stats.eleventy.words)} words`
    : null

  const lines = [
    `${trigger} · ${env.branch}@${env.sha.slice(0, 7)}`,
    commit.subject && `"${short(commit.subject)}"`,
    Boolean(url) && !env.production && url,
    '',
    `⏱ ${duration(totalMs)} total`,
    state.buildMs && sub(`build ${duration(state.buildMs)}${deploy
      ? ` · deploy ${duration(deploy.ms)}`
      : ''}`),
    stats.eleventy && sub(`eleventy ${duration(stats.eleventy.ms)} · thumbhash ${duration(th.ms)}`),
    failed !== 'build' && `📦 ${number(site.files)} files · ${bytes(site.bytes)}`,
    failed !== 'build' && pages && sub(pages),
    failed !== 'build' && deploy?.newFiles !== null && deploy?.newFiles !== undefined && sub(`${number(deploy.newFiles)} uploaded`),
    `🧊 cache ${cache.restored
      ? 'restored ✓'
      : 'cold ✗'}`,
    th.images && sub(`thumbhash ${th.cached} cached · ${th.computed} new`),
    stats.followers && `📊 ${stats.followers.totalLabel} followers`,
    ...followers.map(sub),
    location && `📍 ${location.status === 'live'
      ? location.now
      : 'location unknown'} ${mark(location)}`,
    location?.next && sub(`next: ${location.next}`),
    `🤓 node ${process.versions.node.split('.')[0]} · eleventy ${packageVersion('@11ty/eleventy')}`,
    commit.commits && sub(`${number(commit.commits)} commits since ${commit.firstCommit?.getUTCFullYear()}`),
    ...(logTail
      ? ['', '📜 last lines', ...logTail]
      : []),
  ]

  const messages = [
    {
      text: `${headline}\n${fence(lines)}`,
      level: failed
        ? 'error'
        : 'info',
      silent: !failed && !env.production,
    },
  ]

  if (issues.length) {
    const problem = issues.map(({ name, data, fix }) => {
      const what = data.status === 'no-key'
        ? 'no API key'
        : `FAILED: ${truncate((data.error || '?').replace(/^\w+: /, ''), 40)}`
      const used = data.count !== undefined
        ? `using manual ${number(data.count)} (${data.asOf})`
        : 'shown as unknown on the site'
      return [
        `${MARK[data.status] || '?'} ${name}`,
        `   ${what}`,
        `   ${used}`,
        `   → ${fix}`,
      ].join('\n')
    })
    messages.push({
      text: `⚠️ ChrisSpiegl.com needs a check\n${issues.length} of ${sources.length} live data sources not live\n\n${fence(problem.join('\n\n').split('\n'))}`,
      level: 'error',
      silent: false,
    })
  }
  return messages
}

async function send(messages) {
  for (const message of messages)
    await sendOne(message)
}

async function sendOne({ text, level, silent }) {
  console.log(`\n${text}\n`)
  const idChat = process.env.PUSHNOTICE_CHAT_IDCHAT
  const secret = process.env.PUSHNOTICE_CHAT_SECRET
  if (!idChat || !secret) {
    console.log('[ci] PushNotice not configured (PUSHNOTICE_CHAT_IDCHAT / PUSHNOTICE_CHAT_SECRET); report not sent.')
    return
  }
  try {
    const response = await fetch('https://api.pushnotice.chat/v1/chatnotice/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        idChat,
        secret,
        level,
        env: 'production',
        namespace: 'CF:ChrisSpieglCom:Build',
        silent,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    console.log(`[ci] PushNotice: HTTP ${response.status}`)
  }
  catch (error) {
    // A failed notice must never fail the build.
    console.warn(`[ci] PushNotice failed: ${error.message}`)
  }
}

function tail(output, count = 12) {
  return output
    .replace(/\x1B\[[0-9;]*m/g, '') // eslint-disable-line no-control-regex
    .split('\n')
    .map(line => truncate(line.trimEnd(), 90))
    .filter(Boolean)
    .slice(-count)
}

// --- steps -------------------------------------------------------------------

async function build() {
  const state = {
    startedAt: Date.now(),
    cacheBefore: cacheSnapshot(),
  }
  const result = await run('pnpm', ['run', 'build:clean'])
  state.buildMs = result.ms
  state.buildOk = result.code === 0
  writeJson(runFile, state)

  if (!state.buildOk) {
    await send(await report({
      state,
      failed: 'build',
      logTail: tail(result.output),
    }))
  }
  else if (process.env.CF_PAGES) {
    await send(await report({ state }))
  }
  return result.code
}

async function deploy(args) {
  const state = readJson(runFile)
  const [command, ...rest] = args.length
    ? args
    : ['wrangler', 'deploy']
  // Workers Builds checks out a detached HEAD, so name the Preview after the
  // branch it builds (wrangler would otherwise ask git and find no branch).
  if (command === 'wrangler' && rest[0] === 'preview' && !rest.includes('--name')) {
    const branch = process.env.WORKERS_CI_BRANCH || git('rev-parse', '--abbrev-ref', 'HEAD')
    const name = (branch || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
    if (name && name !== 'head')
      rest.push('--name', name)
  }
  // Prefer the project's own wrangler over a global one.
  const local = path.join(rootDir, 'node_modules', '.bin', command)
  const result = await run(fs.existsSync(local)
    ? local
    : command, rest)
  const info = {
    ...parseDeploy(result.output),
    ms: result.ms,
  }
  const failed = result.code === 0
    ? null
    : 'deploy'
  await send(await report({
    state,
    deploy: info,
    failed,
    logTail: failed
      ? tail(result.output)
      : null,
  }))
  return result.code
}

async function main() {
  const [step, ...args] = process.argv.slice(2)
  if (step === 'build')
    return build()
  if (step === 'deploy')
    return deploy(args)
  if (step === 'report') {
    for (const message of await report({
      state: readJson(runFile),
    }))
      console.log(`${message.text}\n`)
    return 0
  }
  console.error('Usage: node utils/ci.js build | deploy [command…] | report')
  return 2
}

main().then((code) => {
  process.exitCode = code
})
