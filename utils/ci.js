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
//   PUSHNOTICE_MARKDOWN      "0" sends plain text instead of a ``` code block

const { spawn, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const process = require('node:process')
const zlib = require('node:zlib')

const rootDir = path.join(__dirname, '..')
const siteDir = path.join(rootDir, '_site')
const cacheDir = path.join(rootDir, '.cache')
const runFile = path.join(cacheDir, 'ci-run.json')
const statsFile = path.join(cacheDir, 'build-stats.json')
const SITE_URL = 'https://chrisspiegl.com'
const PRODUCTION_BRANCH = process.env.PRODUCTION_BRANCH || 'main'
const WIDTH = 13
const GAP = '\0gap'

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

function version(command, ...args) {
  try {
    return execFileSync(command, args, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().split('\n').pop()
  }
  catch {
    return '?'
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

function ago(date) {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 90)
    return `${seconds}s ago`
  if (seconds < 5400)
    return `${Math.round(seconds / 60)} min ago`
  if (seconds < 129_600)
    return `${Math.round(seconds / 3600)}h ago`
  return `${Math.round(seconds / 86_400)} days ago`
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
    previewUrl: (/(?:Version )?Preview URL: (https:\/\/\S+)/.exec(output) || [])[1] || '',
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
    const hook = details.deploy_hook?.deploy_hook_name
    return {
      push: '📦 git push',
      pull_request: '🔀 pull request',
      manual: '👆 manual retry',
      api: hook
        ? `⏰ deploy hook "${hook}"`
        : '🤖 API',
    }[meta.build_trigger_source] || meta.build_trigger_source
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

function row(label, value) {
  return `${label.padEnd(WIDTH)}${value}`
}

function section(title, rows) {
  const lines = rows.filter(Boolean)
  return lines.length
    ? [GAP, title, ...lines]
    : []
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
  const totalMs = Date.now() - (state.startedAt || Date.now())
  const queueMs = details?.created_on && details?.running_on
    ? new Date(details.running_on) - new Date(details.created_on)
    : null
  const readingMinutes = stats.eleventy?.words
    ? Math.round(stats.eleventy.words / 230)
    : null
  const url = env.production
    ? SITE_URL
    : (deploy?.previewUrl || env.pagesUrl || '')

  let headline
  if (failed === 'build') {
    headline = `❌ ChrisSpiegl.com build failed (${env.branch})`
  }
  else if (failed === 'deploy') {
    headline = `❌ ChrisSpiegl.com deploy failed (${env.branch})`
  }
  else if (env.platform === 'Cloudflare Pages') {
    headline = `✅ ChrisSpiegl.com built on Pages, deploying now (${env.branch})`
  }
  else {
    headline = env.production
      ? '✅ ChrisSpiegl.com is live'
      : `👀 Preview ready (${env.branch})`
  }

  // Live data health: ✅ fresh from the API/feed, ⚪ no API key (manual
  // value), ❌ the API/feed failed (manual value or unknown location).
  const sources = [
    ['YouTube', f.youtube],
    ['Instagram', f.instagram],
    ['Substack', f.substack],
    ['Nomad List', stats.location],
  ].filter(([, source]) => source)
  const broken = sources.filter(([, source]) => source.status === 'failed')
  const missing = sources.filter(([, source]) => source.status === 'no-key')
  const mark = source => ({ 'live': '✅', 'no-key': '⚪', 'failed': '❌' })[source.status] || '❔'
  const why = source => ({
    'live': 'live',
    'no-key': `no API key · manual ${source.asOf}`,
  })[source.status] || `FAILED${source.asOf
    ? ` · manual ${source.asOf}`
    : ''} · ${truncate((source.error || '?').replace(/^\w+: /, ''), 50)}`
  const follower = (label, p) => p && row(label, `${mark(p)} ${number(p.count).padStart(7)}  ${why(p)}`)
  const location = stats.location
  if (broken.length && !failed)
    headline += `\n⚠️ live data broken: ${broken.map(([name]) => name).join(', ')}`

  const lines = [
    row('trigger', trigger),
    row('branch', `${env.branch} @ ${env.sha.slice(0, 7)}`),
    commit.subject && row('commit', `"${truncate(commit.subject, 48)}"`),
    commit.author && row('author', `${commit.author}, ${ago(commit.date)}`),
    details?.pull_request?.pull_request_url && row('pr', details.pull_request.pull_request_url),
    url && row('url', url),
    ...section('📊 live data', [
      follower('YouTube', f.youtube),
      follower('Instagram', f.instagram),
      follower('Substack', f.substack),
      stats.followers && row('total', `   ${number(stats.followers.total).padStart(7)}  →  ${stats.followers.totalLabel}`),
      location && row('location', location.status === 'failed'
        ? `${mark(location)} ${why(location)}`
        : `${mark(location)} ${location.now}${location.next
          ? `  →  ${location.next}`
          : ''}`),
      sources.length && row('health', `✅ ${sources.length - broken.length - missing.length} live · ⚪ ${missing.length} no key · ❌ ${broken.length} failed`),
    ]),
    ...section('⏱  timing', [
      queueMs !== null && row('queue', duration(queueMs)),
      state.buildMs && row('build', `${duration(state.buildMs)}  (eleventy ${duration(stats.eleventy?.ms)}, thumbhash ${duration(th.ms)})`),
      deploy && row('deploy', duration(deploy.ms)),
      row('total', `${duration(totalMs)}  (after install)`),
    ]),
    ...section('📦 output', failed === 'build'
      ? []
      : [
          row('files', `${number(site.files)}  ·  ${bytes(site.bytes)}`),
          stats.eleventy && row('pages', `${number(stats.eleventy.pages)}  ·  ${number(stats.eleventy.words)} words (~${readingMinutes} min read)`),
          row('html', `${bytes(site.htmlBytes)}  ·  biggest ${site.largest?.url || '?'} ${bytes(site.largest?.size)}`),
          site.homeGzip && row('home page', `${bytes(site.homeGzip)} gzipped`),
          deploy?.newFiles !== null && deploy?.newFiles !== undefined && row('uploaded', `${number(deploy.newFiles)} new  ·  ${number(deploy.unchanged ?? site.files - deploy.newFiles)} unchanged`),
          deploy?.versionId && row('version', deploy.versionId.slice(0, 8)),
          deploy?.workerSize && row('worker', `${deploy.workerSize}${deploy.startup
            ? `  ·  startup ${deploy.startup}`
            : ''}`),
          stats.images && row('images', stats.images),
        ]),
    ...section('🧊 cache', [
      row('build cache', cache.restored
        ? `restored ✓  (${cache.fetches} API responses)`
        : 'cold ✗  (nothing restored)'),
      th.images && row('thumbhash', `${th.cached} cached · ${th.computed} new · ${th.hashedByGit} via git`),
    ]),
    ...section('🤓 nerd corner', [
      row('runner', `${env.platform} · ${os.platform()} ${os.arch()} · ${os.cpus().length} cpu · ${bytes(os.totalmem())} ram`),
      row('stack', `node ${process.versions.node} · pnpm ${version('pnpm', '--version')} · eleventy ${packageVersion('@11ty/eleventy')}`),
      deploy && row('', `wrangler ${packageVersion('wrangler')}`),
      commit.commits && row('repo', `${number(commit.commits)} commits${commit.firstCommit
        ? ` since ${commit.firstCommit.toISOString().slice(0, 10)}`
        : ''}`),
      env.buildId && row('build id', env.buildId),
    ]),
    ...(logTail
      ? [GAP, '📜 last lines', ...logTail]
      : []),
  ]

  const body = lines
    .filter(line => typeof line === 'string' && line !== '')
    .map(line => line === GAP
      ? ''
      : line)
    .join('\n')
  const markdown = process.env.PUSHNOTICE_MARKDOWN !== '0'
  const text = markdown
    ? `${headline}\n\`\`\`\n${body}\n\`\`\``
    : `${headline}\n\n${body}`
  return {
    text,
    level: failed || broken.length
      ? 'error'
      : 'info',
    // Previews are quiet, unless something is broken.
    silent: !failed && !broken.length && !env.production,
  }
}

async function send({ text, level, silent }) {
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
    console.log((await report({
      state: readJson(runFile),
    })).text)
    return 0
  }
  console.error('Usage: node utils/ci.js build | deploy [command…] | report')
  return 2
}

main().then((code) => {
  process.exitCode = code
})
