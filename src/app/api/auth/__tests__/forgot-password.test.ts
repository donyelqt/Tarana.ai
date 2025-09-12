import { NextRequest } from 'next/server';
import { POST } from '../forgot-password/route';
import * as supabaseAdmin from '@/lib/data/supabaseAdmin';
import * as auth from '@/lib/auth';
import * as email from '@/lib/email';
import crypto from 'crypto';

// Mock dependencies
jest.mock('@/lib/data/supabaseAdmin');
jest.mock('@/lib/auth');
jest.mock('@/lib/email');
jest.mock('crypto');

const mockSupabaseAdmin = {
  from: jest.fn(() => ({
    update: jest.fn(() => ({
      eq: jest.fn(),
    })),
  })),
};

const mockCrypto = crypto as jest.Mocked<typeof crypto>;
const mockAuth = auth as jest.Mocked<typeof auth>;
const mockEmail = email as jest.Mocked<typeof email>;

// Mock console methods
const consoleSpy = {
  error: jest.spyOn(console, 'error').mockImplementation(),
  warn: jest.spyOn(console, 'warn').mockImplementation(),
};

describe('/api/auth/forgot-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.error.mockClear();
    consoleSpy.warn.mockClear();
    
    // Mock environment variables
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    
    // Default mocks
    (supabaseAdmin as any).supabaseAdmin = mockSupabaseAdmin;
(mockCrypto.randomBytes as jest.Mock).mockReturnValue(Buffer.from('test-token-hex', 'hex'));
    mockEmail.sendPasswordResetEmail.mockResolvedValue(true);
  });

  afterAll(() => {
    consoleSpy.error.mockRestore();
    consoleSpy.warn.mockRestore();
  });

  const createMockRequest = (body: any) => {
    return {
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
      expect(mockSupabaseAdmin.from).not.toHaveBeenCalled();
    });

    it('should not reveal whether user exists through different response times', async () => {
      const request1 = createMockRequest({ email: 'nonexistent@example.com' });
      const request2 = createMockRequest({ email: 'existing@example.com' });
      
      mockAuth.findUserByEmailFromSupabase
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'user-123', email: 'existing@example.com' });
      
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
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
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
      await POST(request);
      
      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('users');
    });

    it('should set token expiry to 1 hour from now', async () => {
      const request = createMockRequest({ email: 'test@example.com' });
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      mockAuth.findUserByEmailFromSupabase.mockResolvedValue(mockUser);
      
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      mockSupabaseAdmin.from.mockReturnValue({ update: mockUpdate });
      
      const beforeCall = Date.now();
      await POST(request);
      const afterCall = Date.now();
      
      const updateCall = mockUpdate.mock.calls[0][0];
      const tokenExpiry = new Date(updateCall.reset_token_expiry);
      const expectedExpiry = new Date(beforeCall + 3600000); // 1 hour
      const maxExpectedExpiry = new Date(afterCall + 3600000);
      
      expect(tokenExpiry.getTime()).toBeGreaterThanOrEqual(expectedExpiry.getTime());
      expect(tokenExpiry.getTime()).toBeLessThanOrEqual(maxExpectedExpiry.getTime());
    });
  });

  describe('Database Operations', () => {
    it('should handle supabase admin client not initialized', async () => {
      const request = createMockRequest({ email: 'test@example.com' });
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      mockAuth.findUserByEmailFromSupabase.mockResolvedValue(mockUser);
      (supabaseAdmin as any).supabaseAdmin = null;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Database connection error');
      expect(consoleSpy.error).toHaveBeenCalledWith('Supabase admin client is not initialized.');
    });

    it('should handle database update errors', async () => {
      const request = createMockRequest({ email: 'test@example.com' });
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      mockAuth.findUserByEmailFromSupabase.mockResolvedValue(mockUser);
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ 
        error: { message: 'Database error' } 
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process reset request');
      expect(consoleSpy.error).toHaveBeenCalledWith('Error storing reset token:', { message: 'Database error' });
    });

    it('should store reset token with correct user ID', async () => {
      const request = createMockRequest({ email: 'test@example.com' });
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      mockAuth.findUserByEmailFromSupabase.mockResolvedValue(mockUser);
      
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseAdmin.from.mockReturnValue({ update: mockUpdate });
      
      await POST(request);
      
      expect(mockEq).toHaveBeenCalledWith('id', 'user-123');
    });
  });

  describe('Email Sending', () => {
    it('should send password reset email with correct URL', async () => {
      const request = createMockRequest({ email: 'test@example.com' });
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      mockAuth.findUserByEmailFromSupabase.mockResolvedValue(mockUser);
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
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
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      mockEmail.sendPasswordResetEmail.mockResolvedValue(false);
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.message).toBe('If an account with that email exists, we have sent a password reset link.');
      expect(consoleSpy.warn).toHaveBeenCalledWith('Failed to send password reset email, but continuing for security');
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
      expect(consoleSpy.error).toHaveBeenCalledWith('Forgot password error:', expect.any(Error));
    });

    it('should handle unexpected errors gracefully', async () => {
      const request = createMockRequest({ email: 'test@example.com' });
      
      mockAuth.findUserByEmailFromSupabase.mockRejectedValue(new Error('Unexpected error'));
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(consoleSpy.error).toHaveBeenCalledWith('Forgot password error:', expect.any(Error));
    });
  });

  describe('Security Best Practices', () => {
    it('should always return the same success message', async () => {
      const request1 = createMockRequest({ email: 'nonexistent@example.com' });
      const request2 = createMockRequest({ email: 'existing@example.com' });
      
      mockAuth.findUserByEmailFromSupabase
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'user-123', email: 'existing@example.com' });
      
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
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
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
      await POST(request);
      
      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
    });
  });
});
