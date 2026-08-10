const browserGlobals = {
  CSS: 'readonly',
  URLSearchParams: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  HTMLElement: 'readonly',
  localStorage: 'readonly',
  navigator: 'readonly',
  setTimeout: 'readonly',
  window: 'readonly',
};

const taskTrackerGlobals = {
  API_URL: 'readonly',
  callAPI: 'readonly',
  cacheClear: 'readonly',
  cachedFetch: 'readonly',
  currentView: 'readonly',
  focusNavigationRecord: 'readonly',
  getAll: 'readonly',
  getDashboard: 'readonly',
  handleSessionExpired: 'readonly',
  idToken: 'writable',
  navigateTo: 'readonly',
  queueOfflineWrite: 'readonly',
  showToast: 'readonly',
  t: 'readonly',
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '.claude/worktrees/**'],
  },
  {
    files: ['frontend/api.js', 'frontend/mobile-nav.js', 'frontend/notifications.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...browserGlobals, ...taskTrackerGlobals },
    },
    rules: {
      'no-constant-condition': 'error',
      'no-dupe-args': 'error',
      'no-func-assign': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-useless-catch': 'error',
    },
  },
  {
    files: ['build.mjs', 'playwright.config.js', 'tests/**/*.js', 'tests/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...browserGlobals,
        Buffer: 'readonly',
        URL: 'readonly',
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      'no-dupe-args': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
