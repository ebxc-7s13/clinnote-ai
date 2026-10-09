// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*'],
  },
  {
    // zod pattern: a schema constant and its inferred type share one name by design
    files: ['src/domain/types.ts', 'src/domain/extraction/item.ts'],
    rules: { '@typescript-eslint/no-redeclare': 'off' },
  },
]);
