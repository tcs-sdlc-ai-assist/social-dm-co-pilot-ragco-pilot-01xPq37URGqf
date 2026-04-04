'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import Tooltip from '@/components/common/Tooltip';

/**
 * Size variant mappings for the notification bell
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    button: 'p-1.5',
    icon: 'h-4 w-4',
    badge: 'h-4 min-w-4 text-[10px] -top-1 -right-1',
    panel: 'w-80 max-h-[28rem]',
  },
  md: {
    button: 'p-2',
    icon: 'h-5 w-5',
    badge: 'h-5 min-w-5 text-xs -top-1.5 -right-1.5',
    panel: 'w-96 max-h-[32rem]',
  },
  lg: {
    button: 'p-2.5',
    icon: 'h-6 w-6',
    badge: 'h-6 min-w-6 text-xs -top-2 -right-2',
    panel: 'w-[28rem] max-h-[36rem]',
  },
});

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
 * Bell icon with ring animation for active notifications
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function BellRingIcon({ className }) {
  return (
    <svg
      className={`${className} animate-[wiggle_1s_ease-in-out]`}
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
 * NotificationBell component
 * Notification bell icon component: displays bell icon with unread count badge
 * in the header. Clicking opens NotificationPanel dropdown.
 *
 * Implements notification trigger for NotificationCenter (SCRUM-6540)
 *
 * Features:
 * - Bell icon with unread count badge
 * - Animated bell when new unread notifications exist
 * - Click to toggle NotificationPanel dropdown
 * - Dropdown positioned below the bell icon (right-aligned)
 * - Click outside to close the dropdown
 * - Escape key to close the dropdown
 * - Auto-refresh unread count on configurable interval
 * - Tooltip on hover when dropdown is closed
 * - ARIA attributes for accessibility
 * - Configurable size variants (sm, md, lg)
 * - Responsive layout
 *
 * @param {object} props
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the bell icon
 * @param {boolean} [props.showBadge=true] - Whether to show the unread count badge
 * @param {boolean} [props.autoRefresh=true] - Whether to auto-refresh unread count
 * @param {number} [props.refreshInterval=30000] - Auto-refresh interval in milliseconds
 * @param {Function} [props.onSelectNotification] - Callback when a notification is selected in the panel
 * @param {Function} [props.onSelectDM] - Callback when a DM-linked notification is selected
 * @param {Function} [props.onSelectLead] - Callback when a lead-linked notification is selected
 * @param {'left'|'right'} [props.dropdownAlign='right'] - Alignment of the dropdown panel
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <NotificationBell />
 *
 * @example
 * <NotificationBell
 *   size="sm"
 *   autoRefresh
 *   refreshInterval={15000}
 *   onSelectNotification={handleSelect}
 *   onSelectDM={handleSelectDM}
 * />
 *
 * @example
 * <NotificationBell
 *   size="lg"
 *   dropdownAlign="left"
 *   showBadge
 * />
 */
export function NotificationBell({
  size = 'md',
  showBadge = true,
  autoRefresh = true,
  refreshInterval = 30000,
  onSelectNotification,
  onSelectDM,
  onSelectLead,
  dropdownAlign = 'right',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  const {
    unreadCount,
    refreshCounts,
  } = useNotifications({
    autoRefresh,
    refreshInterval: autoRefresh ? refreshInterval : 0,
  });

  const hasUnread = unreadCount > 0;
  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);

  /**
   * Toggles the notification panel dropdown
   */
  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  /**
   * Closes the notification panel dropdown
   */
  const handleClose = useCallback(() => {
    if (mountedRef.current) {
      setIsOpen(false);
    }
  }, []);

  /**
   * Handles notification selection from the panel
   * Closes the dropdown and forwards to parent callback
   *
   * @param {object} notification - Selected notification object
   */
  const handleSelectNotification = useCallback((notification) => {
    handleClose();

    if (typeof onSelectNotification === 'function') {
      onSelectNotification(notification);
    }
  }, [handleClose, onSelectNotification]);

  /**
   * Handles DM-linked notification selection
   * Closes the dropdown and forwards to parent callback
   *
   * @param {string} dmId - DM identifier
   */
  const handleSelectDM = useCallback((dmId) => {
    handleClose();

    if (typeof onSelectDM === 'function') {
      onSelectDM(dmId);
    }
  }, [handleClose, onSelectDM]);

  /**
   * Handles lead-linked notification selection
   * Closes the dropdown and forwards to parent callback
   *
   * @param {string} leadId - Lead identifier
   */
  const handleSelectLead = useCallback((leadId) => {
    handleClose();

    if (typeof onSelectLead === 'function') {
      onSelectLead(leadId);
    }
  }, [handleClose, onSelectLead]);

  /**
   * Handles keydown events for accessibility
   * Closes the dropdown when Escape is pressed
   *
   * @param {React.KeyboardEvent} event
   */
  function handleKeyDown(event) {
    if (event.key === 'Escape' && isOpen) {
      event.stopPropagation();
      handleClose();

      // Return focus to the bell button
      if (buttonRef.current) {
        buttonRef.current.focus();
      }
    }
  }

  /**
   * Handles clicks outside the dropdown to close it
   */
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        handleClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClose]);

  const buttonClasses = [
    'relative inline-flex items-center justify-center rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
    sizeClass.button,
    isOpen
      ? 'bg-brand-50 text-brand-600'
      : hasUnread
        ? 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
        : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const dropdownClasses = [
    'absolute z-50 mt-2 overflow-hidden rounded-2xl shadow-card-hover bg-white border border-neutral-200',
    sizeClass.panel,
    dropdownAlign === 'left' ? 'left-0' : 'right-0',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const bellButton = (
    <button
      ref={buttonRef}
      type="button"
      className={buttonClasses}
      onClick={handleToggle}
      aria-label={
        hasUnread
          ? `Notifications — ${unreadCount} unread`
          : 'Notifications'
      }
      aria-expanded={isOpen}
      aria-haspopup="true"
    >
      {/* Bell icon */}
      {hasUnread ? (
        <BellRingIcon className={sizeClass.icon} />
      ) : (
        <BellIcon className={sizeClass.icon} />
      )}

      {/* Unread count badge */}
      {showBadge && hasUnread && (
        <span
          className={`absolute inline-flex items-center justify-center rounded-full bg-red-500 text-white font-semibold leading-none px-1 ${sizeClass.badge}`}
          aria-hidden="true"
        >
          {displayCount}
        </span>
      )}
    </button>
  );

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex ${className}`.trim()}
      onKeyDown={handleKeyDown}
    >
      {/* Bell button with tooltip when closed */}
      {!isOpen ? (
        <Tooltip
          content={
            hasUnread
              ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'No new notifications'
          }
          position="bottom"
          size="sm"
        >
          {bellButton}
        </Tooltip>
      ) : (
        bellButton
      )}

      {/* Notification panel dropdown */}
      {isOpen && (
        <div className={dropdownClasses}>
          <NotificationPanel
            size={size === 'lg' ? 'md' : 'sm'}
            showHeader
            showFilters
            showPagination
            showRefresh
            showMarkAllRead
            autoLoad
            onSelectNotification={handleSelectNotification}
            onSelectDM={handleSelectDM}
            onSelectLead={handleSelectLead}
            className="border-0 shadow-none rounded-none"
          />
        </div>
      )}
    </div>
  );
}

export default NotificationBell;