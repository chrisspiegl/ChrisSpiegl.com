const { execFileSync } = require('node:child_process')

function isShallowRepository() {
  try {
    const output = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      encoding: 'utf8',
    })
    return output.trim() === 'true'
  } catch (error) {
    console.warn(`Could not check git clone depth: ${error.message}`)
    return false
  }
}

if (isShallowRepository()) {
  execFileSync('git', ['fetch', '--unshallow'], { stdio: 'inherit' })
}
