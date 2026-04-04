import { getAllDMs, getDMById as repoGetDMById, saveDM, saveDMs, updateDMStatus, searchDMs, getDMsByStatus, getDMCount } from '@/repositories/dm-repository';
import { addLog } from '@/repositories/audit-log-repository';
import { STATUS, STATUS_LIST, PAGINATION } from '@/utils/constants';
import { sanitizeInput } from '@/utils/validators';
import mockDMs from '@/data/mock-dms.json';

/**
 * DM Inbox Service
 * Business logic layer for DM ingestion and management
 * Implements DMInboxService from LLD (SCRUM-6529)
 *
 * Provides:
 * - loadDMs(): Initialize IndexedDB from mock data
 * - getDMs(filters): Filtered/sorted/paginated DM retrieval
 * - getDMById(id): Single DM lookup
 * - updateStatus(id, status): DM status transitions
 * - searchDMs(query, options): Full-text search across DMs
 * - getDMCounts(): Status-based counts for inbox badges
 *
 * Simulates async latency to mimic real API behavior
 */

/**
 * Simulates network/API latency for realistic async behavior
 * @param {number} [minMs=50] - Minimum delay in milliseconds
 * @param {number} [maxMs=150] - Maximum delay in milliseconds
 * @returns {Promise<void>}
 */
function simulateLatency(minMs = 50, maxMs = 150) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Tracks whether mock data has been loaded into IndexedDB
 * Prevents duplicate ingestion across multiple calls
 * @type {boolean}
 */
let _initialized = false;

/**
 * Loads mock DM data into IndexedDB
 * Skips if data has already been loaded or if DMs already exist in the store
 * Logs the ingestion action to the audit log
 *
 * @param {object} [options]
 * @param {boolean} [options.force=false] - Force reload even if already initialized
 * @returns {Promise<{ loaded: number, skipped: boolean }>} Result of the load operation
 */
export async function loadDMs(options = {}) {
  const { force = false } = options;

  await simulateLatency(100, 300);

  if (_initialized && !force) {
    return { loaded: 0, skipped: true };
  }

  // Check if DMs already exist in the store
  const existingCount = await getDMCount();

  if (existingCount > 0 && !force) {
    _initialized = true;
    return { loaded: 0, skipped: true };
  }

  // Validate and save mock DMs
  const validDMs = mockDMs.filter((dm) => {
    return dm && dm.id && dm.sender && dm.timestamp && dm.content && dm.status;
  });

  if (validDMs.length === 0) {
    _initialized = true;
    return { loaded: 0, skipped: false };
  }

  const savedDMs = await saveDMs(validDMs);

  // Log the ingestion action
  try {
    await addLog({
      entityType: 'dm',
      entityId: 'batch-ingest',
      action: 'create',
      performedBy: 'system',
      details: {
        source: 'mock-data',
        count: savedDMs.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Audit log failure should not block DM ingestion
    console.warn('[dm-inbox-service] Failed to write audit log for DM ingestion');
  }

  _initialized = true;

  return { loaded: savedDMs.length, skipped: false };
}

/**
 * Retrieves DMs with optional filtering, sorting, and pagination
 *
 * @param {object} [filters]
 * @param {number} [filters.page=1] - Page number (1-based)
 * @param {number} [filters.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @param {string[]} [filters.status] - Filter by status values (e.g., ['New', 'Drafted'])
 * @param {string} [filters.platform] - Filter by platform ('Facebook', 'Instagram')
 * @param {string} [filters.sortBy='timestamp'] - Field to sort by
 * @param {string} [filters.sortOrder='desc'] - Sort order ('asc' or 'desc')
 * @param {string} [filters.query] - Search query string
 * @returns {Promise<{ dms: object[], total: number, page: number, pageSize: number }>}
 */
export async function getDMs(filters = {}) {
  await simulateLatency();

  const {
    page = 1,
    pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
    status,
    platform,
    sortBy = 'timestamp',
    sortOrder = 'desc',
    query,
  } = filters;

  // Validate status filter values if provided
  if (status && Array.isArray(status)) {
    const invalidStatuses = status.filter((s) => !STATUS_LIST.includes(s));
    if (invalidStatuses.length > 0) {
      throw new Error(
        `Invalid status filter values: ${invalidStatuses.join(', ')}. Must be one of: ${STATUS_LIST.join(', ')}`
      );
    }
  }

  // Validate sort order
  const validSortOrders = ['asc', 'desc'];
  if (sortOrder && !validSortOrders.includes(sortOrder)) {
    throw new Error(`Invalid sort order: ${sortOrder}. Must be one of: ${validSortOrders.join(', ')}`);
  }

  // If a search query is provided, use the search function
  if (query && typeof query === 'string' && query.trim().length > 0) {
    return searchDMsByQuery(query, { page, pageSize, status, platform });
  }

  return getAllDMs({
    page,
    pageSize,
    status,
    platform,
    sortBy,
    sortOrder,
  });
}

/**
 * Retrieves a single DM by its ID
 *
 * @param {string} id - DM identifier
 * @returns {Promise<object|null>} DM object or null if not found
 * @throws {Error} If id is not provided
 */
export async function getDMById(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('DM id is required and must be a string');
  }

  await simulateLatency();

  const dm = await repoGetDMById(id);

  return dm;
}

/**
 * Updates the status of a DM and logs the transition
 * Validates the status transition and records an audit log entry
 *
 * @param {string} id - DM identifier
 * @param {string} status - New status value (must be a valid STATUS)
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier performing the update
 * @param {string} [options.reason] - Reason for the status change
 * @returns {Promise<object>} Updated DM object
 * @throws {Error} If DM not found, id is missing, or status is invalid
 */
export async function updateStatus(id, status, options = {}) {
  if (!id || typeof id !== 'string') {
    throw new Error('DM id is required and must be a string');
  }

  if (!status || !STATUS_LIST.includes(status)) {
    throw new Error(
      `Invalid DM status: ${status}. Must be one of: ${STATUS_LIST.join(', ')}`
    );
  }

  const { performedBy = 'system', reason } = options;

  await simulateLatency();

  // Fetch existing DM to validate it exists and capture previous status
  const existing = await repoGetDMById(id);

  if (!existing) {
    throw new Error(`DM not found: ${id}`);
  }

  const previousStatus = existing.status;

  // Perform the status update
  const updatedDM = await updateDMStatus(id, status);

  // Log the status transition
  try {
    await addLog({
      entityType: 'dm',
      entityId: id,
      action: 'update',
      performedBy: sanitizeInput(performedBy),
      details: {
        field: 'status',
        previousValue: previousStatus,
        newValue: status,
        reason: reason ? sanitizeInput(reason) : undefined,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Audit log failure should not block the status update
    console.warn('[dm-inbox-service] Failed to write audit log for status update');
  }

  return updatedDM;
}

/**
 * Searches DMs by query text across sender name, handle, and content
 *
 * @param {string} query - Search query string
 * @param {object} [options]
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @param {string[]} [options.status] - Filter by status values
 * @param {string} [options.platform] - Filter by platform
 * @returns {Promise<{ dms: object[], total: number, page: number, pageSize: number }>}
 */
export async function searchDMsByQuery(query, options = {}) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return getDMs(options);
  }

  await simulateLatency();

  return searchDMs(query, options);
}

/**
 * Retrieves DM counts grouped by status for inbox badge display
 *
 * @returns {Promise<{ total: number, new: number, drafted: number, sent: number, escalated: number }>}
 */
export async function getDMCounts() {
  await simulateLatency(30, 80);

  const [total, newCount, draftedCount, sentCount, escalatedCount] = await Promise.all([
    getDMCount(),
    getDMCount(STATUS.NEW),
    getDMCount(STATUS.DRAFTED),
    getDMCount(STATUS.SENT),
    getDMCount(STATUS.ESCALATED),
  ]);

  return {
    total,
    new: newCount,
    drafted: draftedCount,
    sent: sentCount,
    escalated: escalatedCount,
  };
}

/**
 * Ingests a single DM into the system
 * Validates the DM data, saves it to IndexedDB, and logs the ingestion
 *
 * @param {object} dm - DM data to ingest
 * @param {string} dm.id - Unique DM identifier
 * @param {object} dm.sender - Sender information
 * @param {string} dm.sender.name - Sender display name
 * @param {string} dm.sender.handle - Sender handle
 * @param {string} dm.sender.platform - Platform identifier
 * @param {string} dm.timestamp - ISO timestamp
 * @param {string} dm.content - Message content
 * @param {string} [dm.status='New'] - DM status (defaults to New)
 * @param {object} [dm.metadata] - Additional metadata
 * @returns {Promise<object>} Saved DM object
 * @throws {Error} If DM data is invalid
 */
export async function ingestDM(dm) {
  if (!dm || typeof dm !== 'object') {
    throw new Error('DM data must be a non-null object');
  }

  if (!dm.id || typeof dm.id !== 'string') {
    throw new Error('DM must have a string id');
  }

  if (!dm.sender || !dm.sender.name || !dm.sender.handle || !dm.sender.platform) {
    throw new Error('DM must have sender with name, handle, and platform');
  }

  if (!dm.timestamp) {
    throw new Error('DM must have a timestamp');
  }

  if (!dm.content || typeof dm.content !== 'string' || dm.content.trim().length === 0) {
    throw new Error('DM must have non-empty content');
  }

  await simulateLatency(100, 250);

  // Set default status if not provided
  const dmToSave = {
    ...dm,
    status: dm.status || STATUS.NEW,
  };

  // Validate status
  if (!STATUS_LIST.includes(dmToSave.status)) {
    throw new Error(
      `Invalid DM status: ${dmToSave.status}. Must be one of: ${STATUS_LIST.join(', ')}`
    );
  }

  const savedDM = await saveDM(dmToSave);

  // Log the ingestion
  try {
    await addLog({
      entityType: 'dm',
      entityId: savedDM.id,
      action: 'create',
      performedBy: 'system',
      details: {
        platform: savedDM.sender?.platform,
        senderHandle: savedDM.sender?.handle,
        status: savedDM.status,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[dm-inbox-service] Failed to write audit log for DM ingestion');
  }

  return savedDM;
}

/**
 * Retrieves DMs filtered by a specific status
 *
 * @param {string} status - Status to filter by
 * @returns {Promise<object[]>} Array of DM objects matching the status
 * @throws {Error} If status is invalid
 */
export async function getDMsByStatusFilter(status) {
  if (!status || !STATUS_LIST.includes(status)) {
    throw new Error(
      `Invalid DM status: ${status}. Must be one of: ${STATUS_LIST.join(', ')}`
    );
  }

  await simulateLatency();

  return getDMsByStatus(status);
}

/**
 * Resets the initialization flag
 * Useful for testing or when the database needs to be re-seeded
 */
export function resetInitialization() {
  _initialized = false;
}