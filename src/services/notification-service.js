import {
  getAllNotifications,
  getNotificationById,
  saveNotification,
  saveNotifications,
  markAsRead as repoMarkAsRead,
  markMultipleAsRead,
  getUnreadNotifications,
  getNotificationsByType,
  getNotificationsByDMId,
  deleteNotification,
  deleteNotificationsByDMId,
  getNotificationCount,
  getUnreadCount,
} from '@/repositories/notification-repository';
import { addLog } from '@/repositories/audit-log-repository';
import { getDMById } from '@/repositories/dm-repository';
import { getLeadById } from '@/repositories/lead-repository';
import { sanitizeInput } from '@/utils/validators';
import { stripPII } from '@/utils/pii-filter';
import { STATUS, SLA_TIMEOUT_MS, SLA_MINUTES, PAGINATION, LEAD_SCORE, getLeadLabel } from '@/utils/constants';

/**
 * Notification Service (NotificationCenter)
 * Business logic layer for notification lifecycle management
 * Implements NotificationCenter from LLD (SCRUM-6540, SCRUM-6541)
 *
 * Provides:
 * - createNotification(type, payload, linkedLeadId): Creates a notification with type, message, and optional linked entities
 * - getNotifications(filters): Retrieves filtered/paginated notifications
 * - markAsRead(id): Marks a notification as read/acknowledged
 * - markMultipleAsRead(ids): Marks multiple notifications as read
 * - checkSLABreaches(dms): Scans DMs exceeding SLA threshold and creates breach alerts
 * - getUnread(options): Retrieves unread notifications
 * - getNotificationCounts(): Returns notification counts by read status
 *
 * Notification types: high_priority_lead, sla_breach
 * All actions are logged via audit log for compliance and traceability
 *
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
 * Valid notification types
 */
const NOTIFICATION_TYPE = Object.freeze({
  HIGH_PRIORITY_LEAD: 'high_priority_lead',
  SLA_BREACH: 'sla_breach',
});

const NOTIFICATION_TYPE_LIST = Object.freeze(Object.values(NOTIFICATION_TYPE));

/**
 * Creates a notification and persists it to IndexedDB
 * Logs the creation action to the audit log
 *
 * @param {string} type - Notification type ('high_priority_lead' or 'sla_breach')
 * @param {object} payload - Notification payload
 * @param {string} payload.message - Notification message
 * @param {string} [payload.dmId] - Associated DM identifier
 * @param {string} [payload.userId] - Target user identifier
 * @param {string} [payload.performedBy='system'] - User or system identifier creating the notification
 * @param {string} [linkedLeadId] - Associated lead identifier
 * @returns {Promise<object>} Saved notification object
 * @throws {Error} If type or message is invalid
 */
export async function createNotification(type, payload = {}, linkedLeadId) {
  if (!type || typeof type !== 'string') {
    throw new Error('Notification type is required and must be a string');
  }

  if (!NOTIFICATION_TYPE_LIST.includes(type)) {
    throw new Error(
      `Invalid notification type: ${type}. Must be one of: ${NOTIFICATION_TYPE_LIST.join(', ')}`
    );
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Notification payload must be a non-null object');
  }

  if (!payload.message || typeof payload.message !== 'string' || payload.message.trim().length === 0) {
    throw new Error('Notification payload must have a non-empty message');
  }

  const { message, dmId, userId, performedBy = 'system' } = payload;

  await simulateLatency(50, 150);

  const notificationData = {
    type,
    message: sanitizeInput(message),
    dmId: dmId || null,
    leadId: linkedLeadId || null,
    userId: userId || null,
    read: false,
    timestamp: new Date().toISOString(),
  };

  const savedNotification = await saveNotification(notificationData);

  // Log the creation action
  try {
    await addLog({
      entityType: 'notification',
      entityId: String(savedNotification.id),
      action: 'create',
      performedBy: sanitizeInput(performedBy),
      details: {
        type,
        dmId: dmId || null,
        leadId: linkedLeadId || null,
        userId: userId || null,
        message: stripPII(sanitizeInput(message)),
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[notification-service] Failed to write audit log for notification creation');
  }

  return savedNotification;
}

/**
 * Creates a high-priority lead notification
 * Convenience wrapper around createNotification for lead escalation
 *
 * @param {string} leadId - Lead identifier
 * @param {object} [options]
 * @param {string} [options.userId] - Target user/agent identifier
 * @param {number} [options.score] - Lead score
 * @param {string} [options.dmId] - Associated DM identifier
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @returns {Promise<object>} Saved notification object
 */
export async function createHighPriorityLeadNotification(leadId, options = {}) {
  if (!leadId || typeof leadId !== 'string') {
    throw new Error('Lead id is required and must be a string');
  }

  const { userId, score, dmId, performedBy = 'system' } = options;

  const label = typeof score === 'number' ? getLeadLabel(score) : 'High';
  const scoreText = typeof score === 'number' ? ` (score: ${score})` : '';
  const message = `High-priority lead detected: ${label}${scoreText}. Lead requires immediate attention.`;

  return createNotification(
    NOTIFICATION_TYPE.HIGH_PRIORITY_LEAD,
    {
      message,
      dmId: dmId || null,
      userId: userId || null,
      performedBy,
    },
    leadId
  );
}

/**
 * Creates an SLA breach notification for a DM that has exceeded the response time target
 *
 * @param {string} dmId - DM identifier
 * @param {object} [options]
 * @param {number} [options.elapsedMinutes] - Minutes elapsed since DM was received
 * @param {string} [options.userId] - Target user/agent identifier
 * @param {string} [options.senderName] - Sender display name (will be PII-stripped in logs)
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @returns {Promise<object>} Saved notification object
 */
export async function createSLABreachNotification(dmId, options = {}) {
  if (!dmId || typeof dmId !== 'string') {
    throw new Error('DM id is required and must be a string');
  }

  const { elapsedMinutes, userId, senderName, performedBy = 'system' } = options;

  const elapsedText = typeof elapsedMinutes === 'number'
    ? ` (${Math.round(elapsedMinutes)} minutes elapsed)`
    : '';
  const senderText = senderName ? ` from ${sanitizeInput(senderName)}` : '';
  const message = `SLA breach: DM${senderText} has not received a response within the ${SLA_MINUTES}-minute target${elapsedText}.`;

  return createNotification(
    NOTIFICATION_TYPE.SLA_BREACH,
    {
      message,
      dmId,
      userId: userId || null,
      performedBy,
    },
    null
  );
}

/**
 * Retrieves notifications with optional filtering, sorting, and pagination
 *
 * @param {object} [filters]
 * @param {number} [filters.page=1] - Page number (1-based)
 * @param {number} [filters.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @param {string} [filters.type] - Filter by notification type
 * @param {boolean} [filters.read] - Filter by read status
 * @param {string} [filters.dmId] - Filter by associated DM ID
 * @param {string} [filters.sortBy='timestamp'] - Field to sort by
 * @param {string} [filters.sortOrder='desc'] - Sort order ('asc' or 'desc')
 * @returns {Promise<{ notifications: object[], total: number, page: number, pageSize: number }>}
 */
export async function getNotifications(filters = {}) {
  const {
    page = 1,
    pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
    type,
    read,
    dmId,
    sortBy = 'timestamp',
    sortOrder = 'desc',
  } = filters;

  // Validate type filter if provided
  if (type && !NOTIFICATION_TYPE_LIST.includes(type)) {
    throw new Error(
      `Invalid notification type filter: ${type}. Must be one of: ${NOTIFICATION_TYPE_LIST.join(', ')}`
    );
  }

  // Validate sort order
  const validSortOrders = ['asc', 'desc'];
  if (sortOrder && !validSortOrders.includes(sortOrder)) {
    throw new Error(`Invalid sort order: ${sortOrder}. Must be one of: ${validSortOrders.join(', ')}`);
  }

  await simulateLatency();

  return getAllNotifications({
    page,
    pageSize,
    type,
    read,
    dmId,
    sortBy,
    sortOrder,
  });
}

/**
 * Retrieves a single notification by its ID
 *
 * @param {number|string} id - Notification identifier
 * @returns {Promise<object|null>} Notification object or null if not found
 */
export async function getNotificationByIdService(id) {
  if (id === undefined || id === null) return null;

  await simulateLatency(20, 60);

  return getNotificationById(id);
}

/**
 * Marks a notification as read/acknowledged
 * Logs the acknowledgement action to the audit log
 *
 * @param {number|string} id - Notification identifier
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @returns {Promise<object>} Updated notification object
 * @throws {Error} If notification not found
 */
export async function markNotificationAsRead(id, options = {}) {
  if (id === undefined || id === null) {
    throw new Error('Notification id is required');
  }

  const { performedBy = 'system' } = options;

  await simulateLatency();

  const updatedNotification = await repoMarkAsRead(id);

  // Log the acknowledgement action
  try {
    await addLog({
      entityType: 'notification',
      entityId: String(id),
      action: 'acknowledge',
      performedBy: sanitizeInput(performedBy),
      details: {
        notificationType: updatedNotification.type,
        acknowledgedAt: updatedNotification.acknowledgedAt,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[notification-service] Failed to write audit log for notification acknowledgement');
  }

  return updatedNotification;
}

/**
 * Marks multiple notifications as read/acknowledged in a single operation
 * Logs the batch acknowledgement action to the audit log
 *
 * @param {Array<number|string>} ids - Array of notification identifiers
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @returns {Promise<number>} Number of notifications marked as read
 */
export async function markMultipleNotificationsAsRead(ids, options = {}) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;

  const { performedBy = 'system' } = options;

  await simulateLatency();

  const count = await markMultipleAsRead(ids);

  // Log the batch acknowledgement action
  try {
    await addLog({
      entityType: 'notification',
      entityId: 'batch-acknowledge',
      action: 'acknowledge',
      performedBy: sanitizeInput(performedBy),
      details: {
        notificationIds: ids,
        acknowledgedCount: count,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[notification-service] Failed to write audit log for batch acknowledgement');
  }

  return count;
}

/**
 * Retrieves all unread notifications, optionally filtered by type and user
 *
 * @param {object} [options]
 * @param {string} [options.type] - Filter by notification type
 * @param {string} [options.userId] - Filter by target user ID
 * @returns {Promise<object[]>} Array of unread notification objects sorted by timestamp descending
 */
export async function getUnread(options = {}) {
  await simulateLatency();

  return getUnreadNotifications(options);
}

/**
 * Retrieves notification counts grouped by read status
 *
 * @returns {Promise<{ total: number, unread: number, read: number }>}
 */
export async function getNotificationCounts() {
  await simulateLatency(20, 60);

  const [total, unread] = await Promise.all([
    getNotificationCount(),
    getUnreadCount(),
  ]);

  return {
    total,
    unread,
    read: total - unread,
  };
}

/**
 * Retrieves notifications associated with a specific DM
 *
 * @param {string} dmId - DM identifier
 * @returns {Promise<object[]>} Array of notification objects for the DM
 */
export async function getNotificationsForDM(dmId) {
  if (!dmId || typeof dmId !== 'string') return [];

  await simulateLatency(20, 60);

  return getNotificationsByDMId(dmId);
}

/**
 * Retrieves notifications by type
 *
 * @param {string} type - Notification type
 * @returns {Promise<object[]>} Array of notification objects matching the type
 * @throws {Error} If type is invalid
 */
export async function getNotificationsByTypeService(type) {
  if (!type || !NOTIFICATION_TYPE_LIST.includes(type)) {
    throw new Error(
      `Invalid notification type: ${type}. Must be one of: ${NOTIFICATION_TYPE_LIST.join(', ')}`
    );
  }

  await simulateLatency(20, 60);

  return getNotificationsByType(type);
}

/**
 * Deletes a notification by its ID
 * Logs the deletion action to the audit log
 *
 * @param {number|string} id - Notification identifier
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function removeNotification(id, options = {}) {
  if (id === undefined || id === null) return false;

  const { performedBy = 'system' } = options;

  await simulateLatency();

  const deleted = await deleteNotification(id);

  if (deleted) {
    try {
      await addLog({
        entityType: 'notification',
        entityId: String(id),
        action: 'delete',
        performedBy: sanitizeInput(performedBy),
        details: {
          deleted: true,
        },
        timestamp: new Date().toISOString(),
      });
    } catch {
      console.warn('[notification-service] Failed to write audit log for notification deletion');
    }
  }

  return deleted;
}

/**
 * Deletes all notifications associated with a DM
 *
 * @param {string} dmId - DM identifier
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @returns {Promise<number>} Number of notifications deleted
 */
export async function removeNotificationsForDM(dmId, options = {}) {
  if (!dmId || typeof dmId !== 'string') return 0;

  const { performedBy = 'system' } = options;

  await simulateLatency();

  const count = await deleteNotificationsByDMId(dmId);

  if (count > 0) {
    try {
      await addLog({
        entityType: 'notification',
        entityId: dmId,
        action: 'delete',
        performedBy: sanitizeInput(performedBy),
        details: {
          dmId,
          deletedCount: count,
        },
        timestamp: new Date().toISOString(),
      });
    } catch {
      console.warn('[notification-service] Failed to write audit log for DM notification deletion');
    }
  }

  return count;
}

/**
 * Scans an array of DMs for SLA breaches and creates breach notifications
 * A DM is considered in breach if it has status 'New' and its timestamp
 * exceeds the SLA threshold (SLA_MINUTES from constants)
 *
 * Skips DMs that already have an existing SLA breach notification to avoid duplicates
 *
 * @param {object[]} dms - Array of DM objects to check
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @param {string} [options.userId] - Target user/agent for notifications
 * @returns {Promise<{ breaches: object[], checked: number, alreadyNotified: number }>}
 */
export async function checkSLABreaches(dms, options = {}) {
  if (!Array.isArray(dms)) {
    throw new Error('DMs must be an array');
  }

  if (dms.length === 0) {
    return { breaches: [], checked: 0, alreadyNotified: 0 };
  }

  const { performedBy = 'system', userId } = options;

  await simulateLatency(50, 200);

  const now = Date.now();
  const breaches = [];
  let alreadyNotified = 0;

  for (const dm of dms) {
    if (!dm || !dm.id || !dm.timestamp) continue;

    // Only check DMs with status 'New' (not yet responded to)
    if (dm.status !== STATUS.NEW) continue;

    const dmTimestamp = new Date(dm.timestamp).getTime();

    if (isNaN(dmTimestamp)) continue;

    const elapsedMs = now - dmTimestamp;

    // Check if SLA threshold has been exceeded
    if (elapsedMs <= SLA_TIMEOUT_MS) continue;

    const elapsedMinutes = elapsedMs / (60 * 1000);

    // Check if an SLA breach notification already exists for this DM
    try {
      const existingNotifications = await getNotificationsByDMId(dm.id);
      const hasExistingBreach = existingNotifications.some(
        (n) => n.type === NOTIFICATION_TYPE.SLA_BREACH
      );

      if (hasExistingBreach) {
        alreadyNotified++;
        continue;
      }
    } catch {
      // If we can't check existing notifications, proceed with creation
      console.warn(`[notification-service] Failed to check existing notifications for DM: ${dm.id}`);
    }

    // Create SLA breach notification
    try {
      const senderName = dm.sender?.name || null;

      const notification = await createSLABreachNotification(dm.id, {
        elapsedMinutes,
        userId: userId || null,
        senderName,
        performedBy,
      });

      breaches.push(notification);
    } catch (err) {
      console.warn(`[notification-service] Failed to create SLA breach notification for DM ${dm.id}: ${err.message}`);
    }
  }

  // Log the SLA breach check
  if (breaches.length > 0) {
    try {
      await addLog({
        entityType: 'notification',
        entityId: 'sla-breach-check',
        action: 'create',
        performedBy: sanitizeInput(performedBy),
        details: {
          dmsChecked: dms.length,
          breachesFound: breaches.length,
          alreadyNotified,
          slaThresholdMinutes: SLA_MINUTES,
        },
        timestamp: new Date().toISOString(),
      });
    } catch {
      console.warn('[notification-service] Failed to write audit log for SLA breach check');
    }
  }

  return {
    breaches,
    checked: dms.length,
    alreadyNotified,
  };
}

/**
 * Checks a single DM for SLA breach and creates a notification if needed
 *
 * @param {string} dmId - DM identifier
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @param {string} [options.userId] - Target user/agent for notification
 * @returns {Promise<{ breach: boolean, notification: object|null, elapsedMinutes: number|null }>}
 * @throws {Error} If DM not found
 */
export async function checkSingleDMSLABreach(dmId, options = {}) {
  if (!dmId || typeof dmId !== 'string') {
    throw new Error('DM id is required and must be a string');
  }

  const { performedBy = 'system', userId } = options;

  await simulateLatency(30, 80);

  const dm = await getDMById(dmId);

  if (!dm) {
    throw new Error(`DM not found: ${dmId}`);
  }

  // Only check DMs with status 'New'
  if (dm.status !== STATUS.NEW) {
    return { breach: false, notification: null, elapsedMinutes: null };
  }

  const now = Date.now();
  const dmTimestamp = new Date(dm.timestamp).getTime();

  if (isNaN(dmTimestamp)) {
    return { breach: false, notification: null, elapsedMinutes: null };
  }

  const elapsedMs = now - dmTimestamp;
  const elapsedMinutes = elapsedMs / (60 * 1000);

  if (elapsedMs <= SLA_TIMEOUT_MS) {
    return { breach: false, notification: null, elapsedMinutes: Math.round(elapsedMinutes) };
  }

  // Check for existing SLA breach notification
  try {
    const existingNotifications = await getNotificationsByDMId(dmId);
    const hasExistingBreach = existingNotifications.some(
      (n) => n.type === NOTIFICATION_TYPE.SLA_BREACH
    );

    if (hasExistingBreach) {
      return { breach: true, notification: null, elapsedMinutes: Math.round(elapsedMinutes) };
    }
  } catch {
    console.warn(`[notification-service] Failed to check existing notifications for DM: ${dmId}`);
  }

  // Create SLA breach notification
  const notification = await createSLABreachNotification(dmId, {
    elapsedMinutes,
    userId: userId || null,
    senderName: dm.sender?.name || null,
    performedBy,
  });

  return {
    breach: true,
    notification,
    elapsedMinutes: Math.round(elapsedMinutes),
  };
}

/**
 * Creates a notification for a high-priority lead if the lead score meets the threshold
 * Checks the lead's score and creates a notification if it qualifies
 *
 * @param {string} leadId - Lead identifier
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @param {string} [options.userId] - Target user/agent for notification
 * @returns {Promise<{ notified: boolean, notification: object|null, score: number|null }>}
 * @throws {Error} If lead not found
 */
export async function notifyIfHighPriority(leadId, options = {}) {
  if (!leadId || typeof leadId !== 'string') {
    throw new Error('Lead id is required and must be a string');
  }

  const { performedBy = 'system', userId } = options;

  await simulateLatency(30, 80);

  const lead = await getLeadById(leadId);

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const score = typeof lead.score === 'number' ? lead.score : 0;

  if (score < LEAD_SCORE.HOT) {
    return { notified: false, notification: null, score };
  }

  const targetAgent = userId || lead.assignedTo || 'agent-001';

  const notification = await createHighPriorityLeadNotification(leadId, {
    userId: targetAgent,
    score,
    dmId: lead.dmId || null,
    performedBy,
  });

  return {
    notified: true,
    notification,
    score,
  };
}

/**
 * Exported notification type constants for consumers
 */
export { NOTIFICATION_TYPE };