const EleventyFetch = require('@11ty/eleventy-fetch')
const { DateTime } = require('luxon')
const moment = require('moment')
const globalData = require('./global')

const headerIncludesUntil = true
const profileUrl = 'https://nomads.com/@ChrisSpiegl'
const unknownPlace = 'Unknown'
const fetchTimeoutMs = 5000
const durationUnits = ['years', 'months', 'weeks', 'days']
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

function placeString (place) {
  if (!place || !place.city) {
    return unknownPlace
  }

  if (!place.country) {
    return place.city
  }

  return `${place.city}, ${place.country}`
}

function untilString (place) {
  const label = placeString(place)
  if (label === unknownPlace || !place || !place.date_end) {
    return label
  }

  const endMonth = moment(place.date_end)
  if (!endMonth.isValid()) {
    return label
  }

  return `${label} until ${endMonth.format('MMM YYYY')}`
}

function endMonthString (place) {
  if (!place || !place.date_end) {
    return ''
  }

  const endMonth = moment(place.date_end)
  if (!endMonth.isValid()) {
    return ''
  }

  return endMonth.format('MMM YYYY')
}

function durationString (place) {
  if (!place || !place.date_start || !place.date_end) {
    return ''
  }

  const start = DateTime.fromISO(place.date_start)
  const end = DateTime.fromISO(place.date_end)
  if (!start.isValid || !end.isValid || end <= start) {
    return ''
  }

  for (const unit of durationUnits) {
    const count = end.diff(start, unit).get(unit)
    if (Math.abs(count) < 1) {
      continue
    }

    const rounded = Math.round(count)
    if (rounded < 1) {
      continue
    }

    const amount = durationWords[rounded] || String(rounded)
    const label = durationLabels[unit][rounded === 1 ? 0 : 1]
    return `${amount} ${label}`
  }

  return ''
}

function rangeString (place) {
  if (!place || !place.date_start || !place.date_end) {
    return ''
  }

  const start = moment(place.date_start)
  const end = moment(place.date_end)
  if (!start.isValid() || !end.isValid()) {
    return ''
  }

  return `from ${globalData.dateReadable(start)} until ${globalData.dateReadable(end)}`
}

function locationResult (location) {
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

function unknownResult () {
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

    return locationResult(data.location)
  } catch (error) {
    console.warn(`Nomad List lookup failed: ${error.message}`)
    return unknownResult()
  }
}
