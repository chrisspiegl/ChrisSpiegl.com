const { execFileSync } = require('node:child_process')

let cachedDates

function loadCommitDates() {
  if (cachedDates) return cachedDates

  const dates = new Map()

  try {
    const stdout = execFileSync(
      'git',
      ['log', '--pretty=format:COMMIT %cI', '--name-only'],
      { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
    )

    let currentDate = null
    for (const line of stdout.split('\n')) {
      if (line.startsWith('COMMIT ')) {
        currentDate = line.slice('COMMIT '.length).trim() || null
        continue
      }

      if (!line || !currentDate || dates.has(line)) continue
      dates.set(line, currentDate)
    }
  } catch (error) {
    console.warn(`Git file date lookup failed: ${error.message}`)
  }

  cachedDates = dates
  return dates
}

function lastCommitDate(inputPath) {
  if (!inputPath) return null
  const relativePath = String(inputPath).replace(/^\.\//, '')
  if (!relativePath) return null
  return loadCommitDates().get(relativePath) || null
}

module.exports = {
  lastCommitDate,
  loadCommitDates,
}
