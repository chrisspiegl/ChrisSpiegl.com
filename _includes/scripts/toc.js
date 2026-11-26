// "On this page" list for pages with `toc: true` (see _includes/page.pug).
// Without this script the list still works: every entry is shown, and the
// phone bar opens and closes as a plain <details>. The script adds:
// - desktop: the list is always open in the left column
// - phone: the bar closes after a jump, on a tap outside, or on Escape
// - folding: only sections are shown, the one you're reading opens by itself
// - the section you're reading is marked, and shown in the closed phone bar
// - the TOC fades out while a wide figure passes over it
(() => {
  const toc = document.querySelector('.toc')
  if (!toc)
    return

  const details = toc.querySelector('.toc-details')
  const current = toc.querySelector('.toc-current')
  const list = toc.querySelector('.toc-list')
  const links = [
    ...toc.querySelectorAll('a[href^="#"]'),
  ]
  const desktop = window.matchMedia('(min-width: 820px)')
  toc.classList.add('is-enhanced')

  const syncOpen = () => {
    details.open = desktop.matches
  }
  syncOpen()
  desktop.addEventListener('change', syncOpen)

  const closeOnPhone = () => {
    if (!desktop.matches)
      details.open = false
  }

  toc.addEventListener('click', (event) => {
    if (event.target.closest('a'))
      closeOnPhone()
  })

  // A tap or click anywhere outside the open list closes it.
  document.addEventListener('pointerdown', (event) => {
    if (details.open && !toc.contains(event.target))
      closeOnPhone()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && details.open && !desktop.matches) {
      details.open = false
      details.querySelector('summary').focus()
    }
  })

  // Folding: a section shows its subsections only while you're reading it.
  // Clicking a section jumps there, which opens it.
  const branches = [
    ...toc.querySelectorAll('.toc-branch'),
  ]

  const headings = links
    .map(link => document.getElementById(decodeURIComponent(link.hash.slice(1))))
    .filter(Boolean)
  if (headings.length === 0)
    return

  let activeId = null
  const setActive = (id) => {
    if (id === activeId)
      return
    activeId = id
    let activeLink = null
    links.forEach((link) => {
      const isActive = decodeURIComponent(link.hash.slice(1)) === id
      link.removeAttribute('aria-current')
      if (isActive) {
        link.setAttribute('aria-current', 'location')
        activeLink = link
      }
    })
    const branch = activeLink && activeLink.closest('.toc-branch')
    branches.forEach((item) => {
      item.classList.toggle('is-reading', item === branch)
      item.classList.toggle('is-open', item === branch)
    })
    if (activeLink) {
      current.textContent = activeLink.textContent
      // Keep the marked entry in view inside a long list.
      const top = activeLink.offsetTop - list.offsetTop
      if (top < list.scrollTop || top > list.scrollTop + list.clientHeight - activeLink.offsetHeight)
        list.scrollTop = top - list.clientHeight / 3
    }
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

  // Fade the TOC out while a wide figure passes over it. Wide figures only
  // reach into the TOC column when the text is centered on a large screen.
  const wideFigures = [
    ...document.querySelectorAll('.has-toc .figure-wide'),
  ]
  const updateCovered = () => {
    const box = toc.getBoundingClientRect()
    const covered = desktop.matches && wideFigures.some((figure) => {
      const rect = figure.getBoundingClientRect()
      return rect.left < box.right && rect.top < box.bottom && rect.bottom > box.top
    })
    toc.classList.toggle('is-covered', covered)
  }

  let queued = false
  const onScroll = () => {
    if (queued)
      return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      update()
      updateCovered()
    })
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  update()
  updateCovered()
})()
