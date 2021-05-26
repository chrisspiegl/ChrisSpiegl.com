const fs = require("fs");
const path = require("path");
const { getAudioDurationInSeconds } = require("get-audio-duration");

module.exports = {
  siteTitle: "Chris Spiegl",
  siteName: "ChrisSpiegl.com",
  url: "https://ChrisSpiegl.com",
  imageResizer: (width, height, origin) => {
    // Use Wrender for External Image URLs in the future?
    // baseUrl = origin.startsWith('/') ? `https://chrisspiegl.com${origin}` : origin
    // if (process.env.ELEVENTY_ENV == 'production') return `https://wrender.spiegl.co/resize/${width}/${height}/${baseUrl}`
    // else return `${origin}?width=${width}&height=${height}`
    const ext = path.extname(origin);
    const base = path.basename(origin, ext);
    const dir = path.dirname(origin);
    const imagePath = path.join(dir, `${base}-${width}w${ext}`);
    return imagePath;
  },
  authorEmail: "chris@chrisspiegl.com",
  build: {
    env: process.env.ELEVENTY_ENV,
    timestamp: new Date(),
  },
};
