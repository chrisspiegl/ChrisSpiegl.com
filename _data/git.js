const git = require('async-git')

module.exports = async function () {
  // Workers Builds checks out a detached HEAD, so git only says "HEAD" there.
  const branch = await git.branch
  return {
    commitsha: await git.short,
    curbranch: branch === 'HEAD'
      ? (process.env.WORKERS_CI_BRANCH || process.env.CF_PAGES_BRANCH || branch)
      : branch,
    commitdate: await git.date,
    origin: await git.origin,
  }
}
