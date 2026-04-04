'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import { useDM } from '@/contexts/DMContext';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import Tooltip from '@/components/common/Tooltip';
import Toast from '@/components/common/Toast';
import LeadScoreBadge from '@/components/lead/LeadScoreBadge';
import PlatformIcon from '@/components/common/PlatformIcon';
import { formatTimestamp } from '@/utils/formatters';
import { PAGINATION } from '@/utils/constants';

/**
 * Size variant mappings for the notification panel
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    container: 'text-xs',
    heading: 'text-sm',
    body: 'text-xs',
    meta: 'text-xs',
    label: 'text-xs',
    padding: 'px-3 py-2',
    item: 'px-3 py-2.5',
  },
  md: {
    container: 'text-sm',
    heading: 'text-sm',
    body: 'text-sm',
    meta: 'text-xs',
    label: 'text-xs',
    padding: 'px-4 py-3',
    item: 'px-4 py-3',
  },
  lg: {
    container: 'text-base',
    heading: 'text-base',
    body: 'text-sm',
    meta: 'text-sm',
    label: 'text-sm',
    padding: 'px-5 py-4',
    item: 'px-5 py-4',
  },
});

/**
 * Notification type style mappings
 */
const NOTIFICATION_TYPE_STYLES = Object.freeze({
  high_priority_lead: {
    bg: 'bg-brand-50',
    border: 'border-brand-200',
    iconBg: 'bg-brand-100',
    iconText: 'text-brand-600',
    label: 'High-Priority Lead',
    unreadBg: 'bg-brand-50/70',
  },
  sla_breach: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    label: 'SLA Breach',
    unreadBg: 'bg-red-50/70',
  },
});

/**
 * Default style for unknown notification types
 */
const DEFAULT_TYPE_STYLE = {
  bg: 'bg-neutral-50',
  border: 'border-neutral-200',
  iconBg: 'bg-neutral-100',
  iconText: 'text-neutral-600',
  label: 'Notification',
  unreadBg: 'bg-neutral-50/70',
};

/**
 * Filter options for the notification type dropdown
 */
const TYPE_FILTER_OPTIONS = Object.freeze([
  { value: '', label: 'All Types' },
  { value: 'high_priority_lead', label: 'High-Priority Leads' },
  { value: 'sla_breach', label: 'SLA Breaches' },
]);

/**
 * Filter options for the read status dropdown
 */
const READ_FILTER_OPTIONS = Object.freeze([
  { value: '', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
]);

/**
 * High-priority lead icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function HighPriorityLeadIcon({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
      />
    </svg>
  );
}

/**
 * SLA breach icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function SLABreachIcon({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

/**
 * Bell icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function BellIcon({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
      />
    </svg>
  );
}

/**
 * Check icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function CheckIcon({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

/**
 * Close icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function CloseIcon({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/**
 * Chevron icon for pagination
 *
 * @param {object} props
 * @param {'left'|'right'} props.direction - Arrow direction
 * @param {string} props.className - Tailwind classes
 * @returns {React.ReactElement}
 */
function ChevronIcon({ direction, className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      {direction === 'left' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      )}
    </svg>
  );
}

/**
 * Refresh icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes
 * @returns {React.ReactElement}
 */
function RefreshIcon({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

/**
 * Returns the appropriate icon component for a notification type
 *
 * @param {string} type - Notification type
 * @param {string} className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function NotificationTypeIcon({ type, className }) {
  switch (type) {
    case 'high_priority_lead':
      return <HighPriorityLeadIcon className={className} />;
    case 'sla_breach':
      return <SLABreachIcon className={className} />;
    default:
      return <BellIcon className={className} />;
  }
}

/**
 * Notification item component
 * Renders a single notification with type icon, message, timestamp,
 * read/unread status, and action buttons
 *
 * @param {object} props
 * @param {object} props.notification - Notification object
 * @param {object} props.sizeClass - Size variant classes
 * @param {Function} props.onMarkAsRead - Callback when mark as read is clicked
 * @param {Function} props.onDismiss - Callback when dismiss is clicked
 * @param {Function} [props.onSelect] - Callback when notification is clicked
 * @param {boolean} props.isAnyLoading - Whether any loading operation is in progress
 * @returns {React.ReactElement}
 */
function NotificationItem({ notification, sizeClass, onMarkAsRead, onDismiss, onSelect, isAnyLoading }) {
  const typeStyle = NOTIFICATION_TYPE_STYLES[notification.type] || DEFAULT_TYPE_STYLE;
  const isUnread = !notification.read;

  /**
   * Handles click on the notification item
   */
  function handleClick() {
    if (typeof onSelect === 'function') {
      onSelect(notification);
    }
  }

  /**
   * Handles keyboard activation (Enter or Space)
   *
   * @param {React.KeyboardEvent} event
   */
  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }

  /**
   * Handles mark as read button click
   *
   * @param {React.MouseEvent} event
   */
  function handleMarkAsRead(event) {
    event.stopPropagation();
    if (typeof onMarkAsRead === 'function') {
      onMarkAsRead(notification.id);
    }
  }

  /**
   * Handles dismiss button click
   *
   * @param {React.MouseEvent} event
   */
  function handleDismiss(event) {
    event.stopPropagation();
    if (typeof onDismiss === 'function') {
      onDismiss(notification.id);
    }
  }

  const itemClasses = [
    'relative flex items-start gap-3 border-b border-neutral-200 transition-colors cursor-pointer',
    sizeClass.item,
    isUnread ? `${typeStyle.unreadBg} border-l-4 ${typeStyle.border.replace('border-', 'border-l-')}` : 'border-l-4 border-l-transparent hover:bg-neutral-50',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <div
      className={itemClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="listitem"
      aria-label={`${typeStyle.label}: ${notification.message || ''}`}
      tabIndex={0}
    >
      {/* Type icon */}
      <div className={`shrink-0 flex items-center justify-center h-8 w-8 rounded-full ${typeStyle.iconBg}`}>
        <NotificationTypeIcon type={notification.type} className={`h-4 w-4 ${typeStyle.iconText}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Header row: type label and timestamp */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Unread dot */}
            {isUnread && (
              <span
                className="inline-block h-2 w-2 rounded-full bg-blue-500 shrink-0"
                aria-hidden="true"
              />
            )}
            <span className={`font-semibold truncate ${isUnread ? 'text-neutral-900' : 'text-neutral-600'} ${sizeClass.body}`}>
              {typeStyle.label}
            </span>
          </div>
          <span className={`text-neutral-400 shrink-0 whitespace-nowrap ${sizeClass.meta}`}>
            {formatTimestamp(notification.timestamp)}
          </span>
        </div>

        {/* Message */}
        <p className={`leading-snug ${isUnread ? 'text-neutral-800 font-medium' : 'text-neutral-600'} ${sizeClass.body}`}>
          {notification.message || 'No message content.'}
        </p>

        {/* Linked entity info */}
        <div className="flex items-center gap-2 flex-wrap">
          {notification.leadId && (
            <span className="badge badge-neutral text-xs">
              Lead: {notification.leadId}
            </span>
          )}
          {notification.dmId && (
            <span className="badge badge-neutral text-xs">
              DM: {notification.dmId}
            </span>
          )}
          {notification.read && notification.acknowledgedAt && (
            <span className={`text-neutral-400 ${sizeClass.meta}`}>
              Read {formatTimestamp(notification.acknowledgedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Mark as read button (only for unread) */}
        {isUnread && (
          <Tooltip content="Mark as read">
            <button
              type="button"
              onClick={handleMarkAsRead}
              disabled={isAnyLoading}
              className="inline-flex items-center justify-center rounded-xl p-1.5 text-neutral-400 hover:text-brand-600 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Mark notification as read"
            >
              <CheckIcon className="h-4 w-4" />
            </button>
          </Tooltip>
        )}

        {/* Dismiss button */}
        <Tooltip content="Dismiss notification">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isAnyLoading}
            className="inline-flex items-center justify-center rounded-xl p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Dismiss notification"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

/**
 * NotificationPanel component
 * Notification Center panel: displays list of notifications (high-priority lead alerts,
 * SLA breach warnings) with type icons, timestamps, linked lead info, read/unread status,
 * and dismiss actions.
 *
 * Implements FR-007 (SCRUM-6540, SCRUM-6541)
 *
 * Features:
 * - Paginated notification list with configurable page size
 * - Type filter dropdown (All, High-Priority Leads, SLA Breaches)
 * - Read status filter dropdown (All, Unread, Read)
 * - Notification type icons (flag for high-priority leads, clock for SLA breaches)
 * - Unread indicator dot and bold styling for unread notifications
 * - Mark as read action per notification
 * - Mark all as read bulk action
 * - Dismiss (remove) action per notification
 * - Linked lead ID and DM ID badges
 * - Timestamp display with relative formatting
 * - Unread count badge in header
 * - Refresh button to reload notifications
 * - Auto-load on mount
 * - Loading and empty states
 * - Toast notifications for actions
 * - Responsive layout
 * - ARIA roles for accessibility
 *
 * @param {object} props
 * @param {Function} [props.onSelectNotification] - Callback when a notification is clicked (receives notification object)
 * @param {Function} [props.onSelectDM] - Callback when a DM-linked notification is clicked (receives dmId)
 * @param {Function} [props.onSelectLead] - Callback when a lead-linked notification is clicked (receives leadId)
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the panel
 * @param {boolean} [props.showHeader=true] - Whether to show the panel header with counts
 * @param {boolean} [props.showFilters=true] - Whether to show the filter dropdowns
 * @param {boolean} [props.showPagination=true] - Whether to show pagination controls
 * @param {boolean} [props.showRefresh=true] - Whether to show the refresh button
 * @param {boolean} [props.showMarkAllRead=true] - Whether to show the mark all as read button
 * @param {boolean} [props.autoLoad=true] - Whether to auto-load notifications on mount
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <NotificationPanel onSelectNotification={handleSelect} />
 *
 * @example
 * <NotificationPanel
 *   size="sm"
 *   showFilters={false}
 *   showPagination={false}
 *   onSelectDM={handleSelectDM}
 *   onSelectLead={handleSelectLead}
 * />
 */
export function NotificationPanel({
  onSelectNotification,
  onSelectDM,
  onSelectLead,
  size = 'md',
  showHeader = true,
  showFilters = true,
  showPagination = true,
  showRefresh = true,
  showMarkAllRead = true,
  autoLoad = true,
  className = '',
}) {
  const {
    notifications,
    total,
    unreadCount,
    counts,
    filters,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markMultipleAsRead,
    refreshCounts,
    removeNotificationById,
    setFilters,
    clearError,
  } = useNotification();

  const [toast, setToast] = useState(null);
  const [localTypeFilter, setLocalTypeFilter] = useState('');
  const [localReadFilter, setLocalReadFilter] = useState('');

  const listRef = useRef(null);
  const mountedRef = useRef(true);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  /**
   * Auto-load notifications on mount if enabled
   */
  useEffect(() => {
    if (autoLoad && !initialLoadRef.current) {
      initialLoadRef.current = true;
      fetchNotifications({ page: 1 }).catch(() => {});
      refreshCounts().catch(() => {});
    }
  }, [autoLoad, fetchNotifications, refreshCounts]);

  /**
   * Shows a toast notification
   *
   * @param {string} message - Toast message
   * @param {'success'|'error'|'warning'|'info'} variant - Toast variant
   */
  function showToast(message, variant = 'info') {
    if (mountedRef.current) {
      setToast({ message, variant, key: Date.now() });
    }
  }

  /**
   * Handles type filter dropdown changes
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   */
  function handleTypeFilterChange(event) {
    const value = event.target.value;
    setLocalTypeFilter(value);
    setFilters({ type: value || undefined, page: 1 });
  }

  /**
   * Handles read status filter dropdown changes
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   */
  function handleReadFilterChange(event) {
    const value = event.target.value;
    setLocalReadFilter(value);

    let readValue;
    if (value === 'unread') {
      readValue = false;
    } else if (value === 'read') {
      readValue = true;
    } else {
      readValue = undefined;
    }

    setFilters({ read: readValue, page: 1 });
  }

  /**
   * Handles marking a single notification as read
   *
   * @param {number|string} id - Notification identifier
   */
  const handleMarkAsRead = useCallback(async (id) => {
    if (id === undefined || id === null) return;

    const result = await markAsRead(id);

    if (result) {
      showToast('Notification marked as read.', 'success');
    } else {
      showToast('Failed to mark notification as read.', 'error');
    }
  }, [markAsRead]);

  /**
   * Handles marking all visible unread notifications as read
   */
  const handleMarkAllAsRead = useCallback(async () => {
    const unreadIds = notifications
      .filter((n) => !n.read)
      .map((n) => n.id);

    if (unreadIds.length === 0) {
      showToast('No unread notifications to mark.', 'info');
      return;
    }

    const count = await markMultipleAsRead(unreadIds);

    if (count > 0) {
      showToast(`${count} notification${count !== 1 ? 's' : ''} marked as read.`, 'success');
    } else {
      showToast('Failed to mark notifications as read.', 'error');
    }
  }, [notifications, markMultipleAsRead]);

  /**
   * Handles dismissing (removing) a notification
   *
   * @param {number|string} id - Notification identifier
   */
  const handleDismiss = useCallback(async (id) => {
    if (id === undefined || id === null) return;

    const deleted = await removeNotificationById(id);

    if (deleted) {
      showToast('Notification dismissed.', 'success');
    } else {
      showToast('Failed to dismiss notification.', 'error');
    }
  }, [removeNotificationById]);

  /**
   * Handles selecting a notification
   * Routes to the appropriate handler based on linked entity
   *
   * @param {object} notification - Notification object
   */
  const handleSelectNotification = useCallback((notification) => {
    if (!notification) return;

    // Mark as read on selection if unread
    if (!notification.read) {
      markAsRead(notification.id).catch(() => {});
    }

    // Notify parent
    if (typeof onSelectNotification === 'function') {
      onSelectNotification(notification);
    }

    // Route to DM if linked
    if (notification.dmId && typeof onSelectDM === 'function') {
      onSelectDM(notification.dmId);
    }

    // Route to lead if linked
    if (notification.leadId && typeof onSelectLead === 'function') {
      onSelectLead(notification.leadId);
    }
  }, [onSelectNotification, onSelectDM, onSelectLead, markAsRead]);

  /**
   * Handles page navigation
   *
   * @param {number} page - Target page number
   */
  const handlePageChange = useCallback((page) => {
    setFilters({ page });

    // Scroll list to top on page change
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [setFilters]);

  /**
   * Handles refresh button click
   */
  const handleRefresh = useCallback(async () => {
    clearError();
    await fetchNotifications(filters);
    await refreshCounts();
  }, [clearError, fetchNotifications, filters, refreshCounts]);

  /**
   * Handles clearing all filters
   */
  function handleClearFilters() {
    setLocalTypeFilter('');
    setLocalReadFilter('');
    setFilters({
      type: undefined,
      read: undefined,
      page: 1,
    });
  }

  // Calculate pagination values
  const currentPage = filters.page || 1;
  const pageSize = filters.pageSize || PAGINATION.DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;
  const startItem = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, total);

  // Determine loading states
  const isLoadingList = loading.list;
  const isLoadingAction = loading.action || loading.creating;
  const isAnyLoading = isLoadingList || isLoadingAction;

  // Determine if any filter is active
  const hasActiveFilters = localTypeFilter.length > 0 || localReadFilter.length > 0;

  // Count unread in current page
  const unreadInPage = notifications.filter((n) => !n.read).length;

  const containerClasses = [
    'flex flex-col h-full bg-white rounded-2xl shadow-card overflow-hidden',
    sizeClass.container,
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <div className={containerClasses} role="region" aria-label="Notification Center">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <BellIcon className="h-5 w-5 text-neutral-600" />
              <h2 className="text-lg font-semibold text-neutral-900">Notifications</h2>
            </div>

            {/* Total count badge */}
            {total > 0 && (
              <span className="badge badge-neutral">
                {total}
              </span>
            )}

            {/* Unread count badge */}
            {unreadCount > 0 && (
              <span className="badge bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Mark all as read button */}
            {showMarkAllRead && unreadInPage > 0 && (
              <Tooltip content="Mark all visible as read">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={isAnyLoading}
                  ariaLabel="Mark all notifications as read"
                >
                  <CheckIcon className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Mark All Read</span>
                </Button>
              </Tooltip>
            )}

            {/* Refresh button */}
            {showRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                loading={isLoadingList}
                ariaLabel="Refresh notifications"
                className="shrink-0"
              >
                <RefreshIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-200">
          {/* Type filter */}
          <select
            value={localTypeFilter}
            onChange={handleTypeFilterChange}
            disabled={isLoadingList}
            className={`border border-neutral-300 rounded-xl bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${size === 'lg' ? 'px-4 py-2.5 text-base' : size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
            aria-label="Filter by notification type"
          >
            {TYPE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Read status filter */}
          <select
            value={localReadFilter}
            onChange={handleReadFilterChange}
            disabled={isLoadingList}
            className={`border border-neutral-300 rounded-xl bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${size === 'lg' ? 'px-4 py-2.5 text-base' : size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
            aria-label="Filter by read status"
          >
            {READ_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              disabled={isLoadingList}
              className={`inline-flex items-center justify-center font-medium text-neutral-700 bg-white border border-neutral-300 rounded-xl hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${size === 'lg' ? 'px-4 py-2.5 text-base' : size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
              aria-label="Clear all filters"
            >
              <CloseIcon className={`${size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} mr-1.5`} />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-red-700">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              ariaLabel="Dismiss error"
              className="text-red-600 hover:text-red-700 shrink-0"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Notification list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto"
        role="list"
        aria-label="Notification list"
      >
        {/* Loading state */}
        {isLoadingList && notifications.length === 0 && (
          <LoadingSpinner
            center
            size="lg"
            label="Loading notifications..."
            showLabel
          />
        )}

        {/* Empty state */}
        {!isLoadingList && notifications.length === 0 && (
          <EmptyState
            title={hasActiveFilters
              ? 'No notifications match your filters'
              : 'No notifications yet'
            }
            description={hasActiveFilters
              ? 'Try adjusting your filters to find what you\'re looking for.'
              : 'Notifications for high-priority leads and SLA breaches will appear here.'
            }
            actionLabel={hasActiveFilters ? 'Clear Filters' : undefined}
            onAction={hasActiveFilters ? handleClearFilters : undefined}
            actionVariant="secondary"
            size={size}
            icon={<BellIcon className={size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-8 w-8' : 'h-12 w-12'} />}
          />
        )}

        {/* Notification items */}
        {!isLoadingList && notifications.length > 0 && (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              sizeClass={sizeClass}
              onMarkAsRead={handleMarkAsRead}
              onDismiss={handleDismiss}
              onSelect={handleSelectNotification}
              isAnyLoading={isAnyLoading}
            />
          ))
        )}
      </div>

      {/* Pagination controls */}
      {showPagination && !isLoadingList && total > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-neutral-200 bg-neutral-50">
          {/* Page info */}
          <span className={`text-neutral-500 ${sizeClass.meta}`}>
            {startItem}–{endItem} of {total}
          </span>

          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!hasPrevPage || isLoadingList}
              ariaLabel="Previous page"
            >
              <ChevronIcon direction="left" className="h-4 w-4" />
            </Button>

            <span className={`px-2 font-medium text-neutral-700 ${sizeClass.meta}`}>
              {currentPage} / {totalPages}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!hasNextPage || isLoadingList}
              ariaLabel="Next page"
            >
              <ChevronIcon direction="right" className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          variant={toast.variant}
          visible
          duration={4000}
          onClose={() => setToast(null)}
          position="top-right"
        />
      )}
    </div>
  );
}

export default NotificationPanel;