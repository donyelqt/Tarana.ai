import { NextRequest } from 'next/server';
import { POST as forgotPasswordPOST } from '@/app/api/auth/forgot-password/route';
import { POST as resetPasswordPOST } from '@/app/api/auth/reset-password/route';
import * as supabaseAdmin from '@/lib/data/supabaseAdmin';
import * as auth from '@/lib/auth';
import * as email from '@/lib/email/email';
import * as emailConfig from '@/lib/email/emailConfig';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Mock all dependencies
jest.mock('@/lib/data/supabaseAdmin');
jest.mock('@/lib/auth');
jest.mock('@/lib/email/email');
jest.mock('@/lib/email/emailConfig');
jest.mock('bcryptjs');
jest.mock('crypto');

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

describe('Password Reset Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    (supabaseAdmin as any).supabaseAdmin = mockSupabaseAdmin;
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    
    // Mock crypto
    (crypto.randomBytes as jest.Mock).mockReturnValue(Buffer.from('test-token-hex', 'hex'));
    
    // Mock bcrypt
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password_123');
    
    // Mock email service
    (email.sendPasswordResetEmail as jest.Mock).mockResolvedValue(true);
  });

  const createMockRequest = (body: any) => {
    return {
      json: jest.fn().mockResolvedValue(body),
    } as unknown as NextRequest;
  };

  describe('Complete Password Reset Flow', () => {
    it('should complete full password reset workflow successfully', async () => {
      const userEmail = 'test@example.com';
      const newPassword = 'newSecurePassword123';
      const mockUser = { id: 'user-123', email: userEmail };
      
      // Step 1: Request password reset
      (auth.findUserByEmailFromSupabase as jest.Mock).mockResolvedValue(mockUser);
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
      const forgotRequest = createMockRequest({ email: userEmail });
      const forgotResponse = await forgotPasswordPOST(forgotRequest);
      const forgotData = await forgotResponse.json();
      
      expect(forgotResponse.status).toBe(200);
      expect(forgotData.message).toBe('If an account with that email exists, we have sent a password reset link.');
      
      // Verify token was stored
      expect(mockSupabaseAdmin.from().update).toHaveBeenCalled();
      const forgotUpdateCalls = (mockSupabaseAdmin.from().update as jest.Mock).mock.calls;
      expect(forgotUpdateCalls.length).toBeGreaterThan(0);
      const forgotUpdateCall = forgotUpdateCalls[0][0];
      expect(forgotUpdateCall).toHaveProperty('reset_token');
      expect(forgotUpdateCall).toHaveProperty('reset_token_expiry');
      
      // Step 2: Reset password with token
      const resetToken = '746573742d746f6b656e2d686578'; // hex of 'test-token-hex'
      const mockUserWithToken = {
        id: 'user-123',
        reset_token: resetToken,
        reset_token_expiry: new Date(Date.now() + 3600000).toISOString(),
      };
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: mockUserWithToken, 
        error: null 
      });
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
      const resetRequest = createMockRequest({ 
        token: resetToken, 
        password: newPassword 
      });
      const resetResponse = await resetPasswordPOST(resetRequest);
      const resetData = await resetResponse.json();
      
      expect(resetResponse.status).toBe(200);
      expect(resetData.message).toBe('Password has been reset successfully');
      
      // Verify password was hashed and token cleared
      const resetUpdateCalls = (mockSupabaseAdmin.from().update as jest.Mock).mock.calls;
      expect(resetUpdateCalls.length).toBeGreaterThanOrEqual(2);
      const passwordUpdateCall = resetUpdateCalls[1][0];
      expect(passwordUpdateCall.hashed_password).toBe('hashed_password_123');
      expect(passwordUpdateCall.reset_token).toBeNull();
      expect(passwordUpdateCall.reset_token_expiry).toBeNull();
    });

    it('should handle token expiry correctly in workflow', async () => {
      const userEmail = 'test@example.com';
      const mockUser = { id: 'user-123', email: userEmail };
      
      // Step 1: Request password reset
      (auth.findUserByEmailFromSupabase as jest.Mock).mockResolvedValue(mockUser);
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
      const forgotRequest = createMockRequest({ email: userEmail });
      await forgotPasswordPOST(forgotRequest);
      
      // Step 2: Try to reset with expired token
      const resetToken = '746573742d746f6b656e2d686578';
      const expiredUser = {
        id: 'user-123',
        reset_token: resetToken,
        reset_token_expiry: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
      };
      
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: expiredUser, 
        error: null 
      });
      
      const resetRequest = createMockRequest({ 
        token: resetToken, 
        password: 'newPassword123' 
      });
      const resetResponse = await resetPasswordPOST(resetRequest);
      const resetData = await resetResponse.json();
      
      expect(resetResponse.status).toBe(400);
      expect(resetData.error).toBe('Reset token has expired');
    });
  });

  describe('Email Configuration Integration', () => {
    it('should handle missing email configuration gracefully', async () => {
      const userEmail = 'test@example.com';
      const mockUser = { id: 'user-123', email: userEmail };
      
      // Mock no email configuration
      (emailConfig.getEmailTransportConfig as jest.Mock).mockReturnValue(null);
      (emailConfig.validateEmailConfig as jest.Mock).mockReturnValue(null);
      
      (auth.findUserByEmailFromSupabase as jest.Mock).mockResolvedValue(mockUser);
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const request = createMockRequest({ email: userEmail });
      const response = await forgotPasswordPOST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.message).toBe('If an account with that email exists, we have sent a password reset link.');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Password reset link (SMTP not configured):',
        expect.stringContaining('reset-password?token=')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle SendGrid configuration correctly', async () => {
      const userEmail = 'test@example.com';
      const mockUser = { id: 'user-123', email: userEmail };
      
      // Mock SendGrid configuration
      const sendGridConfig = {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: { user: 'apikey', pass: 'SG.test_key' },
        connectionTimeout: 60000,
        socketTimeout: 60000,
        greetingTimeout: 30000,
        headers: { 'X-Priority': '1', 'X-MSMail-Priority': 'High' },
      };
      
      const emailConfigData = {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        user: 'apikey',
        pass: 'SG.test_key',
        fromName: 'Tarana.ai',
        fromEmail: 'noreply@tarana.ai',
      };
      
      (emailConfig.getEmailTransportConfig as jest.Mock).mockReturnValue(sendGridConfig);
      (emailConfig.validateEmailConfig as jest.Mock).mockReturnValue(emailConfigData);
      
      (auth.findUserByEmailFromSupabase as jest.Mock).mockResolvedValue(mockUser);
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
      const request = createMockRequest({ email: userEmail });
      const response = await forgotPasswordPOST(request);
      
      expect(response.status).toBe(200);
      expect(email.sendPasswordResetEmail).toHaveBeenCalledWith(
        userEmail,
        expect.stringContaining('reset-password?token=')
      );
    });
  });

  describe('Security Integration Tests', () => {
    it('should maintain security even with email failures', async () => {
      const userEmail = 'test@example.com';
      const mockUser = { id: 'user-123', email: userEmail };
      
      (auth.findUserByEmailFromSupabase as jest.Mock).mockResolvedValue(mockUser);
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
      // Mock email failure
      (email.sendPasswordResetEmail as jest.Mock).mockResolvedValue(false);
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const request = createMockRequest({ email: userEmail });
      const response = await forgotPasswordPOST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.message).toBe('If an account with that email exists, we have sent a password reset link.');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to send password reset email, but continuing for security');
      
      consoleSpy.mockRestore();
    });

    it('should prevent timing attacks between existing and non-existing users', async () => {
      // Test with non-existing user
      (auth.findUserByEmailFromSupabase as jest.Mock).mockResolvedValue(null);
      
      const request1 = createMockRequest({ email: 'nonexistent@example.com' });
      const start1 = Date.now();
      const response1 = await forgotPasswordPOST(request1);
      const time1 = Date.now() - start1;
      
      // Test with existing user
      const mockUser = { id: 'user-123', email: 'existing@example.com' };
      (auth.findUserByEmailFromSupabase as jest.Mock).mockResolvedValue(mockUser);
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
      const request2 = createMockRequest({ email: 'existing@example.com' });
      const start2 = Date.now();
      const response2 = await forgotPasswordPOST(request2);
      const time2 = Date.now() - start2;
      
      // Both should return same message
      const data1 = await response1.json();
      const data2 = await response2.json();
      
      expect(data1.message).toBe(data2.message);
      expect(response1.status).toBe(response2.status);
      
      // Timing should be similar (within reasonable bounds for testing)
      expect(Math.abs(time1 - time2)).toBeLessThan(100);
    });

    it('should ensure token cannot be reused after successful password reset', async () => {
      const resetToken = '746573742d746f6b656e2d686578';
      const newPassword = 'newPassword123';
      
      const mockUser = {
        id: 'user-123',
        reset_token: resetToken,
        reset_token_expiry: new Date(Date.now() + 3600000).toISOString(),
      };
      
      // First reset attempt - should succeed
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: mockUser, 
        error: null 
      });
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
      const request1 = createMockRequest({ token: resetToken, password: newPassword });
      const response1 = await resetPasswordPOST(request1);
      
      expect(response1.status).toBe(200);
      
      // Verify token was cleared
      const tokenClearCalls = (mockSupabaseAdmin.from().update as jest.Mock).mock.calls;
      expect(tokenClearCalls.length).toBeGreaterThan(0);
      const tokenClearCall = tokenClearCalls[0][0];
      expect(tokenClearCall.reset_token).toBeNull();
      expect(tokenClearCall.reset_token_expiry).toBeNull();
      
      // Second reset attempt with same token - should fail
      mockSupabaseAdmin.from().select().eq().single.mockResolvedValue({ 
        data: null, 
        error: { message: 'No rows returned' } 
      });
      
      const request2 = createMockRequest({ token: resetToken, password: 'anotherPassword123' });
      const response2 = await resetPasswordPOST(request2);
      const data2 = await response2.json();
      
      expect(response2.status).toBe(400);
      expect(data2.error).toBe('Invalid or expired reset token');
    });
  });

  describe('Error Recovery Integration', () => {
    it('should handle database connection failures gracefully', async () => {
      const userEmail = 'test@example.com';
      const mockUser = { id: 'user-123', email: userEmail };
      
      (auth.findUserByEmailFromSupabase as jest.Mock).mockResolvedValue(mockUser);
      (supabaseAdmin as any).supabaseAdmin = null; // Simulate connection failure
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const request = createMockRequest({ email: userEmail });
      const response = await forgotPasswordPOST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Database connection error');
      expect(consoleSpy).toHaveBeenCalledWith('Supabase admin client is not initialized.');
      
      consoleSpy.mockRestore();
    });

    it('should handle concurrent password reset requests', async () => {
      const userEmail = 'test@example.com';
      const mockUser = { id: 'user-123', email: userEmail };
      
      (auth.findUserByEmailFromSupabase as jest.Mock).mockResolvedValue(mockUser);
      mockSupabaseAdmin.from().update().eq.mockResolvedValue({ error: null });
      
      // Simulate concurrent requests
      const request1 = createMockRequest({ email: userEmail });
      const request2 = createMockRequest({ email: userEmail });
      
      const [response1, response2] = await Promise.all([
        forgotPasswordPOST(request1),
        forgotPasswordPOST(request2)
      ]);
      
      // Both should succeed
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // Both should generate tokens (last one wins in database)
      expect(mockSupabaseAdmin.from().update).toHaveBeenCalledTimes(2);
    });
  });
});
