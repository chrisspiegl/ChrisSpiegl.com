# ChrisSpiegl.com: notes for agents

Eleventy 3 site with Pug templates and SCSS, deployed as a Cloudflare Worker with static assets. Run `pnpm build` and `pnpm lint` before you push. The README covers the stack, images, fonts and deploys.

## Design system

The design tokens are the custom properties in `:root` at the top of `assets/scss/style.scss`. That is the source of truth. Use tokens, never raw values. If something needs a new value, add a token there first.

- **Colors:** use only the palette tokens.
  - Text: `--color-ink` (body), `--color-ink-strong` (headings), `--color-ink-muted` (secondary text).
  - Surfaces: `--color-paper` (page), `--color-surface` (cards, fields, pills, code), `--color-paper-raised` (table rows, hover fills).
  - Borders: `--color-rule` and `--color-rule-strong`.
  - Accent: `--color-accent` and `--color-accent-dark` (links, buttons, focus). The accent orange `#cc5630` is Chris's signature color, the same as on Substack. It must stay exactly `#cc5630`, so never change, tint or replace it, even for contrast.
  - Red: `--color-red` and `--color-red-faded`, for errors only.
  - No cool greys and no pure black.
  - Text must reach 4.5:1 contrast on its background. The accent orange is the one exception.
- **Fonts:** Spectral (`--font-text`) is used for everything, including headings, nav and buttons (`--font-controls`). The exceptions are the /links buttons, which use `--font-ui` (system UI), and footer links and code, which use `--font-mono`. Spectral loads only weights 400, 400 italic, 600 and 700, so don't use any other weight. `--font-system-serif` is the fallback, kept so Spectral can be dropped later.
- **Type scale (1.25):**

  | Token | Size |
  |---|---|
  | `--font-size-h1` | 39px |
  | `--font-size-h2` | 31px |
  | `--font-size-h3` | 25px |
  | `--font-size-h4` | 20px, bold |
  | `--font-size-base` | 20px (body) |
  | `--font-size-small` | 16px (buttons, captions, UI) |
  | `--font-size-tiny` | 12.8px (footer, labels, code blocks) |

  Line heights are `--line-height-tight` (1.2, headings), `--line-height-ui` (1.4) and `--line-height-text` (1.6).
- **Spacing:** `--space-1` to `--space-8`, which is 4, 8, 12, 16, 24, 32, 48 and 64px.
- **Radius:** `--radius-sm` 4px (images, code), `--radius-md` 8px (buttons, fields), `--radius-lg` 14px (cards), and `--radius-pill`.
- **Shadow:** only `--shadow-raised`, for a hovered card and the open phone TOC.
- **Squircle:** the brand shape for anything square or round: avatars, icon tiles, round icon buttons (`--mask-squircle`, `@include shapes.squircle` from `_shapes.scss`, or the class `squircle`). It is the Niyama.Academy avatar squircle (`M0 .5C0 0 0 0 .5 0S1 0 1 .5 1 1 .5 1 0 1 0 .5Z` in a 0 to 1 box). Never use it for buttons, fields, cards, photos or other non-square shapes. A circle (`circle`) stays allowed for avatars. A mask clips outlines, so focusable squircles use `shapes.squircle-focus-ring` on `::after`.
- **Controls:** buttons (`.btn`, submit) and fields share `--control-height` (48px), one padding and `--font-size-small`. Anything focusable gets `outline: var(--focus-ring)`.
- **Breakpoints:** only `vars.$break-mobile` (480px) and `vars.$ipad-11-portrait` (820px) from `_variables.scss`.
- **Cards** (/uses, /links) are on `--color-surface` with a `--color-rule` border and `--radius-lg`. A card photo runs edge to edge and is clipped by the card (`overflow: hidden`).
- **Figures:** put photos in `!!! figure` (text width), `!!! figure wide` (wider than the text), `!!! figure pair` or `!!! figure pair wide` (two side by side). Text after the pictures becomes the `<figcaption>`.
- **Table of contents:** a page opts in with `toc: true` in its front matter (layout `page`). Its Markdown `h2` and `h3` headings are listed in a column on the left from 820px, and in a sticky bar that opens at the top on phones. When the screen has room the text column stays centered, as on pages without a TOC. Sections fold: only top-level entries show, the one being read opens by itself, and entries stay on one line with an ellipsis. Wide figures stay centered on the text; on laptops they stop short of the TOC, and only once the text is centered do they pass over it while the TOC fades out. Without JavaScript all entries show and nothing folds or fades. Markup in `_includes/page.pug`, styles in `_toc.scss`, script in `_includes/scripts/toc.js`.

The /styleguide page (`styleguide.md`) shows the elements rendered, and documents each token and Markdown pattern. Its helper classes (`.sg-*` in `_styleguide.scss`) are for that page only. When you add or change a token, update the styleguide too. Check a change there and on /, /uses and /links, at desktop and phone width, before pushing.

## Working rules

- Chris makes all Cloudflare dashboard changes himself. Give him the steps instead of changing anything there.
- Merge pull requests only after Chris says so.
