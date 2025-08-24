import { validateEmailConfig, getEmailTransportConfig } from '../emailConfig';

// Mock environment variables
const mockEnv = (vars: Record<string, string | undefined>) => {
  const originalEnv = process.env;
  process.env = { ...originalEnv, ...vars };
  return () => {
    process.env = originalEnv;
  };
};

describe('Email Configuration', () => {
  let restoreEnv: () => void;

  afterEach(() => {
    if (restoreEnv) {
      restoreEnv();
    }
  });

  describe('validateEmailConfig', () => {
    it('should return null when required environment variables are missing', () => {
      restoreEnv = mockEnv({
        SMTP_HOST: undefined,
        SMTP_PORT: undefined,
        SMTP_USER: undefined,
        SMTP_PASS: undefined,
      });

      const result = validateEmailConfig();
      expect(result).toBeNull();
    });

    it('should return null when only some required variables are present', () => {
      restoreEnv = mockEnv({
        SMTP_HOST: 'smtp.sendgrid.net',
        SMTP_PORT: '587',
        SMTP_USER: undefined,
        SMTP_PASS: undefined,
      });

      const result = validateEmailConfig();
      expect(result).toBeNull();
    });

    it('should return valid config when all required variables are present', () => {
      restoreEnv = mockEnv({
        SMTP_HOST: 'smtp.sendgrid.net',
        SMTP_PORT: '587',
        SMTP_SECURE: 'false',
        SMTP_USER: 'apikey',
        SMTP_PASS: 'SG.test_api_key',
        SMTP_FROM_NAME: 'Tarana.ai',
        SMTP_FROM_EMAIL: 'noreply@tarana.ai',
      });

      const result = validateEmailConfig();
      expect(result).toEqual({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        user: 'apikey',
        pass: 'SG.test_api_key',
        fromName: 'Tarana.ai',
        fromEmail: 'noreply@tarana.ai',
      });
    });

    it('should use default values for optional fields', () => {
      restoreEnv = mockEnv({
        SMTP_HOST: 'smtp.sendgrid.net',
        SMTP_PORT: '587',
        SMTP_USER: 'apikey',
        SMTP_PASS: 'SG.test_api_key',
      });

      const result = validateEmailConfig();
      expect(result).toEqual({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        user: 'apikey',
        pass: 'SG.test_api_key',
        fromName: 'Tarana.ai',
        fromEmail: 'apikey', // Falls back to SMTP_USER
      });
    });

    it('should handle SMTP_SECURE as boolean', () => {
      restoreEnv = mockEnv({
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'test@gmail.com',
        SMTP_PASS: 'password',
      });

      const result = validateEmailConfig();
      expect(result?.secure).toBe(true);
    });
  });

  describe('getEmailTransportConfig', () => {
    it('should return null when email config is invalid', () => {
      restoreEnv = mockEnv({
        SMTP_HOST: undefined,
      });

      const result = getEmailTransportConfig();
      expect(result).toBeNull();
    });

    it('should return transport config for non-SendGrid provider', () => {
      restoreEnv = mockEnv({
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: '587',
        SMTP_USER: 'test@gmail.com',
        SMTP_PASS: 'password',
        NODE_ENV: 'development',
      });

      const result = getEmailTransportConfig();
      expect(result).toEqual({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@gmail.com',
          pass: 'password',
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 30000,
        socketTimeout: 30000,
        greetingTimeout: 10000,
        debug: true,
        logger: true,
      });
    });

    it('should return SendGrid-optimized config for SendGrid', () => {
      restoreEnv = mockEnv({
        SMTP_HOST: 'smtp.sendgrid.net',
        SMTP_PORT: '587',
        SMTP_USER: 'apikey',
        SMTP_PASS: 'SG.test_api_key',
        NODE_ENV: 'production',
      });

      const result = getEmailTransportConfig();
      expect(result).toEqual({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: 'SG.test_api_key',
        },
        tls: {
          rejectUnauthorized: true,
        },
        connectionTimeout: 60000, // SendGrid optimized
        socketTimeout: 60000, // SendGrid optimized
        greetingTimeout: 30000, // SendGrid optimized
        debug: false,
        logger: false,
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
        },
      });
    });

    it('should handle production vs development environment correctly', () => {
      restoreEnv = mockEnv({
        SMTP_HOST: 'smtp.sendgrid.net',
        SMTP_PORT: '587',
        SMTP_USER: 'apikey',
        SMTP_PASS: 'SG.test_api_key',
        NODE_ENV: 'production',
      });

      const result = getEmailTransportConfig();
      expect(result?.tls.rejectUnauthorized).toBe(true);
      expect(result?.debug).toBe(false);
      expect(result?.logger).toBe(false);
    });
  });
});
