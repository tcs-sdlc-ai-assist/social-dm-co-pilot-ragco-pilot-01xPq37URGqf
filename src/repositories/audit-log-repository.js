import { openDB, STORES } from '@/repositories/db';
import { PAGINATION } from '@/utils/constants';
import { encrypt, decrypt } from '@/utils/encryption';
import { sanitizeInput } from '@/utils/validators';
import { stripPII } from '@/utils/pii-filter';

/**
 * Audit log data access layer
 * Provides append-only operations for audit logs in IndexedDB
 * Encrypts sensitive log entry details before storage
 * Implements AuditLogRepository from LLD
 */

/**
 * Fields that contain potentially sensitive content and should be encrypted at rest
 */
const SENSITIVE_FIELDS = ['details'];

/**
 * Valid entity types for audit log entries
 */
const ENTITY_TYPE = Object.freeze({
  LEAD: 'lead',
  NOTIFICATION: 'notification',
  SALESFORCE_SYNC: 'salesforce_sync',
  DM: 'dm',
  DRAFT: 'draft',
});

const ENTITY_TYPE_LIST = Object.freeze(Object.values(ENTITY_TYPE));

/**
 * Valid action types for audit log entries
 */
const ACTION_TYPE = Object.freeze({
  EXTRACT: 'extract',
  SCORE: 'score',
  SYNC: 'sync',
  SYNC_FAILED: 'sync_failed',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  ESCALATE: 'escalate',
  APPROVE: 'approve',
  REJECT: 'reject',
  SEND: 'send',
  ACKNOWLEDGE: 'acknowledge',
});

const ACTION_TYPE_LIST = Object.freeze(Object.values(ACTION_TYPE));

/**
 * Encrypts sensitive fields on an audit log entry before storage
 * @param {object} entry - Audit log entry to encrypt
 * @returns {Promise<object>} Entry with sensitive fields encrypted
 */
async function encryptSensitiveFields(entry) {
  if (!entry) return entry;

  const encrypted = { ...entry };

  for (const field of SENSITIVE_FIELDS) {
    if (encrypted[field] !== undefined && encrypted[field] !== null) {
      try {
        const value = typeof encrypted[field] === 'string'
          ? encrypted[field]
          : JSON.stringify(encrypted[field]);
        encrypted[field] = await encrypt(value);
        encrypted[`_${field}_encrypted`] = true;
      } catch {
        console.warn(`[audit-log-repository] Failed to encrypt field: ${field}`);
        encrypted[`_${field}_encrypted`] = false;
      }
    }
  }

  return encrypted;
}

/**
 * Decrypts sensitive fields on an audit log entry after retrieval
 * @param {object} entry - Audit log entry with potentially encrypted fields
 * @returns {Promise<object>} Entry with sensitive fields decrypted
 */
async function decryptSensitiveFields(entry) {
  if (!entry) return entry;

  const decrypted = { ...entry };

  for (const field of SENSITIVE_FIELDS) {
    if (decrypted[`_${field}_encrypted`] === true && decrypted[field]) {
      try {
        const plaintext = await decrypt(decrypted[field]);
        // Attempt to parse as JSON; fall back to string
        try {
          decrypted[field] = JSON.parse(plaintext);
        } catch {
          decrypted[field] = plaintext;
        }
      } catch {
        console.warn(`[audit-log-repository] Failed to decrypt field: ${field}`);
      }
    }
    // Clean up encryption metadata from returned object
    delete decrypted[`_${field}_encrypted`];
  }

  return decrypted;
}

/**
 * Appends a new audit log entry to IndexedDB
 * Audit logs are append-only — entries cannot be updated or deleted
 * Strips PII from details before encryption and storage
 *
 * @param {object} entry - Audit log entry to add
 * @param {string} entry.entityType - Type of entity being logged (lead, notification, salesforce_sync, dm, draft)
 * @param {string} entry.entityId - Identifier of the entity
 * @param {string} entry.action - Action performed
 * @param {string} entry.performedBy - User or system identifier that performed the action
 * @param {object|string} [entry.details] - Additional details about the action
 * @param {string} [entry.timestamp] - ISO timestamp (defaults to now)
 * @returns {Promise<object>} Saved audit log entry with auto-generated ID
 */
export async function addLog(entry) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('Audit log entry must be a non-null object');
  }

  if (!entry.entityType || typeof entry.entityType !== 'string') {
    throw new Error('Audit log entry must have an entityType');
  }

  if (!entry.entityId || typeof entry.entityId !== 'string') {
    throw new Error('Audit log entry must have an entityId');
  }

  if (!entry.action || typeof entry.action !== 'string') {
    throw new Error('Audit log entry must have an action');
  }

  if (!entry.performedBy || typeof entry.performedBy !== 'string') {
    throw new Error('Audit log entry must have a performedBy value');
  }

  // Sanitize string fields
  const sanitizedEntry = { ...entry };
  sanitizedEntry.entityType = sanitizeInput(sanitizedEntry.entityType);
  sanitizedEntry.entityId = sanitizeInput(sanitizedEntry.entityId);
  sanitizedEntry.action = sanitizeInput(sanitizedEntry.action);
  sanitizedEntry.performedBy = sanitizeInput(sanitizedEntry.performedBy);

  // Strip PII from details before storage
  if (sanitizedEntry.details !== undefined && sanitizedEntry.details !== null) {
    if (typeof sanitizedEntry.details === 'string') {
      sanitizedEntry.details = stripPII(sanitizedEntry.details);
    } else if (typeof sanitizedEntry.details === 'object') {
      // Strip PII from string values within the details object
      const strippedDetails = {};
      for (const [key, value] of Object.entries(sanitizedEntry.details)) {
        if (typeof value === 'string') {
          strippedDetails[key] = stripPII(value);
        } else {
          strippedDetails[key] = value;
        }
      }
      sanitizedEntry.details = strippedDetails;
    }
  }

  // Set timestamp
  sanitizedEntry.timestamp = sanitizedEntry.timestamp || new Date().toISOString();

  // Set event type for index compatibility
  sanitizedEntry.eventType = `${sanitizedEntry.entityType}:${sanitizedEntry.action}`;

  // Encrypt sensitive fields
  const encryptedEntry = await encryptSensitiveFields(sanitizedEntry);

  const db = await openDB();
  const tx = db.transaction(STORES.AUDIT_LOGS, 'readwrite');
  const store = tx.objectStore(STORES.AUDIT_LOGS);

  // Auto-increment ID is handled by IndexedDB
  const id = await store.add(encryptedEntry);
  await tx.done;

  // Retrieve the saved entry with its generated ID
  const saved = await getLogById(id);
  return saved;
}

/**
 * Appends multiple audit log entries in a single transaction
 *
 * @param {object[]} entries - Array of audit log entries to add
 * @returns {Promise<object[]>} Array of saved audit log entries with auto-generated IDs
 */
export async function addLogs(entries) {
  if (!Array.isArray(entries)) {
    throw new Error('Entries must be an array');
  }

  if (entries.length === 0) return [];

  // Validate and encrypt all entries
  const encryptedEntries = await Promise.all(
    entries.map(async (entry) => {
      if (!entry || typeof entry !== 'object') {
        throw new Error('Each audit log entry must be a non-null object');
      }

      if (!entry.entityType || !entry.entityId || !entry.action || !entry.performedBy) {
        throw new Error('Each audit log entry must have entityType, entityId, action, and performedBy');
      }

      const sanitizedEntry = { ...entry };
      sanitizedEntry.entityType = sanitizeInput(sanitizedEntry.entityType);
      sanitizedEntry.entityId = sanitizeInput(sanitizedEntry.entityId);
      sanitizedEntry.action = sanitizeInput(sanitizedEntry.action);
      sanitizedEntry.performedBy = sanitizeInput(sanitizedEntry.performedBy);

      if (sanitizedEntry.details !== undefined && sanitizedEntry.details !== null) {
        if (typeof sanitizedEntry.details === 'string') {
          sanitizedEntry.details = stripPII(sanitizedEntry.details);
        } else if (typeof sanitizedEntry.details === 'object') {
          const strippedDetails = {};
          for (const [key, value] of Object.entries(sanitizedEntry.details)) {
            if (typeof value === 'string') {
              strippedDetails[key] = stripPII(value);
            } else {
              strippedDetails[key] = value;
            }
          }
          sanitizedEntry.details = strippedDetails;
        }
      }

      sanitizedEntry.timestamp = sanitizedEntry.timestamp || new Date().toISOString();
      sanitizedEntry.eventType = `${sanitizedEntry.entityType}:${sanitizedEntry.action}`;

      return encryptSensitiveFields(sanitizedEntry);
    })
  );

  const db = await openDB();
  const tx = db.transaction(STORES.AUDIT_LOGS, 'readwrite');
  const store = tx.objectStore(STORES.AUDIT_LOGS);

  const ids = [];
  for (const encryptedEntry of encryptedEntries) {
    const id = await store.add(encryptedEntry);
    ids.push(id);
  }

  await tx.done;

  // Retrieve saved entries with their generated IDs
  const savedEntries = await Promise.all(
    ids.map((id) => getLogById(id))
  );

  return savedEntries;
}

/**
 * Retrieves a single audit log entry by its ID
 *
 * @param {number|string} id - Audit log entry identifier
 * @returns {Promise<object|null>} Audit log entry or null if not found
 */
export async function getLogById(id) {
  if (id === undefined || id === null) return null;

  const db = await openDB();
  const tx = db.transaction(STORES.AUDIT_LOGS, 'readonly');
  const store = tx.objectStore(STORES.AUDIT_LOGS);

  const entry = await store.get(id);

  await tx.done;

  if (!entry) return null;

  return decryptSensitiveFields(entry);
}

/**
 * Retrieves all audit log entries with optional filtering and pagination
 *
 * @param {object} [options]
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @param {string} [options.entityType] - Filter by entity type
 * @param {string} [options.entityId] - Filter by entity ID
 * @param {string} [options.action] - Filter by action
 * @param {string} [options.performedBy] - Filter by user ID
 * @param {string} [options.sortBy='timestamp'] - Field to sort by
 * @param {string} [options.sortOrder='desc'] - Sort order ('asc' or 'desc')
 * @returns {Promise<{ logs: object[], total: number, page: number, pageSize: number }>}
 */
export async function getAllLogs(options = {}) {
  const {
    page = 1,
    pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
    entityType,
    entityId,
    action,
    performedBy,
    sortBy = 'timestamp',
    sortOrder = 'desc',
  } = options;

  const db = await openDB();
  const tx = db.transaction(STORES.AUDIT_LOGS, 'readonly');
  const store = tx.objectStore(STORES.AUDIT_LOGS);

  let allLogs = await store.getAll();

  await tx.done;

  // Apply entity type filter
  if (entityType) {
    allLogs = allLogs.filter((log) => log.entityType === entityType);
  }

  // Apply entity ID filter
  if (entityId) {
    allLogs = allLogs.filter((log) => log.entityId === entityId);
  }

  // Apply action filter
  if (action) {
    allLogs = allLogs.filter((log) => log.action === action);
  }

  // Apply performedBy filter
  if (performedBy) {
    allLogs = allLogs.filter((log) => log.performedBy === performedBy);
  }

  // Sort results
  allLogs.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    // Handle timestamp comparison
    if (sortBy === 'timestamp') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const total = allLogs.length;

  // Apply pagination
  const clampedPageSize = Math.min(
    Math.max(1, pageSize),
    PAGINATION.MAX_PAGE_SIZE
  );
  const clampedPage = Math.max(1, page);
  const startIndex = (clampedPage - 1) * clampedPageSize;
  const paginatedLogs = allLogs.slice(startIndex, startIndex + clampedPageSize);

  // Decrypt sensitive fields for each log entry
  const decryptedLogs = await Promise.all(
    paginatedLogs.map((log) => decryptSensitiveFields(log))
  );

  return {
    logs: decryptedLogs,
    total,
    page: clampedPage,
    pageSize: clampedPageSize,
  };
}

/**
 * Retrieves audit log entries by action type
 *
 * @param {string} action - Action to filter by
 * @param {object} [options]
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @returns {Promise<{ logs: object[], total: number, page: number, pageSize: number }>}
 */
export async function getLogsByAction(action, options = {}) {
  if (!action || typeof action !== 'string') {
    throw new Error('Action is required and must be a string');
  }

  return getAllLogs({ ...options, action });
}

/**
 * Retrieves audit log entries by user who performed the action
 *
 * @param {string} userId - User identifier
 * @param {object} [options]
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @returns {Promise<{ logs: object[], total: number, page: number, pageSize: number }>}
 */
export async function getLogsByUser(userId, options = {}) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID is required and must be a string');
  }

  const db = await openDB();
  const tx = db.transaction(STORES.AUDIT_LOGS, 'readonly');
  const store = tx.objectStore(STORES.AUDIT_LOGS);
  const index = store.index('by-userId');

  const logs = await index.getAll(userId);

  await tx.done;

  if (!logs || logs.length === 0) {
    const {
      page = 1,
      pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
    } = options;

    return {
      logs: [],
      total: 0,
      page: Math.max(1, page),
      pageSize: Math.min(Math.max(1, pageSize), PAGINATION.MAX_PAGE_SIZE),
    };
  }

  // Sort by timestamp descending (most recent first)
  const {
    page = 1,
    pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
    sortOrder = 'desc',
  } = options;

  logs.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
  });

  const total = logs.length;

  // Apply pagination
  const clampedPageSize = Math.min(
    Math.max(1, pageSize),
    PAGINATION.MAX_PAGE_SIZE
  );
  const clampedPage = Math.max(1, page);
  const startIndex = (clampedPage - 1) * clampedPageSize;
  const paginatedLogs = logs.slice(startIndex, startIndex + clampedPageSize);

  // Decrypt sensitive fields for each log entry
  const decryptedLogs = await Promise.all(
    paginatedLogs.map((log) => decryptSensitiveFields(log))
  );

  return {
    logs: decryptedLogs,
    total,
    page: clampedPage,
    pageSize: clampedPageSize,
  };
}

/**
 * Retrieves audit log entries by entity type and entity ID
 *
 * @param {string} entityType - Entity type to filter by
 * @param {string} entityId - Entity identifier to filter by
 * @returns {Promise<object[]>} Array of audit log entries sorted by timestamp descending
 */
export async function getLogsByEntity(entityType, entityId) {
  if (!entityType || typeof entityType !== 'string') {
    throw new Error('Entity type is required and must be a string');
  }

  if (!entityId || typeof entityId !== 'string') {
    throw new Error('Entity ID is required and must be a string');
  }

  const db = await openDB();
  const tx = db.transaction(STORES.AUDIT_LOGS, 'readonly');
  const store = tx.objectStore(STORES.AUDIT_LOGS);
  const index = store.index('by-entityId');

  const logs = await index.getAll(entityId);

  await tx.done;

  if (!logs || logs.length === 0) return [];

  // Filter by entity type (index only covers entityId)
  const filtered = logs.filter((log) => log.entityType === entityType);

  // Sort by timestamp descending
  filtered.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bTime - aTime;
  });

  return Promise.all(filtered.map((log) => decryptSensitiveFields(log)));
}

/**
 * Retrieves audit log entries by event type using the IndexedDB index
 *
 * @param {string} eventType - Event type string (e.g., 'lead:extract')
 * @returns {Promise<object[]>} Array of audit log entries matching the event type
 */
export async function getLogsByEventType(eventType) {
  if (!eventType || typeof eventType !== 'string') {
    throw new Error('Event type is required and must be a string');
  }

  const db = await openDB();
  const tx = db.transaction(STORES.AUDIT_LOGS, 'readonly');
  const store = tx.objectStore(STORES.AUDIT_LOGS);
  const index = store.index('by-eventType');

  const logs = await index.getAll(eventType);

  await tx.done;

  if (!logs || logs.length === 0) return [];

  // Sort by timestamp descending
  logs.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bTime - aTime;
  });

  return Promise.all(logs.map((log) => decryptSensitiveFields(log)));
}

/**
 * Returns the total count of audit log entries, optionally filtered by entity type
 *
 * @param {string} [entityType] - Optional entity type filter
 * @returns {Promise<number>} Count of audit log entries
 */
export async function getLogCount(entityType) {
  const db = await openDB();
  const tx = db.transaction(STORES.AUDIT_LOGS, 'readonly');
  const store = tx.objectStore(STORES.AUDIT_LOGS);

  let count;

  if (entityType) {
    // No direct index on entityType alone, so count manually
    const allLogs = await store.getAll();
    count = allLogs.filter((log) => log.entityType === entityType).length;
  } else {
    count = await store.count();
  }

  await tx.done;

  return count;
}

/**
 * Escapes a value for safe inclusion in a CSV cell
 * Wraps in double quotes if the value contains commas, quotes, or newlines
 *
 * @param {*} value - Value to escape
 * @returns {string} CSV-safe string
 */
function escapeCSVValue(value) {
  if (value === null || value === undefined) return '';

  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);

  // If the value contains a comma, double quote, or newline, wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Exports all audit log entries as a CSV string
 * Decrypts all entries before export
 * PII is already stripped during addLog, so exported data is safe
 *
 * @param {object} [options]
 * @param {string} [options.entityType] - Filter by entity type
 * @param {string} [options.action] - Filter by action
 * @param {string} [options.performedBy] - Filter by user ID
 * @returns {Promise<string>} CSV-formatted string of audit log entries
 */
export async function exportLogsAsCSV(options = {}) {
  const { entityType, action, performedBy } = options;

  const db = await openDB();
  const tx = db.transaction(STORES.AUDIT_LOGS, 'readonly');
  const store = tx.objectStore(STORES.AUDIT_LOGS);

  let allLogs = await store.getAll();

  await tx.done;

  // Apply filters
  if (entityType) {
    allLogs = allLogs.filter((log) => log.entityType === entityType);
  }

  if (action) {
    allLogs = allLogs.filter((log) => log.action === action);
  }

  if (performedBy) {
    allLogs = allLogs.filter((log) => log.performedBy === performedBy);
  }

  // Sort by timestamp ascending for chronological export
  allLogs.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return aTime - bTime;
  });

  // Decrypt all entries
  const decryptedLogs = await Promise.all(
    allLogs.map((log) => decryptSensitiveFields(log))
  );

  // CSV header
  const headers = ['id', 'entityType', 'entityId', 'action', 'performedBy', 'timestamp', 'details'];
  const headerRow = headers.join(',');

  // CSV rows
  const rows = decryptedLogs.map((log) => {
    const values = headers.map((header) => escapeCSVValue(log[header]));
    return values.join(',');
  });

  return [headerRow, ...rows].join('\n');
}