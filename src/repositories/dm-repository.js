import { openDB, STORES } from '@/repositories/db';
import { STATUS, STATUS_LIST, PAGINATION } from '@/utils/constants';
import { encrypt, decrypt } from '@/utils/encryption';
import { sanitizeInput } from '@/utils/validators';
import { stripPII } from '@/utils/pii-filter';

/**
 * DM data access layer
 * Provides CRUD operations for DMs in IndexedDB
 * Handles encryption of sensitive message content
 */

/**
 * Fields that contain sensitive content and should be encrypted at rest
 */
const SENSITIVE_FIELDS = ['content'];

/**
 * Encrypts sensitive fields on a DM object before storage
 * @param {object} dm - DM object to encrypt
 * @returns {Promise<object>} DM with sensitive fields encrypted
 */
async function encryptSensitiveFields(dm) {
  if (!dm) return dm;

  const encrypted = { ...dm };

  for (const field of SENSITIVE_FIELDS) {
    if (encrypted[field] !== undefined && encrypted[field] !== null) {
      try {
        encrypted[field] = await encrypt(encrypted[field]);
        encrypted[`_${field}_encrypted`] = true;
      } catch {
        // If encryption fails, store as-is but log warning
        console.warn(`[dm-repository] Failed to encrypt field: ${field}`);
        encrypted[`_${field}_encrypted`] = false;
      }
    }
  }

  return encrypted;
}

/**
 * Decrypts sensitive fields on a DM object after retrieval
 * @param {object} dm - DM object with potentially encrypted fields
 * @returns {Promise<object>} DM with sensitive fields decrypted
 */
async function decryptSensitiveFields(dm) {
  if (!dm) return dm;

  const decrypted = { ...dm };

  for (const field of SENSITIVE_FIELDS) {
    if (decrypted[`_${field}_encrypted`] === true && decrypted[field]) {
      try {
        decrypted[field] = await decrypt(decrypted[field]);
      } catch {
        console.warn(`[dm-repository] Failed to decrypt field: ${field}`);
      }
    }
    // Clean up encryption metadata from returned object
    delete decrypted[`_${field}_encrypted`];
  }

  return decrypted;
}

/**
 * Retrieves all DMs from IndexedDB with optional filtering and pagination
 *
 * @param {object} [options]
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @param {string[]} [options.status] - Filter by status values
 * @param {string} [options.platform] - Filter by platform
 * @param {string} [options.sortBy='timestamp'] - Field to sort by
 * @param {string} [options.sortOrder='desc'] - Sort order ('asc' or 'desc')
 * @returns {Promise<{ dms: object[], total: number, page: number, pageSize: number }>}
 */
export async function getAllDMs(options = {}) {
  const {
    page = 1,
    pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
    status,
    platform,
    sortBy = 'timestamp',
    sortOrder = 'desc',
  } = options;

  const db = await openDB();
  const tx = db.transaction(STORES.DMS, 'readonly');
  const store = tx.objectStore(STORES.DMS);

  let allDMs = await store.getAll();

  await tx.done;

  // Apply status filter
  if (status && Array.isArray(status) && status.length > 0) {
    allDMs = allDMs.filter((dm) => status.includes(dm.status));
  }

  // Apply platform filter
  if (platform) {
    allDMs = allDMs.filter(
      (dm) => dm.sender && dm.sender.platform === platform
    );
  }

  // Sort results
  allDMs.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    // Handle nested sender fields
    if (sortBy === 'sender.name') {
      aVal = a.sender?.name || '';
      bVal = b.sender?.name || '';
    }

    // Handle timestamp comparison
    if (sortBy === 'timestamp') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const total = allDMs.length;

  // Apply pagination
  const clampedPageSize = Math.min(
    Math.max(1, pageSize),
    PAGINATION.MAX_PAGE_SIZE
  );
  const clampedPage = Math.max(1, page);
  const startIndex = (clampedPage - 1) * clampedPageSize;
  const paginatedDMs = allDMs.slice(startIndex, startIndex + clampedPageSize);

  // Decrypt sensitive fields for each DM
  const decryptedDMs = await Promise.all(
    paginatedDMs.map((dm) => decryptSensitiveFields(dm))
  );

  return {
    dms: decryptedDMs,
    total,
    page: clampedPage,
    pageSize: clampedPageSize,
  };
}

/**
 * Retrieves a single DM by its ID
 *
 * @param {string} id - DM identifier
 * @returns {Promise<object|null>} DM object or null if not found
 */
export async function getDMById(id) {
  if (!id) return null;

  const db = await openDB();
  const tx = db.transaction(STORES.DMS, 'readonly');
  const store = tx.objectStore(STORES.DMS);

  const dm = await store.get(id);

  await tx.done;

  if (!dm) return null;

  return decryptSensitiveFields(dm);
}

/**
 * Saves a DM to IndexedDB (insert or update)
 * Encrypts sensitive content before storage
 *
 * @param {object} dm - DM object to save
 * @param {string} dm.id - Unique DM identifier
 * @param {object} dm.sender - Sender information
 * @param {string} dm.sender.name - Sender display name
 * @param {string} dm.sender.handle - Sender handle
 * @param {string} dm.sender.platform - Platform identifier
 * @param {string} dm.timestamp - ISO timestamp
 * @param {string} dm.content - Message content
 * @param {string} dm.status - DM status
 * @param {object} [dm.metadata] - Additional metadata
 * @returns {Promise<object>} Saved DM object (decrypted)
 */
export async function saveDM(dm) {
  if (!dm || typeof dm !== 'object') {
    throw new Error('DM data must be a non-null object');
  }

  if (!dm.id) {
    throw new Error('DM must have an id');
  }

  // Validate status if provided
  if (dm.status && !STATUS_LIST.includes(dm.status)) {
    throw new Error(`Invalid DM status: ${dm.status}. Must be one of: ${STATUS_LIST.join(', ')}`);
  }

  // Sanitize content before encryption
  const sanitizedDM = { ...dm };
  if (sanitizedDM.content && typeof sanitizedDM.content === 'string') {
    sanitizedDM.content = sanitizeInput(sanitizedDM.content);
  }

  // Set last_updated timestamp
  sanitizedDM.last_updated = new Date().toISOString();

  // Encrypt sensitive fields
  const encryptedDM = await encryptSensitiveFields(sanitizedDM);

  const db = await openDB();
  const tx = db.transaction(STORES.DMS, 'readwrite');
  const store = tx.objectStore(STORES.DMS);

  await store.put(encryptedDM);
  await tx.done;

  // Return the decrypted version
  return decryptSensitiveFields(encryptedDM);
}

/**
 * Saves multiple DMs to IndexedDB in a single transaction
 *
 * @param {object[]} dms - Array of DM objects to save
 * @returns {Promise<object[]>} Array of saved DM objects (decrypted)
 */
export async function saveDMs(dms) {
  if (!Array.isArray(dms)) {
    throw new Error('DMs must be an array');
  }

  if (dms.length === 0) return [];

  // Encrypt all DMs
  const encryptedDMs = await Promise.all(
    dms.map(async (dm) => {
      if (!dm || !dm.id) {
        throw new Error('Each DM must have an id');
      }

      if (dm.status && !STATUS_LIST.includes(dm.status)) {
        throw new Error(
          `Invalid DM status: ${dm.status}. Must be one of: ${STATUS_LIST.join(', ')}`
        );
      }

      const sanitizedDM = { ...dm };
      if (sanitizedDM.content && typeof sanitizedDM.content === 'string') {
        sanitizedDM.content = sanitizeInput(sanitizedDM.content);
      }

      sanitizedDM.last_updated = new Date().toISOString();

      return encryptSensitiveFields(sanitizedDM);
    })
  );

  const db = await openDB();
  const tx = db.transaction(STORES.DMS, 'readwrite');
  const store = tx.objectStore(STORES.DMS);

  for (const encryptedDM of encryptedDMs) {
    await store.put(encryptedDM);
  }

  await tx.done;

  // Return decrypted versions
  return Promise.all(encryptedDMs.map((dm) => decryptSensitiveFields(dm)));
}

/**
 * Updates the status of a DM
 *
 * @param {string} id - DM identifier
 * @param {string} status - New status value (must be a valid STATUS)
 * @returns {Promise<object>} Updated DM object (decrypted)
 * @throws {Error} If DM not found or status is invalid
 */
export async function updateDMStatus(id, status) {
  if (!id) {
    throw new Error('DM id is required');
  }

  if (!STATUS_LIST.includes(status)) {
    throw new Error(
      `Invalid DM status: ${status}. Must be one of: ${STATUS_LIST.join(', ')}`
    );
  }

  const db = await openDB();
  const tx = db.transaction(STORES.DMS, 'readwrite');
  const store = tx.objectStore(STORES.DMS);

  const existing = await store.get(id);

  if (!existing) {
    await tx.done;
    throw new Error(`DM not found: ${id}`);
  }

  existing.status = status;
  existing.last_updated = new Date().toISOString();

  await store.put(existing);
  await tx.done;

  return decryptSensitiveFields(existing);
}

/**
 * Searches DMs by matching query text against sender name, handle, and content
 * Content is decrypted before matching
 *
 * @param {string} query - Search query string
 * @param {object} [options]
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @param {string[]} [options.status] - Filter by status values
 * @param {string} [options.platform] - Filter by platform
 * @returns {Promise<{ dms: object[], total: number, page: number, pageSize: number }>}
 */
export async function searchDMs(query, options = {}) {
  const {
    page = 1,
    pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
    status,
    platform,
  } = options;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return getAllDMs(options);
  }

  const sanitizedQuery = sanitizeInput(query.trim()).toLowerCase();

  const db = await openDB();
  const tx = db.transaction(STORES.DMS, 'readonly');
  const store = tx.objectStore(STORES.DMS);

  const allDMs = await store.getAll();

  await tx.done;

  // Decrypt all DMs for search matching
  const decryptedDMs = await Promise.all(
    allDMs.map((dm) => decryptSensitiveFields(dm))
  );

  // Filter by search query
  let matchedDMs = decryptedDMs.filter((dm) => {
    const senderName = (dm.sender?.name || '').toLowerCase();
    const senderHandle = (dm.sender?.handle || '').toLowerCase();
    const content = (dm.content || '').toLowerCase();
    const inquiryType = (dm.metadata?.inquiryType || '').toLowerCase();

    return (
      senderName.includes(sanitizedQuery) ||
      senderHandle.includes(sanitizedQuery) ||
      content.includes(sanitizedQuery) ||
      inquiryType.includes(sanitizedQuery)
    );
  });

  // Apply status filter
  if (status && Array.isArray(status) && status.length > 0) {
    matchedDMs = matchedDMs.filter((dm) => status.includes(dm.status));
  }

  // Apply platform filter
  if (platform) {
    matchedDMs = matchedDMs.filter(
      (dm) => dm.sender && dm.sender.platform === platform
    );
  }

  // Sort by timestamp descending (most recent first)
  matchedDMs.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bTime - aTime;
  });

  const total = matchedDMs.length;

  // Apply pagination
  const clampedPageSize = Math.min(
    Math.max(1, pageSize),
    PAGINATION.MAX_PAGE_SIZE
  );
  const clampedPage = Math.max(1, page);
  const startIndex = (clampedPage - 1) * clampedPageSize;
  const paginatedDMs = matchedDMs.slice(startIndex, startIndex + clampedPageSize);

  return {
    dms: paginatedDMs,
    total,
    page: clampedPage,
    pageSize: clampedPageSize,
  };
}

/**
 * Deletes a DM by its ID
 *
 * @param {string} id - DM identifier
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function deleteDM(id) {
  if (!id) return false;

  const db = await openDB();
  const tx = db.transaction(STORES.DMS, 'readwrite');
  const store = tx.objectStore(STORES.DMS);

  const existing = await store.get(id);

  if (!existing) {
    await tx.done;
    return false;
  }

  await store.delete(id);
  await tx.done;

  return true;
}

/**
 * Retrieves DMs by status using the IndexedDB index
 *
 * @param {string} status - Status to filter by
 * @returns {Promise<object[]>} Array of DM objects matching the status
 */
export async function getDMsByStatus(status) {
  if (!status || !STATUS_LIST.includes(status)) {
    throw new Error(
      `Invalid DM status: ${status}. Must be one of: ${STATUS_LIST.join(', ')}`
    );
  }

  const db = await openDB();
  const tx = db.transaction(STORES.DMS, 'readonly');
  const store = tx.objectStore(STORES.DMS);
  const index = store.index('by-status');

  const dms = await index.getAll(status);

  await tx.done;

  return Promise.all(dms.map((dm) => decryptSensitiveFields(dm)));
}

/**
 * Retrieves DMs by sender handle using the IndexedDB index
 *
 * @param {string} handle - Sender handle to filter by
 * @returns {Promise<object[]>} Array of DM objects from the sender
 */
export async function getDMsBySenderHandle(handle) {
  if (!handle) return [];

  const db = await openDB();
  const tx = db.transaction(STORES.DMS, 'readonly');
  const store = tx.objectStore(STORES.DMS);
  const index = store.index('by-sender-handle');

  const dms = await index.getAll(handle);

  await tx.done;

  return Promise.all(dms.map((dm) => decryptSensitiveFields(dm)));
}

/**
 * Returns the total count of DMs, optionally filtered by status
 *
 * @param {string} [status] - Optional status filter
 * @returns {Promise<number>} Count of DMs
 */
export async function getDMCount(status) {
  const db = await openDB();
  const tx = db.transaction(STORES.DMS, 'readonly');
  const store = tx.objectStore(STORES.DMS);

  let count;

  if (status && STATUS_LIST.includes(status)) {
    const index = store.index('by-status');
    count = await index.count(status);
  } else {
    count = await store.count();
  }

  await tx.done;

  return count;
}