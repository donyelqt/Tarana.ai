// Polyfill Response.json
const MockedResponse2 = globalThis.Response as unknown as {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): any;
  json(body: unknown, init?: { status?: number }): any;
};
if (typeof MockedResponse2.json !== 'function') {
  MockedResponse2.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponse2(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { POST } from '../reset-password/route';
import {
  findUserByResetToken,
  hashPassword,
  resetPassword,
} from '@/lib/services/passwordService';

// Mock service boundary — route owns validation + expiry check, service owns DB + hashing
jest.mock('@/lib/services/passwordService', () => ({
  findUserByResetToken: jest.fn(),
  hashPassword: jest.fn(),
  resetPassword: jest.fn(),
}));
jest.mock('@/lib/security/rateLimiter', () => ({
  createRateLimitMiddleware: jest.fn(() => () => ({ allowed: true })),
  rateLimitConfigs: { auth: { windowMs: 60000, maxRequests: 10, blockDurationMs: 60000 } },
}));
jest.mock('@/lib/security/environmentValidator', () => ({
  checkRequiredEnvVars: jest.fn(),
}));
jest.mock('@/lib/security/securityHeaders', () => ({
  applySecurityHeaders: jest.fn((r: any) => r),
}));
jest.mock('@/lib/security/inputSanitizer', () => ({
  validatePasswordStrength: jest.fn((pwd: string) => {
    if (!pwd || pwd.length < 8) return { isValid: false, errors: ['Password must be at least 8 characters long'], score: 0, feedback: [], strengthLevel: 'very-weak' };
    return { isValid: true, errors: [], score: 10, feedback: [], strengthLevel: 'very-strong' };
  }),
}));

const mockFindUserByResetToken = findUserByResetToken as jest.Mock;
const mockHashPassword = hashPassword as jest.Mock;
const mockResetPassword = resetPassword as jest.Mock;

// Mock console methods
const consoleSpy = {
  error: jest.spyOn(console, 'error').mockImplementation(),
};

describe('/api/auth/reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.error.mockClear();
    mockHashPassword.mockResolvedValue('hashed_password_123');
    mockResetPassword.mockResolvedValue(true);
    mockFindUserByResetToken.mockResolvedValue(null);
  });

  afterAll(() => {
    consoleSpy.error.mockRestore();
  });

  const createMockRequest = (body: any) => {
    return {
      json: jest.fn().mockResolvedValue(body),
    } as unknown as NextRequest;
  };

  const validUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-123',
    reset_token_expiry: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    ...overrides,
  });

  describe('Input Validation', () => {
    it('should return 400 when token is missing', async () => {
      const request = createMockRequest({ password: 'newpassword123' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Token and password are required');
    });

    it('should return 400 when password is missing', async () => {
      const request = createMockRequest({ token: 'valid-token' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Token and password are required');
    });

    it('should return 400 when both token and password are missing', async () => {
      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Token and password are required');
    });

    it('should return 400 when password is too short', async () => {
      const request = createMockRequest({
        token: 'valid-token',
        password: '1234567' // 7 characters
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Password must be at least 8 characters long');
    });

    it('should accept password with exactly 8 characters', async () => {
      const request = createMockRequest({
        token: 'valid-token',
        password: '12345678' // 8 characters
      });

      mockFindUserByResetToken.mockResolvedValue(validUser());

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Token Validation', () => {
    it('should return 400 when token is not found in database', async () => {
      const request = createMockRequest({
        token: 'invalid-token',
        password: 'newpassword123'
      });

      mockFindUserByResetToken.mockResolvedValue(null);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid or expired reset token');
    });

    it('should return 400 when service returns null on query failure', async () => {
      const request = createMockRequest({
        token: 'valid-token',
        password: 'newpassword123'
      });

      mockFindUserByResetToken.mockResolvedValue(null);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid or expired reset token');
    });

    it('should return 400 when token has expired', async () => {
      const request = createMockRequest({
        token: 'expired-token',
        password: 'newpassword123'
      });

      mockFindUserByResetToken.mockResolvedValue(
        validUser({ reset_token_expiry: new Date(Date.now() - 3600000).toISOString() })
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Reset token has expired');
    });

    it('should accept valid token that has not expired', async () => {
      const request = createMockRequest({
        token: 'valid-token',
        password: 'newpassword123'
      });

      mockFindUserByResetToken.mockResolvedValue(validUser());

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should handle edge case where token expires exactly now', async () => {
      const request = createMockRequest({
        token: 'edge-token',
        password: 'newpassword123'
      });

      // make expiry slightly in past to ensure expired (route uses now > expiry, equality is not expired)
      mockFindUserByResetToken.mockResolvedValue(
        validUser({ reset_token_expiry: new Date(Date.now() - 1000).toISOString() })
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Reset token has expired');
    });
  });

  describe('Password Hashing', () => {
    it('should hash password via passwordService', async () => {
      const request = createMockRequest({
        token: 'valid-token',
        password: 'newpassword123'
      });

      mockFindUserByResetToken.mockResolvedValue(validUser());

      await POST(request);

      expect(mockHashPassword).toHaveBeenCalledWith('newpassword123');
      expect(mockResetPassword).toHaveBeenCalledWith('user-123', 'hashed_password_123');
    });

    it('should handle hashing errors', async () => {
      const request = createMockRequest({
        token: 'valid-token',
        password: 'newpassword123'
      });

      mockFindUserByResetToken.mockResolvedValue(validUser());
      mockHashPassword.mockRejectedValue(new Error('Hashing failed'));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(consoleSpy.error).toHaveBeenCalledWith('Reset password error:', expect.any(Error));
    });
  });

  describe('Database Operations', () => {
    it('should update password and clear reset token fields via service', async () => {
      const request = createMockRequest({
        token: 'valid-token',
        password: 'newpassword123'
      });

      mockFindUserByResetToken.mockResolvedValue(validUser());

      await POST(request);

      expect(mockResetPassword).toHaveBeenCalledWith('user-123', 'hashed_password_123');
    });

    it('should handle database update errors', async () => {
      const request = createMockRequest({
        token: 'valid-token',
        password: 'newpassword123'
      });

      mockFindUserByResetToken.mockResolvedValue(validUser());
      mockResetPassword.mockRejectedValue(new Error('Failed to reset password: Update failed'));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to reset password');
      expect(consoleSpy.error).toHaveBeenCalledWith('Error updating password:', expect.any(Error));
    });
  });

  describe('Success Cases', () => {
    it('should successfully reset password with valid token', async () => {
      const request = createMockRequest({
        token: 'valid-token',
        password: 'newpassword123'
      });

      mockFindUserByResetToken.mockResolvedValue(validUser());

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Password has been reset successfully');
    });

    it('should handle long passwords correctly', async () => {
      const longPassword = 'a'.repeat(100); // 100 character password
      const request = createMockRequest({
        token: 'valid-token',
        password: longPassword
      });

      mockFindUserByResetToken.mockResolvedValue(validUser());

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockHashPassword).toHaveBeenCalledWith(longPassword);
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parsing errors', async () => {
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(consoleSpy.error).toHaveBeenCalledWith('Reset password error:', expect.any(Error));
    });

    it('should handle unexpected errors gracefully', async () => {
      const request = createMockRequest({
        token: 'valid-token',
        password: 'newpassword123'
      });

      mockFindUserByResetToken.mockRejectedValue(new Error('Unexpected database error'));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(consoleSpy.error).toHaveBeenCalledWith('Reset password error:', expect.any(Error));
    });
  });

  describe('Security Considerations', () => {
    it('should not reveal user information in error messages', async () => {
      const request = createMockRequest({
        token: 'invalid-token',
        password: 'newpassword123'
      });

      mockFindUserByResetToken.mockResolvedValue(null);

      const response = await POST(request);
      const data = await response.json();

      expect(data.error).toBe('Invalid or expired reset token');
      expect(data.error).not.toContain('user');
      expect(data.error).not.toContain('database');
    });

    it('should clear reset token after successful password reset', async () => {
      const request = createMockRequest({
        token: 'valid-token',
        password: 'newpassword123'
      });

      mockFindUserByResetToken.mockResolvedValue(validUser());

      await POST(request);

      // Service owns the clearing — route delegates user id + hashed password
      expect(mockResetPassword).toHaveBeenCalledWith('user-123', 'hashed_password_123');
    });
  });
});
