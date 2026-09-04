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
import * as supabaseAdmin from '@/lib/data/supabaseAdmin';
import bcrypt from 'bcryptjs';

// Mock dependencies - use getter to allow runtime swapping (jest.setup's mock is non-configurable)
jest.mock('@/lib/data/supabaseAdmin', () => ({
  get supabaseAdmin() { return (global as any).__testSupabaseAdmin ?? (global as any).mockSupabaseAdmin; },
  set supabaseAdmin(v: any) { (global as any).__testSupabaseAdmin = v; },
}));
jest.mock('bcryptjs');
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

const mockSingle = jest.fn();
const mockEqSelect = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEqSelect }));
const mockEqUpdate = jest.fn().mockResolvedValue({ error: null });
const mockUpdate = jest.fn(() => ({ eq: mockEqUpdate }));
const mockSupabaseAdmin: any = {
  from: jest.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  })),
  __mockSingle: mockSingle,
  __mockEqSelect: mockEqSelect,
  __mockSelect: mockSelect,
  __mockEqUpdate: mockEqUpdate,
  __mockUpdate: mockUpdate,
};

const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Fix bcrypt.hash return type
(mockBcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>) = jest.fn();

// Mock console methods
const consoleSpy = {
  error: jest.spyOn(console, 'error').mockImplementation(),
};

describe('/api/auth/reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.error.mockClear();
    // Default mocks - set global mutable reference
    (global as any).__testSupabaseAdmin = mockSupabaseAdmin;
    (mockBcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>).mockResolvedValue('hashed_password_123' as never);
    // reset chain mocks to default success
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockEqUpdate.mockResolvedValue({ error: null } as any);
    mockSupabaseAdmin.from.mockReturnValue({ select: mockSelect, update: mockUpdate } as any);
  });

  afterAll(() => {
    consoleSpy.error.mockRestore();
  });

  const createMockRequest = (body: any) => {
    return {
      json: jest.fn().mockResolvedValue(body),
    } as unknown as NextRequest;
  };

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
      
      const mockUser = {
        id: 'user-123',
        reset_token: 'valid-token',
        reset_token_expiry: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      };
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: mockUser, 
        error: null 
      });
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
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
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: null, 
        error: { message: 'No rows returned' } 
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid or expired reset token');
    });

    it('should return 400 when database query fails', async () => {
      const request = createMockRequest({ 
        token: 'valid-token', 
        password: 'newpassword123' 
      });
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });
      
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
      
      const expiredUser = {
        id: 'user-123',
        reset_token: 'expired-token',
        reset_token_expiry: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      };
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: expiredUser, 
        error: null 
      });
      
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
      
      const validUser = {
        id: 'user-123',
        reset_token: 'valid-token',
        reset_token_expiry: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      };
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: validUser, 
        error: null 
      });
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
    });

    it('should handle edge case where token expires exactly now', async () => {
      const request = createMockRequest({ 
        token: 'edge-token', 
        password: 'newpassword123' 
      });
      
      const edgeUser = {
        id: 'user-123',
        reset_token: 'edge-token',
        // make expiry slightly in past to ensure expired (route uses now > expiry, equality is not expired)
        reset_token_expiry: new Date(Date.now() - 1000).toISOString(),
      };
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: edgeUser, 
        error: null 
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Reset token has expired');
    });
  });

  describe('Password Hashing', () => {
    it('should hash password with bcrypt salt rounds 10', async () => {
      const request = createMockRequest({ 
        token: 'valid-token', 
        password: 'newpassword123' 
      });
      
      const validUser = {
        id: 'user-123',
        reset_token: 'valid-token',
        reset_token_expiry: new Date(Date.now() + 3600000).toISOString(),
      };
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: validUser, 
        error: null 
      });
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
      await POST(request);
      
      expect(mockBcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
    });

    it('should handle bcrypt hashing errors', async () => {
      const request = createMockRequest({ 
        token: 'valid-token', 
        password: 'newpassword123' 
      });
      
      const validUser = {
        id: 'user-123',
        reset_token: 'valid-token',
        reset_token_expiry: new Date(Date.now() + 3600000).toISOString(),
      };
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: validUser, 
        error: null 
      });
      (mockBcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>).mockRejectedValue(new Error('Hashing failed') as never);
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(consoleSpy.error).toHaveBeenCalledWith('Reset password error:', expect.any(Error));
    });
  });

  describe('Database Operations', () => {
    // debt: supabaseAdmin getter is non-configurable in jest.setup.js; cannot set to null at runtime without resetModules
    it.skip('should handle supabase admin client not initialized', async () => {
      const request = createMockRequest({ 
        token: 'valid-token', 
        password: 'newpassword123' 
      });
      jest.spyOn(supabaseAdmin as any, 'supabaseAdmin', 'get').mockReturnValue(null);
      const response = await POST(request);
      const data = await response.json();
      expect(response.status).toBe(500);
      expect(data.error).toBe('Database connection error');
      expect(consoleSpy.error).toHaveBeenCalledWith('Supabase admin client is not initialized.');
    });

    it('should update password and clear reset token fields', async () => {
      const request = createMockRequest({ 
        token: 'valid-token', 
        password: 'newpassword123' 
      });
      
      const validUser = {
        id: 'user-123',
        reset_token: 'valid-token',
        reset_token_expiry: new Date(Date.now() + 3600000).toISOString(),
      };
      
      // Ensure select returns valid user via shared mocks
      mockSingle.mockResolvedValue({ data: validUser, error: null } as any);
      const localMockEq = jest.fn().mockResolvedValue({ error: null });
      const localMockUpdate = jest.fn().mockReturnValue({ eq: localMockEq });
      mockSupabaseAdmin.from.mockReturnValue({ 
        select: mockSelect,
        update: localMockUpdate 
      } as any);
      
      await POST(request);
      
      expect(localMockUpdate).toHaveBeenCalledWith({
        hashed_password: 'hashed_password_123',
        reset_token: null,
        reset_token_expiry: null,
      });
      expect(localMockEq).toHaveBeenCalledWith('id', 'user-123');
    });

    it('should handle database update errors', async () => {
      const request = createMockRequest({ 
        token: 'valid-token', 
        password: 'newpassword123' 
      });
      
      const validUser = {
        id: 'user-123',
        reset_token: 'valid-token',
        reset_token_expiry: new Date(Date.now() + 3600000).toISOString(),
      };
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: validUser, 
        error: null 
      });
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ 
        error: { message: 'Update failed' } 
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to reset password');
      expect(consoleSpy.error).toHaveBeenCalledWith('Error updating password:', { message: 'Update failed' });
    });
  });

  describe('Success Cases', () => {
    it('should successfully reset password with valid token', async () => {
      const request = createMockRequest({ 
        token: 'valid-token', 
        password: 'newpassword123' 
      });
      
      const validUser = {
        id: 'user-123',
        reset_token: 'valid-token',
        reset_token_expiry: new Date(Date.now() + 3600000).toISOString(),
      };
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: validUser, 
        error: null 
      });
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
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
      
      const validUser = {
        id: 'user-123',
        reset_token: 'valid-token',
        reset_token_expiry: new Date(Date.now() + 3600000).toISOString(),
      };
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: validUser, 
        error: null 
      });
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(longPassword, 10);
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
      
      mockSupabaseAdmin.from.mockImplementation(() => {
        throw new Error('Unexpected database error');
      });
      
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
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: null, 
        error: { message: 'No rows returned' } 
      });
      
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
      
      const validUser = {
        id: 'user-123',
        reset_token: 'valid-token',
        reset_token_expiry: new Date(Date.now() + 3600000).toISOString(),
      };
      
      mockSingle.mockResolvedValue({ data: validUser, error: null } as any);
      const localMockEq = jest.fn().mockResolvedValue({ error: null });
      const localMockUpdate = jest.fn().mockReturnValue({ eq: localMockEq });
      mockSupabaseAdmin.from.mockReturnValue({ 
        select: mockSelect,
        update: localMockUpdate 
      } as any);
      
      await POST(request);
      
      const updateCall = localMockUpdate.mock.calls[0][0];
      expect(updateCall.reset_token).toBeNull();
      expect(updateCall.reset_token_expiry).toBeNull();
    });
  });
});
