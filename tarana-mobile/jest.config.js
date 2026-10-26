/**
 * Jest config for the mobile local-LLM suite.
 *
 * Only the LLM boundary is tested here (prompt contract, degradation), so
 * this is deliberately minimal: the React Native preset supplies haste
 * platform resolution, the resolver, and the babel/asset transforms;
 * `testEnvironment: 'node'` overrides the preset's RN environment because no
 * test renders a view.
 *
 * The preset is loaded through `jest.preset.js`, which drops the RN setup
 * file jest cannot transform here (explained in that file). Babel comes from
 * the app's own `babel.config.js` — same transform Metro uses, so a test run
 * and a bundle disagree about syntax far less often than ts-jest would.
 *
 * `tarana-web/*` mirrors the Metro `extraNodeModules` remap in
 * metro.config.js (and the tsconfig `paths` entry), so the shared schema
 * resolves from the repo root identically at test time.
 *
 * `zod` is mapped to the ROOT copy: the mobile package ships v3, the shared
 * schema is written against v4, and Metro already resolves the root one
 * (node resolution walks up, see metro.config.js). Jest must agree or
 * `itinerarySchema` and the generator would run against different zod
 * versions in production and in test.
 */
module.exports = {
  // The React Native preset, via a local adapter that drops its ESM setup
  // file — see jest.preset.js for why that file cannot load under Jest.
  preset: './jest.preset.js',

  testEnvironment: 'node',

  // Restricts discovery to src/ — the repo-root jest.config.js otherwise
  // matches these specs too (duplicate runs, wrong rootDir).
  roots: ['<rootDir>/src'],

  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },

  // jest concatenates a preset's setupFiles with the project's; the preset's
  // is emptied in jest.preset.js, so this is the only setup that runs.
  setupFiles: ['<rootDir>/jest.setup.ts'],

  transformIgnorePatterns: ['node_modules/(?!((jest-)?react-native|@react-native(-community)?)/)'],

  testMatch: ['**/__tests__/**/*.(spec|test).(ts|tsx|js|jsx)'],

  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/android/', '/ios/'],

  moduleNameMapper: {
    '^tarana-web/(.*)$': '<rootDir>/../src/lib/$1',
    '^tarana-web$': '<rootDir>/../src/lib',
    '^zod$': '<rootDir>/../node_modules/zod',
    // SDK 57 ships TypeScript source as the legacy entry point's default and
    // no mobile spec writes files, so the require parses as raw ESM and dies
    // on Linux. Map it to the shared stub, the same way the root config does
    // for the same reason. See jest.expoFileSystemMock.js for why a transform
    // was tried first and does not close.
    '^expo-file-system/legacy$': '<rootDir>/../jest.expoFileSystemMock.js',
    '^expo-file-system$': '<rootDir>/../jest.expoFileSystemMock.js',
  },
};
