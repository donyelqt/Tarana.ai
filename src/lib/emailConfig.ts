// Email configuration validation and setup utilities
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export function validateEmailConfig(): EmailConfig | null {
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  
  // Check if all required environment variables are present
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      console.warn(`Missing required environment variable: ${varName}`);
      return null;
    }
  }

  return {
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT!),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
    fromName: process.env.SMTP_FROM_NAME || 'Tarana.ai',
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER!,
  };
}

export function getEmailTransportConfig() {
  const config = validateEmailConfig();
  
  if (!config) {
    return null;
  }

  // SendGrid-specific optimizations
  const isSendGrid = config.host === 'smtp.sendgrid.net';

  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    // Security and reliability options
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
    // SendGrid-optimized timeouts
    connectionTimeout: isSendGrid ? 60000 : 30000, // 60s for SendGrid
    socketTimeout: isSendGrid ? 60000 : 30000, // 60s for SendGrid
    greetingTimeout: isSendGrid ? 30000 : 10000, // 30s for SendGrid
    // Enable debug logging in development
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development',
    // SendGrid-specific headers
    ...(isSendGrid && {
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
      },
    }),
  };
}
