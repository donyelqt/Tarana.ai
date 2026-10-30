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

  const isSendGrid = config.host === 'smtp.sendgrid.net';

  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
    connectionTimeout: isSendGrid ? 60000 : 30000, 
    socketTimeout: isSendGrid ? 60000 : 30000, 
    greetingTimeout: isSendGrid ? 30000 : 10000, 
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development',
    ...(isSendGrid && {
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
      },
    }),
  };
}
