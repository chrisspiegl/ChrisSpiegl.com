const EleventyFetch = require('@11ty/eleventy-fetch')
const moment = require('moment')

const headerIncludesUntil = true
const profileUrl = 'https://nomads.com/@ChrisSpiegl'
const unknownPlace = 'Unknown'
const fetchTimeoutMs = 5000

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

function locationResult (location) {
  const now = location && location.now
  const next = location && location.next

  return {
    url: profileUrl,
    headerIncludesUntil,
    now: {
      string: placeString(now),
      until: untilString(now),
    },
    next: {
      string: placeString(next),
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
    },
    next: {
      string: unknownPlace,
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
