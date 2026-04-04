import { openDB, STORES } from '@/repositories/db';
import { PAGINATION } from '@/utils/constants';
import { sanitizeInput } from '@/utils/validators';

/**
 * Notification data access layer
 * Provides CRUD operations for notifications in IndexedDB
 * Supports notification types: high_priority_lead, sla_breach
 * Tracks read/acknowledged state for each notification
 */

/**
 * Valid notification types
 */
const NOTIFICATION_TYPE = Object.freeze({
  HIGH_PRIORITY_LEAD: 'high_priority_lead',
  SLA_BREACH: 'sla_breach',
});

const NOTIFICATION_TYPE_LIST = Object.freeze(Object.values(NOTIFICATION_TYPE));

/**
 * Retrieves all notifications from IndexedDB with optional filtering and pagination
 *
 * @param {object} [options]
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @param {string} [options.type] - Filter by notification type
 * @param {boolean} [options.read] - Filter by read status
 * @param {string} [options.dmId] - Filter by associated DM ID
 * @param {string} [options.sortBy='timestamp'] - Field to sort by
 * @param {string} [options.sortOrder='desc'] - Sort order ('asc' or 'desc')
 * @returns {Promise<{ notifications: object[], total: number, page: number, pageSize: number }>}
 */
export async function getAllNotifications(options = {}) {
  const {
    page = 1,
    pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
    type,
    read,
    dmId,
    sortBy = 'timestamp',
    sortOrder = 'desc',
  } = options;

  const db = await openDB();
  const tx = db.transaction(STORES.NOTIFICATIONS, 'readonly');
  const store = tx.objectStore(STORES.NOTIFICATIONS);

  let allNotifications = await store.getAll();

  await tx.done;

  // Apply type filter
  if (type) {
    if (Array.isArray(type)) {
      allNotifications = allNotifications.filter((n) => type.includes(n.type));
    } else {
      allNotifications = allNotifications.filter((n) => n.type === type);
    }
  }

  // Apply read filter
  if (read !== undefined && read !== null) {
    allNotifications = allNotifications.filter((n) => n.read === read);
  }

  // Apply dmId filter
  if (dmId) {
    allNotifications = allNotifications.filter((n) => n.dmId === dmId);
  }

  // Sort results
  allNotifications.sort((a, b) => {
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

  const total = allNotifications.length;

  // Apply pagination
  const clampedPageSize = Math.min(
    Math.max(1, pageSize),
    PAGINATION.MAX_PAGE_SIZE
  );
  const clampedPage = Math.max(1, page);
  const startIndex = (clampedPage - 1) * clampedPageSize;
  const paginatedNotifications = allNotifications.slice(
    startIndex,
    startIndex + clampedPageSize
  );

  return {
    notifications: paginatedNotifications,
    total,
    page: clampedPage,
    pageSize: clampedPageSize,
  };
}

/**
 * Retrieves a single notification by its ID
 *
 * @param {number|string} id - Notification identifier
 * @returns {Promise<object|null>} Notification object or null if not found
 */
export async function getNotificationById(id) {
  if (id === undefined || id === null) return null;

  const db = await openDB();
  const tx = db.transaction(STORES.NOTIFICATIONS, 'readonly');
  const store = tx.objectStore(STORES.NOTIFICATIONS);

  const notification = await store.get(id);

  await tx.done;

  if (!notification) return null;

  return notification;
}

/**
 * Saves a new notification to IndexedDB
 *
 * @param {object} notification - Notification object to save
 * @param {string} notification.type - Notification type (high_priority_lead, sla_breach)
 * @param {string} notification.message - Notification message
 * @param {string} [notification.dmId] - Associated DM identifier
 * @param {string} [notification.leadId] - Associated lead identifier
 * @param {string} [notification.userId] - Target user identifier
 * @param {boolean} [notification.read=false] - Read/acknowledged status
 * @param {string} [notification.timestamp] - ISO timestamp (defaults to now)
 * @returns {Promise<object>} Saved notification object with auto-generated ID
 */
export async function saveNotification(notification) {
  if (!notification || typeof notification !== 'object') {
    throw new Error('Notification data must be a non-null object');
  }

  if (!notification.type) {
    throw new Error('Notification must have a type');
  }

  if (!NOTIFICATION_TYPE_LIST.includes(notification.type)) {
    throw new Error(
      `Invalid notification type: ${notification.type}. Must be one of: ${NOTIFICATION_TYPE_LIST.join(', ')}`
    );
  }

  if (!notification.message || typeof notification.message !== 'string' || notification.message.trim().length === 0) {
    throw new Error('Notification must have a non-empty message');
  }

  // Sanitize message content
  const sanitizedNotification = { ...notification };
  sanitizedNotification.message = sanitizeInput(sanitizedNotification.message);

  // Set defaults
  sanitizedNotification.read = sanitizedNotification.read === true;
  sanitizedNotification.timestamp = sanitizedNotification.timestamp || new Date().toISOString();

  const db = await openDB();
  const tx = db.transaction(STORES.NOTIFICATIONS, 'readwrite');
  const store = tx.objectStore(STORES.NOTIFICATIONS);

  // Auto-increment ID is handled by IndexedDB
  const id = await store.add(sanitizedNotification);
  await tx.done;

  // Retrieve the saved notification with its generated ID
  const saved = await getNotificationById(id);
  return saved;
}

/**
 * Saves multiple notifications to IndexedDB in a single transaction
 *
 * @param {object[]} notifications - Array of notification objects to save
 * @returns {Promise<object[]>} Array of saved notification objects with auto-generated IDs
 */
export async function saveNotifications(notifications) {
  if (!Array.isArray(notifications)) {
    throw new Error('Notifications must be an array');
  }

  if (notifications.length === 0) return [];

  // Validate all notifications before writing
  const sanitizedNotifications = notifications.map((notification) => {
    if (!notification || typeof notification !== 'object') {
      throw new Error('Each notification must be a non-null object');
    }

    if (!notification.type) {
      throw new Error('Each notification must have a type');
    }

    if (!NOTIFICATION_TYPE_LIST.includes(notification.type)) {
      throw new Error(
        `Invalid notification type: ${notification.type}. Must be one of: ${NOTIFICATION_TYPE_LIST.join(', ')}`
      );
    }

    if (!notification.message || typeof notification.message !== 'string' || notification.message.trim().length === 0) {
      throw new Error('Each notification must have a non-empty message');
    }

    const sanitized = { ...notification };
    sanitized.message = sanitizeInput(sanitized.message);
    sanitized.read = sanitized.read === true;
    sanitized.timestamp = sanitized.timestamp || new Date().toISOString();

    return sanitized;
  });

  const db = await openDB();
  const tx = db.transaction(STORES.NOTIFICATIONS, 'readwrite');
  const store = tx.objectStore(STORES.NOTIFICATIONS);

  const ids = [];
  for (const sanitized of sanitizedNotifications) {
    const id = await store.add(sanitized);
    ids.push(id);
  }

  await tx.done;

  // Retrieve saved notifications with their generated IDs
  const savedNotifications = await Promise.all(
    ids.map((id) => getNotificationById(id))
  );

  return savedNotifications;
}

/**
 * Marks a notification as read/acknowledged
 *
 * @param {number|string} id - Notification identifier
 * @returns {Promise<object>} Updated notification object
 * @throws {Error} If notification not found
 */
export async function markAsRead(id) {
  if (id === undefined || id === null) {
    throw new Error('Notification id is required');
  }

  const db = await openDB();
  const tx = db.transaction(STORES.NOTIFICATIONS, 'readwrite');
  const store = tx.objectStore(STORES.NOTIFICATIONS);

  const existing = await store.get(id);

  if (!existing) {
    await tx.done;
    throw new Error(`Notification not found: ${id}`);
  }

  existing.read = true;
  existing.acknowledgedAt = new Date().toISOString();

  await store.put(existing);
  await tx.done;

  return existing;
}

/**
 * Marks multiple notifications as read/acknowledged in a single transaction
 *
 * @param {Array<number|string>} ids - Array of notification identifiers
 * @returns {Promise<number>} Number of notifications marked as read
 */
export async function markMultipleAsRead(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;

  const db = await openDB();
  const tx = db.transaction(STORES.NOTIFICATIONS, 'readwrite');
  const store = tx.objectStore(STORES.NOTIFICATIONS);

  let count = 0;
  const now = new Date().toISOString();

  for (const id of ids) {
    const existing = await store.get(id);
    if (existing && !existing.read) {
      existing.read = true;
      existing.acknowledgedAt = now;
      await store.put(existing);
      count++;
    }
  }

  await tx.done;

  return count;
}

/**
 * Retrieves all unread notifications, optionally filtered by type
 *
 * @param {object} [options]
 * @param {string} [options.type] - Filter by notification type
 * @param {string} [options.userId] - Filter by target user ID
 * @returns {Promise<object[]>} Array of unread notification objects sorted by timestamp descending
 */
export async function getUnreadNotifications(options = {}) {
  const { type, userId } = options;

  const db = await openDB();
  const tx = db.transaction(STORES.NOTIFICATIONS, 'readonly');
  const store = tx.objectStore(STORES.NOTIFICATIONS);
  const index = store.index('by-read');

  let unreadNotifications = await index.getAll(false);

  await tx.done;

  // Apply type filter
  if (type) {
    if (Array.isArray(type)) {
      unreadNotifications = unreadNotifications.filter((n) => type.includes(n.type));
    } else {
      unreadNotifications = unreadNotifications.filter((n) => n.type === type);
    }
  }

  // Apply userId filter
  if (userId) {
    unreadNotifications = unreadNotifications.filter((n) => n.userId === userId);
  }

  // Sort by timestamp descending (most recent first)
  unreadNotifications.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bTime - aTime;
  });

  return unreadNotifications;
}

/**
 * Retrieves notifications by type using the IndexedDB index
 *
 * @param {string} type - Notification type to filter by
 * @returns {Promise<object[]>} Array of notification objects matching the type
 */
export async function getNotificationsByType(type) {
  if (!type || !NOTIFICATION_TYPE_LIST.includes(type)) {
    throw new Error(
      `Invalid notification type: ${type}. Must be one of: ${NOTIFICATION_TYPE_LIST.join(', ')}`
    );
  }

  const db = await openDB();
  const tx = db.transaction(STORES.NOTIFICATIONS, 'readonly');
  const store = tx.objectStore(STORES.NOTIFICATIONS);
  const index = store.index('by-type');

  const notifications = await index.getAll(type);

  await tx.done;

  // Sort by timestamp descending
  notifications.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bTime - aTime;
  });

  return notifications;
}

/**
 * Retrieves notifications associated with a specific DM ID
 *
 * @param {string} dmId - DM identifier
 * @returns {Promise<object[]>} Array of notification objects for the DM
 */
export async function getNotificationsByDMId(dmId) {
  if (!dmId) return [];

  const db = await openDB();
  const tx = db.transaction(STORES.NOTIFICATIONS, 'readonly');
  const store = tx.objectStore(STORES.NOTIFICATIONS);
  const index = store.index('by-dmId');

  const notifications = await index.getAll(dmId);

  await tx.done;

  // Sort by timestamp descending
  notifications.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bTime - aTime;
  });

  return notifications;
}

/**
 * Deletes a notification by its ID
 *
 * @param {number|string} id - Notification identifier
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function deleteNotification(id) {
  if (id === undefined || id === null) return false;

  const db = await openDB();
  const tx = db.transaction(STORES.NOTIFICATIONS, 'readwrite');
  const store = tx.objectStore(STORES.NOTIFICATIONS);

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
 * Deletes all notifications associated with a DM ID
 *
 * @param {string} dmId - DM identifier
 * @returns {Promise<number>} Number of notifications deleted
 */
export async function deleteNotificationsByDMId(dmId) {
  if (!dmId) return 0;

  const db = await openDB();
  const tx = db.transaction(STORES.NOTIFICATIONS, 'readwrite');
  const store = tx.objectStore(STORES.NOTIFICATIONS);
  const index = store.index('by-dmId');

  const notifications = await index.getAll(dmId);

  if (!notifications || notifications.length === 0) {
    await tx.done;
    return 0;
  }

  for (const notification of notifications) {
    await store.delete(notification.id);
  }

  await tx.done;

  return notifications.length;
}

/**
 * Returns the total count of notifications, optionally filtered by read status
 *
 * @param {boolean} [read] - Optional read status filter
 * @returns {Promise<number>} Count of notifications
 */
export async function getNotificationCount(read) {
  const db = await openDB();
  const tx = db.transaction(STORES.NOTIFICATIONS, 'readonly');
  const store = tx.objectStore(STORES.NOTIFICATIONS);

  let count;

  if (read !== undefined && read !== null) {
    const index = store.index('by-read');
    count = await index.count(read);
  } else {
    count = await store.count();
  }

  await tx.done;

  return count;
}

/**
 * Returns the count of unread notifications
 *
 * @returns {Promise<number>} Count of unread notifications
 */
export async function getUnreadCount() {
  return getNotificationCount(false);
}