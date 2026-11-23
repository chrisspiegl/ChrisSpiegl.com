// Pug front matter can't template a permalink, so each pagination page sets it here.
module.exports = {
  permalink: data => data.linkPagePath,
}
