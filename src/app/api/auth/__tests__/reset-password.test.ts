import { NextRequest } from 'next/server';
import { POST } from '../reset-password/route';
import * as supabaseAdmin from '@/lib/supabaseAdmin';
import bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('@/lib/supabaseAdmin');
jest.mock('bcryptjs');

const mockSupabaseAdmin = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(),
    })),
  })),
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
    
    // Default mocks
    (supabaseAdmin as any).supabaseAdmin = mockSupabaseAdmin;
    (mockBcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>).mockResolvedValue('hashed_password_123' as never);
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
        reset_token_expiry: new Date().toISOString(), // Expires exactly now
      };
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: edgeUser, 
        error: null 
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      // Should be expired since now > tokenExpiry
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
    it('should handle supabase admin client not initialized', async () => {
      const request = createMockRequest({ 
        token: 'valid-token', 
        password: 'newpassword123' 
      });
      
      (supabaseAdmin as any).supabaseAdmin = null;
      
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
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: validUser, 
        error: null 
      });
      
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseAdmin.from.mockReturnValue({ 
        select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn() })) })),
        update: mockUpdate 
      });
      
      await POST(request);
      
      expect(mockUpdate).toHaveBeenCalledWith({
        hashed_password: 'hashed_password_123',
        reset_token: null,
        reset_token_expiry: null,
      });
      expect(mockEq).toHaveBeenCalledWith('id', 'user-123');
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
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: validUser, 
        error: null 
      });
      
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseAdmin.from.mockReturnValue({ 
        select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn() })) })),
        update: mockUpdate 
      });
      
      await POST(request);
      
      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.reset_token).toBeNull();
      expect(updateCall.reset_token_expiry).toBeNull();
    });
  });
});
