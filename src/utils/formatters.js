import { PLATFORM, LEAD_LABELS, LEAD_SCORE } from '@/utils/constants';

/**
 * Display formatting utilities for consistent UI presentation
 * across the Social DM Copilot application
 */

/**
 * Formats a timestamp into a human-readable string
 * Shows relative time for recent timestamps, absolute date for older ones
 * @param {string|number|Date} timestamp - ISO string, Unix ms, or Date object
 * @param {object} [options]
 * @param {boolean} [options.relative=true] - Use relative time for recent timestamps
 * @param {boolean} [options.includeTime=true] - Include time in absolute format
 * @returns {string} Formatted timestamp string
 */
export function formatTimestamp(timestamp, options = {}) {
  const { relative = true, includeTime = true } = options;

  if (!timestamp) return '';

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (isNaN(date.getTime())) return '';

  if (relative) {
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 0) return 'just now';
    if (diffSeconds < 60) return 'just now';
    if (diffMinutes === 1) return '1 min ago';
    if (diffMinutes < 60) return `${diffMinutes} mins ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
  }

  const dateOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };

  if (includeTime) {
    dateOptions.hour = 'numeric';
    dateOptions.minute = '2-digit';
  }

  return date.toLocaleDateString('en-US', dateOptions);
}

/**
 * Formats a platform identifier for display with optional icon prefix
 * @param {string} platform - Platform identifier from PLATFORM constants
 * @returns {string} Formatted platform name
 */
export function formatPlatform(platform) {
  if (!platform) return '';

  switch (platform) {
    case PLATFORM.FACEBOOK:
      return 'Facebook';
    case PLATFORM.INSTAGRAM:
      return 'Instagram';
    default:
      return String(platform);
  }
}

/**
 * Formats a confidence score (0-1) as a percentage string
 * @param {number} score - Confidence score between 0 and 1
 * @param {object} [options]
 * @param {number} [options.decimals=0] - Number of decimal places
 * @param {boolean} [options.showSymbol=true] - Whether to append % symbol
 * @returns {string} Formatted confidence score
 */
export function formatConfidenceScore(score, options = {}) {
  const { decimals = 0, showSymbol = true } = options;

  if (score === null || score === undefined || isNaN(score)) return '';

  const clamped = Math.max(0, Math.min(1, score));
  const percentage = (clamped * 100).toFixed(decimals);

  return showSymbol ? `${percentage}%` : percentage;
}

/**
 * Formats a lead score (0-100) with its corresponding label
 * @param {number} score - Lead score between 0 and 100
 * @param {object} [options]
 * @param {boolean} [options.includeLabel=true] - Whether to include the Hot/Warm/Cold label
 * @returns {string} Formatted lead score string
 */
export function formatLeadScore(score, options = {}) {
  const { includeLabel = true } = options;

  if (score === null || score === undefined || isNaN(score)) return '';

  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  if (!includeLabel) return String(clamped);

  let label;
  if (clamped >= LEAD_SCORE.HOT) {
    label = LEAD_LABELS.HOT;
  } else if (clamped >= LEAD_SCORE.WARM) {
    label = LEAD_LABELS.WARM;
  } else {
    label = LEAD_LABELS.COLD;
  }

  return `${clamped} (${label})`;
}

/**
 * Truncates text to a specified length with an ellipsis
 * @param {string} text - Text to truncate
 * @param {number} [maxLength=100] - Maximum character length before truncation
 * @param {string} [suffix='…'] - Suffix to append when truncated
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100, suffix = '…') {
  if (!text) return '';

  const str = String(text);

  if (str.length <= maxLength) return str;

  return str.slice(0, maxLength).trimEnd() + suffix;
}

/**
 * Formats a number as a currency string
 * @param {number} amount - Numeric amount
 * @param {object} [options]
 * @param {string} [options.currency='USD'] - ISO 4217 currency code
 * @param {string} [options.locale='en-US'] - Locale for formatting
 * @param {number} [options.minimumFractionDigits=2] - Minimum decimal places
 * @param {number} [options.maximumFractionDigits=2] - Maximum decimal places
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, options = {}) {
  const {
    currency = 'USD',
    locale = 'en-US',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  if (amount === null || amount === undefined || isNaN(amount)) return '';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);
}