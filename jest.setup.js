// Jest setup file for Tarana.ai tests

// Mock Next.js environment
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:3000';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

// Setup React Testing Library
require('@testing-library/jest-dom');

// Mock Next.js Request/Response for server-side code
global.Request = class Request {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Map();
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value);
      });
    }
  }

  async json() {
    return {};
  }

  async text() {
    return '';
  }
};

global.Response = class Response {
  constructor(body, options = {}) {
    this.body = body;
    this.status = options.status || 200;
    this.statusText = options.statusText || 'OK';
    this.headers = new Map();
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value);
      });
    }
  }

  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }

  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }
};

global.Headers = class Headers {
  constructor(init = {}) {
    this.map = new Map();
    if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this.map.set(key.toLowerCase(), value);
      });
    }
  }

  get(key) {
    return this.map.get(key.toLowerCase());
  }

  set(key, value) {
    this.map.set(key.toLowerCase(), value);
  }

  has(key) {
    return this.map.has(key.toLowerCase());
  }
};

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: jest.fn(() => '/'),
}));

// Mock Supabase admin to prevent client-side import errors
const mockSupabaseAdmin = {
  auth: {
    admin: {
      getUserById: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      createUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      updateUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    }
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
};

jest.mock('@/lib/data/supabaseAdmin', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

// Make it available globally for tests that need to modify it
global.mockSupabaseAdmin = mockSupabaseAdmin;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock fetch for API calls
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({}),
  text: async () => '',
});

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

// Mock nodemailer with complete implementation
const mockCreateTransport = jest.fn((config = {}) => ({
  sendMail: jest.fn().mockResolvedValue({
    messageId: 'test-message-id',
    envelope: { from: config.auth?.user || 'test@example.com', to: [] },
    accepted: [],
    rejected: [],
    pending: [],
    response: '250 OK'
  }),
  verify: jest.fn().mockResolvedValue(true),
  close: jest.fn(),
}));

const mockNodemailer = {
  default: {
    createTransport: mockCreateTransport,
  },
  createTransport: mockCreateTransport,
};

jest.mock('nodemailer', () => mockNodemailer);

// Make it available globally for tests
global.mockCreateTransport = mockCreateTransport;
global.mockSendMail = mockCreateTransport().sendMail;

// Setup test database cleanup
afterEach(() => {
  jest.clearAllMocks();
});
