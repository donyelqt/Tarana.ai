/**
 * Environment variable validation and security utilities
 * Ensures all critical environment variables are properly configured
 */

interface EnvironmentConfig {
  required: string[];
  optional: string[];
  sensitive: string[];
}

interface ValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
  errors: string[];
}

/**
 * Environment variable configurations for different contexts
 */
export const environmentConfigs = {
  production: {
    required: [
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENWEATHER_API_KEY', // Changed from NEXT_PUBLIC_
      'GOOGLE_GEMINI_API_KEY',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASS',
      'SMTP_FROM_EMAIL',
      'TOMTOM_API_KEY',
    ],
    optional: [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'REINDEX_SECRET',
      'SMTP_FROM_NAME',
    ],
    sensitive: [
      'NEXTAUTH_SECRET',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENWEATHER_API_KEY',
      'GOOGLE_GEMINI_API_KEY',
      'GOOGLE_CLIENT_SECRET',
      'SMTP_PASS',
      'REINDEX_SECRET',
    ],
  },
  development: {
    required: [
      'NEXTAUTH_SECRET',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
    optional: [
      'OPENWEATHER_API_KEY',
      'GOOGLE_GEMINI_API_KEY',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASS',
      'SMTP_FROM_EMAIL',
      'REINDEX_SECRET',
    ],
    sensitive: [
      'NEXTAUTH_SECRET',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENWEATHER_API_KEY',
      'GOOGLE_GEMINI_API_KEY',
      'GOOGLE_CLIENT_SECRET',
      'SMTP_PASS',
      'REINDEX_SECRET',
    ],
  },
} as const;

/**
 * Validate environment variables
 */
export function validateEnvironment(
  environment: 'production' | 'development' = 'development'
): ValidationResult {
  const config = environmentConfigs[environment];
  const missing: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check required variables
  for (const varName of config.required) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missing.push(varName);
      errors.push(`Required environment variable ${varName} is missing or empty`);
    }
  }

  // Check optional variables and warn if missing in production
  if (environment === 'production') {
    for (const varName of config.optional) {
      const value = process.env[varName];
      if (!value || value.trim() === '') {
        warnings.push(`Optional environment variable ${varName} is missing - some features may not work`);
      }
    }
  }

  // Validate specific variable formats
  validateSpecificVariables(errors, warnings);

  return {
    isValid: missing.length === 0 && errors.length === 0,
    missing,
    warnings,
    errors,
  };
}

/**
 * Validate specific environment variable formats
 */
function validateSpecificVariables(errors: string[], warnings: string[]): void {
  // Validate NEXTAUTH_SECRET strength
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  if (nextAuthSecret) {
    if (nextAuthSecret.length < 32) {
      errors.push('NEXTAUTH_SECRET should be at least 32 characters long');
    }
    if (!/[A-Za-z]/.test(nextAuthSecret) || !/[0-9]/.test(nextAuthSecret)) {
      warnings.push('NEXTAUTH_SECRET should contain both letters and numbers');
    }
  }

  // Validate URLs
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  if (nextAuthUrl && !isValidUrl(nextAuthUrl)) {
    errors.push('NEXTAUTH_URL must be a valid URL');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && !isValidUrl(supabaseUrl)) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL must be a valid URL');
  }

  // Validate email format
  const smtpFromEmail = process.env.SMTP_FROM_EMAIL;
  if (smtpFromEmail && !isValidEmail(smtpFromEmail)) {
    errors.push('SMTP_FROM_EMAIL must be a valid email address');
  }

  // Validate SMTP port
  const smtpPort = process.env.SMTP_PORT;
  if (smtpPort) {
    const port = parseInt(smtpPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push('SMTP_PORT must be a valid port number (1-65535)');
    }
  }
}

/**
 * Check if a string is a valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a string is a valid email
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Mask sensitive environment variables for logging
 */
export function maskSensitiveEnvVars(
  envVars: Record<string, string | undefined>,
  environment: 'production' | 'development' = 'development'
): Record<string, string> {
  const config = environmentConfigs[environment];
  const masked: Record<string, string> = {};

  for (const [key, value] of Object.entries(envVars)) {
    if (!value) {
      masked[key] = 'undefined';
    } else if (config.sensitive.includes(key as any)) {
      masked[key] = `${value.substring(0, 4)}${'*'.repeat(Math.max(0, value.length - 8))}${value.substring(Math.max(4, value.length - 4))}`;
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Get environment variable with validation
 */
export function getEnvVar(
  name: string,
  defaultValue?: string,
  required: boolean = false
): string {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    if (required) {
      throw new Error(`Required environment variable ${name} is missing`);
    }
    return defaultValue || '';
  }

  return value.trim();
}

/**
 * Initialize and validate environment on startup
 */
export function initializeEnvironment(): void {
  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const validation = validateEnvironment(environment);

  if (!validation.isValid) {
    console.error('❌ Environment validation failed:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    
    if (environment === 'production') {
      throw new Error('Critical environment variables are missing in production');
    }
  }

  if (validation.warnings.length > 0) {
    console.warn('⚠️  Environment warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  if (validation.isValid && validation.warnings.length === 0) {
    console.log('✅ Environment validation passed');
  }
}

/**
 * Runtime environment check for API routes
 */
export function checkRequiredEnvVars(requiredVars: string[]): void {
  const missing = requiredVars.filter(varName => {
    const value = process.env[varName];
    return !value || value.trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
