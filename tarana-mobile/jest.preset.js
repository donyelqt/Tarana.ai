/**
 * React Native Jest preset, minus its setup file.
 *
 * Why a shim instead of `preset: 'react-native'`: jest prepends a preset's
 * `setupFiles` to the project's own and offers no way to remove it
 * (jest-config normalize.js:273 concatenates, unconditionally). The RN
 * preset ships an ESM setup.js that resolves through pnpm to a deep
 * `.pnpm/...` path; that path contains `node_modules/.pnpm/`, so the
 * preset's own `@react-native` transformIgnorePatterns lookahead misses and
 * babel-jest never transforms the file — every suite dies with
 * "Cannot use import statement outside a module" before a single test runs.
 *
 * This module re-exports everything the RN preset provides (haste platform
 * resolution, the resolver, the babel/asset transforms, the ignore
 * patterns) and drops ONLY the setup file it cannot load under Jest. If a
 * future test renders a component, add an equivalent RN setup here rather
 * than dropping the preset — this is a platform quirk, not a preference.
 */
module.exports = {
  ...require('@react-native/jest-preset'),
  setupFiles: [],
};
