// Note: DOMPurify import removed due to dependency issues
// Using custom HTML sanitization instead

/**
 * Comprehensive input sanitization utilities
 * Protects against XSS, SQL injection, and other input-based attacks
 */

/**
 * HTML sanitization using custom implementation
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  
  // Remove all HTML tags except safe ones
  const allowedTags = ['b', 'i', 'em', 'strong', 'p', 'br'];
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  
  return input.replace(tagRegex, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      // Keep allowed tags but strip attributes
      return `<${tagName.toLowerCase()}>`;
    }
    return ''; // Remove disallowed tags
  });
}

/**
 * Basic text sanitization - removes HTML tags and dangerous characters
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"&]/g, (char) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      };
      return entities[char] || char;
    })
    .trim();
}

/**
 * Email sanitization and validation
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';
  
  return email
    .toLowerCase()
    .trim()
    .replace(/[^\w@.-]/g, ''); // Keep only valid email characters
}

/**
 * Name sanitization - allows letters, spaces, hyphens, apostrophes
 */
export function sanitizeName(name: string): string {
  if (typeof name !== 'string') return '';
  
  return name
    .trim()
    .replace(/[^a-zA-Z\s'-]/g, '') // Keep only letters, spaces, hyphens, apostrophes
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .substring(0, 100); // Limit length
}

/**
 * URL sanitization - ensures safe URLs
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return '';
  
  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Phone number sanitization
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') return '';
  
  return phone
    .replace(/[^\d+()-\s]/g, '') // Keep only digits, +, (), -, spaces
    .trim()
    .substring(0, 20); // Limit length
}

/**
 * SQL injection prevention - escape special characters
 */
export function escapeSqlString(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input.replace(/'/g, "''"); // Escape single quotes
}

/**
 * Validate and sanitize JSON input
 */
export function sanitizeJsonInput(input: any): any {
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return sanitizeObject(parsed);
    } catch {
      return null;
    }
  }
  
  return sanitizeObject(input);
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeText(key);
      if (sanitizedKey) {
        sanitized[sanitizedKey] = sanitizeObject(value);
      }
    }
    
    return sanitized;
  }
  
  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }
  
  return obj;
}

/**
 * Password strength validation
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
  score: number;
} {
  const errors: string[] = [];
  let score = 0;
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else if (password.length >= 12) {
    score += 2;
  } else {
    score += 1;
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 1;
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else {
    score += 2;
  }
  
  // Check for common patterns
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password should not contain repeated characters');
    score -= 1;
  }
  
  if (/123|abc|qwe|password|admin/i.test(password)) {
    errors.push('Password should not contain common patterns');
    score -= 2;
  }
  
  return {
    isValid: errors.length === 0 && score >= 4,
    errors,
    score: Math.max(0, score),
  };
}

/**
 * Input length validation
 */
export function validateInputLength(
  input: string,
  minLength: number = 0,
  maxLength: number = 1000
): boolean {
  if (typeof input !== 'string') return false;
  return input.length >= minLength && input.length <= maxLength;
}

/**
 * Comprehensive input sanitization for user registration
 */
export function sanitizeUserRegistration(data: {
  fullName: string;
  email: string;
  password: string;
}): {
  sanitized: {
    fullName: string;
    email: string;
    password: string;
  };
  errors: string[];
} {
  const errors: string[] = [];
  
  const sanitizedFullName = sanitizeName(data.fullName);
  const sanitizedEmail = sanitizeEmail(data.email);
  
  if (!sanitizedFullName || sanitizedFullName.length < 2) {
    errors.push('Full name must be at least 2 characters long');
  }
  
  if (!sanitizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
    errors.push('Invalid email format');
  }
  
  const passwordValidation = validatePasswordStrength(data.password);
  if (!passwordValidation.isValid) {
    errors.push(...passwordValidation.errors);
  }
  
  return {
    sanitized: {
      fullName: sanitizedFullName,
      email: sanitizedEmail,
      password: data.password, // Keep original for hashing
    },
    errors,
  };
}
