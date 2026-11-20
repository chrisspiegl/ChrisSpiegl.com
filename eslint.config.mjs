import antfu from '@antfu/eslint-config'

export default antfu({
  // This repo is CommonJS JavaScript, no framework.
  typescript: false,
  vue: false,
  // Content files are written by hand; only lint code.
  markdown: false,
  // Don't enforce antfu's pnpm workspace settings.
  pnpm: false,
  ignores: [
    '_site/**',
    '.cache/**',
    'assets/images/**',
    'pnpm-lock.yaml',
  ],
}, {
  rules: {
    'node/prefer-global/process': 'off',
    'no-console': 'off',
  },
})
