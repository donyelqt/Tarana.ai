// Polyfill for global.Response.json used by NextResponse.json (jest.setup.js overrides Response)
const MockedResponse = globalThis.Response as unknown as {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<typeof globalThis.Response> & {
    status: number;
    json(): Promise<unknown>;
  };
  json(body: unknown, init?: { status?: number; headers?: Record<string, string> }): unknown;
};
if (typeof MockedResponse.json !== 'function') {
  MockedResponse.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponse(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
}

import { NextRequest } from 'next/server';
import { POST } from '../forgot-password/route';
import * as auth from '@/lib/auth';
import * as email from '@/lib/email';
import { storeResetToken } from '@/lib/services/passwordService';
import crypto from 'crypto';
import { logger } from '@/lib/observability/logger';

jest.mock('@/lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mock dependencies — route owns token generation + email, service owns DB write
jest.mock('@/lib/services/passwordService', () => ({
  storeResetToken: jest.fn(),
}));
jest.mock('@/lib/auth');
jest.mock('@/lib/email');
jest.mock('crypto');
jest.mock('@/lib/security/rateLimiter', () => ({
  createRateLimitMiddleware: jest.fn(() => () => ({ allowed: true })),
  rateLimitConfigs: { passwordReset: { windowMs: 60000, maxRequests: 10, blockDurationMs: 60000 } },
}));
jest.mock('@/lib/security/environmentValidator', () => ({
  checkRequiredEnvVars: jest.fn(),
}));
jest.mock('@/lib/security/securityHeaders', () => ({
  applySecurityHeaders: jest.fn((r) => r),
}));
jest.mock('@/lib/security/inputSanitizer', () => ({
  sanitizeEmail: jest.fn((e: string) => e),
}));

const mockCrypto = crypto as jest.Mocked<typeof crypto>;
const mockAuth = auth as jest.Mocked<typeof auth>;
const mockEmail = email as jest.Mocked<typeof email>;
const mockStoreResetToken = storeResetToken as jest.Mock;
const mockLogger = logger as jest.Mocked<typeof logger>;


describe('/api/auth/forgot-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock environment variables
    process.env.NEXTAUTH_URL = 'http://localhost:3000';

    (mockCrypto.randomBytes as jest.Mock).mockReturnValue(Buffer.from('test-token-hex'));
    mockEmail.sendPasswordResetEmail.mockResolvedValue(true);
    mockStoreResetToken.mockResolvedValue(undefined);
  });


  const createMockRequest = (body: any) => {
    return {
      headers: { get: () => null },
      json: jest.fn().mockResolvedValue(body),
    } as unknown as NextRequest;
  };

  describe('Input Validation', () => {
    it('should return 400 when email is missing', async () => {
      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email is required');
    });

    it('should return 400 when email is empty string', async () => {
      const request = createMockRequest({ email: '' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email is required');
    });

    it('should return 400 when email is null', async () => {
      const request = createMockRequest({ email: null });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email is required');
    });
  });

  describe('Anti-enumeration Security', () => {
    it('should return success message when user does not exist', async () => {
      const request = createMockRequest({ email: 'nonexistent@example.com' });
      mockAuth.findUserByEmailFromSupabase.mockResolvedValue(null);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('If an account with that email exists, we have sent a password reset link.');
      expect(mockStoreResetToken).not.toHaveBeenCalled();
    });

    it('should not reveal whether user exists through different response times', async () => {
      const request1 = createMockRequest({ email: 'nonexistent@example.com' });
      const request2 = createMockRequest({ email: 'existing@example.com' });

      mockAuth.findUserByEmailFromSupabase
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'user-123', email: 'existing@example.com' });

      const start1 = Date.now();
      await POST(request1);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await POST(request2);
      const time2 = Date.now() - start2;

      // Response times should be similar (within reasonable bounds)
      expect(Math.abs(time1 - time2)).toBeLessThan(100);
    });
  });

  describe('Token Generation', () => {
    it('should generate secure reset token when user exists', async () => {
      const request = createMockRequest({ email: 'test@example.com' });
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockAuth.findUserByEmailFromSupabase.mockResolvedValue(mockUser);

      await POST(request);

      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
      expect(mockStoreResetToken).toHaveBeenCalledWith(
        'user-123',
        expect.any(String),
        expect.any(Date)
      );
    });

    it('should set token expiry to 1 hour from now', async () => {
      const request = createMockRequest({ email: 'test@example.com' });
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockAuth.findUserByEmailFromSupabase.mockResolvedValue(mockUser);

      const beforeCall = Date.now();
      await POST(request);
      const afterCall = Date.now();

      const expiry: Date = mockStoreResetToken.mock.calls[0][2];
      const expectedExpiry = new Date(beforeCall + 3600000); // 1 hour
      const maxExpectedExpiry = new Date(afterCall + 3600000);

      expect(expiry.getTime()).toBeGreaterThanOrEqual(expectedExpiry.getTime());
      expect(expiry.getTime()).toBeLessThanOrEqual(maxExpectedExpiry.getTime());
    });
  });

  describe('Database Operations', () => {
    it('should handle database update errors', async () => {
      const request = createMockRequest({ email: 'test@example.com' });
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockAuth.findUserByEmailFromSupabase.mockResolvedValue(mockUser);
      mockStoreResetToken.mockRejectedValue(new Error('Failed to store reset token: Database error'));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process reset request');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error storing reset token',
        expect.objectContaining({ entryPoint: '/api/auth/forgot-password' }),
        expect.any(String)
      );
    });

    it('should store reset token with correct user ID', async () => {
      const request = createMockRequest({ email: 'test@example.com' });
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockAuth.findUserByEmailFromSupabase.mockResolvedValue(mockUser);

      await POST(request);

      expect(mockStoreResetToken).toHaveBeenCalledWith(
        'user-123',
        expect.any(String),
        expect.any(Date)
      );
    });
  });

  describe('Email Sending', () => {
    it('should send password reset email with correct URL', async () => {
      const request = createMockRequest({ email: 'test@example.com' });
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockAuth.findUserByEmailFromSupabase.mockResolvedValue(mockUser);

      await POST(request);

      expect(mockEmail.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        'http://localhost:3000/auth/reset-password?token=746573742d746f6b656e2d686578'
      );
    });

    it('should continue processing even if email fails to send', async () => {
      const request = createMockRequest({ email: 'test@example.com' });
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockAuth.findUserByEmailFromSupabase.mockResolvedValue(mockUser);
      mockEmail.sendPasswordResetEmail.mockResolvedValue(false);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('If an account with that email exists, we have sent a password reset link.');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to send password reset email',
        expect.objectContaining({ entryPoint: '/api/auth/forgot-password' }),
        expect.any(String)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parsing errors', async () => {
      const request = {
        headers: { get: () => null },
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Forgot password error',
        expect.objectContaining({ entryPoint: '/api/auth/forgot-password' }),
        expect.any(String)
      );
    });

    it('should handle unexpected errors gracefully', async () => {
      const request = createMockRequest({ email: 'test@example.com' });

      mockAuth.findUserByEmailFromSupabase.mockRejectedValue(new Error('Unexpected error'));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Forgot password error',
        expect.objectContaining({ entryPoint: '/api/auth/forgot-password' }),
        expect.any(String)
      );
    });
  });

  describe('Security Best Practices', () => {
    it('should always return the same success message', async () => {
      const request1 = createMockRequest({ email: 'nonexistent@example.com' });
      const request2 = createMockRequest({ email: 'existing@example.com' });

      mockAuth.findUserByEmailFromSupabase
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'user-123', email: 'existing@example.com' });

      const response1 = await POST(request1);
      const response2 = await POST(request2);

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.message).toBe(data2.message);
      expect(data1.message).toBe('If an account with that email exists, we have sent a password reset link.');
    });

    it('should use cryptographically secure token generation', async () => {
      const request = createMockRequest({ email: 'test@example.com' });
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockAuth.findUserByEmailFromSupabase.mockResolvedValue(mockUser);

      await POST(request);

      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
    });
  });
});
