const CSVToJSON = require('csvtojson')

const compare = (a, b) => {
  a.Priority = (!a.Priority) ? a.Priority = 9000 : parseInt(a.Priority)
  b.Priority = (!b.Priority) ? b.Priority = 9000 : parseInt(b.Priority)
  if (a.Priority > b.Priority) return 1
  if (a.Priority < b.Priority) return -1
  if (a.Title > b.Title) return 1
  if (a.Title < b.Title) return -1
  return 0
}

module.exports = function () {
  return new Promise(async (resolve, reject) => {
    try {
      const gears = await CSVToJSON().fromFile('_data/gear.csv')
      const gearsSorted = gears.sort(compare)
      return resolve(gearsSorted)
    } catch (err) {
      console.error('error while loading gears CSV file: ', err)
    }
  })
}
