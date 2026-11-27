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

- **Images**: content images (posts, pages, /uses gear) live in the R2 bucket `chrisspiegl-com-r2-production` (EU jurisdiction), public at `https://r2.chrisspiegl.com/images/`, and not in git. The rest of the bucket is free for other public files (PDFs and such). Only the site images in `assets/images/other` (avatar, default share photo, signatures) are committed. Markdown uses the same `/assets/images/...` path for both. In production every `<img>` points at Cloudflare Images (`/cdn-cgi/image/...`), which resizes on request and serves AVIF, WebP or JPEG depending on the browser, from a `srcset` of 320/640/960/1200/1920 px (`utils/images.js`; 1200 because Cloudflare encodes AVIF only up to 1,200 px), never larger than the original. Unique transformations stay low (free tier: 5,000 per month; format doesn't count). Local and preview builds use files on disk where they exist and the production transformation URLs otherwise. Force a mode with `IMAGES_CDN=cloudflare` or `IMAGES_CDN=local`. See "Images on R2" below.
- **Image placeholders**: every image gets a [ThumbHash](https://evanw.github.io/thumbhash/) (stored in `_data/images.json` for R2 images, computed at build time for repo images by `utils/thumbhash.js`, cached in `.cache/thumbhash.json`). It is inlined as a ~0.9 KB lossless blurred WebP CSS background (plus aspect-ratio) on the `<img>`, so a preview shows while the image loads, with no JavaScript. Images with transparency are skipped.
- **Fonts**: Spectral for headings, text, nav and buttons is linked from Google Fonts in `_includes/layout.pug`; Cloudflare Fonts rewrites the link to load it from this domain. The /links buttons use system UI; code and the footer use the system mono stack.
- **Design tokens**: colors, type scale (1.25, body 20px), spacing (4–64px), radius, line heights and the 48px control height are custom properties at the top of `assets/scss/style.scss`. Use them instead of raw values. Breakpoints are `$break-mobile` (480px) and `$ipad-11-portrait` (820px) in `_variables.scss`.
- **Icons**: inline SVGs bundled at build time from Iconify (`utils/icons.js`, `{% icon "fa7-brands:youtube" %}`).
- **Sharing**: Open Graph and Twitter tags use `ogImage` from front matter, else `imageHero`, else the first image on the page, else the default photo, cropped to 1200x630 by Cloudflare. Set `description` in front matter for each page.
- **Analytics**: Cloudflare Web Analytics only (cookieless, injected automatically by Cloudflare).
- **Location and follower counts**: fetched at build time (Nomad List, YouTube, Instagram, Substack). The Worker's daily cron (03:00 UTC, `worker/index.js`) calls a Workers Builds deploy hook to rebuild, so they stay at most a day old. No Worker code runs on page views.
- **Instagram token**: the build variable `INSTAGRAM_ACCESS_TOKEN` is a Facebook Page token for the Page linked to the Instagram account; it doesn't expire. The account id is in `_data/followers.js` (`INSTAGRAM_USER_ID` overrides it). Instagram's own login needs a verified business portfolio, so the Facebook route is used. A failed lookup shows as ✗ in the build report.
- **Build and deploy**: Workers Builds runs `pnpm ci:build` and `pnpm ci:deploy` (`pnpm ci:preview` for other branches: a Worker Preview at `<branch>.preview.chrisspiegl.com`). `utils/ci.js` wraps both and sends a compact PushNotice build report (trigger, timings, output, cache, live data with ✓ / ⚠ no key / ✗ failed per source). When any live data source isn't live, a second message lists what needs a check; a failed build or deploy adds the last log lines. Facts from the build come from `utils/buildStats.js`. Without the PushNotice variables the report is only printed. Try it locally with `node utils/ci.js report` after a build.
- **Headers**: `_headers` sets security headers, 10 minutes of browser cache for HTML and the stylesheet, a week for `/assets/*`, and `noindex` on preview, workers.dev and pages.dev addresses. It is a template (`_headers.njk`): the noindex rules for single pages come from `_data/searchVisibility.js`, the one list of what search engines may show (it also sets the robots meta tag, canonical links and the sitemap).
- **Redirects**: `_data/redirects.json` builds `_redirects` for Cloudflare plus HTML pages for local overview. Entries default to `302`; set `"status": 301` for links that never change.
- **Dependencies**: Dependabot opens one grouped pull request per week (`.github/dependabot.yml`).

## Images on R2

**Adding an image while writing**

1. Export from Lightroom at the size you want to publish. Anything up to Cloudflare's limits works; bigger files are handled too (below). Exporting with "All metadata except location" or with location both work: the push removes GPS either way and keeps only city and country. To show a neighborhood, type it into Lightroom's IPTC "Sublocation" field: captions then read "Nimman, Chiang Mai" instead of "Chiang Mai, Thailand".
2. Put the file in `assets/images/<folder>/` (any folder except `other`), for example `assets/images/post/2026/`.
3. Run `pnpm images:push`. It prints the final path and uploads the file.
4. Write `![Alt text](/assets/images/post/2026/Leica-Walk-01.jpg)` (or a `!!! figure`) and commit `_data/images.json` with the post.

`pnpm dev` shows the local file right away, even before the push. A build on Cloudflare stops with the file name when an image isn't pushed, or when the path differs from the pushed file only in case (macOS ignores case, the web doesn't).

**What `pnpm images:push` does** (`utils/imagesCli.js`, `utils/imageMeta.js`, `utils/copyright.js`) for each new or changed file:

- Renames it to a URL-safe name that keeps your casing: spaces and underscores become hyphens, umlauts are spelled out, other special characters go, the extension is lowercase and matches the real format (`Leica Walk 01.JPG` → `Leica-Walk-01.jpg`; a PNG saved as `.jpg` stays a PNG and becomes `.png`, so update links to it). Files are never converted between JPEG and PNG.
- Reads the shooting data: camera, lens, focal length (and 35 mm equivalent), aperture, shutter, ISO, exposure compensation, flash, capture time with its time zone, software, artist and copyright.
- Reads the place: City/State/Country from IPTC/XMP (what Lightroom writes) first, else the GPS coordinates looked up offline against GeoNames towns (`all-the-cities`). Only city, region, country and country code are kept, plus `neighborhood` from Lightroom's Sublocation field when you typed one (never looked up from GPS); coordinates and street addresses never are.
- Keeps the copyright, updated where it's out of date (`_data/copyright.json`). A notice or artist that names Chris in an old spelling (Christoph Spiegl, cspiegl@cspiegl.com, cspiegl.com, chrissp.com) becomes `© <year taken> Chris Spiegl, ChrisSpiegl.com`, with artist Chris Spiegl. Anyone else's notice is kept word for word. An image with no notice gets Chris's only in the folders listed under `ownFolders` (FridayWallpaper); gear product shots and other images stay without one. A hand-set `artist` or `copyright` in `overrides` is used as written.
- Uploads a copy without EXIF, XMP, IPTC or comments (no GPS, serial numbers or owner names). JPEG, PNG and WebP are cleaned without re-encoding; the colour profile stays. Photos with an EXIF rotation are turned upright first. HEIC and TIFF are converted to JPEG. Only the credit is written back: EXIF Artist and Copyright, XMP creator and rights, and for Chris's photos his e-mail and website as the creator's contact plus ChrisSpiegl.com as the rights web page. The push checks the cleaned copy and refuses to upload if anything else survived.
- When a file is over Cloudflare's limits (100 megapixels, 12,000 px per side, 100 MB; [docs](https://developers.cloudflare.com/images/get-started/limits/)), it also uploads `<name>@display.<ext>`, just under the limits, as the source for resizing. The original stays the full-resolution download.
- Writes the entry to `_data/images.json` and uploads a backup of that file to `images/_manifest.json` in the bucket. Every image goes to `images/<path under assets/images>`.

Uploads use Wrangler with a year of caching: run `pnpm install`, then `npx wrangler login` once (or set `CLOUDFLARE_API_TOKEN`). The account is CSX.Ventures; `R2_BUCKET`, `R2_JURISDICTION` and `CLOUDFLARE_ACCOUNT_ID` override the defaults. Options: `--dry-run` shows what would happen, `--no-upload` only updates the manifest, `--force` processes every file again. `pnpm images:pull` downloads the cleaned copies of every image that isn't on disk, for a new computer or a fresh clone.

**`_data/images.json`** has one entry per image, keyed by its path under `assets/images`: `originalName`, `width`, `height`, `bytes`, `type`, `hash` (SHA-256 of your file, also used as `?v=` so a replaced image shows at once despite the year of caching), `uploadedHash`, `thumbhash`, `exif`, `location`, `createdAt`, `updatedAt`, `uploadedAt`, and `source` for the smaller copy. Two hand edits are kept by later pushes: `"location": false` keeps a photo's place off the site (and out of this public repo) for good, and `"overrides": { ... }` replaces any `exif` value or the `location`.

**Figures**: `!!! figure exif` adds a line with camera, lens, exposure and place, `!!! figure full` a "View full resolution" link with pixel and file size, `nolocation` leaves the place out of that line. Camera and lens display names, and links to their /uses entry, are in `_data/cameras.json`.

## Cloudflare settings this site depends on

- Images > Transformations: enabled for the chrisspiegl.com zone. Sources from the same zone (r2.chrisspiegl.com) are allowed by default.
- R2 bucket `chrisspiegl-com-r2-production` in the EU jurisdiction, public only through the custom domain `r2.chrisspiegl.com` (no r2.dev URL).
- Speed > Settings > Content Optimization: Cloudflare Fonts on.
- Web Analytics: enabled for chrisspiegl.com with automatic setup.
- Workers & Pages > chrisspiegl-com: Workers Builds connected to this repo (build `pnpm ci:build`, deploy `pnpm ci:deploy`, non-production branches `pnpm ci:preview`), build variables `YOUTUBE_API_KEY`, `INSTAGRAM_ACCESS_TOKEN` (secret), `PUSHNOTICE_CHAT_IDCHAT`, `PUSHNOTICE_CHAT_SECRET` (optional `CF_BUILDS_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`), Worker secrets `DEPLOY_HOOK`, `PUSHNOTICE_CHAT_SECRET` (`PUSHNOTICE_CHAT_IDCHAT` is a plain var in `wrangler.jsonc`).
