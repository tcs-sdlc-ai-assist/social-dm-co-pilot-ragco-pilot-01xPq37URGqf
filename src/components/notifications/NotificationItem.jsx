'use client';

import { useState, useCallback } from 'react';
import Button from '@/components/common/Button';
import Tooltip from '@/components/common/Tooltip';
import PlatformIcon from '@/components/common/PlatformIcon';
import LeadScoreBadge from '@/components/lead/LeadScoreBadge';
import { formatTimestamp } from '@/utils/formatters';

/**
 * Size variant mappings for the notification item
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    container: 'text-xs',
    heading: 'text-sm',
    body: 'text-xs',
    meta: 'text-xs',
    label: 'text-xs',
    item: 'px-3 py-2.5',
    icon: 'h-7 w-7',
    iconInner: 'h-3.5 w-3.5',
    actionIcon: 'h-3.5 w-3.5',
  },
  md: {
    container: 'text-sm',
    heading: 'text-sm',
    body: 'text-sm',
    meta: 'text-xs',
    label: 'text-xs',
    item: 'px-4 py-3',
    icon: 'h-8 w-8',
    iconInner: 'h-4 w-4',
    actionIcon: 'h-4 w-4',
  },
  lg: {
    container: 'text-base',
    heading: 'text-base',
    body: 'text-sm',
    meta: 'text-sm',
    label: 'text-sm',
    item: 'px-5 py-4',
    icon: 'h-10 w-10',
    iconInner: 'h-5 w-5',
    actionIcon: 'h-4 w-4',
  },
});

/**
 * Notification type style mappings
 */
const NOTIFICATION_TYPE_STYLES = Object.freeze({
  high_priority_lead: {
    bg: 'bg-brand-50',
    border: 'border-brand-200',
    borderLeft: 'border-l-brand-300',
    iconBg: 'bg-brand-100',
    iconText: 'text-brand-600',
    label: 'High-Priority Lead',
    unreadBg: 'bg-brand-50/70',
  },
  sla_breach: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    borderLeft: 'border-l-red-300',
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
  borderLeft: 'border-l-neutral-300',
  iconBg: 'bg-neutral-100',
  iconText: 'text-neutral-600',
  label: 'Notification',
  unreadBg: 'bg-neutral-50/70',
};

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
 * Bell icon SVG component (default notification icon)
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
 * Eye icon SVG component for "view lead" action
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function ViewIcon({ className }) {
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
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

/**
 * Returns the appropriate icon component for a notification type
 *
 * @param {object} props
 * @param {string} props.type - Notification type
 * @param {string} props.className - Tailwind classes for sizing
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
 * NotificationItem component
 * Individual notification item component: displays notification type icon, message,
 * timestamp, linked lead reference, and action buttons (mark read, dismiss, view lead).
 *
 * Implements notification item display for NotificationCenter (SCRUM-6540, SCRUM-6541)
 *
 * Features:
 * - Notification type icon (flag for high-priority leads, clock for SLA breaches)
 * - Type label with color coding per notification type
 * - Unread indicator dot and bold styling for unread notifications
 * - Notification message display
 * - Relative timestamp formatting
 * - Linked lead ID and DM ID badges
 * - Lead score badge for high-priority lead notifications
 * - Mark as read action button (only for unread notifications)
 * - Dismiss (remove) action button
 * - View lead action button (only for lead-linked notifications)
 * - Read timestamp display for acknowledged notifications
 * - Click handler for notification selection
 * - Keyboard accessible (Enter/Space to select)
 * - ARIA role="listitem" with descriptive aria-label
 * - Hover and selected state styling
 * - Responsive layout
 *
 * @param {object} props
 * @param {object} props.notification - Notification object
 * @param {number|string} props.notification.id - Notification identifier
 * @param {string} props.notification.type - Notification type ('high_priority_lead' or 'sla_breach')
 * @param {string} props.notification.message - Notification message text
 * @param {string} props.notification.timestamp - ISO timestamp of notification creation
 * @param {boolean} props.notification.read - Whether the notification has been read/acknowledged
 * @param {string} [props.notification.acknowledgedAt] - ISO timestamp of acknowledgement
 * @param {string} [props.notification.leadId] - Associated lead identifier
 * @param {string} [props.notification.dmId] - Associated DM identifier
 * @param {string} [props.notification.userId] - Target user identifier
 * @param {number} [props.notification.leadScore] - Lead score for high-priority lead notifications
 * @param {Function} [props.onMarkAsRead] - Callback when mark as read is clicked (receives notification id)
 * @param {Function} [props.onDismiss] - Callback when dismiss is clicked (receives notification id)
 * @param {Function} [props.onSelect] - Callback when notification is clicked (receives notification object)
 * @param {Function} [props.onViewLead] - Callback when view lead is clicked (receives leadId)
 * @param {Function} [props.onViewDM] - Callback when DM badge is clicked (receives dmId)
 * @param {boolean} [props.isSelected=false] - Whether this notification is currently selected
 * @param {boolean} [props.disabled=false] - Whether action buttons are disabled
 * @param {boolean} [props.showActions=true] - Whether to show action buttons
 * @param {boolean} [props.showLeadBadge=true] - Whether to show the linked lead badge
 * @param {boolean} [props.showDMBadge=true] - Whether to show the linked DM badge
 * @param {boolean} [props.showLeadScore=true] - Whether to show the lead score badge
 * @param {boolean} [props.showViewLeadButton=true] - Whether to show the view lead button
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the item
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <NotificationItem
 *   notification={notificationObject}
 *   onMarkAsRead={handleMarkAsRead}
 *   onDismiss={handleDismiss}
 *   onSelect={handleSelect}
 *   onViewLead={handleViewLead}
 * />
 *
 * @example
 * <NotificationItem
 *   notification={notificationObject}
 *   size="sm"
 *   showActions={false}
 *   showLeadScore={false}
 * />
 */
export function NotificationItem({
  notification,
  onMarkAsRead,
  onDismiss,
  onSelect,
  onViewLead,
  onViewDM,
  isSelected = false,
  disabled = false,
  showActions = true,
  showLeadBadge = true,
  showDMBadge = true,
  showLeadScore = true,
  showViewLeadButton = true,
  size = 'md',
  className = '',
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const typeStyle = NOTIFICATION_TYPE_STYLES[notification?.type] || DEFAULT_TYPE_STYLE;
  const isUnread = notification ? !notification.read : false;

  const hasLeadId = notification?.leadId && typeof notification.leadId === 'string' && notification.leadId.trim().length > 0;
  const hasDMId = notification?.dmId && typeof notification.dmId === 'string' && notification.dmId.trim().length > 0;
  const hasLeadScore = showLeadScore && notification?.leadScore !== undefined && notification?.leadScore !== null && typeof notification.leadScore === 'number';
  const hasMessage = notification?.message && typeof notification.message === 'string' && notification.message.trim().length > 0;

  /**
   * Handles click on the notification item
   */
  const handleClick = useCallback(() => {
    if (typeof onSelect === 'function' && notification) {
      onSelect(notification);
    }
  }, [onSelect, notification]);

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
  const handleMarkAsRead = useCallback((event) => {
    event.stopPropagation();
    if (typeof onMarkAsRead === 'function' && notification) {
      onMarkAsRead(notification.id);
    }
  }, [onMarkAsRead, notification]);

  /**
   * Handles dismiss button click
   *
   * @param {React.MouseEvent} event
   */
  const handleDismiss = useCallback((event) => {
    event.stopPropagation();
    if (typeof onDismiss === 'function' && notification) {
      onDismiss(notification.id);
    }
  }, [onDismiss, notification]);

  /**
   * Handles view lead button click
   *
   * @param {React.MouseEvent} event
   */
  const handleViewLead = useCallback((event) => {
    event.stopPropagation();
    if (typeof onViewLead === 'function' && notification?.leadId) {
      onViewLead(notification.leadId);
    }
  }, [onViewLead, notification]);

  /**
   * Handles DM badge click
   *
   * @param {React.MouseEvent} event
   */
  const handleViewDM = useCallback((event) => {
    event.stopPropagation();
    if (typeof onViewDM === 'function' && notification?.dmId) {
      onViewDM(notification.dmId);
    }
  }, [onViewDM, notification]);

  if (!notification) {
    return null;
  }

  const itemClasses = [
    'relative flex items-start gap-3 border-b border-neutral-200 transition-colors cursor-pointer',
    sizeClass.item,
    isSelected
      ? 'bg-brand-50 border-l-4 border-l-brand-500'
      : isUnread
        ? `${typeStyle.unreadBg} border-l-4 ${typeStyle.borderLeft}`
        : 'border-l-4 border-l-transparent hover:bg-neutral-50',
    className,
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
      <div className={`shrink-0 flex items-center justify-center rounded-full ${typeStyle.iconBg} ${sizeClass.icon}`}>
        <NotificationTypeIcon type={notification.type} className={`${sizeClass.iconInner} ${typeStyle.iconText}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Header row: type label, unread dot, and timestamp */}
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

            {/* Lead score badge for high-priority lead notifications */}
            {hasLeadScore && (
              <LeadScoreBadge
                score={notification.leadScore}
                size="sm"
                showLabel={false}
                showFlag={false}
                showBar={false}
                showTooltip
              />
            )}
          </div>
          <span className={`text-neutral-400 shrink-0 whitespace-nowrap ${sizeClass.meta}`}>
            {formatTimestamp(notification.timestamp)}
          </span>
        </div>

        {/* Message */}
        {hasMessage && (
          <p className={`leading-snug ${isUnread ? 'text-neutral-800 font-medium' : 'text-neutral-600'} ${sizeClass.body}`}>
            {notification.message}
          </p>
        )}

        {/* Linked entity badges and read status */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Lead ID badge */}
          {showLeadBadge && hasLeadId && (
            <button
              type="button"
              onClick={handleViewLead}
              className="badge badge-neutral text-xs hover:bg-neutral-200 transition-colors cursor-pointer"
              aria-label={`View lead: ${notification.leadId}`}
              disabled={disabled}
            >
              Lead: {notification.leadId}
            </button>
          )}

          {/* DM ID badge */}
          {showDMBadge && hasDMId && (
            <button
              type="button"
              onClick={handleViewDM}
              className="badge badge-neutral text-xs hover:bg-neutral-200 transition-colors cursor-pointer"
              aria-label={`View DM: ${notification.dmId}`}
              disabled={disabled}
            >
              DM: {notification.dmId}
            </button>
          )}

          {/* Read timestamp */}
          {notification.read && notification.acknowledgedAt && (
            <span className={`text-neutral-400 ${sizeClass.meta}`}>
              Read {formatTimestamp(notification.acknowledgedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {showActions && (
        <div className="flex items-center gap-1 shrink-0">
          {/* View lead button (only for lead-linked notifications) */}
          {showViewLeadButton && hasLeadId && (
            <Tooltip content="View lead details">
              <button
                type="button"
                onClick={handleViewLead}
                disabled={disabled}
                className="inline-flex items-center justify-center rounded-xl p-1.5 text-neutral-400 hover:text-brand-600 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="View lead details"
              >
                <ViewIcon className={sizeClass.actionIcon} />
              </button>
            </Tooltip>
          )}

          {/* Mark as read button (only for unread) */}
          {isUnread && (
            <Tooltip content="Mark as read">
              <button
                type="button"
                onClick={handleMarkAsRead}
                disabled={disabled}
                className="inline-flex items-center justify-center rounded-xl p-1.5 text-neutral-400 hover:text-brand-600 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Mark notification as read"
              >
                <CheckIcon className={sizeClass.actionIcon} />
              </button>
            </Tooltip>
          )}

          {/* Dismiss button */}
          <Tooltip content="Dismiss notification">
            <button
              type="button"
              onClick={handleDismiss}
              disabled={disabled}
              className="inline-flex items-center justify-center rounded-xl p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Dismiss notification"
            >
              <CloseIcon className={sizeClass.actionIcon} />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

export default NotificationItem;