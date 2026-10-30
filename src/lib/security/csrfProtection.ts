import { NextRequest } from 'next/server';
import crypto from 'crypto';


interface CSRFTokenData {
  token: string;
  timestamp: number;
  userAgent: string;
}

export function generateCSRFToken(userAgent: string = ''): string {
  const tokenData: CSRFTokenData = {
    token: crypto.randomBytes(32).toString('hex'),
    timestamp: Date.now(),
    userAgent: userAgent.substring(0, 100), 
  };
  
  const payload = Buffer.from(JSON.stringify(tokenData)).toString('base64');
  const signature = crypto
    .createHmac('sha256', process.env.NEXTAUTH_SECRET || 'fallback-secret')
    .update(payload)
    .digest('hex');
  
  return `${payload}.${signature}`;
}

export function validateCSRFToken(
  token: string,
  userAgent: string = '',
  maxAge: number = 3600000 
): boolean {
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return false;
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.NEXTAUTH_SECRET || 'fallback-secret')
      .update(payload)
      .digest('hex');
    
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
      return false;
    }
    
    const tokenData: CSRFTokenData = JSON.parse(Buffer.from(payload, 'base64').toString());
    
    if (Date.now() - tokenData.timestamp > maxAge) {
      return false;
    }
    
    if (tokenData.userAgent && userAgent && tokenData.userAgent !== userAgent.substring(0, 100)) {
      console.warn('CSRF token user agent mismatch');
    }
    
    return true;
  } catch (error) {
    console.error('CSRF token validation error:', error);
    return false;
  }
}

export function validateCSRFMiddleware(request: NextRequest): {
  isValid: boolean;
  error?: string;
} {
  const method = request.method;
  
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { isValid: true };
  }
  
  const csrfToken = request.headers.get('x-csrf-token') || request.headers.get('csrf-token');
  const userAgent = request.headers.get('user-agent') || '';
  
  if (!csrfToken) {
    return {
      isValid: false,
      error: 'CSRF token missing',
    };
  }
  
  if (!validateCSRFToken(csrfToken, userAgent)) {
    return {
      isValid: false,
      error: 'Invalid CSRF token',
    };
  }
  
  return { isValid: true };
}
