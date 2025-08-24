// Jest setup file for Tarana.ai password reset tests

// Mock Next.js environment
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock crypto for consistent token generation in tests
const crypto = require('crypto');
const originalRandomBytes = crypto.randomBytes;
crypto.randomBytes = jest.fn().mockImplementation((size) => {
  return Buffer.from('a'.repeat(size * 2), 'hex');
});

// Restore original crypto for specific tests that need it
global.restoreCrypto = () => {
  crypto.randomBytes = originalRandomBytes;
};

// Mock nodemailer to prevent actual email sending during tests
jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  })),
}));

// Setup test database cleanup
afterEach(() => {
  jest.clearAllMocks();
});
