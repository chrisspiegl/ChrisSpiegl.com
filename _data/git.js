const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const git = require('async-git')

const execFileAsync = promisify(execFile)

async function lastCommitDate (filePath) {
  try {
    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%cI', '--', filePath])
    const value = stdout.trim()
    return value || null
  } catch (error) {
    console.warn(`Git date lookup failed for ${filePath}: ${error.message}`)
    return null
  }
}

module.exports = async function () {
  return {
    commitsha: await git.short,
    curbranch: await git.branch,
    commitdate: await git.date,
    origin: await git.origin,
    nowPageDate: await lastCommitDate('now.md'),
  }
}
