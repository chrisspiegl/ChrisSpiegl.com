// Email signatures shown on /styleguide/email-signature.
// Each one renders to inline-styled HTML (email clients drop <style> blocks).
// Links go straight to their destination, never through a redirect, and carry
// utm_source, utm_medium and utm_campaign.

// Matches Gmail's "Sans Serif" default text style, which Gmail sends as Arial.
const SANS = 'Arial, Helvetica, sans-serif'

// Chris's signature orange. It must stay exactly #cc5630.
const ORANGE = '#cc5630'
// Nicole's own purple, kept from her original signature.
const PURPLE = '#ac8bd4'

// Readable on purpose: anyone who looks at a link sees where it came from, and
// chrisspiegl.com/signature is a real page for them (signature.md).
const CHRIS_SOURCE = 'chrisspiegl.com/signature'
// Nicole's site gets its own /signature page.
const NICOLE_SOURCE = 'nicolereiher.com/signature'
const UTM_MEDIUM = 'email'

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

// Built by hand so the slash in utm_source stays a slash (it is valid in a
// query string) instead of becoming %2F.
function trackedUrl(href, { source, campaign }) {
  const url = new URL(href)
  const query = [
    url.search.slice(1),
    `utm_source=${source}`,
    `utm_medium=${UTM_MEDIUM}`,
    `utm_campaign=${encodeURIComponent(campaign)}`,
  ].filter(Boolean).join('&')
  return `${url.origin}${url.pathname}?${query}${url.hash}`
}

// One signature: `lines` is a list of paragraphs, each a list of parts.
// A part is plain text, { link, href, title, plain }, { bold: [parts] },
// or 'br' for a line break. An empty line is a spacer paragraph (&nbsp;),
// which every client keeps, unlike margins.
function render({ font, color, source, campaign, lines }) {
  const pStyle = `font-family: ${font}; letter-spacing: normal; margin: 0 0 12px 0; line-height: normal;`
  const aStyle = plain => `font-family: ${font}; color: ${color};${plain ? ' text-decoration: none;' : ''}`

  const part = (item) => {
    if (item === 'br')
      return '<br>'
    if (typeof item === 'string')
      return escapeHtml(item)
    if (item.link) {
      const href = escapeHtml(trackedUrl(item.href, { source, campaign }))
      const title = item.title
        ? ` title="${escapeHtml(item.title)}"`
        : ''
      return `<a style="${aStyle(item.plain)}"${title} href="${href}">${escapeHtml(item.link)}</a>`
    }
    if (item.bold)
      return `<span style="font-weight: bold;">${item.bold.map(part).join('')}</span>`
    throw new Error(`Unknown signature part: ${JSON.stringify(item)}`)
  }

  return lines
    .map(line => `<p style="${pStyle}">${line.length
      ? line.map(part).join('')
      : '&nbsp;'}</p>`)
    .join('\n')
}

const SEP = ' · '

// Links Chris's signatures share. No LinkedIn: it isn't a platform we use.
const chris = {
  hub: { link: 'ChrisSpiegl.com', href: 'https://chrisspiegl.com/', title: 'My digital hub for everything.' },
  fieldNotes: { link: 'Field Notes', href: 'https://chrisspiegl.substack.com/', title: 'Be a traveler, not a tourist. Essays on traveling slowly through life.' },
  now: { link: '/now', href: 'https://chrisspiegl.com/now', title: 'What I am doing now.' },
  youtube: { link: 'YouTube.com/@ChrisSpiegl', href: 'https://www.youtube.com/@ChrisSpiegl', title: 'Longer stories, cameras, and deep dives.' },
  instagram: { link: 'Instagram.com/ChrisSpiegl', href: 'https://www.instagram.com/chrisspiegl/', title: 'Photos about life, the road less traveled, and the in-between.' },
  niyama: { link: 'Niyama.Academy', href: 'https://niyama.academy/', title: 'Echtes Yoga für Dein Echtes Leben!' },
  bolstair: { link: 'BOLSTair', href: 'https://bolstair.com/', title: 'The only blowup yoga bolster for fitness & relaxation with built in blow-up mechanism.' },
}
const chrisSocial = [chris.youtube, SEP, chris.instagram]

const nicole = {
  niyama: { link: 'Niyama.Academy ~ Dein Online Yoga Studio', href: 'https://niyama.academy/', title: 'Echtes Yoga für Dein Echtes Leben - Live Yoga, Kurse, und eine wundervolle Yoga Community' },
  bolstair: { link: 'BOLSTair ~ Das einzige luftgefüllte Yoga Kissen', href: 'https://bolstair.com/', title: 'Für Yoga, Fitness, und vor allem zum Reisen genial! Mit eingebauter Pumpe und nur 280g leicht.' },
  youtube: { link: 'YouTube.com/NicoleReiher', href: 'https://www.youtube.com/NicoleReiher', title: 'Online Yoga mit Liebe & Herz für Motivation und Gesundheit' },
  instagram: { link: 'Instagram.com/NicoleReiher1', href: 'https://www.instagram.com/NicoleReiher1/', title: 'Motivation, Inspiration, Leben und das große Leben' },
}
const nicoleSocial = [nicole.youtube, SEP, nicole.instagram]

const bolstairBlock = [
  {
    bold: ['BOLSTair ~ The Blowup Yoga & Fitness Bolster'],
  },
  'br',
  'Website & Shop: ',
  { ...chris.bolstair, link: 'www.BOLSTair.com' },
]

const chrisDefaults = {
  name: 'Chris Spiegl',
  font: SANS,
  color: ORANGE,
  source: CHRIS_SOURCE,
}

const variants = [
  {
    ...chrisDefaults,
    id: 'chris-personal',
    label: 'Personal',
    use: 'chris@chrisspiegl.com and everyday mail.',
    lines: [
      ['Chris Spiegl'],
      [],
      [
        'Founder of ',
        chris.niyama,
        ' & ',
        chris.bolstair,
      ],
      [
        chris.hub,
        SEP,
        chris.fieldNotes,
        SEP,
        'What I am doing ',
        chris.now,
      ],
      chrisSocial,
      [],
    ],
  },
  {
    ...chrisDefaults,
    id: 'ryan-assistant',
    name: 'Ryan',
    label: 'Assistant to Chris',
    use: 'Mail Ryan sends on Chris\'s behalf.',
    lines: [
      ['Ryan'],
      [],
      [
        'Assistant to Chris Spiegl, his work & life, and responsibilities at ',
        chris.niyama,
        ' & ',
        chris.bolstair,
        '.',
      ],
      [
        { ...chris.hub, title: 'Chris\'s online hub for everything.' },
        SEP,
        { ...chris.fieldNotes, title: 'Chris\'s essays on traveling slowly through life.' },
        SEP,
        'What Chris is doing ',
        { ...chris.now, title: 'What Chris is doing now.' },
      ],
      chrisSocial,
      [],
    ],
  },
  {
    ...chrisDefaults,
    id: 'chris-niyama',
    label: 'Niyama.Academy',
    use: 'The Niyama.Academy mailbox.',
    lines: [
      ['Namasté'],
      ['Chris Spiegl'],
      [],
      [
        'Founder of ',
        chris.niyama,
        ' & ',
        chris.bolstair,
      ],
      [
        {
          bold: [
            { ...chris.niyama, plain: true },
            ' ~ Dein Online Yoga Studio',
          ],
        },
        'br',
        'Community, Live Yoga, und Kurse: ',
        { ...chris.niyama, link: 'www.Niyama.Academy' },
      ],
      [chris.hub, SEP, ...chrisSocial],
      [],
    ],
  },
  {
    ...chrisDefaults,
    id: 'chris-bolstair',
    label: 'BOLSTair',
    use: 'The BOLSTair mailbox.',
    lines: [
      ['Chris Spiegl'],
      [],
      [
        'Founder of ',
        chris.bolstair,
        ' & ',
        chris.niyama,
      ],
      bolstairBlock,
      [chris.hub, SEP, ...chrisSocial],
      [],
    ],
  },
  {
    id: 'nicole-personal',
    name: 'Nicole Reiher',
    label: 'Personal',
    use: 'Nicole\'s everyday mail.',
    font: SANS,
    color: PURPLE,
    source: NICOLE_SOURCE,
    lines: [
      ['Namasté'],
      ['Nicole Reiher'],
      [],
      ['Yoga-Lehrerin von Herzen (B. Ed., E-RYT500)'],
      ['Gründerin der ', nicole.niyama],
      ['Co-Founder bei ', nicole.bolstair],
      nicoleSocial,
      [],
    ],
  },
  {
    id: 'nicole-bolstair',
    name: 'Nicole Reiher',
    label: 'BOLSTair',
    use: 'Nicole\'s BOLSTair mail.',
    font: SANS,
    color: PURPLE,
    source: NICOLE_SOURCE,
    lines: [
      ['Namasté'],
      ['Nicole Reiher'],
      [],
      ['Yoga-Lehrerin von Herzen (B. Ed., E-RYT500)'],
      ['Co-Founder bei ', nicole.bolstair],
      ['Gründerin der ', nicole.niyama],
      bolstairBlock,
      nicoleSocial,
      [],
    ],
  },
]

// Drafts for Chris's personal signature, shown next to the current one.
const drafts = [
  {
    id: 'draft-zero',
    label: 'Draft 0 · Founder, links, place',
    lines: [
      ['Chris Spiegl'],
      [
        'Founder of ',
        chris.niyama,
        ' & ',
        chris.bolstair,
      ],
      [
        chris.hub,
        SEP,
        chris.fieldNotes,
        SEP,
        'What I\'m doing ',
        chris.now,
      ],
      chrisSocial,
      ['Written in Nimman, Chiang Mai'],
      [],
    ],
  },
  {
    id: 'draft-zero-a',
    label: 'Draft 0A · Plain labels',
    lines: [
      [
        'Chris Spiegl',
        SEP,
        chris.hub,
        'br',
        'Founder of ',
        chris.niyama,
        ' & ',
        chris.bolstair,
        'br',
        'What I\'m doing now: ',
        { ...chris.now, link: 'ChrisSpiegl.com/now' },
        'br',
        chris.fieldNotes,
        SEP,
        ...chrisSocial,
        'br',
        'Written in Nimman, Chiang Mai',
      ],
      [],
    ],
  },
  {
    id: 'draft-zero-b',
    label: 'Draft 0B · Grouped',
    lines: [
      [
        'Chris Spiegl',
        'br',
        'Founder of ',
        chris.niyama,
        ' & ',
        chris.bolstair,
      ],
      [
        chris.hub,
        SEP,
        chris.fieldNotes,
        SEP,
        'What I\'m doing ',
        chris.now,
        'br',
        ...chrisSocial,
      ],
      ['Written in Nimman, Chiang Mai'],
      [],
    ],
  },
  {
    id: 'draft-zero-d',
    label: 'Draft 0D · Grouped, place first',
    lines: [
      [
        'Chris Spiegl',
        'br',
        'Written in Nimman, Chiang Mai',
      ],
      [
        chris.hub,
        SEP,
        chris.fieldNotes,
        SEP,
        'What I\'m doing ',
        chris.now,
        'br',
        ...chrisSocial,
      ],
      [
        'Founder of ',
        chris.niyama,
        ' & ',
        chris.bolstair,
      ],
      [],
    ],
  },
  {
    id: 'draft-zero-e',
    label: 'Draft 0E · Name on its own',
    lines: [
      ['Chris Spiegl'],
      ['Written in Nimman, Chiang Mai'],
      [
        chris.hub,
        SEP,
        chris.fieldNotes,
        SEP,
        'What I\'m doing ',
        chris.now,
        'br',
        ...chrisSocial,
      ],
      [
        'Founder of ',
        chris.niyama,
        ' & ',
        chris.bolstair,
      ],
      [],
    ],
  },
  {
    id: 'draft-zero-c',
    label: 'Draft 0C · Cut to four lines',
    lines: [
      [
        {
          bold: ['Chris Spiegl'],
        },
        ', founder of ',
        chris.niyama,
        ' & ',
        chris.bolstair,
        'br',
        chris.hub,
        SEP,
        chris.fieldNotes,
        SEP,
        'What I\'m doing ',
        chris.now,
        'br',
        ...chrisSocial,
        'br',
        'Nimman, Chiang Mai',
      ],
      [],
    ],
  },
  {
    id: 'draft-plain',
    label: 'Draft 1 · Plain',
    lines: [
      ['Chris Spiegl'],
      [
        chris.hub,
        SEP,
        'what I\'m doing ',
        chris.now,
      ],
      [],
    ],
  },
  {
    id: 'draft-field-notes',
    label: 'Draft 2 · Field Notes first',
    lines: [
      [
        {
          bold: ['Chris Spiegl'],
        },
      ],
      ['Father. Traveler. Photographer. Thinker.'],
      [],
      [chris.fieldNotes, ': on traveling slowly, seeing closely, and growing up for real.'],
      [
        chris.hub,
        SEP,
        { ...chris.now, link: 'Now' },
        SEP,
        { ...chris.youtube, link: 'YouTube' },
        SEP,
        { ...chris.instagram, link: 'Instagram' },
      ],
      [],
    ],
  },
  {
    id: 'draft-place',
    label: 'Draft 4 · Place line',
    lines: [
      ['Chris Spiegl'],
      [
        {
          bold: ['Written in Nimman, Chiang Mai'],
        },
      ],
      [
        chris.fieldNotes,
        SEP,
        chris.hub,
        SEP,
        { ...chris.instagram, link: 'Instagram' },
      ],
      [],
    ],
  },
].map(draft => ({
  ...chrisDefaults,
  ...draft,
  kind: 'draft',
}))

function build(variant) {
  return {
    ...variant,
    campaign: variant.id,
    html: render({ ...variant, campaign: variant.id }),
  }
}

module.exports = {
  variants: variants.map(build),
  drafts: drafts.map(build),
}
