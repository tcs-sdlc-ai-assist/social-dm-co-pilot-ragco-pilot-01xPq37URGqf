import {
  addLog,
  addLogs,
  getAllLogs,
  getLogById,
  getLogsByAction,
  getLogsByUser,
  getLogsByEntity,
  getLogsByEventType,
  getLogCount,
  exportLogsAsCSV,
} from '@/repositories/audit-log-repository';
import { sanitizeInput } from '@/utils/validators';
import { stripPII } from '@/utils/pii-filter';
import { PAGINATION } from '@/utils/constants';

/**
 * Audit Log Service
 * Business logic layer for centralized audit logging
 * Implements AuditLogService from LLD (SCRUM-6536, SCRUM-6542)
 *
 * Provides:
 * - log(action, userId, details): Creates timestamped encrypted log entry with PII stripped
 * - logEntityAction(entityType, entityId, action, userId, details): Logs an action on a specific entity
 * - getAuditTrail(filters): Retrieves filtered/paginated audit logs
 * - getEntityHistory(entityType, entityId): Retrieves audit trail for a specific entity
 * - exportLogs(options): Generates CSV export of audit logs
 * - getLogCounts(entityType): Returns total log counts
 *
 * All detail fields are PII-stripped before storage
 * Simulates async latency to mimic real API behavior
 */

/**
 * Simulates network/API latency for realistic async behavior
 * @param {number} [minMs=30] - Minimum delay in milliseconds
 * @param {number} [maxMs=100] - Maximum delay in milliseconds
 * @returns {Promise<void>}
 */
function simulateLatency(minMs = 30, maxMs = 100) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Strips PII from a details object or string before logging
 * Recursively processes nested objects and arrays
 *
 * @param {*} details - Details to sanitize
 * @returns {*} PII-stripped details
 */
function sanitizeDetails(details) {
  if (details === null || details === undefined) return details;

  if (typeof details === 'string') {
    return stripPII(sanitizeInput(details));
  }

  if (Array.isArray(details)) {
    return details.map((item) => sanitizeDetails(item));
  }

  if (typeof details === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(details)) {
      if (typeof value === 'string') {
        sanitized[key] = stripPII(sanitizeInput(value));
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeDetails(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return details;
}

/**
 * Creates a timestamped, encrypted audit log entry
 * Strips PII from detail fields before storage
 *
 * @param {string} action - Action performed (e.g., 'create', 'update', 'approve', 'reject')
 * @param {string} userId - User or system identifier that performed the action
 * @param {object|string} [details] - Additional details about the action
 * @param {object} [options]
 * @param {string} [options.entityType='system'] - Type of entity being logged
 * @param {string} [options.entityId='system'] - Identifier of the entity
 * @param {string} [options.timestamp] - ISO timestamp (defaults to now)
 * @returns {Promise<object>} Saved audit log entry
 * @throws {Error} If action or userId is not provided
 */
export async function log(action, userId, details, options = {}) {
  if (!action || typeof action !== 'string') {
    throw new Error('Action is required and must be a string');
  }

  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID is required and must be a string');
  }

  const {
    entityType = 'system',
    entityId = 'system',
    timestamp,
  } = options;

  await simulateLatency();

  // Sanitize and strip PII from details
  const sanitizedDetails = sanitizeDetails(details);

  const entry = {
    entityType: sanitizeInput(entityType),
    entityId: sanitizeInput(entityId),
    action: sanitizeInput(action),
    performedBy: sanitizeInput(userId),
    details: sanitizedDetails,
    timestamp: timestamp || new Date().toISOString(),
  };

  const savedEntry = await addLog(entry);

  return savedEntry;
}

/**
 * Logs an action on a specific entity
 * Convenience wrapper around log() with explicit entity parameters
 *
 * @param {string} entityType - Type of entity (e.g., 'dm', 'draft', 'lead', 'notification')
 * @param {string} entityId - Entity identifier
 * @param {string} action - Action performed
 * @param {string} userId - User or system identifier
 * @param {object|string} [details] - Additional details
 * @returns {Promise<object>} Saved audit log entry
 * @throws {Error} If required parameters are missing
 */
export async function logEntityAction(entityType, entityId, action, userId, details) {
  if (!entityType || typeof entityType !== 'string') {
    throw new Error('Entity type is required and must be a string');
  }

  if (!entityId || typeof entityId !== 'string') {
    throw new Error('Entity ID is required and must be a string');
  }

  return log(action, userId, details, { entityType, entityId });
}

/**
 * Logs multiple actions in a single batch operation
 * Strips PII from all detail fields before storage
 *
 * @param {object[]} entries - Array of log entry objects
 * @param {string} entries[].action - Action performed
 * @param {string} entries[].performedBy - User or system identifier
 * @param {string} [entries[].entityType='system'] - Entity type
 * @param {string} [entries[].entityId='system'] - Entity identifier
 * @param {object|string} [entries[].details] - Additional details
 * @returns {Promise<object[]>} Array of saved audit log entries
 * @throws {Error} If entries is not an array or entries are invalid
 */
export async function logBatch(entries) {
  if (!Array.isArray(entries)) {
    throw new Error('Entries must be an array');
  }

  if (entries.length === 0) return [];

  await simulateLatency(50, 150);

  const sanitizedEntries = entries.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Each entry must be a non-null object');
    }

    if (!entry.action || typeof entry.action !== 'string') {
      throw new Error('Each entry must have an action string');
    }

    if (!entry.performedBy || typeof entry.performedBy !== 'string') {
      throw new Error('Each entry must have a performedBy string');
    }

    return {
      entityType: sanitizeInput(entry.entityType || 'system'),
      entityId: sanitizeInput(entry.entityId || 'system'),
      action: sanitizeInput(entry.action),
      performedBy: sanitizeInput(entry.performedBy),
      details: sanitizeDetails(entry.details),
      timestamp: entry.timestamp || new Date().toISOString(),
    };
  });

  const savedEntries = await addLogs(sanitizedEntries);

  return savedEntries;
}

/**
 * Retrieves filtered and paginated audit logs
 *
 * @param {object} [filters]
 * @param {number} [filters.page=1] - Page number (1-based)
 * @param {number} [filters.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @param {string} [filters.entityType] - Filter by entity type
 * @param {string} [filters.entityId] - Filter by entity ID
 * @param {string} [filters.action] - Filter by action
 * @param {string} [filters.performedBy] - Filter by user ID
 * @param {string} [filters.sortBy='timestamp'] - Field to sort by
 * @param {string} [filters.sortOrder='desc'] - Sort order ('asc' or 'desc')
 * @returns {Promise<{ logs: object[], total: number, page: number, pageSize: number }>}
 */
export async function getAuditTrail(filters = {}) {
  const {
    page = 1,
    pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
    entityType,
    entityId,
    action,
    performedBy,
    sortBy = 'timestamp',
    sortOrder = 'desc',
  } = filters;

  // Validate sort order
  const validSortOrders = ['asc', 'desc'];
  if (sortOrder && !validSortOrders.includes(sortOrder)) {
    throw new Error(`Invalid sort order: ${sortOrder}. Must be one of: ${validSortOrders.join(', ')}`);
  }

  await simulateLatency();

  return getAllLogs({
    page,
    pageSize,
    entityType,
    entityId,
    action,
    performedBy,
    sortBy,
    sortOrder,
  });
}

/**
 * Retrieves the audit trail for a specific entity
 *
 * @param {string} entityType - Entity type
 * @param {string} entityId - Entity identifier
 * @returns {Promise<object[]>} Array of audit log entries sorted by timestamp descending
 * @throws {Error} If entityType or entityId is missing
 */
export async function getEntityHistory(entityType, entityId) {
  if (!entityType || typeof entityType !== 'string') {
    throw new Error('Entity type is required and must be a string');
  }

  if (!entityId || typeof entityId !== 'string') {
    throw new Error('Entity ID is required and must be a string');
  }

  await simulateLatency();

  return getLogsByEntity(entityType, entityId);
}

/**
 * Retrieves audit log entries by action type
 *
 * @param {string} action - Action to filter by
 * @param {object} [options]
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @returns {Promise<{ logs: object[], total: number, page: number, pageSize: number }>}
 * @throws {Error} If action is missing
 */
export async function getLogsByActionType(action, options = {}) {
  if (!action || typeof action !== 'string') {
    throw new Error('Action is required and must be a string');
  }

  await simulateLatency();

  return getLogsByAction(action, options);
}

/**
 * Retrieves audit log entries by user
 *
 * @param {string} userId - User identifier
 * @param {object} [options]
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @returns {Promise<{ logs: object[], total: number, page: number, pageSize: number }>}
 * @throws {Error} If userId is missing
 */
export async function getUserAuditTrail(userId, options = {}) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID is required and must be a string');
  }

  await simulateLatency();

  return getLogsByUser(userId, options);
}

/**
 * Retrieves audit log entries by event type
 *
 * @param {string} eventType - Event type string (e.g., 'lead:extract', 'draft:approve')
 * @returns {Promise<object[]>} Array of audit log entries matching the event type
 * @throws {Error} If eventType is missing
 */
export async function getLogsByEvent(eventType) {
  if (!eventType || typeof eventType !== 'string') {
    throw new Error('Event type is required and must be a string');
  }

  await simulateLatency();

  return getLogsByEventType(eventType);
}

/**
 * Retrieves a single audit log entry by its ID
 *
 * @param {number|string} id - Audit log entry identifier
 * @returns {Promise<object|null>} Audit log entry or null if not found
 */
export async function getLogEntry(id) {
  if (id === undefined || id === null) return null;

  await simulateLatency(20, 60);

  return getLogById(id);
}

/**
 * Returns the total count of audit log entries, optionally filtered by entity type
 *
 * @param {string} [entityType] - Optional entity type filter
 * @returns {Promise<number>} Count of audit log entries
 */
export async function getLogCounts(entityType) {
  await simulateLatency(20, 60);

  return getLogCount(entityType);
}

/**
 * Exports audit logs as a CSV string
 * Decrypts all entries and strips PII before export
 *
 * @param {object} [options]
 * @param {string} [options.entityType] - Filter by entity type
 * @param {string} [options.action] - Filter by action
 * @param {string} [options.performedBy] - Filter by user ID
 * @returns {Promise<string>} CSV-formatted string of audit log entries
 */
export async function exportLogs(options = {}) {
  await simulateLatency(100, 300);

  const csv = await exportLogsAsCSV(options);

  return csv;
}

/**
 * Convenience method to log a DM-related action
 *
 * @param {string} dmId - DM identifier
 * @param {string} action - Action performed
 * @param {string} userId - User or system identifier
 * @param {object|string} [details] - Additional details
 * @returns {Promise<object>} Saved audit log entry
 */
export async function logDMAction(dmId, action, userId, details) {
  return logEntityAction('dm', dmId, action, userId, details);
}

/**
 * Convenience method to log a draft-related action
 *
 * @param {string} draftId - Draft identifier
 * @param {string} action - Action performed
 * @param {string} userId - User or system identifier
 * @param {object|string} [details] - Additional details
 * @returns {Promise<object>} Saved audit log entry
 */
export async function logDraftAction(draftId, action, userId, details) {
  return logEntityAction('draft', String(draftId), action, userId, details);
}

/**
 * Convenience method to log a lead-related action
 *
 * @param {string} leadId - Lead identifier
 * @param {string} action - Action performed
 * @param {string} userId - User or system identifier
 * @param {object|string} [details] - Additional details
 * @returns {Promise<object>} Saved audit log entry
 */
export async function logLeadAction(leadId, action, userId, details) {
  return logEntityAction('lead', leadId, action, userId, details);
}

/**
 * Convenience method to log a notification-related action
 *
 * @param {string} notificationId - Notification identifier
 * @param {string} action - Action performed
 * @param {string} userId - User or system identifier
 * @param {object|string} [details] - Additional details
 * @returns {Promise<object>} Saved audit log entry
 */
export async function logNotificationAction(notificationId, action, userId, details) {
  return logEntityAction('notification', String(notificationId), action, userId, details);
}

/**
 * Convenience method to log a Salesforce sync action
 *
 * @param {string} syncId - Sync operation identifier
 * @param {string} action - Action performed (e.g., 'sync', 'sync_failed')
 * @param {string} userId - User or system identifier
 * @param {object|string} [details] - Additional details
 * @returns {Promise<object>} Saved audit log entry
 */
export async function logSyncAction(syncId, action, userId, details) {
  return logEntityAction('salesforce_sync', syncId, action, userId, details);
}