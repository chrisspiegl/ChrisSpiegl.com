const CSVToJSON = require('csvtojson')

const compare = (a, b) => {
  a.Priority = (a.Priority) ? Number.parseInt(a.Priority, 10) : a.Priority = 9000
  b.Priority = (b.Priority) ? Number.parseInt(b.Priority, 10) : b.Priority = 9000
  if (a.Priority > b.Priority) {
    return 1
  }

  if (a.Priority < b.Priority) {
    return -1
  }

  if (a.Title > b.Title) {
    return 1
  }

  if (a.Title < b.Title) {
    return -1
  }

  return 0
}

module.exports = function () {
  return new Promise(async (resolve) => {
    try {
      const gears = await CSVToJSON().fromFile('_data/gear.csv')
      const gearsSorted = gears.sort(compare)
      return resolve(gearsSorted)
    } catch (error) {
      console.error('error while loading gears CSV file:', error)
    }
  })
}
