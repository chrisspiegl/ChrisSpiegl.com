const EleventyFetch = require('@11ty/eleventy-fetch')
const { differenceInCalendarDays } = require('date-fns')
const buildStats = require('../utils/buildStats')
const { dateReadable, formatDate, isValidDate, toDate } = require('../utils/dates')

const headerIncludesUntil = true
const profileUrl = 'https://nomads.com/@ChrisSpiegl'
const unknownPlace = 'Unknown'
const fetchTimeoutMs = 5000
const durationUnits = ['years', 'months', 'weeks', 'days']
const daysPerUnit = {
  years: 365.25,
  months: 30.44,
  weeks: 7,
  days: 1,
}
const durationWords = {
  1: 'a',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
}
const durationLabels = {
  years: ['year', 'years'],
  months: ['month', 'months'],
  weeks: ['week', 'weeks'],
  days: ['day', 'days'],
}

function placeString(place) {
  if (!place || !place.city) {
    return unknownPlace
  }

  if (!place.country) {
    return place.city
  }

  return `${place.city}, ${place.country}`
}

function untilString(place) {
  const label = placeString(place)
  if (label === unknownPlace || !place || !place.date_end) {
    return label
  }

  if (!isValidDate(place.date_end)) {
    return label
  }

  return `${label} until ${formatDate(place.date_end, 'MMM yyyy')}`
}

function endMonthString(place) {
  if (!place || !place.date_end) {
    return ''
  }

  return formatDate(place.date_end, 'MMM yyyy')
}

function durationString(place) {
  if (!place || !place.date_start || !place.date_end) {
    return ''
  }

  if (!isValidDate(place.date_start) || !isValidDate(place.date_end)) {
    return ''
  }

  const days = differenceInCalendarDays(toDate(place.date_end), toDate(place.date_start))
  if (days <= 0) {
    return ''
  }

  for (const unit of durationUnits) {
    const count = days / daysPerUnit[unit]
    if (Math.abs(count) < 1) {
      continue
    }

    const rounded = Math.round(count)
    if (rounded < 1) {
      continue
    }

    const amount = durationWords[rounded] || String(rounded)
    const label = durationLabels[unit][rounded === 1
      ? 0
      : 1]
    return `${amount} ${label}`
  }

  return ''
}

function rangeString(place) {
  if (!place || !place.date_start || !place.date_end) {
    return ''
  }

  if (!isValidDate(place.date_start) || !isValidDate(place.date_end)) {
    return ''
  }

  return `from ${dateReadable(place.date_start)} until ${dateReadable(place.date_end)}`
}

function locationResult(location) {
  const now = location && location.now
  const next = location && location.next

  return {
    url: profileUrl,
    headerIncludesUntil,
    now: {
      string: placeString(now),
      until: untilString(now),
      range: rangeString(now),
      end: endMonthString(now),
    },
    next: {
      string: placeString(next),
      range: rangeString(next),
      end: endMonthString(next),
      duration: durationString(next),
    },
  }
}

function unknownResult() {
  return {
    url: profileUrl,
    headerIncludesUntil,
    now: {
      string: unknownPlace,
      until: unknownPlace,
      range: '',
      end: '',
    },
    next: {
      string: unknownPlace,
      range: '',
      end: '',
      duration: '',
    },
  }
}

module.exports = async function () {
  try {
    const data = await EleventyFetch(`${profileUrl}?format=json`, {
      duration: '6h',
      type: 'json',
      directory: '.cache',
      fetchOptions: {
        signal: AbortSignal.timeout(fetchTimeoutMs),
      },
    })

    const result = locationResult(data.location)
    buildStats.record('location', { now: result.now.string, next: result.next.string })
    return result
  }
  catch (error) {
    console.warn(`Nomad List lookup failed: ${error.message}`)
    buildStats.record('location', { now: unknownPlace, failed: true })
    return unknownResult()
  }
}
