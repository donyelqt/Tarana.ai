module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  // The web tree only. The mobile specs have their own config
  // (tarana-mobile/jest.config.js) and their own CI step, so they must not be
  // collected from here: running them under this config made
  // jest.mock('../modelManager') register a module ID that a POSIX working
  // directory does not reproduce, so the real native model manager loaded
  // instead of the double and the degradation assertions failed on Linux only.
  // See `testPathIgnorePatterns` below, which is the belt to this braces.
  roots: ['<rootDir>'],
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
    // The whole mobile app. `roots` is already web-only above, but this keeps
    // the mobile specs out even if a future change re-widens the roots or a
    // symlink puts them under one: they must run under
    // tarana-mobile/jest.config.js, whose mock identity for
    // jest.mock('../modelManager') is the one the degradation assertions pass
    // against. Under this config they pass on Windows and fail on Linux.
    '/tarana-mobile/',
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