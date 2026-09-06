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