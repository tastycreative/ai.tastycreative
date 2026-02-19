/**
 * Validation utilities for model onboarding forms
 * Provides real-time validation for fields with clear error messages
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// ==================== STRING VALIDATION ====================

export function validateRequired(value: string | null | undefined, fieldName: string = 'This field'): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  return { isValid: true };
}

export function validateMinLength(value: string, minLength: number, fieldName: string = 'This field'): ValidationResult {
  if (value.length < minLength) {
    return { isValid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }
  return { isValid: true };
}

export function validateMaxLength(value: string, maxLength: number, fieldName: string = 'This field'): ValidationResult {
  if (value.length > maxLength) {
    return { isValid: false, error: `${fieldName} must be less than ${maxLength} characters` };
  }
  return { isValid: true };
}

// ==================== EMAIL VALIDATION ====================

export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return { isValid: true }; // Optional field
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true };
}

// ==================== URL VALIDATION ====================

export function validateUrl(url: string, platform?: string): ValidationResult {
  if (!url || url.trim().length === 0) {
    return { isValid: true }; // Optional field
  }

  try {
    const urlObj = new URL(url);
    
    // Check for valid protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'URL must start with http:// or https://' };
    }

    // Platform-specific validation
    if (platform) {
      const hostname = urlObj.hostname.toLowerCase();
      const platformChecks: Record<string, string[]> = {
        instagram: ['instagram.com', 'www.instagram.com'],
        twitter: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'],
        tiktok: ['tiktok.com', 'www.tiktok.com'],
        reddit: ['reddit.com', 'www.reddit.com'],
        onlyfans: ['onlyfans.com', 'www.onlyfans.com'],
        fansly: ['fansly.com', 'www.fansly.com'],
      };

      const allowedHosts = platformChecks[platform.toLowerCase()];
      if (allowedHosts && !allowedHosts.includes(hostname)) {
        return { isValid: false, error: `URL must be from ${platform}` };
      }
    }

    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Please enter a valid URL' };
  }
}

// ==================== USERNAME VALIDATION ====================

export function validateInstagramUsername(username: string): ValidationResult {
  if (!username || username.trim().length === 0) {
    return { isValid: false, error: 'Instagram username is required' };
  }

  // Remove @ if present
  const cleanUsername = username.replace('@', '');

  // Instagram username rules: 1-30 characters, alphanumeric + underscores and periods
  const instagramRegex = /^[a-zA-Z0-9._]{1,30}$/;
  
  if (!instagramRegex.test(cleanUsername)) {
    return { 
      isValid: false, 
      error: 'Username can only contain letters, numbers, underscores, and periods (1-30 characters)' 
    };
  }

  // Can't start or end with period
  if (cleanUsername.startsWith('.') || cleanUsername.endsWith('.')) {
    return { isValid: false, error: 'Username cannot start or end with a period' };
  }

  // Can't have consecutive periods
  if (cleanUsername.includes('..')) {
    return { isValid: false, error: 'Username cannot contain consecutive periods' };
  }

  return { isValid: true };
}

export function validateTwitterUsername(username: string): ValidationResult {
  if (!username || username.trim().length === 0) {
    return { isValid: true }; // Optional field
  }

  // Remove @ if present
  const cleanUsername = username.replace('@', '');

  // Twitter username rules: 1-15 characters, alphanumeric + underscores
  const twitterRegex = /^[a-zA-Z0-9_]{1,15}$/;
  
  if (!twitterRegex.test(cleanUsername)) {
    return { 
      isValid: false, 
      error: 'Twitter username can only contain letters, numbers, and underscores (1-15 characters)' 
    };
  }

  return { isValid: true };
}

export function validateTikTokUsername(username: string): ValidationResult {
  if (!username || username.trim().length === 0) {
    return { isValid: true }; // Optional field
  }

  // Remove @ if present
  const cleanUsername = username.replace('@', '');

  // TikTok username rules: 2-24 characters, alphanumeric + underscores and periods
  const tiktokRegex = /^[a-zA-Z0-9._]{2,24}$/;
  
  if (!tiktokRegex.test(cleanUsername)) {
    return { 
      isValid: false, 
      error: 'TikTok username can only contain letters, numbers, underscores, and periods (2-24 characters)' 
    };
  }

  return { isValid: true };
}

export function validateRedditUsername(username: string): ValidationResult {
  if (!username || username.trim().length === 0) {
    return { isValid: true }; // Optional field
  }

  // Remove u/ if present
  const cleanUsername = username.replace(/^u\//, '');

  // Reddit username rules: 3-20 characters, alphanumeric + underscores and hyphens
  const redditRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  
  if (!redditRegex.test(cleanUsername)) {
    return { 
      isValid: false, 
      error: 'Reddit username can only contain letters, numbers, underscores, and hyphens (3-20 characters)' 
    };
  }

  return { isValid: true };
}

// ==================== NUMBER VALIDATION ====================

export function validateAge(age: number | null | undefined): ValidationResult {
  if (!age) {
    return { isValid: true }; // Optional field
  }

  if (age < 18) {
    return { isValid: false, error: 'Model must be at least 18 years old' };
  }

  if (age > 100) {
    return { isValid: false, error: 'Please enter a valid age' };
  }

  return { isValid: true };
}

export function validatePrice(price: number | null | undefined, fieldName: string = 'Price'): ValidationResult {
  if (price === null || price === undefined) {
    return { isValid: true }; // Optional field
  }

  if (price < 0) {
    return { isValid: false, error: `${fieldName} cannot be negative` };
  }

  if (price > 100000) {
    return { isValid: false, error: `${fieldName} seems unreasonably high` };
  }

  return { isValid: true };
}

// ==================== ARRAY VALIDATION ====================

export function validateArrayNotEmpty<T>(array: T[] | null | undefined, fieldName: string): ValidationResult {
  if (!array || array.length === 0) {
    return { isValid: false, error: `${fieldName} must have at least one item` };
  }
  return { isValid: true };
}

// ==================== COMPOSITE VALIDATION ====================

/**
 * Validates basic info section
 */
export function validateBasicInfo(data: {
  name?: string | null;
  profileImageUrl?: string | null;
  instagramUsername?: string | null;
  type?: string | null;
  age?: string | null;
  birthday?: string | null;
  height?: string | null;
  weight?: string | null;
  ethnicity?: string | null;
  timezone?: string | null;
  modelBible?: any;
}): Record<string, ValidationResult> {
  const modelBible = data.modelBible || {};
  const clothingSizes = modelBible.clothingSizes || {};
  
  return {
    name: validateRequired(data.name || '', 'Model name'),
    profileImageUrl: validateRequired(data.profileImageUrl || '', 'Profile image'),
    instagramUsername: validateInstagramUsername(data.instagramUsername || ''),
    type: validateRequired(data.type || '', 'Model type'),
    // Optional overview fields - no validation required, just allow any string
    age: { isValid: true },
    birthday: { isValid: true },
    height: { isValid: true },
    weight: { isValid: true },
    ethnicity: { isValid: true },
    timezone: { isValid: true },
    clothingSizes: { isValid: true },
  };
}

/**
 * Validates background section
 */
export function validateBackground(data: {
  backstory?: string | null;
}): Record<string, ValidationResult> {
  return {
    backstory: data.backstory ? validateMinLength(data.backstory, 20, 'Backstory') : { isValid: true },
  };
}

/**
 * Validates content types section
 */
export function validateContentTypes(data: {
  selectedContentTypes?: string[] | null;
}): Record<string, ValidationResult> {
  return {
    contentTypes: validateArrayNotEmpty(data.selectedContentTypes, 'Content types'),
  };
}

/**
 * Validates social accounts section
 */
export function validateSocialAccounts(data: {
  onlyFansPaidUrl?: string | null;
  onlyFansFreeUrl?: string | null;
  onlyFansTvUrl?: string | null;
  fanslyUrl?: string | null;
  instagramUrl?: string | null;
  twitterUsername?: string | null;
  tiktokUsername?: string | null;
  redditUsername?: string | null;
}): Record<string, ValidationResult> {
  return {
    onlyFansPaidUrl: validateUrl(data.onlyFansPaidUrl || '', 'onlyfans'),
    onlyFansFreeUrl: validateUrl(data.onlyFansFreeUrl || '', 'onlyfans'),
    onlyFansTvUrl: validateUrl(data.onlyFansTvUrl || '', 'onlyfans'),
    fanslyUrl: validateUrl(data.fanslyUrl || '', 'fansly'),
    instagramUrl: validateUrl(data.instagramUrl || '', 'instagram'),
    twitterUsername: validateTwitterUsername(data.twitterUsername || ''),
    tiktokUsername: validateTikTokUsername(data.tiktokUsername || ''),
    redditUsername: validateRedditUsername(data.redditUsername || ''),
  };
}

/**
 * Checks if all validation results in a section are valid
 */
export function isSectionValid(validationResults: Record<string, ValidationResult>): boolean {
  return Object.values(validationResults).every(result => result.isValid);
}

/**
 * Gets all error messages from validation results
 */
export function getValidationErrors(validationResults: Record<string, ValidationResult>): string[] {
  return Object.values(validationResults)
    .filter(result => !result.isValid && result.error)
    .map(result => result.error!);
}
