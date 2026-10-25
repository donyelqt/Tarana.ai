// Jest stub for `expo-file-system` under the repo-root jest config.
//
// WHY A STUB AND NOT A TRANSFORM: SDK 57 split the filesystem, and the legacy
// entry point the model manager depends on ships TypeScript source with no
// build output (`main: src/index.ts`, `exports["./legacy"].default:
// ./src/legacy/index.ts`). `node_modules` is on the root config's
// transformIgnorePatterns, so nothing rewrites that ESM `export * from
// './FileSystem'` into CommonJS and the require dies with
// "Unexpected token 'export'". Letting expo-file-system through Babel instead
// does not close: `src/legacy/FileSystem.ts` imports `expo-modules-core` and
// `react-native`, whose own entry is Flow (`import typeof * as
// ReactNativePublicAPI from './index.js.flow'`), which the root config's
// babel-jest cannot parse — the failure just moves to react-native's index.js.
// A fix there means adding presets to the root Babel config, which would
// change how every web `.js` file under `src/` is transformed.
//
// The web tree never imports this package at all (checked: zero references in
// `src/`), so this mapping only binds when a mobile spec is run from the repo
// ROOT — which is what `pnpm test` does in CI.
//
// BEHAVIOR CONTRACT: reading `documentDirectory` returns a string, because
// that is the single value the model manager's shape guard requires
// (`'documentDirectory' in fs`, then `typeof fs.documentDirectory === 'string'`).
// Every actual filesystem operation throws, rather than returning fabricated
// file state: a stub that reports "the model is not on disk" would let a
// degradation assertion pass for the wrong reason. Anything that needs real
// filesystem behavior must run under `tarana-mobile/jest.config.js`, where the
// app is the rootDir.
module.exports = {
  documentDirectory: 'file:///jest-stub/expo-file-system/',
  cacheDirectory: 'file:///jest-stub/expo-file-system/cache/',
  bundleDirectory: 'file:///jest-stub/expo-file-system/bundle/',

  // Anything reaching this file is asking for real disk state. Fail loudly
  // instead of answering with invented data.
  getInfoAsync: unavailable('getInfoAsync'),
  readAsStringAsync: unavailable('readAsStringAsync'),
  writeAsStringAsync: unavailable('writeAsStringAsync'),
  deleteAsync: unavailable('deleteAsync'),
  moveAsync: unavailable('moveAsync'),
  copyAsync: unavailable('copyAsync'),
  makeDirectoryAsync: unavailable('makeDirectoryAsync'),
  readDirectoryAsync: unavailable('readDirectoryAsync'),
  getContentUriAsync: unavailable('getContentUriAsync'),
  getFreeDiskStorageAsync: unavailable('getFreeDiskStorageAsync'),
  getTotalDiskCapacityAsync: unavailable('getTotalDiskCapacityAsync'),
  deleteLegacyDocumentDirectoryAndroid: unavailable('deleteLegacyDocumentDirectoryAndroid'),
  createDownloadResumable: unavailable('createDownloadResumable'),
};

function unavailable(name) {
  return function stubUnavailable() {
    throw new Error(
      `expo-file-system.${name} is not available under the repo-root jest config. ` +
        'This spec is asserting a failure path that fires before any filesystem call; ' +
        'run it under tarana-mobile/jest.config.js to exercise real filesystem behavior.'
    );
  };
}
