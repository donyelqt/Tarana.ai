module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  // `pnpm test` runs from here, so the mobile LLM specs are discovered and run
  // by THIS config, not only by tarana-mobile/jest.config.js. Declaring both
  // roots (and the mobile node_modules in moduleDirectories) makes a mobile
  // spec resolve against tarana-mobile -- the same way its own config does --
  // so `../modelManager` in the spec and `./modelManager` in generateWithLlama
  // are resolved by the same rules. That is what the spec's
  // jest.mock('../modelManager') depends on: it registers under a module ID
  // built from the resolved absolute path plus the export conditions, and if
  // the two callers resolve differently the mock is never consulted and the
  // real model manager loads instead.
  roots: ['<rootDir>', '<rootDir>/tarana-mobile/src'],
  moduleDirectories: ['node_modules', '<rootDir>/tarana-mobile/node_modules'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/specs/**/?(*.)+(spec|test).[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/*',
    '!src/**/__mocks__/*',
    '!src/types/**/*',
    '!src/components/ui/**/*', // Exclude shadcn/ui components
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mobile resolves `tarana-web/*` through Metro extraNodeModules (see
    // tarana-mobile/metro.config.js); the root config needs the same remap
    // so mobile specs that import the shared schema run from here too.
    '^tarana-web/(.*)$': '<rootDir>/src/lib/$1',
    '^tarana-web$': '<rootDir>/src/lib',
    // SDK 57's legacy entry point ships untransformable TS source (see
    // jest.expoFileSystemMock.js), so map it to a stub when a mobile spec is
    // run from here -- which is what `pnpm test` does in CI.
    '^expo-file-system/legacy$': '<rootDir>/jest.expoFileSystemMock.js',
    '^expo-file-system$': '<rootDir>/jest.expoFileSystemMock.js',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(png|jpg|jpeg|gif|webp|svg|ico)$': '<rootDir>/jest.fileMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/.swc/',
    '/.kilo/',
    '/tests/e2e/',
  ],
  // Explicit, and written with forward slashes so the pattern means the same
  // thing on every platform. Jest's own default is the Windows-escaped
  // `\\node_modules\\`, normalized through replacePathSepForRegex, which only
  // rewrites separators when `path().sep === '\\'`: the default therefore
  // matches a Windows path and cannot match a POSIX one, so node_modules is
  // skipped on a developer machine and transformed in CI. See the matching
  // note in modelManager.ts, which was written about this same divergence.
  // Forward slashes make both platforms behave identically; the `.pnp` pattern
  // is kept because jest's default carries it and dropping it would change
  // PnP handling.
  transformIgnorePatterns: ['/node_modules/', '\\.pnp\\.[^\\\\]+$'],
  modulePathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/.swc/',
    '/.kilo/',
  ],
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  coverageThreshold: {
    // Ratchet floor as of 2026-09-06 — raise quarterly toward 80. DO NOT lower.
    global: {
      branches: 14.25,
      functions: 20.43,
      lines: 18.56,
      statements: 18.6,
    },
  },
};