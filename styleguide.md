---
layout: page
title: Styleguide
description: How ChrisSpiegl.com looks and why. Colors, type, spacing, controls and every content element, rendered with the live styles.
toc: true
colors:
  - token: --color-ink
    hex: "#4e4a45"
    use: Body text. 7.2:1 on paper.
  - token: --color-ink-strong
    hex: "#363737"
    use: Headings, strong labels. 9.8:1 on paper.
  - token: --color-ink-muted
    hex: "#6b6864"
    use: Captions, dates, placeholders. 4.5:1 on paper.
  - token: --color-paper
    hex: "#eee8e0"
    use: Page background.
  - token: --color-surface
    hex: "#faf7f3"
    use: Cards, fields, code blocks, the TOC bar.
  - token: --color-paper-raised
    hex: "#e0dad3"
    use: Table rows, hover fills, icon tiles.
  - token: --color-rule
    hex: "#d6d1ca"
    use: Borders and dividers.
  - token: --color-rule-strong
    hex: "#c9c2b9"
    use: Borders that need a little more weight.
  - token: --color-accent
    hex: "#cc5630"
    use: Links, buttons, focus. The signature orange, never changed.
  - token: --color-accent-dark
    hex: "#b74d2b"
    use: Hover state of the accent.
  - token: --color-white
    hex: "#ffffff"
    use: Text on the accent.
  - token: --color-red
    hex: "#c22323"
    use: Errors only.
  - token: --color-red-faded
    hex: "#fde2e2"
    use: Error backgrounds, the table caption marker.
  - token: --color-code-bg
    hex: "#222830"
    use: Dark (Dracula) code themes.
typeScale:
  - token: --font-size-h1
    size: 39px
    sample: <span style="font-size:var(--font-size-h1);font-weight:700;line-height:var(--line-height-tight)">Field Notes</span>
  - token: --font-size-h2
    size: 31px
    sample: <span style="font-size:var(--font-size-h2);font-weight:700;line-height:var(--line-height-tight)">Field Notes</span>
  - token: --font-size-h3
    size: 25px
    sample: <span style="font-size:var(--font-size-h3);font-weight:700;line-height:var(--line-height-tight)">Field Notes</span>
  - token: --font-size-h4
    size: 20px, bold
    sample: <span style="font-size:var(--font-size-h4);font-weight:700">Field Notes</span>
  - token: --font-size-base
    size: 20px, body
    sample: <span style="font-size:var(--font-size-base)">Field Notes from a life on the road</span>
  - token: --font-size-small
    size: 16px, buttons, captions, UI
    sample: <span style="font-size:var(--font-size-small)">Field Notes from a life on the road</span>
  - token: --font-size-tiny
    size: 12.8px, footer, labels, code blocks
    sample: <span style="font-size:var(--font-size-tiny)">Field Notes from a life on the road</span>
spacing: [[1, 4], [2, 8], [3, 12], [4, 16], [5, 24], [6, 32], [7, 48], [8, 64]]
---

# {{ title }}

This page shows every piece of ChrisSpiegl.com with the live stylesheet, so a change can be checked in one place. Each section names the token or the Markdown that produces it.

The tokens are the custom properties in `:root` at the top of `assets/scss/style.scss`. That file is the source of truth, and `CLAUDE.md` in the repository has the rules that go with it. Use a token, never a raw value. If something needs a new value, add a token first.

## Colors

The palette is the warm paper and ink of [Field Notes on Substack](https://chrisspiegl.substack.com), so the site and the newsletter feel like one place. There are 14 colors and no others: no cool greys, and no pure black.

<div class="sg-swatches">
{%- for c in colors %}
<div class="sg-swatch"><div class="sg-chip" style="background:var({{ c.token }})"></div><code>{{ c.token }}</code><p>{{ c.hex }}</p><p>{{ c.use }}</p></div>
{%- endfor %}
</div>

### Rules for color

- Text reaches 4.5:1 contrast on its background. Muted ink passes on paper (4.5:1) and surface (5.2:1), but not on paper-raised (4.0:1), so keep secondary text off raised fills.
- The accent orange `#cc5630` is Chris's signature color, the same as on Substack. It stays exactly `#cc5630`, and is never tinted, darkened or swapped, even for contrast. It is the one exception to the contrast rule.
- Red is for errors only. Don't use it for emphasis.
- Pages may use the role aliases (`--color-body`, `--color-heading`, `--color-link` and so on) in their partials. Each one points to one of the 14 colors above.

## Typography

### Fonts

Everything is set in [Spectral](https://fonts.google.com/specimen/Spectral), including headings, navigation and buttons. It is linked in `_includes/layout.pug`, not imported in CSS, so Cloudflare Fonts can serve it from this domain.

<div class="sg-rows">
<div class="sg-row"><p><code>--font-text</code><br>Spectral</p><p>Reading text, headings, nav, buttons.</p></div>
<div class="sg-row"><p><code>--font-system-serif</code><br>Spectral's fallback</p><p style="font-family:var(--font-system-serif)">New York on Apple, Charter, Cambria, Georgia. Kept so Spectral can be dropped one day.</p></div>
<div class="sg-row"><p><code>--font-ui</code><br>System UI</p><p style="font-family:var(--font-ui)">The /links buttons only.</p></div>
<div class="sg-row"><p><code>--font-mono</code><br>System mono</p><p style="font-family:var(--font-mono);font-size:var(--font-size-small)">Footer links and code.</p></div>
</div>

### Weights

Spectral loads in four styles only. CSS must not ask for any other weight, or the browser fakes it.

<div class="sg-rows">
<div class="sg-row"><p><code>400</code></p><p>Body text, lists, captions.</p></div>
<div class="sg-row"><p><code>400 italic</code></p><p><em>Emphasis, cite, dates.</em></p></div>
<div class="sg-row"><p><code>600</code></p><p style="font-weight:600">Buttons, card titles, the TOC.</p></div>
<div class="sg-row"><p><code>700</code></p><p style="font-weight:700">Headings, the site name, strong text.</p></div>
</div>

### Type scale

A 1.25 modular scale on a 20px body. Headings use `--line-height-tight` (1.2), buttons and cards `--line-height-ui` (1.4), and reading text `--line-height-text` (1.6).

<div class="sg-rows">
{%- for t in typeScale %}
<div class="sg-row"><p><code>{{ t.token }}</code><br>{{ t.size }}</p><p>{{ t.sample | safe }}</p></div>
{%- endfor %}
</div>

### Headings

A page has one `h1`, its title. Sections start at `h2`. `h3` is muted, and `h4` is the body size in bold. `h5` and `h6` exist but are rarely needed. Every heading written in Markdown gets an id and links to itself.

<div class="sg-rows">
<h2>Heading 2, a section</h2>
<h3>Heading 3, a subsection</h3>
<h4>Heading 4, a run-in title</h4>
<h5>Heading 5</h5>
<h6>Heading 6</h6>
</div>

### Text

A paragraph is set at 20px with room to breathe, and wraps with hyphenation and `text-wrap: pretty`. Links are [in the accent orange and underlined](#text). Use *emphasis* for stress and **strong** for the one thing nobody should miss. `Inline code` keeps the text size in the mono font.

The typographer turns "straight quotes" into curly ones, `--` into an en dash, `---` into an em dash, and `...` into an ellipsis.

## Spacing

All margins, paddings and gaps come from eight steps. Paragraphs, lists and code blocks end with `--space-6` (32px), and an `h2` starts a section with `--space-8` (64px) above it.

<div class="sg-rows">
{%- for s in spacing %}
<div class="sg-row"><p><code>--space-{{ s[0] }}</code><br>{{ s[1] }}px</p><div class="sg-bar" style="width:var(--space-{{ s[0] }})"></div></div>
{%- endfor %}
</div>

## Radius

<div class="sg-radii">
<div><div class="sg-radius" style="border-radius:var(--radius-sm)"></div><code>--radius-sm</code><br>4px, images, code</div>
<div><div class="sg-radius" style="border-radius:var(--radius-md)"></div><code>--radius-md</code><br>8px, buttons, fields</div>
<div><div class="sg-radius" style="border-radius:var(--radius-lg)"></div><code>--radius-lg</code><br>14px, cards</div>
<div><div class="sg-radius" style="border-radius:var(--radius-pill)"></div><code>--radius-pill</code><br>pills, round icons</div>
</div>

## Controls

Buttons and fields share one height (`--control-height`, 48px), one padding, `--font-size-small` and `--radius-md`, so they line up when they sit next to each other.

### Buttons

<div class="sg-controls">
<a class="btn" href="#buttons">A button link</a>
<input type="submit" value="A submit button">
</div>

Any link becomes a button with the `btn` class. Add `btn-block` to make it full width.

<a class="btn btn-block" href="#buttons">A full-width button</a>

In Markdown, a button is usually an email link or a plain link inside a centered block:

```md
!!! text-center
<a class="btn" href="https://chrisspiegl.substack.com">Read Field Notes</a>
!!!
```

### Fields

<div class="sg-fields">
<label class="visually-hidden" for="sg-field">Example field</label>
<input id="sg-field" type="text" placeholder="A text field with a placeholder">
<label class="visually-hidden" for="sg-select">Example select</label>
<select id="sg-select"><option>A select</option><option>Another option</option></select>
</div>

### Focus

Everything you can reach with the Tab key gets the same orange ring, `outline: var(--focus-ring)`, 2px from the element. Press Tab on this page to see it on the links, buttons and fields above.

## Cards

Cards (on /uses and /links) sit on `--color-surface` with a `--color-rule` border and `--radius-lg`. A photo runs edge to edge and the card clips its corners with `overflow: hidden`.

<div class="sg-card">
{% image "/assets/images/other/2017-08-19-at-12-38-54-dangle-your-feet.jpg", "Feet dangling over a view", "half" %}
<p><strong>A card title</strong>A short description in muted ink, at the small size.</p>
</div>

## Lists

List items get a little air between them, and nested lists sit tight under their parent.

- Pack light
  - one bag
  - one camera
- Stay a month, not a week
- Write it down the same day

Numbered lists are for steps that happen in order:

1. Plan the work.
2. Do the work.

    A step can hold more paragraphs, indented by four spaces.

    ```js
    const done = plan && work
    ```

3. Ship it.

A definition list is written in HTML:

<dl>
<dt>Field Notes</dt>
<dd>The newsletter on Substack, and home base for the writing.</dd>
<dt>Now</dt>
<dd>What Chris is doing right now, updated every few weeks.</dd>
</dl>

## Images

A Markdown image under `/assets/images` becomes a responsive image: Cloudflare Images serves it in the right size and format in production, with a blurred preview while it loads. Images get `--radius-sm`. On its own, an image keeps its size and never grows wider than the text.

<div class="sg-narrow">

![A hike up a mountain](/assets/images/other/2017-07-17-at-10-33-24-mountain-hike.jpg)

</div>

```md
![A hike up a mountain](/assets/images/other/2017-07-17-at-10-33-24-mountain-hike.jpg)
```

### Figures

Put pictures in a `figure` block to set how wide they are. The text after the pictures becomes the caption, set small and muted on the right. There are four widths:

| Block | Width |
| :--- | :--- |
| `!!! figure` | As wide as the text. |
| `!!! figure wide` | Wider than the text, up to 1225px, centered on the text. On TOC pages it passes over the TOC, which fades out until it has scrolled by. |
| `!!! figure pair` | Two pictures side by side, as wide as the text together. |
| `!!! figure pair wide` | Two pictures side by side, slightly wider than the text. |

A pair crops both pictures to the same height, so different shapes still line up.

#### As wide as the text

!!! figure
![Meditating at Angel's Landing](/assets/images/post/2020/2018-10-13-meditating-at-angles-landing.jpg)
Angel's Landing, October 2018.
!!!

```md
!!! figure
![Meditating at Angel's Landing](/assets/images/post/2020/angels-landing.jpg)
Angel's Landing, October 2018.
!!!
```

#### Wider than the text

!!! figure wide
![Meditating at Angel's Landing](/assets/images/post/2020/2018-10-13-meditating-at-angles-landing.jpg)
The same photo, wider than the text.
!!!

```md
!!! figure wide
![Meditating at Angel's Landing](/assets/images/post/2020/angels-landing.jpg)
The same photo, wider than the text.
!!!
```

#### Two side by side

!!! figure pair
![A hike up a mountain](/assets/images/other/2017-07-17-at-10-33-24-mountain-hike.jpg)
![Feet dangling over a view](/assets/images/other/2017-08-19-at-12-38-54-dangle-your-feet.jpg)
Two pictures, as wide as the text.
!!!

```md
!!! figure pair
![A hike up a mountain](/assets/images/other/mountain-hike.jpg)
![Feet dangling over a view](/assets/images/other/dangle-your-feet.jpg)
Two pictures, as wide as the text.
!!!
```

#### Two side by side, wider

!!! figure pair wide
![A hike up a mountain](/assets/images/other/2017-07-17-at-10-33-24-mountain-hike.jpg)
![A thoughtful moment in Berlin](/assets/images/other/2017-07-02-at-11-24-39-thoughtful-berlin.jpg)
Two pictures, slightly wider than the text.
!!!

```md
!!! figure pair wide
![A hike up a mountain](/assets/images/other/mountain-hike.jpg)
![A thoughtful moment in Berlin](/assets/images/other/thoughtful-berlin.jpg)
Two pictures, slightly wider than the text.
!!!
```

### Signature

!!! signature
![Chris Spiegl](/assets/images/other/signature-public-small.png)
!!!

```md
!!! signature
![Chris Spiegl](/assets/images/other/signature-public-small.png)
!!!
```

## Containers

Containers are written with three exclamation marks and a name. They wrap their content in a `div` with that class.

### Centered text

!!! text-center
A short line, centered.
!!!

```md
!!! text-center
A short line, centered.
!!!
```

### Side by side

Two columns on wide screens, one column on phones.

!!! side-by-side
The left column holds text or an image.

The right column holds the other half.
!!!

```md
!!! side-by-side
The left column.

The right column.
!!!
```

### Hero quote

A quote set large and centered. On normal pages it spans the screen; on pages with a TOC it stays in the text column.

!!! quote-hero
> "If we did all of the things that we are capable of doing, we would literally astound&nbsp;ourselves."
> <cite>Thomas Edison</cite>
!!!

```md
!!! quote-hero
> "If we did all of the things that we are capable of doing, …"
> <cite>Thomas Edison</cite>
!!!
```

For photos there are also `image-hero`, one photo across the whole screen, and `header-image-three`, three in a row. Most photos belong in a [figure](#figures).

### Folding text

`!!!` followed by any text that isn't a container name makes a folding section. The text becomes the summary you click. It starts out closed.

!!! Why does this fold?
Because it's a detail most readers can skip. The open part is indented and set in muted ink.
!!!

```md
!!! Why does this fold?
Because it's a detail most readers can skip.
!!!
```

## Code

Code blocks are set in `--font-mono` at the tiny size with `--radius-sm`. Name the language after the backticks to get highlighting in the dark Dracula theme on `--color-code-bg`. A block without a language stays light, on `--color-surface` with a rule border.

```js
// utils/toc.js: nest each h3 under the h2 before it
const parent = items.at(-1)
if (level === '3' && parent)
  parent.children.push(item)
else
  items.push(item)
```

```
A block without a language, for plain output.
```

Inline code like `--color-accent` keeps the size of the text around it.

## Tables

Tables run the full width, with a rule under the header and alternating rows on `--color-paper-raised`.

| Token | Size | Use |
| :--- | :--- | :--- |
| `--font-size-h1` | 39px | Page title |
| `--font-size-base` | 20px | Body text |
| `--font-size-small` | 16px | Buttons, captions |
| `--font-size-tiny` | 12.8px | Footer, labels, code blocks |

```md
| Token | Size |
| :--- | :--- |
| `--font-size-h1` | 39px |
```

## Blockquote

A quote is indented with a rule on its left, in strong ink. Put the source in a `cite` on its own line.

> We shall come back, no doubt, to walk down the Row and watch young people on the tennis courts by the clump of mimosas and walk down the beach by the bay.
> <cite>Robert Penn Warren</cite>

```md
> We shall come back, no doubt, …
> <cite>Robert Penn Warren</cite>
```

## Footnotes

A footnote reference opens a small popover with the note, so the reader doesn't lose their place.[^popover] Browsers without the Popover API jump to the list at the end of the page instead. Notes can also be written inline.^[Like this one, which can't hold a line break.]

```md
A sentence with a note.[^popover]

[^popover]: The note itself, at the end of the file.
```

[^popover]: The popover is built by `_includes/scripts/footnotes.js` from the list markdown-it-footnote writes.

## Table of contents

This page has one. Add `toc: true` to a page's front matter, and every `h2` and `h3` written in Markdown is listed under "On this page", with the `h3`s nested under their section. Pages without it don't get a TOC.

```yaml
---
layout: page
title: A long page
toc: true
---
```

- **From 820px** it is a column on the left that stays in view while you read, and marks the section you're in with an orange line. When the screen is wide enough, the text stays in the middle of the screen, as on pages without a TOC, and the TOC sits in the margin.
- **On phones** it is a bar that sticks to the top of the screen. It shows the current section, opens into the full list when tapped, and closes after a jump.

Headings written as raw HTML have no id, so they stay out of the list. The samples under [Headings](#headings) are written that way.

## Breakpoints

There are two, both in `assets/scss/_variables.scss`. Don't add others.

| Variable | Width | What changes |
| :--- | :--- | :--- |
| `vars.$break-mobile` | 480px | Side by side becomes one column, /links buttons tighten. |
| `vars.$ipad-11-portrait` | 820px | The TOC moves from the top bar to the left column. |

The text column is `--content-width` (980px) wide at most, and 90% of the screen below that.

## Before you push

Check a change on this page and on [/](/), [/uses](/uses) and [/links](/links), at desktop and phone width. Then run `pnpm build` and `pnpm lint`.
