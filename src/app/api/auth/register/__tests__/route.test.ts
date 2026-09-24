const MockedResponseReg = globalThis.Response as unknown as { new(body?: unknown, init?: any): any; json(body: unknown, init?: any): any; };
if (typeof MockedResponseReg.json !== 'function') {
  MockedResponseReg.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponseReg(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { createUserInSupabase } from '@/lib/auth';
import { createUserProfile } from '@/lib/services/userService';
import { validatePasswordStrength } from '@/lib/security/inputSanitizer';
import { logger } from '@/lib/observability/logger';

jest.mock('@/lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;
jest.mock('@/lib/auth', () => ({
  createUserInSupabase: jest.fn(),
}));

jest.mock('@/lib/services/userService', () => ({
  createUserProfile: jest.fn(),
}));

jest.mock('@/lib/security/rateLimiter', () => ({
  createRateLimitMiddleware: jest.fn(() => () => ({ allowed: true, remaining: 5, resetTime: Date.now() + 900000 })),
  rateLimitConfigs: { auth: { windowMs: 900000, maxRequests: 5, blockDurationMs: 1800000 } },
}));

jest.mock('@/lib/security/inputSanitizer', () => ({
  sanitizeUserRegistration: jest.fn(),
  validatePasswordStrength: jest.fn(),
}));

jest.mock('@/lib/security/securityHeaders', () => ({
  applySecurityHeaders: jest.fn((response) => response),
}));

jest.mock('@/lib/security/environmentValidator', () => ({
  checkRequiredEnvVars: jest.fn(),
}));

jest.mock('@/lib/referral-system', () => ({
  ReferralService: {
    validateReferralCode: jest.fn(),
    createReferral: jest.fn(),
  },
}));

describe('Register API Route Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createUserProfile as jest.Mock).mockResolvedValue(undefined);
  });

  test('should return 400 for missing required fields', async () => {
    const mockRequest = {
      headers: { get: () => null },
      json: jest.fn().mockResolvedValue({}),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(400);
  });

  test('should return 400 when ToS agreement is missing', async () => {
    const mockRequest = {
      headers: { get: () => null },
      json: jest.fn().mockResolvedValue({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'strongPassword123!',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(400);
  });

  test('should return 400 when ToS agreement is false', async () => {
    const mockRequest = {
      headers: { get: () => null },
      json: jest.fn().mockResolvedValue({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'strongPassword123!',
        agreed: false,
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(400);
  });

  test('should return 201 for valid registration', async () => {
    (validatePasswordStrength as jest.Mock).mockReturnValue({
      isValid: true,
      errors: [],
      score: 2,
      feedback: ['Great! Longer passwords are more secure'],
      strengthLevel: 'medium',
    });

    (require('@/lib/security/inputSanitizer').sanitizeUserRegistration as jest.Mock)
      .mockReturnValue({
        sanitized: { fullName: 'John Doe', email: 'john@example.com', password: 'strongPassword123!' },
        errors: [],
      });

    (createUserInSupabase as jest.Mock).mockResolvedValue({
      id: 'test-user-id',
      fullName: 'John Doe',
      email: 'john@example.com',
    });

    const mockRequest = {
      headers: { get: () => null },
      json: jest.fn().mockResolvedValue({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'strongPassword123!',
        agreed: true,
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(201);

    const responseBody = await response.json();
    expect(responseBody.success).toBe(true);
    expect(responseBody.message).toBe('User registered successfully');
    expect(createUserInSupabase as jest.Mock).toHaveBeenCalledWith(
      'John Doe',
      'john@example.com',
      'strongPassword123!',
      expect.any(String),
    );
    expect(createUserProfile as jest.Mock).toHaveBeenCalledWith('test-user-id');
  });

  test('should return 409 when user already exists', async () => {
    (validatePasswordStrength as jest.Mock).mockReturnValue({
      isValid: true,
      errors: [],
      score: 2,
      feedback: ['Great! Longer passwords are more secure'],
      strengthLevel: 'medium',
    });

    (require('@/lib/security/inputSanitizer').sanitizeUserRegistration as jest.Mock)
      .mockReturnValue({
        sanitized: { fullName: 'John Doe', email: 'john@example.com', password: 'strongPassword123!' },
        errors: [],
      });

    (createUserInSupabase as jest.Mock).mockRejectedValue(
      new Error('User with this email already exists')
    );

    const mockRequest = {
      headers: { get: () => null },
      json: jest.fn().mockResolvedValue({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'strongPassword123!',
        agreed: true,
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(409);

    const responseBody = await response.json();
    expect(responseBody.error).toBe('User with this email already exists');
  });

  test('should validate referral code if provided', async () => {
    const { ReferralService } = require('@/lib/referral-system');
    ReferralService.validateReferralCode.mockResolvedValue(false);

    const mockRequest = {
      headers: { get: () => null },
      json: jest.fn().mockResolvedValue({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'strongPassword123!',
        referralCode: 'invalid-code',
        agreed: true,
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(400);

    const responseBody = await response.json();
    expect(responseBody.error).toBe('Invalid referral code');
  });

  test('should handle server errors gracefully', async () => {
    (validatePasswordStrength as jest.Mock).mockReturnValue({
      isValid: true,
      errors: [],
      score: 2,
      feedback: ['Great! Longer passwords are more secure'],
      strengthLevel: 'medium',
    });

    (require('@/lib/security/inputSanitizer').sanitizeUserRegistration as jest.Mock)
      .mockReturnValue({
        sanitized: { fullName: 'John Doe', email: 'john@example.com', password: 'strongPassword123!' },
        errors: [],
      });

    (createUserInSupabase as jest.Mock).mockRejectedValue('Unexpected error');

    const mockRequest = {
      headers: { get: () => null },
      json: jest.fn().mockResolvedValue({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'strongPassword123!',
        agreed: true,
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBeGreaterThanOrEqual(400);

    const responseBody = await response.json();
    expect(responseBody.error).toBeDefined();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Registration error',
      expect.objectContaining({ entryPoint: '/api/auth/register' }),
      expect.any(String)
    );
  });
});