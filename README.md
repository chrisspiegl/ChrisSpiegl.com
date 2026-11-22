# ChrisSpiegl.com

Personal website of Chris Spiegl, built with [Eleventy 3](https://www.11ty.dev/) (Pug layouts, Markdown content) and served as static assets by a [Cloudflare Worker](https://developers.cloudflare.com/workers/static-assets/) (`wrangler.jsonc`), built by Workers Builds on every push. Writing lives on [Field Notes](https://chrisspiegl.substack.com); this site is the hub around it.

## Commands

```sh
pnpm install
pnpm dev          # local server with live reload
pnpm build        # production build into _site/
pnpm lint         # ESLint (@antfu/eslint-config)
pnpm format       # ESLint with --fix
pnpm check        # link check of _site/
```

Node is pinned in `.node-version` (24); Cloudflare's build image reads it too.

## How things work

- **Images**: only originals live in `assets/images/`. In production every `<img>` points at Cloudflare Images (`/cdn-cgi/image/...`), which resizes on request and serves AVIF, WebP or JPEG depending on the browser. Widths are fixed to 320/640/960/1280/1920 (`utils/images.js`) to keep unique transformations low (free tier: 5,000 per month; format doesn't count). Local and preview builds use the originals. Force a mode with `IMAGES_CDN=cloudflare` or `IMAGES_CDN=local`.
- **Image placeholders**: every image in `assets/images` gets a [ThumbHash](https://evanw.github.io/thumbhash/) at build time (`utils/thumbhash.js`, cached in `.cache/thumbhash.json`). It is inlined as a ~0.9 KB lossless blurred WebP CSS background (plus aspect-ratio) on the `<img>`, so a preview shows while the image loads, with no JavaScript. Images with transparency are skipped.
- **Fonts**: Playfair Display is linked from Google Fonts in `_includes/layout.pug`; Cloudflare Fonts rewrites it to load from this domain.
- **Icons**: inline SVGs bundled at build time from Iconify (`utils/icons.js`, `{% icon "fa7-brands:youtube" %}`).
- **Sharing**: Open Graph and Twitter tags use `ogImage` from front matter, else `imageHero`, else the first image on the page, else the default photo, cropped to 1200x630 by Cloudflare. Set `description` in front matter for each page.
- **Analytics**: Cloudflare Web Analytics only (cookieless, injected automatically by Cloudflare).
- **Location and follower counts**: fetched at build time (Nomad List, YouTube, Instagram, Substack). The Worker's daily cron (03:00 UTC, `worker/index.js`) first refreshes the Instagram count, then calls a Workers Builds deploy hook to rebuild, so they stay at most a day old. No Worker code runs on page views.
- **Instagram token**: lives in the Worker, not in the build. The Worker keeps it in KV (binding `INSTAGRAM`, namespace `chrisspiegl-com-instagram`, created by the first deploy), renews it every 7 days (tokens last 60) and stores the follower count. The build reads only the count from `https://chrisspiegl.com/_worker/instagram.json`. A failed renewal sends a PushNotice. To start or replace the token, paste a long-lived Instagram token into the Worker secret `INSTAGRAM_ACCESS_TOKEN`; the next run picks it up. Without a token the endpoint answers 503 with which part is missing, and the build report shows Instagram as ⚠ no key.
- **Build and deploy**: Workers Builds runs `pnpm ci:build` and `pnpm ci:deploy` (`pnpm ci:preview` for other branches: a Worker Preview at `<branch>.preview.chrisspiegl.com`). `utils/ci.js` wraps both and sends a compact PushNotice build report (trigger, timings, output, cache, live data with ✓ / ⚠ no key / ✗ failed per source). When any live data source isn't live, a second message lists what needs a check; a failed build or deploy adds the last log lines. Facts from the build come from `utils/buildStats.js`. Without the PushNotice variables the report is only printed. Try it locally with `node utils/ci.js report` after a build.
- **Headers**: `_headers` sets security headers, 10 minutes of browser cache for HTML and the stylesheet, a week for `/assets/*`, and `noindex` on preview, workers.dev and pages.dev addresses.
- **Redirects**: `_data/redirects.json` builds `_redirects` for Cloudflare plus HTML pages for local overview. Entries default to `302`; set `"status": 301` for links that never change.
- **Dependencies**: Dependabot opens one grouped pull request per week (`.github/dependabot.yml`).

## Cloudflare settings this site depends on

- Images > Transformations: enabled for the chrisspiegl.com zone.
- Speed > Settings > Content Optimization: Cloudflare Fonts on.
- Web Analytics: enabled for chrisspiegl.com with automatic setup.
- Workers & Pages > chrisspiegl-com: Workers Builds connected to this repo (build `pnpm ci:build`, deploy `pnpm ci:deploy`, non-production branches `pnpm ci:preview`), build variables `YOUTUBE_API_KEY`, `PUSHNOTICE_CHAT_IDCHAT`, `PUSHNOTICE_CHAT_SECRET` (optional `CF_BUILDS_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`), Worker secrets `DEPLOY_HOOK`, `PUSHNOTICE_CHAT_SECRET`, `INSTAGRAM_ACCESS_TOKEN` (`PUSHNOTICE_CHAT_IDCHAT` is a plain var in `wrangler.jsonc`), KV namespace `chrisspiegl-com-instagram` bound as `INSTAGRAM` (the deploy token needs Workers KV Storage: Edit to create it).
