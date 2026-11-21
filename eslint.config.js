// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
  {
    // src/game must stay pure: no React / React Native / Expo / app-layer imports.
    files: ['src/game/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-*', 'react-native', 'react-native-*'], message: 'src/game saf TypeScript olmalı.' },
            { group: ['expo', 'expo-*', '@expo/*'], message: 'src/game saf TypeScript olmalı.' },
            { group: ['@/db/*', '@/state/*', '@/components/*', '@/screens/*', '@/notifications/*', '@/hooks/*'], message: 'src/game diğer katmanlara bağımlı olamaz.' },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Seed kullan (src/game/random.ts).' },
        { object: 'Date', property: 'now', message: 'Zamanı parametre olarak al.' },
      ],
    },
  },
]);
