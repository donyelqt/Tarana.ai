/**
 * Jest for tarana-mobile — data-layer tests only.
 *
 * Runs against the existing `babel.config.js` (babel-preset-expo +
 * nativewind/babel) via babel-jest, so no second transform config to drift.
 * `testEnvironment: node` keeps the data layer free of a DOM; UI tests can
 * opt into jsdom per-file with the `@jest-environment` docblock.
 *
 * `roots` restricts discovery to `src/` — the repo-root jest.config.js
 * otherwise matches these specs too (duplicate runs, wrong rootDir).
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/android/', '/ios/'],
};
