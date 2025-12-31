import { validatePasswordStrength } from '../inputSanitizer';

describe('Password Validation Tests', () => {
  describe('Valid Passwords', () => {
    test('should accept passwords with 8+ characters that are not common', () => {
      const result = validatePasswordStrength('myvalid8char');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept passwords with 12+ characters (strong)', () => {
      const result = validatePasswordStrength('mySecureRandom123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThanOrEqual(2);
    });

    test('should accept passphrase-style passwords', () => {
      const result = validatePasswordStrength('correct-horse-battery-staple');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept passwords with mixed characters (if 8+ chars)', () => {
      const result = validatePasswordStrength('MyP@ssw0rd!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept long passwords with spaces', () => {
      const result = validatePasswordStrength('this is a long secure passphrase');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Invalid Passwords', () => {
    test('should reject passwords with less than 8 characters', () => {
      const result = validatePasswordStrength('pass');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    test('should reject common passwords', () => {
      const commonPasswords = [
        'password',
        '12345678',
        'qwerty123',
        'admin123',
        'welcome1',
        'letmein1',
        'monkey123',
        'sunshine1'
      ];

      commonPasswords.forEach(pwd => {
        const result = validatePasswordStrength(pwd);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password is too common');
      });
    });

    test('should reject passwords with common patterns', () => {
      const result = validatePasswordStrength('myPassword123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is too common');
    });

    test('should reject passwords with repeated characters', () => {
      const result = validatePasswordStrength('passssword');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Avoid repeating characters');
    });

    test('should reject passwords with sequential patterns', () => {
      const result = validatePasswordStrength('abcdef123456');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Avoid sequential patterns');
    });

    test('should reject passwords with simple sequences', () => {
      const result = validatePasswordStrength('12345678');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Avoid sequential patterns');
    });

    test('should reject passwords with repeated single characters', () => {
      const result = validatePasswordStrength('aaaaaaa');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Avoid repeating characters');
    });
  });

  describe('Password Strength Scoring', () => {
    test('should give low score for invalid passwords', () => {
      const result = validatePasswordStrength('weak');
      expect(result.score).toBeLessThan(2);
    });

    test('should give score for 8-11 character valid passwords', () => {
      const result = validatePasswordStrength('longenough');
      expect(result.score).toBeGreaterThanOrEqual(1);
    });

    test('should give higher score for 12+ character valid passwords', () => {
      const result = validatePasswordStrength('thisislongenough');
      expect(result.score).toBeGreaterThanOrEqual(2);
    });

    test('should give higher score for longer passwords', () => {
      const result = validatePasswordStrength('thisisaverylongpasswordfortesting');
      expect(result.score).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Feedback Messages', () => {
    test('should provide feedback for short passwords', () => {
      const result = validatePasswordStrength('short');
      expect(result.feedback).toContain('Make your password longer for better security');
    });

    test('should provide feedback for strong passwords', () => {
      const result = validatePasswordStrength('thisisaverylongpassword');
      expect(result.feedback).toContain('Excellent! Long passwords are highly secure');
    });

    test('should provide feedback for common passwords', () => {
      const result = validatePasswordStrength('password');
      expect(result.feedback).toContain('Choose a less common password');
    });

    test('should provide feedback for repeated characters', () => {
      const result = validatePasswordStrength('passssword');
      expect(result.feedback).toContain('Avoid repeating the same character multiple times');
    });

    test('should provide feedback for sequential patterns', () => {
      const result = validatePasswordStrength('qwertyuiop');
      expect(result.feedback).toContain('Avoid sequences like "123456" or "abcdef"');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty password', () => {
      const result = validatePasswordStrength('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    test('should handle password with only spaces', () => {
      const result = validatePasswordStrength('        ');
      expect(result.isValid).toBe(false);
      // This will fail because of repeated characters (' ' repeated 8 times)
      expect(result.errors).toContain('Avoid repeating characters');
    });

    test('should handle special characters in valid passwords', () => {
      const result = validatePasswordStrength('mySpecial!@#$%^&*()Chars');
      expect(result.isValid).toBe(true);
    });

    test('should handle numeric passwords', () => {
      const result = validatePasswordStrength('123456789012');
      // Note: This will fail because '12345678' is a common pattern
      // The function checks for '12345678' in the pattern
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Avoid sequential patterns');
    });

    test('should handle single repeated character with less than 3 repetitions', () => {
      const result = validatePasswordStrength('paassword'); // Only 2 'a's in a row
      expect(result.isValid).toBe(true);
    });

    test('should reject when 3 or more characters repeat', () => {
      const result = validatePasswordStrength('passsword'); // 3 's's in a row
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Avoid repeating characters');
    });
  });

  describe('Case Sensitivity', () => {
    test('should detect common passwords regardless of case', () => {
      const result = validatePasswordStrength('PASSWORD');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is too common');
    });

    test('should detect common passwords with mixed case', () => {
      const result = validatePasswordStrength('PassWord123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is too common');
    });
  });
});