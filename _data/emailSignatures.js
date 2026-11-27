// Email signatures shown on /email-signature, one entry per variant.
// Each one renders to inline-styled HTML (email clients drop <style> blocks),
// and every link gets utm_source, utm_medium and utm_campaign. The old
// ref=signature-* stays as well, so existing reports keep working.

// Gmail only offers a short font list. Georgia is the closest serif to Spectral
// that every desktop and iPhone has; Android falls back to its own serif.
const SERIF = 'Georgia, \'Times New Roman\', serif'
const SANS = 'Helvetica, Arial, sans-serif'

// Chris's signature orange. It must stay exactly #cc5630.
const ORANGE = '#cc5630'
// Nicole's own purple, kept from her original signature.
const PURPLE = '#ac8bd4'

const UTM_SOURCE = 'email'
const UTM_MEDIUM = 'signature'

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function trackedUrl(href, { campaign, ref }) {
  const url = new URL(href)
  if (ref)
    url.searchParams.set('ref', ref)
  url.searchParams.set('utm_source', UTM_SOURCE)
  url.searchParams.set('utm_medium', UTM_MEDIUM)
  url.searchParams.set('utm_campaign', campaign)
  return url.toString()
}

// One signature: `lines` is a list of paragraphs, each a list of parts.
// A part is plain text, { link, href, title, bold, plain }, { bold: 'text' },
// or 'br' for a line break. An empty line is a spacer paragraph (&nbsp;),
// which every client keeps, unlike margins.
function render({ font, color, campaign, ref, lines }) {
  const pStyle = `font-family: ${font}; letter-spacing: normal; margin: 0 0 12px 0; line-height: normal;`
  const aStyle = plain => `font-family: ${font}; color: ${color};${plain ? ' text-decoration: none;' : ''}`

  const part = (item) => {
    if (item === 'br')
      return '<br>'
    if (typeof item === 'string')
      return escapeHtml(item)
    if (item.link) {
      const href = escapeHtml(trackedUrl(item.href, { campaign, ref }))
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

// Links Chris's signatures share.
const chris = {
  hub: { link: 'ChrisSpiegl.com', href: 'https://chrisspiegl.com/', title: 'My digital hub for everything.' },
  fieldNotes: { link: 'Field Notes', href: 'https://chrisspiegl.substack.com/', title: 'Be a traveler, not a tourist. Essays on traveling slowly through life.' },
  now: { link: '/now', href: 'https://chrisspiegl.com/now', title: 'What I am doing now.' },
  youtube: { link: 'YouTube.com/ChrisSpiegl', href: 'https://chrisspiegl.com/youtube', title: 'New videos every week.' },
  instagram: { link: 'Instagram.com/ChrisSpiegl', href: 'https://chrisspiegl.com/instagram', title: 'Business, personal, and tech!' },
  linkedin: { link: 'LinkedIn.com/in/ChrisSpiegl', href: 'https://chrisspiegl.com/linkedin', title: 'Let\'s connect and build together!' },
  niyama: { link: 'Niyama.Academy', href: 'https://niyama.academy/', title: 'Echtes Yoga für Dein Echtes Leben!' },
  bolstair: { link: 'BOLSTair', href: 'https://bolstair.com/', title: 'The only blowup yoga bolster for fitness & relaxation with built in blow-up mechanism.' },
}
const chrisSocial = [
  chris.youtube,
  SEP,
  chris.instagram,
  SEP,
  chris.linkedin,
]

const nicole = {
  niyama: { link: 'Niyama.Academy ~ Dein Online Yoga Studio', href: 'https://niyama.academy/', title: 'Echtes Yoga für Dein Echtes Leben - Live Yoga, Kurse, und eine wundervolle Yoga Community' },
  bolstair: { link: 'BOLSTair ~ Das einzige luftgefüllte Yoga Kissen', href: 'https://bolstair.com/', title: 'Für Yoga, Fitness, und vor allem zum Reisen genial! Mit eingebauter Pumpe und nur 280g leicht.' },
  youtube: { link: 'YouTube.com/NicoleReiher', href: 'https://youtube.com/NicoleReiher/', title: 'Online Yoga mit Liebe & Herz für Motivation und Gesundheit' },
  instagram: { link: 'Instagram.com/NicoleReiher1', href: 'https://instagram.com/NicoleReiher1/', title: 'Motivation, Inspiration, Leben und das große Leben' },
  linkedin: { link: 'LinkedIn.com/in/NicoleReiher', href: 'https://www.linkedin.com/in/nicolereiher/', title: 'Gemeinsam Vorwärts um Bildung, Leben, und Business zu verändern' },
}
const nicoleSocial = [
  nicole.youtube,
  SEP,
  nicole.instagram,
  SEP,
  nicole.linkedin,
]

const variants = [
  {
    id: 'chris-personal',
    name: 'Chris Spiegl',
    label: 'Personal',
    use: 'chris@chrisspiegl.com and everyday mail.',
    font: SERIF,
    color: ORANGE,
    ref: 'signature-chris',
    lines: [
      ['Chris Spiegl'],
      [],
      [
        'Co-Founder at ',
        chris.niyama,
        ' and ',
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
    id: 'ryan-assistant',
    name: 'Ryan',
    label: 'Assistant to Chris',
    use: 'Mail Ryan sends on Chris\'s behalf.',
    font: SERIF,
    color: ORANGE,
    ref: 'signature-ryan',
    lines: [
      ['Ryan'],
      [],
      [
        'Assistant to Chris Spiegl, his personal brand & life, and responsibilities at ',
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
    id: 'chris-niyama',
    name: 'Chris Spiegl',
    label: 'Niyama.Academy',
    use: 'The Niyama.Academy mailbox. German greeting.',
    font: SERIF,
    color: ORANGE,
    ref: 'signature-chris',
    lines: [
      ['Namasté'],
      ['Chris Spiegl'],
      [],
      [
        'Co-Founder at ',
        chris.niyama,
        ' and ',
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
    id: 'chris-bolstair',
    name: 'Chris Spiegl',
    label: 'BOLSTair',
    use: 'The BOLSTair mailbox.',
    font: SERIF,
    color: ORANGE,
    ref: 'signature-chris',
    lines: [
      ['Chris Spiegl'],
      [],
      [
        'Co-Founder at ',
        chris.bolstair,
        ' and ',
        chris.niyama,
      ],
      [
        {
          bold: ['BOLSTair ~ The Blowup Yoga & Fitness Bolster'],
        },
        'br',
        'Website & Shop: ',
        { ...chris.bolstair, link: 'www.BOLSTair.com' },
      ],
      [chris.hub, SEP, ...chrisSocial],
      [],
    ],
  },
  {
    id: 'nicole-personal',
    name: 'Nicole Reiher',
    label: 'Personal',
    use: 'Nicole\'s everyday mail. Her purple and sans-serif, as before.',
    font: SANS,
    color: PURPLE,
    ref: 'signature-nicole',
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
    ref: 'signature-nicole',
    lines: [
      ['Namasté'],
      ['Nicole Reiher'],
      [],
      ['Yoga-Lehrerin von Herzen (B. Ed., E-RYT500)'],
      ['Co-Founder bei ', nicole.bolstair],
      ['Gründerin der ', nicole.niyama],
      [
        {
          bold: ['BOLSTair ~ The Blowup Yoga & Fitness Bolster'],
        },
        'br',
        'Website & Shop: ',
        { ...chris.bolstair, link: 'www.BOLSTair.com' },
      ],
      nicoleSocial,
      [],
    ],
  },
]

module.exports = variants.map(variant => ({
  ...variant,
  campaign: variant.id,
  html: render({ ...variant, campaign: variant.id }),
}))
