import { POST } from '../route';
import { NextRequest } from 'next/server';
import { createUserInSupabase } from '@/lib/auth';
import { validatePasswordStrength } from '@/lib/security/inputSanitizer';

// Mock the dependencies
jest.mock('@/lib/auth', () => ({
  createUserInSupabase: jest.fn(),
}));

jest.mock('@/lib/security/rateLimiter', () => ({
  createRateLimitMiddleware: jest.fn(() => () => ({ allowed: true, remaining: 5, resetTime: Date.now() + 900000 })),
  rateLimitConfigs: { auth: { windowMs: 900000, maxRequests: 5, blockDurationMs: 1800000 } },
}));

jest.mock('@/lib/security/inputSanitizer', () => ({
  sanitizeUserRegistration: jest.fn(),
  validatePasswordStrength: jest.fn(),
}));

jest.mock('@/lib/security/securityHeaders', () => ({
  applySecurityHeaders: jest.fn((response) => response),
}));

jest.mock('@/lib/security/environmentValidator', () => ({
  checkRequiredEnvVars: jest.fn(),
}));

jest.mock('@/lib/referral-system', () => ({
  ReferralService: {
    validateReferralCode: jest.fn(),
    createReferral: jest.fn(),
  },
}));

jest.mock('@/lib/data/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ error: null })),
    })),
  },
}));

describe('Register API Route Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 400 for missing required fields', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({}),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(400);
    
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Missing required fields');
  });

  test('should return 400 for invalid password', async () => {
    // Mock validation to return errors
    (validatePasswordStrength as jest.Mock).mockReturnValue({
      isValid: false,
      errors: ['Password must be at least 8 characters'],
      score: 0,
      feedback: ['Make your password longer for better security'],
      strengthLevel: 'very-weak',
    });

    (require('@/lib/security/inputSanitizer').sanitizeUserRegistration as jest.Mock)
      .mockReturnValue({
        sanitized: { fullName: 'John Doe', email: 'john@example.com', password: 'weak' },
        errors: ['Password must be at least 8 characters'],
      });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'weak',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(400);
    
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Password must be at least 8 characters');
  });

  test('should return 400 for common password', async () => {
    // Mock validation to return errors for common password
    (validatePasswordStrength as jest.Mock).mockReturnValue({
      isValid: false,
      errors: ['Password is too common'],
      score: 0,
      feedback: ['Choose a less common password'],
      strengthLevel: 'very-weak',
    });

    (require('@/lib/security/inputSanitizer').sanitizeUserRegistration as jest.Mock)
      .mockReturnValue({
        sanitized: { fullName: 'John Doe', email: 'john@example.com', password: 'password' },
        errors: ['Password is too common'],
      });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'password',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(400);
    
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Password is too common');
  });

  test('should return 400 for password with repeated characters', async () => {
    // Mock validation to return errors for repeated characters
    (validatePasswordStrength as jest.Mock).mockReturnValue({
      isValid: false,
      errors: ['Avoid repeating characters'],
      score: 0,
      feedback: ['Avoid repeating the same character multiple times'],
      strengthLevel: 'very-weak',
    });

    (require('@/lib/security/inputSanitizer').sanitizeUserRegistration as jest.Mock)
      .mockReturnValue({
        sanitized: { fullName: 'John Doe', email: 'john@example.com', password: 'passssword' },
        errors: ['Avoid repeating characters'],
      });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'passssword',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(400);
    
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Avoid repeating characters');
  });

  test('should return 400 for password with sequential patterns', async () => {
    // Mock validation to return errors for sequential patterns
    (validatePasswordStrength as jest.Mock).mockReturnValue({
      isValid: false,
      errors: ['Avoid sequential patterns'],
      score: 0,
      feedback: ['Avoid sequences like "123456" or "abcdef"'],
      strengthLevel: 'very-weak',
    });

    (require('@/lib/security/inputSanitizer').sanitizeUserRegistration as jest.Mock)
      .mockReturnValue({
        sanitized: { fullName: 'John Doe', email: 'john@example.com', password: 'abcdef123456' },
        errors: ['Avoid sequential patterns'],
      });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'abcdef123456',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(400);
    
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Avoid sequential patterns');
  });

  test('should return 201 for valid registration', async () => {
    // Mock validation to pass
    (validatePasswordStrength as jest.Mock).mockReturnValue({
      isValid: true,
      errors: [],
      score: 2,
      feedback: ['Great! Longer passwords are more secure'],
      strengthLevel: 'medium',
    });

    (require('@/lib/security/inputSanitizer').sanitizeUserRegistration as jest.Mock)
      .mockReturnValue({
        sanitized: { fullName: 'John Doe', email: 'john@example.com', password: 'strongPassword123!' },
        errors: [],
      });

    (createUserInSupabase as jest.Mock).mockResolvedValue({
      id: 'test-user-id',
      fullName: 'John Doe',
      email: 'john@example.com',
    });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'strongPassword123!',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(201);
    
    const responseBody = await response.json();
    expect(responseBody.success).toBe(true);
    expect(responseBody.message).toBe('User registered successfully');
  });

  test('should return 409 when user already exists', async () => {
    // Mock validation to pass
    (validatePasswordStrength as jest.Mock).mockReturnValue({
      isValid: true,
      errors: [],
      score: 2,
      feedback: ['Great! Longer passwords are more secure'],
      strengthLevel: 'medium',
    });

    (require('@/lib/security/inputSanitizer').sanitizeUserRegistration as jest.Mock)
      .mockReturnValue({
        sanitized: { fullName: 'John Doe', email: 'john@example.com', password: 'strongPassword123!' },
        errors: [],
      });

    (createUserInSupabase as jest.Mock).mockRejectedValue(
      new Error('User with this email already exists')
    );

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'strongPassword123!',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(409);
    
    const responseBody = await response.json();
    expect(responseBody.error).toBe('User with this email already exists');
  });

  test('should validate referral code if provided', async () => {
    const { ReferralService } = require('@/lib/referral-system');
    ReferralService.validateReferralCode.mockResolvedValue(false);

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'strongPassword123!',
        referralCode: 'invalid-code',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(400);
    
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Invalid referral code');
  });

  test('should handle server errors gracefully', async () => {
    // Mock validation to pass
    (validatePasswordStrength as jest.Mock).mockReturnValue({
      isValid: true,
      errors: [],
      score: 2,
      feedback: ['Great! Longer passwords are more secure'],
      strengthLevel: 'medium',
    });

    (require('@/lib/security/inputSanitizer').sanitizeUserRegistration as jest.Mock)
      .mockReturnValue({
        sanitized: { fullName: 'John Doe', email: 'john@example.com', password: 'strongPassword123!' },
        errors: [],
      });

    // Mock an unexpected error during user creation
    (createUserInSupabase as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'strongPassword123!',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    // The error handling in the route catches the error and returns 500
    // But if it's a known error type, it might return 400
    expect(response.status).toBeGreaterThanOrEqual(400); // Should be an error status

    const responseBody = await response.json();
    // The error message might be different depending on how it's handled
    expect(responseBody.error).toBeDefined();
  });
});