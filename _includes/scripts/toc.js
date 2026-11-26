// "On this page" list for pages with `toc: true` (see _includes/page.pug).
// Desktop: always open in the left column. Phone: a bar that opens and closes,
// and closes again after a jump. Marks the section being read.
(() => {
  const toc = document.querySelector('.toc')
  if (!toc)
    return

  const details = toc.querySelector('.toc-details')
  const current = toc.querySelector('.toc-current')
  const links = [
    ...toc.querySelectorAll('a[href^="#"]'),
  ]
  const desktop = window.matchMedia('(min-width: 820px)')

  const syncOpen = () => {
    details.open = desktop.matches
  }
  syncOpen()
  desktop.addEventListener('change', syncOpen)

  toc.addEventListener('click', (event) => {
    if (event.target.closest('a') && !desktop.matches)
      details.open = false
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && details.open && !desktop.matches) {
      details.open = false
      details.querySelector('summary').focus()
    }
  })

  const headings = links
    .map(link => document.getElementById(decodeURIComponent(link.hash.slice(1))))
    .filter(Boolean)
  if (headings.length === 0)
    return

  const setActive = (id) => {
    links.forEach((link) => {
      const isActive = decodeURIComponent(link.hash.slice(1)) === id
      if (isActive) {
        link.setAttribute('aria-current', 'location')
        current.textContent = link.textContent
      }
      else {
        link.removeAttribute('aria-current')
      }
    })
  }

  // The active section is the last heading that has scrolled past the top third.
  const update = () => {
    const line = window.innerHeight / 3
    let active = headings[0]
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= line)
        active = heading
    }
    setActive(active.id)
  }

  let queued = false
  window.addEventListener('scroll', () => {
    if (queued)
      return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      update()
    })
  }, { passive: true })
  update()
})()
