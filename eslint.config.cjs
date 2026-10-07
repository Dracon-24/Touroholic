const js = require('@eslint/js');
module.exports = [
  { ignores: ['node_modules/**', '.parcel-cache/**', 'public/js/dist/**', 'dev-data/data/tour5.js'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest', sourceType: 'commonjs',
      globals: Object.fromEntries(['console', 'process', 'Buffer', '__dirname', 'module', 'exports', 'require', 'setTimeout', 'clearTimeout', 'fetch', 'URL', 'URLSearchParams', 'AbortController', 'document', 'window', 'location', 'FormData'].map(key => [key, 'readonly']))
    },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^(req|res|next|val|_)', varsIgnorePattern: '^reviewsReady$', caughtErrors: 'none' }] }
  },
  { files: ['public/js/*.js'], languageOptions: { sourceType: 'module' } }
];
