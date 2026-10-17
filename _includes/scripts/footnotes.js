// Turns markdown-it-footnote references into click-to-open popovers (Popover API + CSS anchor positioning).
// Without Popover API support the original links stay and jump to the footnote list.
(() => {
  if (!('showPopover' in HTMLElement.prototype)) return

  const referenceLinks = document.querySelectorAll('.footnote-ref > a[href^="#"]')
  if (referenceLinks.length === 0) return

  const ACTIVE_CLASS = 'is-active'

  referenceLinks.forEach((referenceLink, index) => {
    const footnoteId = decodeURIComponent(referenceLink.hash.slice(1))
    if (!footnoteId) return

    const selector = `#${CSS.escape(footnoteId)}`
    const scope = referenceLink.closest('article') || document
    const footnoteItem = scope.querySelector(selector) || document.querySelector(selector)
    if (!footnoteItem) return

    const footnoteNumber = referenceLink.textContent.trim()
    const popoverId = `footnote-popover-${index + 1}`
    const anchorName = `--footnote-${index + 1}`

    const popover = document.createElement('div')
    popover.className = 'footnote-popover'
    popover.id = popoverId
    popover.popover = 'auto'
    popover.setAttribute('role', 'note')
    popover.setAttribute('aria-label', `Footnote ${footnoteNumber}`)
    popover.style.setProperty('position-anchor', anchorName)
    for (const child of footnoteItem.childNodes) popover.append(child.cloneNode(true))
    popover.querySelectorAll('.footnote-backref').forEach((backLink) => backLink.remove())

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'footnote-button'
    button.textContent = footnoteNumber
    button.setAttribute('aria-label', `Footnote ${footnoteNumber}`)
    button.setAttribute('aria-expanded', 'false')
    button.popoverTargetElement = popover
    button.style.setProperty('anchor-name', anchorName)
    if (referenceLink.id) button.id = referenceLink.id

    popover.addEventListener('toggle', (event) => {
      const isOpen = event.newState === 'open'
      button.classList.toggle(ACTIVE_CLASS, isOpen)
      button.setAttribute('aria-expanded', String(isOpen))
    })

    const referenceSup = referenceLink.parentElement
    referenceLink.replaceWith(button)
    referenceSup.after(popover)
  })
})()
