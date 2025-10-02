/* eslint-env node */
module.exports = {
  root: true,
  env: {
    browser: true,     // ← даст window/localStorage и уберёт no-undef по ним
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['react', 'react-hooks', 'import', 'jsx-a11y'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended', // ← включает exhaustive-deps
    'plugin:import/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    // Строгие ошибки оставляем по умолчанию.
    // Косметику делаем мягче, чтобы не мешало работе.
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'import/no-unresolved': 'off', // если есть алиасы без настроенного resolver
    // Если где-то осознанно ломаешь exhaustive-deps — точечно отключай комментом.
    // 'react-hooks/exhaustive-deps': 'warn',
  },
  ignorePatterns: [
    'dist/', 'build/', 'coverage/', 'node_modules/',
    // генерённые/внешние файлы, если есть:
    '*.config.cjs', '*.config.js'
  ],
};