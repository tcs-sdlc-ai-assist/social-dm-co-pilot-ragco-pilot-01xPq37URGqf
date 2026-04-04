import { STATUS, STATUS_LIST, PLATFORM, PLATFORM_LIST, LEAD_SCORE, SENTIMENT } from '@/utils/constants';

/**
 * Input validation and sanitization utilities
 * Provides validation for lead data, draft content, consent status,
 * and XSS prevention through input sanitization
 */

/**
 * HTML entity map for sanitization
 */
const HTML_ENTITY_MAP = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
});

const HTML_ENTITY_REGEX = /[&<>"'`/]/g;

/**
 * Sanitizes a string to prevent XSS attacks by escaping HTML entities
 * @param {string} input - Raw input string
 * @returns {string} Sanitized string with HTML entities escaped
 */
export function sanitizeInput(input) {
  if (input === null || input === undefined) return '';

  const str = String(input);

  return str.replace(HTML_ENTITY_REGEX, (char) => HTML_ENTITY_MAP[char] || char);
}

/**
 * Strips all HTML tags from a string
 * @param {string} input - Raw input string
 * @returns {string} String with HTML tags removed
 */
function stripHtmlTags(input) {
  if (!input) return '';
  return String(input).replace(/<[^>]*>/g, '');
}

/**
 * Validates that a value is a non-empty string
 * @param {*} value
 * @returns {boolean}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates that a value is a finite number within a given range
 * @param {*} value
 * @param {number} min
 * @param {number} max
 * @returns {boolean}
 */
function isNumberInRange(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Validates lead data object for completeness and correctness
 * @param {object} leadData - Lead data to validate
 * @param {string} leadData.name - Contact name
 * @param {string} [leadData.platform] - Platform identifier
 * @param {number} [leadData.score] - Lead score (0-100)
 * @param {string} [leadData.sentiment] - Sentiment label
 * @param {string} [leadData.status] - Conversation status
 * @param {string} [leadData.email] - Contact email
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
export function validateLeadData(leadData) {
  const errors = [];

  if (!leadData || typeof leadData !== 'object') {
    return { valid: false, errors: ['Lead data must be a non-null object'] };
  }

  // Name is required
  if (!isNonEmptyString(leadData.name)) {
    errors.push('Name is required and must be a non-empty string');
  } else if (leadData.name.trim().length > 200) {
    errors.push('Name must not exceed 200 characters');
  }

  // Platform validation (optional but must be valid if provided)
  if (leadData.platform !== undefined && leadData.platform !== null) {
    if (!PLATFORM_LIST.includes(leadData.platform)) {
      errors.push(`Platform must be one of: ${PLATFORM_LIST.join(', ')}`);
    }
  }

  // Score validation (optional but must be valid if provided)
  if (leadData.score !== undefined && leadData.score !== null) {
    if (!isNumberInRange(leadData.score, 0, 100)) {
      errors.push('Score must be a number between 0 and 100');
    }
  }

  // Sentiment validation (optional but must be valid if provided)
  if (leadData.sentiment !== undefined && leadData.sentiment !== null) {
    const validSentiments = Object.values(SENTIMENT);
    if (!validSentiments.includes(leadData.sentiment)) {
      errors.push(`Sentiment must be one of: ${validSentiments.join(', ')}`);
    }
  }

  // Status validation (optional but must be valid if provided)
  if (leadData.status !== undefined && leadData.status !== null) {
    if (!STATUS_LIST.includes(leadData.status)) {
      errors.push(`Status must be one of: ${STATUS_LIST.join(', ')}`);
    }
  }

  // Email validation (optional but must be valid if provided)
  if (leadData.email !== undefined && leadData.email !== null && leadData.email !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(leadData.email)) {
      errors.push('Email must be a valid email address');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates draft reply content before sending or saving
 * @param {string} content - Draft message content
 * @param {object} [options]
 * @param {number} [options.minLength=1] - Minimum content length
 * @param {number} [options.maxLength=5000] - Maximum content length
 * @param {boolean} [options.allowHtml=false] - Whether HTML tags are permitted
 * @returns {{ valid: boolean, errors: string[], sanitized: string }} Validation result with sanitized content
 */
export function validateDraftContent(content, options = {}) {
  const { minLength = 1, maxLength = 5000, allowHtml = false } = options;
  const errors = [];

  if (content === null || content === undefined) {
    return { valid: false, errors: ['Draft content is required'], sanitized: '' };
  }

  if (typeof content !== 'string') {
    return { valid: false, errors: ['Draft content must be a string'], sanitized: '' };
  }

  // Strip HTML if not allowed
  let sanitized = allowHtml ? content : stripHtmlTags(content);

  // Sanitize to prevent XSS
  sanitized = sanitizeInput(sanitized);

  const trimmed = content.trim();

  if (trimmed.length < minLength) {
    errors.push(`Draft content must be at least ${minLength} character${minLength === 1 ? '' : 's'}`);
  }

  if (trimmed.length > maxLength) {
    errors.push(`Draft content must not exceed ${maxLength} characters`);
  }

  // Check for potentially malicious patterns
  const scriptPattern = /<script[\s>]/i;
  const eventHandlerPattern = /\bon\w+\s*=/i;

  if (scriptPattern.test(content)) {
    errors.push('Draft content must not contain script tags');
  }

  if (eventHandlerPattern.test(content)) {
    errors.push('Draft content must not contain inline event handlers');
  }

  return { valid: errors.length === 0, errors, sanitized };
}

/**
 * Validates consent status for GDPR/privacy compliance
 * @param {object} consentData - Consent data to validate
 * @param {boolean} consentData.hasConsent - Whether the contact has given consent
 * @param {string|number|Date} [consentData.consentDate] - Date consent was given
 * @param {string} [consentData.consentSource] - Source of consent (e.g., 'dm', 'form', 'manual')
 * @param {string} [consentData.contactId] - Associated contact identifier
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
export function validateConsentStatus(consentData) {
  const errors = [];

  if (!consentData || typeof consentData !== 'object') {
    return { valid: false, errors: ['Consent data must be a non-null object'] };
  }

  // hasConsent is required and must be a boolean
  if (typeof consentData.hasConsent !== 'boolean') {
    errors.push('hasConsent must be a boolean value');
  }

  // consentDate validation (required when hasConsent is true)
  if (consentData.hasConsent === true) {
    if (!consentData.consentDate) {
      errors.push('consentDate is required when consent is given');
    } else {
      const date = consentData.consentDate instanceof Date
        ? consentData.consentDate
        : new Date(consentData.consentDate);

      if (isNaN(date.getTime())) {
        errors.push('consentDate must be a valid date');
      } else if (date.getTime() > Date.now()) {
        errors.push('consentDate must not be in the future');
      }
    }

    // consentSource validation (required when hasConsent is true)
    if (!isNonEmptyString(consentData.consentSource)) {
      errors.push('consentSource is required when consent is given');
    } else {
      const validSources = ['dm', 'form', 'manual', 'import', 'api'];
      if (!validSources.includes(consentData.consentSource)) {
        errors.push(`consentSource must be one of: ${validSources.join(', ')}`);
      }
    }
  }

  // contactId validation (optional but must be valid if provided)
  if (consentData.contactId !== undefined && consentData.contactId !== null) {
    if (!isNonEmptyString(consentData.contactId)) {
      errors.push('contactId must be a non-empty string when provided');
    }
  }

  return { valid: errors.length === 0, errors };
}