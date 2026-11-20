# ChrisSpiegl.com

Personal website of Chris Spiegl, built with [Eleventy 3](https://www.11ty.dev/) (Pug layouts, Markdown content) and deployed on [Cloudflare Pages](https://pages.cloudflare.com/). Writing lives on [Field Notes](https://chrisspiegl.substack.com); this site is the hub around it.

## Commands

```sh
pnpm install
pnpm dev          # local server with live reload
pnpm build        # production build into _site/
pnpm lint         # ESLint (@antfu/eslint-config)
pnpm format       # ESLint with --fix
pnpm check        # link check of _site/
```

Node is pinned in `.node-version` (24); Cloudflare Pages reads it too.

## How things work

- **Images**: only originals live in `assets/images/`. In production every `<img>` points at Cloudflare Images (`/cdn-cgi/image/...`), which resizes on request and serves AVIF, WebP or JPEG depending on the browser. Widths are fixed to 320/640/960/1280/1920 (`utils/images.js`) to keep unique transformations low (free tier: 5,000 per month; format doesn't count). Local and preview builds use the originals. Force a mode with `IMAGES_CDN=cloudflare` or `IMAGES_CDN=local`.
- **Fonts**: Playfair Display is linked from Google Fonts in `_includes/layout.pug`; Cloudflare Fonts rewrites it to load from this domain.
- **Icons**: inline SVGs bundled at build time from Iconify (`utils/icons.js`, `{% icon "fa7-brands:youtube" %}`).
- **Sharing**: Open Graph and Twitter tags use `ogImage` from front matter, else `imageHero`, else the first image on the page, else the default photo, cropped to 1200x630 by Cloudflare. Set `description` in front matter for each page.
- **Analytics**: Cloudflare Web Analytics only (cookieless, injected by Pages).
- **Location**: the header pulls the current city from Nomad List at build time; a daily rebuild keeps it fresh.
- **Redirects**: `_data/redirects.json` builds `_redirects` for Cloudflare plus HTML pages for local overview.

## Cloudflare settings this site depends on

- Images > Transformations: enabled for the chrisspiegl.com zone.
- Speed > Settings > Content Optimization: Cloudflare Fonts on.
- Web Analytics: enabled for the Pages project.
