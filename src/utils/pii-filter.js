import { sanitizeInput } from '@/utils/validators';

/**
 * PII (Personally Identifiable Information) filtering utility
 * Removes or masks sensitive data from strings before logging
 * or display in non-secure contexts
 * Supports email, phone, SSN, and name pattern detection
 */

/**
 * Default mask character used to replace PII content
 */
const MASK_CHAR = '•';

/**
 * Default mask string for replaced PII values
 */
const MASKED_EMAIL = '[email redacted]';
const MASKED_PHONE = '[phone redacted]';
const MASKED_SSN = '[SSN redacted]';
const MASKED_CREDIT_CARD = '[card redacted]';

/**
 * Regex patterns for detecting common PII types
 */
const PII_PATTERNS = Object.freeze({
  // Email addresses: user@domain.tld
  EMAIL: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,

  // Phone numbers: various formats including international
  // Matches: +1 (555) 123-4567, 555-123-4567, (555) 123 4567, +44 20 7946 0958, 5551234567
  PHONE: /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}\b/g,

  // US Social Security Numbers: 123-45-6789 or 123 45 6789
  SSN: /\b\d{3}[\s-]\d{2}[\s-]\d{4}\b/g,

  // Credit card numbers: 16 digits with optional separators
  CREDIT_CARD: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
});

/**
 * Common name prefixes and titles used for name detection
 */
const NAME_PREFIXES = [
  'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'sir', 'madam',
];

/**
 * Regex for detecting name patterns preceded by common prefixes/titles
 * Matches: "Mr. John Smith", "Dr. Jane Doe", "Mrs. Alice Johnson"
 */
const NAME_WITH_PREFIX_PATTERN = new RegExp(
  `\\b(?:${NAME_PREFIXES.join('|')})\\.?\\s+[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*\\b`,
  'gi'
);

/**
 * Masks an email address, preserving structure hint
 * e.g., "user@example.com" → "[email redacted]"
 * @param {string} email - Email address to mask
 * @returns {string} Masked email
 */
function maskEmail(email) {
  return MASKED_EMAIL;
}

/**
 * Masks a phone number
 * @param {string} phone - Phone number to mask
 * @returns {string} Masked phone
 */
function maskPhone(phone) {
  return MASKED_PHONE;
}

/**
 * Masks a Social Security Number
 * @param {string} ssn - SSN to mask
 * @returns {string} Masked SSN
 */
function maskSSN(ssn) {
  return MASKED_SSN;
}

/**
 * Masks a credit card number
 * @param {string} card - Credit card number to mask
 * @returns {string} Masked credit card
 */
function maskCreditCard(card) {
  return MASKED_CREDIT_CARD;
}

/**
 * Partially masks a name, showing only the first initial
 * e.g., "Mr. John Smith" → "Mr. J•••• S••••"
 * @param {string} nameMatch - Full name match including prefix
 * @returns {string} Partially masked name
 */
function maskName(nameMatch) {
  return nameMatch.replace(/\b([A-Z])[a-z]+/g, (word, initial) => {
    return initial + MASK_CHAR.repeat(4);
  });
}

/**
 * Strips or masks all detected PII from a text string
 * Processes emails, phone numbers, SSNs, credit cards, and name patterns
 *
 * @param {string} text - Input text potentially containing PII
 * @param {object} [options]
 * @param {boolean} [options.maskEmails=true] - Whether to mask email addresses
 * @param {boolean} [options.maskPhones=true] - Whether to mask phone numbers
 * @param {boolean} [options.maskSSNs=true] - Whether to mask Social Security Numbers
 * @param {boolean} [options.maskCreditCards=true] - Whether to mask credit card numbers
 * @param {boolean} [options.maskNames=true] - Whether to mask name patterns with titles
 * @returns {string} Text with PII removed or masked
 */
export function stripPII(text, options = {}) {
  const {
    maskEmails = true,
    maskPhones = true,
    maskSSNs = true,
    maskCreditCards = true,
    maskNames = true,
  } = options;

  if (text === null || text === undefined) return '';

  if (typeof text !== 'string') {
    text = String(text);
  }

  if (text.trim().length === 0) return text;

  let result = text;

  // Order matters: process more specific patterns first to avoid
  // partial matches from broader patterns

  // Mask SSNs before phone numbers (SSN pattern is more specific)
  if (maskSSNs) {
    result = result.replace(PII_PATTERNS.SSN, maskSSN);
  }

  // Mask credit card numbers before phone numbers
  if (maskCreditCards) {
    result = result.replace(PII_PATTERNS.CREDIT_CARD, maskCreditCard);
  }

  // Mask email addresses
  if (maskEmails) {
    result = result.replace(PII_PATTERNS.EMAIL, maskEmail);
  }

  // Mask phone numbers
  if (maskPhones) {
    result = result.replace(PII_PATTERNS.PHONE, maskPhone);
  }

  // Mask names with recognized prefixes/titles
  if (maskNames) {
    result = result.replace(NAME_WITH_PREFIX_PATTERN, maskName);
  }

  return result;
}

/**
 * Checks whether a text string contains any detectable PII
 * Useful for pre-screening before logging or external transmission
 *
 * @param {string} text - Input text to check
 * @returns {{ hasPII: boolean, types: string[] }} Detection result with list of PII types found
 */
export function detectPII(text) {
  const types = [];

  if (text === null || text === undefined || typeof text !== 'string') {
    return { hasPII: false, types };
  }

  if (text.trim().length === 0) {
    return { hasPII: false, types };
  }

  // Reset regex lastIndex for global patterns
  PII_PATTERNS.EMAIL.lastIndex = 0;
  PII_PATTERNS.PHONE.lastIndex = 0;
  PII_PATTERNS.SSN.lastIndex = 0;
  PII_PATTERNS.CREDIT_CARD.lastIndex = 0;
  NAME_WITH_PREFIX_PATTERN.lastIndex = 0;

  if (PII_PATTERNS.EMAIL.test(text)) {
    types.push('email');
  }

  PII_PATTERNS.SSN.lastIndex = 0;
  if (PII_PATTERNS.SSN.test(text)) {
    types.push('ssn');
  }

  PII_PATTERNS.CREDIT_CARD.lastIndex = 0;
  if (PII_PATTERNS.CREDIT_CARD.test(text)) {
    types.push('creditCard');
  }

  PII_PATTERNS.PHONE.lastIndex = 0;
  if (PII_PATTERNS.PHONE.test(text)) {
    types.push('phone');
  }

  NAME_WITH_PREFIX_PATTERN.lastIndex = 0;
  if (NAME_WITH_PREFIX_PATTERN.test(text)) {
    types.push('name');
  }

  return { hasPII: types.length > 0, types };
}

/**
 * Sanitizes and strips PII from text in a single pass
 * Combines XSS sanitization with PII filtering for safe logging
 *
 * @param {string} text - Raw input text
 * @param {object} [options] - Options passed to stripPII
 * @returns {string} Sanitized and PII-free text
 */
export function sanitizeAndStripPII(text, options = {}) {
  if (text === null || text === undefined) return '';

  const sanitized = sanitizeInput(text);
  return stripPII(sanitized, options);
}