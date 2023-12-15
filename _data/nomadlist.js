const axios = require('axios')

module.exports = async function () {
  const url = 'https://nomadlist.com/@ChrisSpiegl'
  try {
    const { data } = await axios.get(`${url}?format=json`)

    data.location.now.string = !data.location.now.city ? 'Unknown' : `${data.location.now.city}, ${data.location.now.country}`
    data.location.next.string = !data.location.next.city ? 'Unknown' : `${data.location.next.city}, ${data.location.next.country}`

    const returnValue = {
      data,
      url,
      now: data.location.now,
      next: data.location.next,
    }
    return returnValue
  } catch (error) {
    console.log(error)
  }

  return {
    data: {},
    url,
    now: 'Unknown',
    next: 'Unknown',
  }
}
