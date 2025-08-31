// Security validation utilities

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Email validation with enhanced security checks
export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = [];
  
  // Basic email format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!email.trim()) {
    errors.push('Email is required');
  } else if (!emailRegex.test(email)) {
    errors.push('Please enter a valid email address');
  } else if (email.length > 254) {
    errors.push('Email address is too long');
  }
  
  return { isValid: errors.length === 0, errors };
};

// Enhanced password strength validation
export const validatePassword = (password: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for common weak patterns
  const commonPatterns = [
    /(.)\1{2,}/, // Repeated characters (3+ times)
    /123456|654321|qwerty|password|admin/i, // Common sequences
  ];
  
  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push('Password contains common weak patterns');
      break;
    }
  }
  
  return { isValid: errors.length === 0, errors };
};

// Rate limiting utilities
class RateLimiter {
  private attempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) { // 15 minutes
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  canAttempt(identifier: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record) {
      this.attempts.set(identifier, { count: 1, lastAttempt: now });
      return true;
    }

    // Reset if window has passed
    if (now - record.lastAttempt > this.windowMs) {
      this.attempts.set(identifier, { count: 1, lastAttempt: now });
      return true;
    }

    // Check if exceeded limit
    if (record.count >= this.maxAttempts) {
      return false;
    }

    // Increment attempt count
    this.attempts.set(identifier, { count: record.count + 1, lastAttempt: now });
    return true;
  }

  getRemainingTime(identifier: string): number {
    const record = this.attempts.get(identifier);
    if (!record || record.count < this.maxAttempts) return 0;
    
    const now = Date.now();
    const timeLeft = this.windowMs - (now - record.lastAttempt);
    return Math.max(0, timeLeft);
  }
}

// Export rate limiters for different operations
export const authRateLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts per 15 minutes
export const registrationRateLimiter = new RateLimiter(3, 60 * 60 * 1000); // 3 attempts per hour

// Security logging utilities
export const logSecurityEvent = (event: {
  type: 'auth_attempt' | 'registration_attempt' | 'suspicious_activity';
  email?: string;
  success: boolean;
  error?: string;
  userAgent?: string;
  ip?: string;
}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...event,
  };
  
  // In a production environment, this would be sent to a secure logging service
  console.log('SECURITY_EVENT:', JSON.stringify(logEntry));
  
  // Store in session storage for debugging (not recommended for production)
  try {
    const existingLogs = JSON.parse(sessionStorage.getItem('security_logs') || '[]');
    existingLogs.push(logEntry);
    // Keep only last 50 logs
    if (existingLogs.length > 50) {
      existingLogs.splice(0, existingLogs.length - 50);
    }
    sessionStorage.setItem('security_logs', JSON.stringify(existingLogs));
  } catch (error) {
    console.error('Failed to store security log:', error);
  }
};

// File validation utilities
export const validateFile = (file: File, options: {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  allowedExtensions?: string[];
}): ValidationResult => {
  const errors: string[] = [];
  const { maxSize = 10 * 1024 * 1024, allowedTypes = [], allowedExtensions = [] } = options;
  
  if (!file) {
    errors.push('File is required');
    return { isValid: false, errors };
  }
  
  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    errors.push(`File size must be less than ${maxSizeMB}MB`);
  }
  
  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed`);
  }
  
  // Check file extension
  if (allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      errors.push(`File extension must be one of: ${allowedExtensions.join(', ')}`);
    }
  }
  
  return { isValid: errors.length === 0, errors };
};
