'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import { useDebounce } from '@/hooks/useDebounce';

/**
 * Custom hook for notification management
 * Provides a simplified interface to the NotificationContext
 * Implements notification access patterns for SCRUM-6540, SCRUM-6541
 *
 * Returns:
 * - notifications: Current page of notification objects
 * - unreadCount: Number of unread notifications
 * - counts: Notification counts by read status (total, unread, read)
 * - total: Total number of notifications matching current filters
 * - filters: Active filter/sort/pagination state
 * - loading: Loading state flags
 * - error: Current error state
 * - markAsRead(id): Mark a single notification as read/acknowledged
 * - markAllAsRead(ids): Mark multiple notifications as read
 * - dismiss(id): Remove a notification by ID
 * - dismissForDM(dmId): Remove all notifications for a DM
 * - fetchNotifications(filters): Fetch notifications with filtering
 * - fetchUnread(options): Fetch unread notifications
 * - refreshCounts(): Refresh notification counts
 * - checkSLABreaches(dms): Check DMs for SLA breaches and create alerts
 * - checkSingleDMBreach(dmId): Check a single DM for SLA breach
 * - createSLABreachAlert(dmId, options): Create an SLA breach notification
 * - createHighPriorityNotification(leadId, options): Create a high-priority lead notification
 * - notifyHighPriorityLead(leadId, options): Notify if a lead is high priority
 * - setFilters(filters): Update filter state and refetch
 * - clearError(): Clear the current error
 *
 * @param {object} [options]
 * @param {boolean} [options.autoRefresh=false] - Whether to auto-refresh counts on mount
 * @param {number} [options.refreshInterval=0] - Auto-refresh interval in milliseconds (0 = disabled)
 * @returns {object} Notification management interface
 *
 * @example
 * const { notifications, unreadCount, markAsRead, dismiss, checkSLABreaches } = useNotifications();
 *
 * // Mark a notification as read
 * await markAsRead(notificationId);
 *
 * // Dismiss a notification
 * await dismiss(notificationId);
 *
 * // Check DMs for SLA breaches
 * const result = await checkSLABreaches(dms);
 */
export function useNotifications(options = {}) {
  const { autoRefresh = false, refreshInterval = 0 } = options;

  const {
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
    markAsRead,
    markMultipleAsRead,
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
  } = useNotification();

  // Ref to track mounted state for async operations
  const mountedRef = useRef(true);

  // Ref to track refresh interval
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Auto-refresh counts on mount if enabled
  useEffect(() => {
    if (autoRefresh) {
      refreshCounts().catch(() => {});
    }
  }, [autoRefresh, refreshCounts]);

  // Set up periodic refresh interval if configured
  useEffect(() => {
    if (refreshInterval > 0) {
      const clampedInterval = Math.max(5000, refreshInterval);

      intervalRef.current = setInterval(() => {
        if (mountedRef.current) {
          refreshCounts().catch(() => {});
        }
      }, clampedInterval);

      return () => {
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refreshInterval, refreshCounts]);

  /**
   * Marks a single notification as read/acknowledged
   *
   * @param {number|string} id - Notification identifier
   * @param {object} [markOptions]
   * @param {string} [markOptions.performedBy='system'] - User or system identifier
   * @returns {Promise<object|null>} Updated notification or null on failure
   */
  const markRead = useCallback(async (id, markOptions = {}) => {
    if (id === undefined || id === null) return null;

    return markAsRead(id, markOptions);
  }, [markAsRead]);

  /**
   * Marks multiple notifications as read/acknowledged
   *
   * @param {Array<number|string>} ids - Array of notification identifiers
   * @param {object} [markOptions]
   * @param {string} [markOptions.performedBy='system'] - User or system identifier
   * @returns {Promise<number>} Number of notifications marked as read
   */
  const markAllAsRead = useCallback(async (ids, markOptions = {}) => {
    if (!Array.isArray(ids) || ids.length === 0) return 0;

    return markMultipleAsRead(ids, markOptions);
  }, [markMultipleAsRead]);

  /**
   * Dismisses (removes) a notification by its ID
   *
   * @param {number|string} id - Notification identifier
   * @param {object} [dismissOptions]
   * @param {string} [dismissOptions.performedBy='system'] - User or system identifier
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  const dismiss = useCallback(async (id, dismissOptions = {}) => {
    if (id === undefined || id === null) return false;

    return removeNotificationById(id, dismissOptions);
  }, [removeNotificationById]);

  /**
   * Dismisses all notifications associated with a DM
   *
   * @param {string} dmId - DM identifier
   * @param {object} [dismissOptions]
   * @param {string} [dismissOptions.performedBy='system'] - User or system identifier
   * @returns {Promise<number>} Number of notifications deleted
   */
  const dismissForDM = useCallback(async (dmId, dismissOptions = {}) => {
    if (!dmId || typeof dmId !== 'string') return 0;

    return removeNotificationsForDMId(dmId, dismissOptions);
  }, [removeNotificationsForDMId]);

  /**
   * Checks an array of DMs for SLA breaches and creates breach notifications
   *
   * @param {object[]} dms - Array of DM objects to check
   * @param {object} [checkOptions]
   * @param {string} [checkOptions.performedBy='system'] - User or system identifier
   * @param {string} [checkOptions.userId] - Target user/agent for notifications
   * @returns {Promise<{ breaches: object[], checked: number, alreadyNotified: number }|null>}
   */
  const checkSLABreaches = useCallback(async (dms, checkOptions = {}) => {
    if (!Array.isArray(dms)) return null;

    return checkDMSLABreaches(dms, checkOptions);
  }, [checkDMSLABreaches]);

  /**
   * Gets notifications for a specific DM
   *
   * @param {string} dmId - DM identifier
   * @returns {Promise<object[]>} Array of notification objects for the DM
   */
  const getNotificationsForDM = useCallback(async (dmId) => {
    if (!dmId || typeof dmId !== 'string') return [];

    return getNotificationsForDMId(dmId);
  }, [getNotificationsForDMId]);

  /**
   * Whether any loading operation is in progress
   * @type {boolean}
   */
  const isLoading = loading.list || loading.action || loading.creating || loading.checking;

  return {
    // State
    notifications,
    total,
    unreadCount,
    counts,
    filters,
    loading,
    error,
    isLoading,

    // Read/acknowledge actions
    markAsRead: markRead,
    markAllAsRead,

    // Dismiss actions
    dismiss,
    dismissForDM,

    // Fetch actions
    fetchNotifications,
    fetchUnread,
    refreshCounts,

    // SLA breach actions
    checkSLABreaches,
    checkSingleDMBreach,
    createSLABreachAlert,

    // High-priority lead actions
    createHighPriorityNotification,
    notifyHighPriorityLead,

    // General notification creation
    createNotification: createNewNotification,

    // DM-specific queries
    getNotificationsForDM,

    // Filter management
    setFilters,

    // Error management
    clearError,
  };
}

export default useNotifications;