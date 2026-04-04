/**
 * Application-wide constants and enumerations
 * Used across the Social DM Copilot application
 */

// Conversation status tags
export const STATUS = Object.freeze({
  NEW: 'New',
  DRAFTED: 'Drafted',
  SENT: 'Sent',
  ESCALATED: 'Escalated',
});

export const STATUS_LIST = Object.freeze([
  STATUS.NEW,
  STATUS.DRAFTED,
  STATUS.SENT,
  STATUS.ESCALATED,
]);

// Supported social media platforms
export const PLATFORM = Object.freeze({
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
});

export const PLATFORM_LIST = Object.freeze([
  PLATFORM.FACEBOOK,
  PLATFORM.INSTAGRAM,
]);

// AI confidence threshold for reply suggestions
export const CONFIDENCE_THRESHOLD =
  parseFloat(process.env.NEXT_PUBLIC_CONFIDENCE_THRESHOLD) || 0.7;

// SLA response time target in minutes
export const SLA_MINUTES =
  parseInt(process.env.NEXT_PUBLIC_SLA_MINUTES, 10) || 30;

// SLA timeout in milliseconds
export const SLA_TIMEOUT_MS = SLA_MINUTES * 60 * 1000;

// Lead score thresholds
export const LEAD_SCORE = Object.freeze({
  HOT: 80,
  WARM: 50,
  COLD: 0,
});

export const LEAD_LABELS = Object.freeze({
  HOT: 'Hot',
  WARM: 'Warm',
  COLD: 'Cold',
});

/**
 * Returns the lead label based on a numeric score
 * @param {number} score - Lead score (0-100)
 * @returns {string} Lead label
 */
export function getLeadLabel(score) {
  if (score >= LEAD_SCORE.HOT) return LEAD_LABELS.HOT;
  if (score >= LEAD_SCORE.WARM) return LEAD_LABELS.WARM;
  return LEAD_LABELS.COLD;
}

// User role definitions
export const ROLE = Object.freeze({
  ADMIN: 'admin',
  AGENT: 'agent',
  VIEWER: 'viewer',
});

export const ROLE_LIST = Object.freeze([
  ROLE.ADMIN,
  ROLE.AGENT,
  ROLE.VIEWER,
]);

// Application event types for internal pub/sub and logging
export const EVENT_TYPE = Object.freeze({
  CONVERSATION_CREATED: 'conversation:created',
  CONVERSATION_UPDATED: 'conversation:updated',
  CONVERSATION_ESCALATED: 'conversation:escalated',
  MESSAGE_RECEIVED: 'message:received',
  MESSAGE_SENT: 'message:sent',
  REPLY_DRAFTED: 'reply:drafted',
  REPLY_APPROVED: 'reply:approved',
  REPLY_EDITED: 'reply:edited',
  SLA_WARNING: 'sla:warning',
  SLA_BREACHED: 'sla:breached',
  LEAD_SCORE_UPDATED: 'lead:score_updated',
  SYNC_STARTED: 'sync:started',
  SYNC_COMPLETED: 'sync:completed',
  SYNC_FAILED: 'sync:failed',
});

// IndexedDB and localStorage storage keys
export const STORAGE_KEY = Object.freeze({
  DB_NAME: 'social-dm-copilot',
  DB_VERSION: 1,
  STORE_CONVERSATIONS: 'conversations',
  STORE_MESSAGES: 'messages',
  STORE_CONTACTS: 'contacts',
  STORE_TEMPLATES: 'templates',
  STORE_AUDIT_LOG: 'auditLog',
  LOCAL_AUTH_TOKEN: 'sdmc_auth_token',
  LOCAL_USER_PREFS: 'sdmc_user_prefs',
  LOCAL_LAST_SYNC: 'sdmc_last_sync',
  LOCAL_ENCRYPTION_KEY: 'sdmc_encryption_key',
});

// Application name from environment
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Social DM Copilot';

// Encryption key seed from environment
export const ENCRYPTION_KEY_SEED =
  process.env.NEXT_PUBLIC_ENCRYPTION_KEY_SEED || '';

// Pagination defaults
export const PAGINATION = Object.freeze({
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
});

// Sentiment labels used for message analysis
export const SENTIMENT = Object.freeze({
  POSITIVE: 'positive',
  NEUTRAL: 'neutral',
  NEGATIVE: 'negative',
});