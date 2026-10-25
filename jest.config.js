module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
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