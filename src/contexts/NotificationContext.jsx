'use client';

import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  createNotification,
  createHighPriorityLeadNotification,
  createSLABreachNotification,
  getNotifications,
  markNotificationAsRead,
  markMultipleNotificationsAsRead,
  getUnread,
  getNotificationCounts,
  getNotificationsForDM,
  removeNotification,
  removeNotificationsForDM,
  checkSLABreaches,
  checkSingleDMSLABreach,
  notifyIfHighPriority,
  NOTIFICATION_TYPE,
} from '@/services/notification-service';
import { PAGINATION } from '@/utils/constants';

/**
 * Notification Context
 * Manages notification list, unread count, and SLA breach alerts
 * Wraps NotificationService
 * Implements NotificationContext from LLD (SCRUM-6540, SCRUM-6541)
 *
 * Provides:
 * - notifications: Current page of notification objects
 * - unreadCount: Number of unread notifications
 * - counts: Notification counts by read status
 * - filters: Active filter/sort/pagination state
 * - loading: Loading state flags
 * - error: Current error state
 * - fetchNotifications(filters): Fetch notifications with filtering, sorting, and pagination
 * - createNewNotification(type, payload, linkedLeadId): Create a new notification
 * - createHighPriorityNotification(leadId, options): Create a high-priority lead notification
 * - createSLABreachAlert(dmId, options): Create an SLA breach notification
 * - markAsRead(id, options): Mark a notification as read/acknowledged
 * - markMultipleAsRead(ids, options): Mark multiple notifications as read
 * - fetchUnread(options): Fetch unread notifications
 * - refreshCounts(): Refresh notification counts
 * - checkDMSLABreaches(dms, options): Check DMs for SLA breaches
 * - checkSingleDMBreach(dmId, options): Check a single DM for SLA breach
 * - notifyHighPriorityLead(leadId, options): Notify if a lead is high priority
 * - removeNotificationById(id, options): Remove a notification
 * - removeNotificationsForDMId(dmId, options): Remove all notifications for a DM
 * - getNotificationsForDMId(dmId): Get notifications for a specific DM
 * - setFilters(filters): Update filter state and refetch
 * - clearError(): Clear the current error
 */

/**
 * @typedef {object} NotificationFilters
 * @property {number} page - Current page number (1-based)
 * @property {number} pageSize - Items per page
 * @property {string} type - Notification type filter
 * @property {boolean} [read] - Read status filter
 * @property {string} dmId - DM ID filter
 * @property {string} sortBy - Field to sort by
 * @property {string} sortOrder - Sort order ('asc' or 'desc')
 */

/**
 * @typedef {object} NotificationCounts
 * @property {number} total - Total notification count
 * @property {number} unread - Unread notification count
 * @property {number} read - Read notification count
 */

/**
 * @typedef {object} NotificationLoadingState
 * @property {boolean} list - Whether the notification list is loading
 * @property {boolean} action - Whether a notification action is in progress
 * @property {boolean} creating - Whether a notification is being created
 * @property {boolean} checking - Whether SLA breach check is in progress
 */

/**
 * @typedef {object} NotificationContextValue
 * @property {object[]} notifications - Current page of notification objects
 * @property {number} total - Total number of notifications matching current filters
 * @property {number} unreadCount - Number of unread notifications
 * @property {NotificationCounts} counts - Notification counts by read status
 * @property {NotificationFilters} filters - Active filter/sort/pagination state
 * @property {NotificationLoadingState} loading - Loading state flags
 * @property {string|null} error - Current error message
 * @property {Function} fetchNotifications - Fetch notifications with filters
 * @property {Function} createNewNotification - Create a new notification
 * @property {Function} createHighPriorityNotification - Create a high-priority lead notification
 * @property {Function} createSLABreachAlert - Create an SLA breach notification
 * @property {Function} markAsRead - Mark a notification as read
 * @property {Function} markMultipleAsRead - Mark multiple notifications as read
 * @property {Function} fetchUnread - Fetch unread notifications
 * @property {Function} refreshCounts - Refresh notification counts
 * @property {Function} checkDMSLABreaches - Check DMs for SLA breaches
 * @property {Function} checkSingleDMBreach - Check a single DM for SLA breach
 * @property {Function} notifyHighPriorityLead - Notify if a lead is high priority
 * @property {Function} removeNotificationById - Remove a notification
 * @property {Function} removeNotificationsForDMId - Remove all notifications for a DM
 * @property {Function} getNotificationsForDMId - Get notifications for a specific DM
 * @property {Function} setFilters - Update filters and refetch
 * @property {Function} clearError - Clear the current error
 */

const NotificationContext = createContext(null);

/**
 * Default filter state
 */
const DEFAULT_FILTERS = Object.freeze({
  page: 1,
  pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
  type: '',
  read: undefined,
  dmId: '',
  sortBy: 'timestamp',
  sortOrder: 'desc',
});

/**
 * Default counts state
 */
const DEFAULT_COUNTS = Object.freeze({
  total: 0,
  unread: 0,
  read: 0,
});

/**
 * Default loading state
 */
const DEFAULT_LOADING = Object.freeze({
  list: false,
  action: false,
  creating: false,
  checking: false,
});

/**
 * Notification Context provider component
 * Manages notification list, unread count, SLA breach alerts, and notification lifecycle
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement}
 */
export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [counts, setCounts] = useState({ ...DEFAULT_COUNTS });
  const [filters, setFiltersState] = useState({ ...DEFAULT_FILTERS });
  const [loading, setLoading] = useState({ ...DEFAULT_LOADING });
  const [error, setError] = useState(null);

  // Ref to track mounted state for async operations
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Helper to safely update state only if component is still mounted
   */
  const safeSetState = useCallback((setter, value) => {
    if (mountedRef.current) {
      setter(value);
    }
  }, []);

  /**
   * Updates a specific loading flag
   *
   * @param {string} key - Loading state key
   * @param {boolean} value - Loading state value
   */
  const setLoadingFlag = useCallback((key, value) => {
    if (mountedRef.current) {
      setLoading((prev) => ({ ...prev, [key]: value }));
    }
  }, []);

  /**
   * Clears the current error state
   */
  const clearError = useCallback(() => {
    safeSetState(setError, null);
  }, [safeSetState]);

  /**
   * Refreshes notification counts for badges
   *
   * @returns {Promise<NotificationCounts>}
   */
  const refreshCounts = useCallback(async () => {
    try {
      const newCounts = await getNotificationCounts();
      safeSetState(setCounts, newCounts);
      safeSetState(setUnreadCount, newCounts.unread);
      return newCounts;
    } catch (err) {
      console.warn('[NotificationContext] Failed to refresh notification counts:', err.message);
      return counts;
    }
  }, [safeSetState, counts]);

  /**
   * Fetches notifications with the provided or current filters
   * Updates the notification list, total count, and refreshes counts
   *
   * @param {Partial<NotificationFilters>} [filterOverrides] - Optional filter overrides
   * @returns {Promise<{ notifications: object[], total: number }>}
   */
  const fetchNotifications = useCallback(async (filterOverrides = {}) => {
    setLoadingFlag('list', true);
    clearError();

    try {
      const activeFilters = { ...filters, ...filterOverrides };

      const result = await getNotifications({
        page: activeFilters.page,
        pageSize: activeFilters.pageSize,
        type: activeFilters.type || undefined,
        read: activeFilters.read,
        dmId: activeFilters.dmId || undefined,
        sortBy: activeFilters.sortBy,
        sortOrder: activeFilters.sortOrder,
      });

      safeSetState(setNotifications, result.notifications);
      safeSetState(setTotal, result.total);

      // Refresh counts in the background
      refreshCounts().catch(() => {});

      return { notifications: result.notifications, total: result.total };
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch notifications';
      safeSetState(setError, errorMessage);
      console.warn('[NotificationContext] Failed to fetch notifications:', errorMessage);
      return { notifications: [], total: 0 };
    } finally {
      setLoadingFlag('list', false);
    }
  }, [filters, setLoadingFlag, clearError, safeSetState, refreshCounts]);

  /**
   * Creates a new notification
   *
   * @param {string} type - Notification type ('high_priority_lead' or 'sla_breach')
   * @param {object} payload - Notification payload
   * @param {string} payload.message - Notification message
   * @param {string} [payload.dmId] - Associated DM identifier
   * @param {string} [payload.userId] - Target user identifier
   * @param {string} [payload.performedBy='system'] - User or system identifier
   * @param {string} [linkedLeadId] - Associated lead identifier
   * @returns {Promise<object|null>} Saved notification or null on failure
   */
  const createNewNotification = useCallback(async (type, payload = {}, linkedLeadId) => {
    if (!type || typeof type !== 'string') {
      safeSetState(setError, 'Notification type is required and must be a string');
      return null;
    }

    if (!payload || typeof payload !== 'object') {
      safeSetState(setError, 'Notification payload must be a non-null object');
      return null;
    }

    if (!payload.message || typeof payload.message !== 'string' || payload.message.trim().length === 0) {
      safeSetState(setError, 'Notification payload must have a non-empty message');
      return null;
    }

    setLoadingFlag('creating', true);
    clearError();

    try {
      const notification = await createNotification(type, payload, linkedLeadId);

      // Add the new notification to the list
      safeSetState(setNotifications, (prev) => [notification, ...prev]);

      // Refresh counts in the background
      refreshCounts().catch(() => {});

      return notification;
    } catch (err) {
      const errorMessage = err.message || 'Failed to create notification';
      safeSetState(setError, errorMessage);
      console.warn('[NotificationContext] Failed to create notification:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('creating', false);
    }
  }, [setLoadingFlag, clearError, safeSetState, refreshCounts]);

  /**
   * Creates a high-priority lead notification
   *
   * @param {string} leadId - Lead identifier
   * @param {object} [options]
   * @param {string} [options.userId] - Target user/agent identifier
   * @param {number} [options.score] - Lead score
   * @param {string} [options.dmId] - Associated DM identifier
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<object|null>} Saved notification or null on failure
   */
  const createHighPriorityNotification = useCallback(async (leadId, options = {}) => {
    if (!leadId || typeof leadId !== 'string') {
      safeSetState(setError, 'Lead id is required and must be a string');
      return null;
    }

    setLoadingFlag('creating', true);
    clearError();

    try {
      const notification = await createHighPriorityLeadNotification(leadId, options);

      // Add the new notification to the list
      safeSetState(setNotifications, (prev) => [notification, ...prev]);

      // Refresh counts in the background
      refreshCounts().catch(() => {});

      return notification;
    } catch (err) {
      const errorMessage = err.message || 'Failed to create high-priority lead notification';
      safeSetState(setError, errorMessage);
      console.warn('[NotificationContext] Failed to create high-priority notification:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('creating', false);
    }
  }, [setLoadingFlag, clearError, safeSetState, refreshCounts]);

  /**
   * Creates an SLA breach notification
   *
   * @param {string} dmId - DM identifier
   * @param {object} [options]
   * @param {number} [options.elapsedMinutes] - Minutes elapsed since DM was received
   * @param {string} [options.userId] - Target user/agent identifier
   * @param {string} [options.senderName] - Sender display name
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<object|null>} Saved notification or null on failure
   */
  const createSLABreachAlert = useCallback(async (dmId, options = {}) => {
    if (!dmId || typeof dmId !== 'string') {
      safeSetState(setError, 'DM id is required and must be a string');
      return null;
    }

    setLoadingFlag('creating', true);
    clearError();

    try {
      const notification = await createSLABreachNotification(dmId, options);

      // Add the new notification to the list
      safeSetState(setNotifications, (prev) => [notification, ...prev]);

      // Refresh counts in the background
      refreshCounts().catch(() => {});

      return notification;
    } catch (err) {
      const errorMessage = err.message || 'Failed to create SLA breach notification';
      safeSetState(setError, errorMessage);
      console.warn('[NotificationContext] Failed to create SLA breach alert:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('creating', false);
    }
  }, [setLoadingFlag, clearError, safeSetState, refreshCounts]);

  /**
   * Marks a notification as read/acknowledged
   *
   * @param {number|string} id - Notification identifier
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<object|null>} Updated notification or null on failure
   */
  const markAsReadAction = useCallback(async (id, options = {}) => {
    if (id === undefined || id === null) {
      safeSetState(setError, 'Notification id is required');
      return null;
    }

    setLoadingFlag('action', true);
    clearError();

    try {
      const updatedNotification = await markNotificationAsRead(id, options);

      // Update the notification in the current list
      safeSetState(setNotifications, (prev) =>
        prev.map((n) => (n.id === id ? updatedNotification : n))
      );

      // Refresh counts in the background
      refreshCounts().catch(() => {});

      return updatedNotification;
    } catch (err) {
      const errorMessage = err.message || 'Failed to mark notification as read';
      safeSetState(setError, errorMessage);
      console.warn('[NotificationContext] Failed to mark notification as read:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('action', false);
    }
  }, [setLoadingFlag, clearError, safeSetState, refreshCounts]);

  /**
   * Marks multiple notifications as read/acknowledged
   *
   * @param {Array<number|string>} ids - Array of notification identifiers
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<number>} Number of notifications marked as read
   */
  const markMultipleAsReadAction = useCallback(async (ids, options = {}) => {
    if (!Array.isArray(ids) || ids.length === 0) return 0;

    setLoadingFlag('action', true);
    clearError();

    try {
      const count = await markMultipleNotificationsAsRead(ids, options);

      // Update the notifications in the current list
      const idSet = new Set(ids);
      safeSetState(setNotifications, (prev) =>
        prev.map((n) => {
          if (idSet.has(n.id)) {
            return { ...n, read: true, acknowledgedAt: new Date().toISOString() };
          }
          return n;
        })
      );

      // Refresh counts in the background
      refreshCounts().catch(() => {});

      return count;
    } catch (err) {
      const errorMessage = err.message || 'Failed to mark notifications as read';
      safeSetState(setError, errorMessage);
      console.warn('[NotificationContext] Failed to mark multiple notifications as read:', errorMessage);
      return 0;
    } finally {
      setLoadingFlag('action', false);
    }
  }, [setLoadingFlag, clearError, safeSetState, refreshCounts]);

  /**
   * Fetches unread notifications
   *
   * @param {object} [options]
   * @param {string} [options.type] - Filter by notification type
   * @param {string} [options.userId] - Filter by target user ID
   * @returns {Promise<object[]>} Array of unread notification objects
   */
  const fetchUnread = useCallback(async (options = {}) => {
    setLoadingFlag('list', true);
    clearError();

    try {
      const unreadNotifications = await getUnread(options);
      return unreadNotifications;
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch unread notifications';
      safeSetState(setError, errorMessage);
      console.warn('[NotificationContext] Failed to fetch unread notifications:', errorMessage);
      return [];
    } finally {
      setLoadingFlag('list', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Checks an array of DMs for SLA breaches and creates breach notifications
   *
   * @param {object[]} dms - Array of DM objects to check
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @param {string} [options.userId] - Target user/agent for notifications
   * @returns {Promise<{ breaches: object[], checked: number, alreadyNotified: number }|null>}
   */
  const checkDMSLABreaches = useCallback(async (dms, options = {}) => {
    if (!Array.isArray(dms)) {
      safeSetState(setError, 'DMs must be an array');
      return null;
    }

    setLoadingFlag('checking', true);
    clearError();

    try {
      const result = await checkSLABreaches(dms, options);

      // Add new breach notifications to the list
      if (result.breaches && result.breaches.length > 0) {
        safeSetState(setNotifications, (prev) => [...result.breaches, ...prev]);

        // Refresh counts in the background
        refreshCounts().catch(() => {});
      }

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to check SLA breaches';
      safeSetState(setError, errorMessage);
      console.warn('[NotificationContext] Failed to check SLA breaches:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('checking', false);
    }
  }, [setLoadingFlag, clearError, safeSetState, refreshCounts]);

  /**
   * Checks a single DM for SLA breach
   *
   * @param {string} dmId - DM identifier
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @param {string} [options.userId] - Target user/agent for notification
   * @returns {Promise<{ breach: boolean, notification: object|null, elapsedMinutes: number|null }|null>}
   */
  const checkSingleDMBreach = useCallback(async (dmId, options = {}) => {
    if (!dmId || typeof dmId !== 'string') {
      safeSetState(setError, 'DM id is required and must be a string');
      return null;
    }

    setLoadingFlag('checking', true);
    clearError();

    try {
      const result = await checkSingleDMSLABreach(dmId, options);

      // Add breach notification to the list if created
      if (result.notification) {
        safeSetState(setNotifications, (prev) => [result.notification, ...prev]);

        // Refresh counts in the background
        refreshCounts().catch(() => {});
      }

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to check DM SLA breach';
      safeSetState(setError, errorMessage);
      console.warn('[NotificationContext] Failed to check single DM SLA breach:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('checking', false);
    }
  }, [setLoadingFlag, clearError, safeSetState, refreshCounts]);

  /**
   * Notifies if a lead is high priority
   *
   * @param {string} leadId - Lead identifier
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @param {string} [options.userId] - Target user/agent for notification
   * @returns {Promise<{ notified: boolean, notification: object|null, score: number|null }|null>}
   */
  const notifyHighPriorityLead = useCallback(async (leadId, options = {}) => {
    if (!leadId || typeof leadId !== 'string') {
      safeSetState(setError, 'Lead id is required and must be a string');
      return null;
    }

    setLoadingFlag('creating', true);
    clearError();

    try {
      const result = await notifyIfHighPriority(leadId, options);

      // Add notification to the list if created
      if (result.notification) {
        safeSetState(setNotifications, (prev) => [result.notification, ...prev]);

        // Refresh counts in the background
        refreshCounts().catch(() => {});
      }

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to check high-priority lead notification';
      safeSetState(setError, errorMessage);
      console.warn('[NotificationContext] Failed to notify high-priority lead:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('creating', false);
    }
  }, [setLoadingFlag, clearError, safeSetState, refreshCounts]);

  /**
   * Removes a notification by its ID
   *
   * @param {number|string} id - Notification identifier
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  const removeNotificationById = useCallback(async (id, options = {}) => {
    if (id === undefined || id === null) {
      safeSetState(setError, 'Notification id is required');
      return false;
    }

    setLoadingFlag('action', true);
    clearError();

    try {
      const deleted = await removeNotification(id, options);

      if (deleted) {
        // Remove the notification from the current list
        safeSetState(setNotifications, (prev) => prev.filter((n) => n.id !== id));

        // Refresh counts in the background
        refreshCounts().catch(() => {});
      }

      return deleted;
    } catch (err) {
      const errorMessage = err.message || 'Failed to remove notification';
      safeSetState(setError, errorMessage);
      console.warn('[NotificationContext] Failed to remove notification:', errorMessage);
      return false;
    } finally {
      setLoadingFlag('action', false);
    }
  }, [setLoadingFlag, clearError, safeSetState, refreshCounts]);

  /**
   * Removes all notifications associated with a DM
   *
   * @param {string} dmId - DM identifier
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<number>} Number of notifications deleted
   */
  const removeNotificationsForDMId = useCallback(async (dmId, options = {}) => {
    if (!dmId || typeof dmId !== 'string') {
      safeSetState(setError, 'DM id is required and must be a string');
      return 0;
    }

    setLoadingFlag('action', true);
    clearError();

    try {
      const count = await removeNotificationsForDM(dmId, options);

      if (count > 0) {
        // Remove the notifications from the current list
        safeSetState(setNotifications, (prev) => prev.filter((n) => n.dmId !== dmId));

        // Refresh counts in the background
        refreshCounts().catch(() => {});
      }

      return count;
    } catch (err) {
      const errorMessage = err.message || 'Failed to remove notifications for DM';
      safeSetState(setError, errorMessage);
      console.warn('[NotificationContext] Failed to remove notifications for DM:', errorMessage);
      return 0;
    } finally {
      setLoadingFlag('action', false);
    }
  }, [setLoadingFlag, clearError, safeSetState, refreshCounts]);

  /**
   * Gets notifications for a specific DM
   *
   * @param {string} dmId - DM identifier
   * @returns {Promise<object[]>} Array of notification objects for the DM
   */
  const getNotificationsForDMId = useCallback(async (dmId) => {
    if (!dmId || typeof dmId !== 'string') {
      return [];
    }

    try {
      return await getNotificationsForDM(dmId);
    } catch (err) {
      console.warn('[NotificationContext] Failed to get notifications for DM:', err.message);
      return [];
    }
  }, []);

  /**
   * Updates filter state and refetches notifications
   *
   * @param {Partial<NotificationFilters>} newFilters - Filter updates to apply
   * @returns {Promise<{ notifications: object[], total: number }>}
   */
  const setFilters = useCallback(async (newFilters) => {
    const mergedFilters = { ...filters, ...newFilters };

    // Reset to page 1 when filters change (except when explicitly setting page)
    if (
      newFilters.type !== undefined ||
      newFilters.read !== undefined ||
      newFilters.dmId !== undefined
    ) {
      if (newFilters.page === undefined) {
        mergedFilters.page = 1;
      }
    }

    safeSetState(setFiltersState, mergedFilters);

    return fetchNotifications(mergedFilters);
  }, [filters, safeSetState, fetchNotifications]);

  const contextValue = useMemo(
    () => ({
      notifications,
      total,
      unreadCount,
      counts,
      filters,
      loading,
      error,
      fetchNotifications,
      createNewNotification,
      createHighPriorityNotification,
      createSLABreachAlert,
      markAsRead: markAsReadAction,
      markMultipleAsRead: markMultipleAsReadAction,
      fetchUnread,
      refreshCounts,
      checkDMSLABreaches,
      checkSingleDMBreach,
      notifyHighPriorityLead,
      removeNotificationById,
      removeNotificationsForDMId,
      getNotificationsForDMId,
      setFilters,
      clearError,
    }),
    [
      notifications,
      total,
      unreadCount,
      counts,
      filters,
      loading,
      error,
      fetchNotifications,
      createNewNotification,
      createHighPriorityNotification,
      createSLABreachAlert,
      markAsReadAction,
      markMultipleAsReadAction,
      fetchUnread,
      refreshCounts,
      checkDMSLABreaches,
      checkSingleDMBreach,
      notifyHighPriorityLead,
      removeNotificationById,
      removeNotificationsForDMId,
      getNotificationsForDMId,
      setFilters,
      clearError,
    ]
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Hook to access the notification context
 * Must be used within a NotificationProvider
 *
 * @returns {NotificationContextValue} Notification context value
 * @throws {Error} If used outside of NotificationProvider
 */
export function useNotification() {
  const context = useContext(NotificationContext);

  if (context === null) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }

  return context;
}

export default NotificationContext;