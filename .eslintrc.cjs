module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  // fbq: Meta Pixel, cargado por un <script> externo en index.html — no es un
  // import, así que ESLint necesita que se lo digamos para no marcarlo no-undef.
  globals: { fbq: 'readonly' },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
}
