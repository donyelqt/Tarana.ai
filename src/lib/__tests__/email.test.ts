import { sendPasswordResetEmail } from '../email';
import * as emailConfig from '../emailConfig';

// Mock nodemailer
const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({
  sendMail: mockSendMail,
}));

jest.mock('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

// Mock console methods
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation(),
};

describe('Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
  });

  afterAll(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('sendPasswordResetEmail', () => {
    const testEmail = 'test@example.com';
    const testResetUrl = 'https://tarana.ai/auth/reset-password?token=abc123';

    it('should return true and log URL when SMTP is not configured', async () => {
      // Mock no email configuration
      jest.spyOn(emailConfig, 'getEmailTransportConfig').mockReturnValue(null);
      jest.spyOn(emailConfig, 'validateEmailConfig').mockReturnValue(null);

      const result = await sendPasswordResetEmail(testEmail, testResetUrl);

      expect(result).toBe(true);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        'Password reset link (SMTP not configured):',
        testResetUrl
      );
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('should send email successfully with valid configuration', async () => {
      // Mock valid email configuration
      const mockTransportConfig = {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: { user: 'apikey', pass: 'SG.test_key' },
      };
      const mockEmailConfig = {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        user: 'apikey',
        pass: 'SG.test_key',
        fromName: 'Tarana.ai',
        fromEmail: 'noreply@tarana.ai',
      };

      jest.spyOn(emailConfig, 'getEmailTransportConfig').mockReturnValue(mockTransportConfig);
      jest.spyOn(emailConfig, 'validateEmailConfig').mockReturnValue(mockEmailConfig);
      
      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });

      const result = await sendPasswordResetEmail(testEmail, testResetUrl);

      expect(result).toBe(true);
      expect(mockCreateTransport).toHaveBeenCalledWith(mockTransportConfig);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Tarana.ai" <noreply@tarana.ai>',
        to: testEmail,
        subject: 'Reset Your Tarana.ai Password',
        html: expect.stringContaining(testResetUrl),
        text: expect.stringContaining(testResetUrl),
      });
      expect(consoleSpy.log).toHaveBeenCalledWith(
        'Password reset email sent successfully to:',
        testEmail
      );
    });

    it('should validate email content structure', async () => {
      const mockTransportConfig = {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: { user: 'apikey', pass: 'SG.test_key' },
      };
      const mockEmailConfig = {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        user: 'apikey',
        pass: 'SG.test_key',
        fromName: 'Tarana.ai',
        fromEmail: 'noreply@tarana.ai',
      };

      jest.spyOn(emailConfig, 'getEmailTransportConfig').mockReturnValue(mockTransportConfig);
      jest.spyOn(emailConfig, 'validateEmailConfig').mockReturnValue(mockEmailConfig);
      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });

      await sendPasswordResetEmail(testEmail, testResetUrl);

      const emailCall = mockSendMail.mock.calls[0][0];
      
      // Validate HTML content
      expect(emailCall.html).toContain('Tarana.ai');
      expect(emailCall.html).toContain('Reset Your Password');
      expect(emailCall.html).toContain(testResetUrl);
      expect(emailCall.html).toContain('expire in 1 hour');
      expect(emailCall.html).toContain('Reset Password');
      
      // Validate text content
      expect(emailCall.text).toContain('Reset Your Tarana.ai Password');
      expect(emailCall.text).toContain(testResetUrl);
      expect(emailCall.text).toContain('expire in 1 hour');
      expect(emailCall.text).toContain('The Tarana.ai Team');
      
      // Validate email structure
      expect(emailCall.from).toBe('"Tarana.ai" <noreply@tarana.ai>');
      expect(emailCall.to).toBe(testEmail);
      expect(emailCall.subject).toBe('Reset Your Tarana.ai Password');
    });

    it('should handle email sending errors gracefully', async () => {
      const mockTransportConfig = {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: { user: 'apikey', pass: 'SG.test_key' },
      };
      const mockEmailConfig = {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        user: 'apikey',
        pass: 'SG.test_key',
        fromName: 'Tarana.ai',
        fromEmail: 'noreply@tarana.ai',
      };

      jest.spyOn(emailConfig, 'getEmailTransportConfig').mockReturnValue(mockTransportConfig);
      jest.spyOn(emailConfig, 'validateEmailConfig').mockReturnValue(mockEmailConfig);
      
      const testError = new Error('SMTP connection failed');
      mockSendMail.mockRejectedValue(testError);

      const result = await sendPasswordResetEmail(testEmail, testResetUrl);

      expect(result).toBe(true); // Should return true to prevent email enumeration
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Error sending password reset email:',
        testError
      );
    });

    it('should handle transport creation errors', async () => {
      const mockTransportConfig = {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: { user: 'apikey', pass: 'SG.test_key' },
      };
      const mockEmailConfig = {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        user: 'apikey',
        pass: 'SG.test_key',
        fromName: 'Tarana.ai',
        fromEmail: 'noreply@tarana.ai',
      };

      jest.spyOn(emailConfig, 'getEmailTransportConfig').mockReturnValue(mockTransportConfig);
      jest.spyOn(emailConfig, 'validateEmailConfig').mockReturnValue(mockEmailConfig);
      
      mockCreateTransport.mockImplementation(() => {
        throw new Error('Transport creation failed');
      });

      const result = await sendPasswordResetEmail(testEmail, testResetUrl);

      expect(result).toBe(true); // Should return true to prevent email enumeration
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Error sending password reset email:',
        expect.any(Error)
      );
    });

    it('should handle different email configurations correctly', async () => {
      const mockTransportConfig = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user: 'test@gmail.com', pass: 'password' },
      };
      const mockEmailConfig = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: 'test@gmail.com',
        pass: 'password',
        fromName: 'Custom Name',
        fromEmail: 'custom@example.com',
      };

      jest.spyOn(emailConfig, 'getEmailTransportConfig').mockReturnValue(mockTransportConfig);
      jest.spyOn(emailConfig, 'validateEmailConfig').mockReturnValue(mockEmailConfig);
      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });

      await sendPasswordResetEmail(testEmail, testResetUrl);

      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.from).toBe('"Custom Name" <custom@example.com>');
    });
  });
});
