

export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return '';

  const allowedTags = ['b', 'i', 'em', 'strong', 'p', 'br'];
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

  return input.replace(tagRegex, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      return `<${tagName.toLowerCase()}>`;
    }
    return ''; 
  });
}

export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .replace(/<[^>]*>/g, '') 
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

export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';

  return email
    .toLowerCase()
    .trim()
    .replace(/[^\w@.-]/g, ''); 
}

export function sanitizeName(name: string): string {
  if (typeof name !== 'string') return '';

  return name
    .trim()
    .replace(/[^a-zA-Z\s'-]/g, '') 
    .replace(/\s+/g, ' ') 
    .substring(0, 100); 
}

export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return '';

  try {
    const parsed = new URL(url);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }

    return parsed.toString();
  } catch {
    return '';
  }
}

export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') return '';

  return phone
    .replace(/[^\d+()-\s]/g, '') 
    .trim()
    .substring(0, 20); 
}

export function escapeSqlString(input: string): string {
  if (typeof input !== 'string') return '';

  return input.replace(/'/g, "''"); 
}

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

function calculatePasswordEntropy(password: string): number {
  if (!password) return 0;
  
  let charsetSize = 0;
  
  if (/[a-z]/.test(password)) charsetSize += 26; 
  if (/[A-Z]/.test(password)) charsetSize += 26; 
  if (/\d/.test(password)) charsetSize += 10;     
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32; 

  const entropy = password.length * Math.log2(charsetSize || 1);

  if (entropy < 10) return 0;
  if (entropy < 20) return 1;
  if (entropy < 30) return 2;
  if (entropy < 40) return 3;
  if (entropy < 50) return 4;
  if (entropy < 60) return 5;
  return 6;
}

export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
  score: number;
  feedback: string[];
  strengthLevel: 'very-weak' | 'weak' | 'medium' | 'strong' | 'very-strong';
} {
  const errors: string[] = [];
  const feedback: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
    feedback.push('Make your password longer for better security');
    return {
      isValid: false,
      errors,
      score: 0,
      feedback,
      strengthLevel: 'very-weak'
    };
  }

  if (/(.)\1{2,}/.test(password)) { 
    return {
      isValid: false,
      errors: ['Avoid repeating characters'],
      score: 0,
      feedback: ['Avoid repeating the same character multiple times'],
      strengthLevel: 'very-weak'
    };
  }

  const commonPasswords = [
    'password', 'qwerty123', 'admin123',
    'welcome1', 'letmein1', 'monkey123', 'sunshine1',
    'iloveyou', 'princess', 'rockyou', 'abc123',
    'nicole', 'daniel', 'babygirl', 'qwerty'
  ];


  if (password.toLowerCase() === 'password') {
    return {
      isValid: false,
      errors: ['Password is too common'],
      score: 0,
      feedback: ['Choose a less common password'],
      strengthLevel: 'very-weak'
    };
  }

  if (password.toLowerCase() === '12345678') {
    return {
      isValid: false,
      errors: ['Avoid sequential patterns'],
      score: 0,
      feedback: ['Avoid sequences like "123456" or "abcdef"'],
      strengthLevel: 'very-weak'
    };
  }

  const hasCommonPassword = commonPasswords.some(common =>
    password.toLowerCase().includes(common)
  );

  if (hasCommonPassword) {
    return {
      isValid: false,
      errors: ['Password is too common'],
      score: 0,
      feedback: ['Choose a less common password'],
      strengthLevel: 'very-weak'
    };
  }

  const sequentialPatternRegex = /abcdef|qwertyui|admin|welcome|123456|1234567|123456789|987654321|qwerty|qwert|asdf|zxcv/i;

  if (sequentialPatternRegex.test(password)) {
    return {
      isValid: false,
      errors: ['Avoid sequential patterns'],
      score: 0,
      feedback: ['Avoid sequences like "123456" or "abcdef"'],
      strengthLevel: 'very-weak'
    };
  }

  const lengthScore = password.length >= 14 ? 4 : 
                     password.length >= 10 ? 3 : 2;
  
  const entropyScore = calculatePasswordEntropy(password);
  const score = lengthScore + entropyScore;

  let strengthLevel: 'very-weak' | 'weak' | 'medium' | 'strong' | 'very-strong' = 'very-weak';
  if (score >= 8) strengthLevel = 'very-strong';
  else if (score >= 6) strengthLevel = 'strong';
  else if (score >= 4) strengthLevel = 'medium';
  else if (score >= 2) strengthLevel = 'weak';

  return {
    isValid: true, 
    errors: [],
    score: Math.min(10, score), 
    feedback,
    strengthLevel
  };
}

export function validateInputLength(
  input: string,
  minLength: number = 0,
  maxLength: number = 1000
): boolean {
  if (typeof input !== 'string') return false;
  return input.length >= minLength && input.length <= maxLength;
}

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
      password: data.password, 
    },
    errors,
  };
}