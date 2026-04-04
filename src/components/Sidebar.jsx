'use client';

import { useState, useCallback } from 'react';
import { useAuth, APP_ROLE_LABELS } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import Button from '@/components/common/Button';
import Tooltip from '@/components/common/Tooltip';
import { APP_NAME, ROLE } from '@/utils/constants';

/**
 * Navigation link definitions for the sidebar
 */
const NAV_LINKS = Object.freeze([
  {
    id: 'inbox',
    label: 'Inbox',
    href: '#inbox',
    description: 'DM inbox and message management',
  },
  {
    id: 'leads',
    label: 'Leads',
    href: '#leads',
    description: 'Lead capture and scoring',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    href: '#notifications',
    description: 'Alerts and SLA breach warnings',
  },
  {
    id: 'audit',
    label: 'Audit Log',
    href: '#audit',
    description: 'Compliance and activity log',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '#settings',
    description: 'Application settings',
  },
]);

/**
 * Role badge color mappings
 */
const ROLE_BADGE_STYLES = Object.freeze({
  [ROLE.ADMIN]: 'bg-brand-100 text-brand-800',
  [ROLE.AGENT]: 'bg-blue-100 text-blue-800',
  [ROLE.VIEWER]: 'bg-neutral-100 text-neutral-700',
});

/**
 * Inbox icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function InboxIcon({ className }) {
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
        d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-17.5 0V6.75a2.25 2.25 0 012.25-2.25h13.5a2.25 2.25 0 012.25 2.25v6.75m-17.5 0v4.5a2.25 2.25 0 002.25 2.25h13.5a2.25 2.25 0 002.25-2.25v-4.5"
      />
    </svg>
  );
}

/**
 * Leads icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function LeadsIcon({ className }) {
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
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  );
}

/**
 * Notifications icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function NotificationsIcon({ className }) {
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
 * Audit log icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function AuditIcon({ className }) {
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
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
      />
    </svg>
  );
}

/**
 * Settings icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function SettingsIcon({ className }) {
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
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
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
 * User icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function UserIcon({ className }) {
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
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
  );
}

/**
 * Logout icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function LogoutIcon({ className }) {
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
        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
      />
    </svg>
  );
}

/**
 * Collapse icon SVG component (chevron left/right)
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @param {boolean} props.collapsed - Whether the sidebar is collapsed
 * @returns {React.ReactElement}
 */
function CollapseIcon({ className, collapsed }) {
  return (
    <svg
      className={`${className} transition-transform ${collapsed ? 'rotate-180' : ''}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

/**
 * Returns the icon component for a given nav link ID
 *
 * @param {string} id - Navigation link identifier
 * @param {string} className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function NavIcon({ id, className }) {
  switch (id) {
    case 'inbox':
      return <InboxIcon className={className} />;
    case 'leads':
      return <LeadsIcon className={className} />;
    case 'notifications':
      return <NotificationsIcon className={className} />;
    case 'audit':
      return <AuditIcon className={className} />;
    case 'settings':
      return <SettingsIcon className={className} />;
    default:
      return <InboxIcon className={className} />;
  }
}

/**
 * Brand logo component for the sidebar header
 *
 * @param {object} props
 * @param {boolean} props.collapsed - Whether the sidebar is collapsed
 * @returns {React.ReactElement}
 */
function SidebarBrandLogo({ collapsed }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex items-center justify-center h-8 w-8 rounded-xl bg-brand-600 text-white font-bold text-sm shrink-0"
        aria-hidden="true"
      >
        S
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold text-neutral-900 tracking-tight">
            {APP_NAME}
          </span>
          <span className="text-xs text-neutral-500 font-medium">
            Stockland
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Sidebar navigation link component
 *
 * @param {object} props
 * @param {string} props.id - Link identifier
 * @param {string} props.label - Link display label
 * @param {string} props.href - Link href
 * @param {string} props.description - Link description for tooltip
 * @param {boolean} props.active - Whether the link is currently active
 * @param {boolean} props.collapsed - Whether the sidebar is collapsed
 * @param {number} [props.badge] - Optional badge count to display
 * @param {Function} props.onClick - Click handler
 * @returns {React.ReactElement}
 */
function SidebarNavLink({ id, label, href, description, active, collapsed, badge, onClick }) {
  /**
   * Handles click on the nav link
   *
   * @param {React.MouseEvent} event
   */
  function handleClick(event) {
    event.preventDefault();
    if (typeof onClick === 'function') {
      onClick(id);
    }
  }

  const linkContent = (
    <a
      href={href}
      onClick={handleClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
        active
          ? 'bg-brand-50 text-brand-700 font-medium'
          : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
      } ${collapsed ? 'justify-center' : ''}`}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
    >
      <NavIcon
        id={id}
        className={`h-5 w-5 shrink-0 ${active ? 'text-brand-600' : 'text-neutral-500'}`}
      />
      {!collapsed && (
        <span className="flex-1 text-sm truncate">{label}</span>
      )}
      {!collapsed && badge !== undefined && badge !== null && badge > 0 && (
        <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold leading-none">
          {badge > 99 ? '99+' : String(badge)}
        </span>
      )}
      {collapsed && badge !== undefined && badge !== null && badge > 0 && (
        <span
          className="absolute top-1 right-1 inline-block h-2 w-2 rounded-full bg-red-500"
          aria-hidden="true"
        />
      )}
    </a>
  );

  if (collapsed) {
    return (
      <Tooltip content={label} position="right" size="sm">
        <div className="relative">
          {linkContent}
        </div>
      </Tooltip>
    );
  }

  return linkContent;
}

/**
 * User info section for the sidebar footer
 *
 * @param {object} props
 * @param {object} props.user - Current user object
 * @param {boolean} props.collapsed - Whether the sidebar is collapsed
 * @param {Function} props.onLogout - Logout handler
 * @returns {React.ReactElement|null}
 */
function SidebarUserInfo({ user, collapsed, onLogout }) {
  if (!user) return null;

  const roleBadgeStyle = ROLE_BADGE_STYLES[user.role] || ROLE_BADGE_STYLES[ROLE.VIEWER];
  const roleLabel = user.roleLabel || APP_ROLE_LABELS[user.role] || user.role;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Tooltip content={`${user.username} (${roleLabel})`} position="right" size="sm">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-neutral-200 text-neutral-600 shrink-0">
            <UserIcon className="h-4 w-4" />
          </div>
        </Tooltip>
        <Tooltip content="Sign out" position="right" size="sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            ariaLabel="Sign out"
            className="text-neutral-500 hover:text-neutral-700"
          >
            <LogoutIcon className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-neutral-200 text-neutral-600 shrink-0">
          <UserIcon className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight min-w-0 flex-1">
          <span className="text-sm font-medium text-neutral-800 truncate">
            {user.username}
          </span>
          <span className={`inline-flex items-center self-start px-1.5 py-0 rounded-full text-xs font-medium ${roleBadgeStyle}`}>
            {roleLabel}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onLogout}
        ariaLabel="Sign out"
        fullWidth
        className="text-neutral-500 hover:text-neutral-700 justify-start"
      >
        <LogoutIcon className="h-4 w-4 mr-2" />
        Sign out
      </Button>
    </div>
  );
}

/**
 * Sidebar component
 * Application sidebar navigation: links to Inbox, Leads, Notifications, Audit Log,
 * and Settings pages. Highlights active route. Collapsible on mobile.
 *
 * Features:
 * - Navigation links with icons for Inbox, Leads, Notifications, Audit Log, Settings
 * - Active route highlighting with brand-colored background
 * - Collapsible sidebar with icon-only mode
 * - Notification unread count badge on Notifications link
 * - Brand logo in sidebar header
 * - User info with role badge in sidebar footer
 * - Logout button
 * - Tooltip labels when collapsed
 * - Responsive: auto-collapses on smaller screens
 * - ARIA labels for accessibility
 * - Keyboard accessible navigation
 *
 * @param {object} props
 * @param {string} [props.activeNav='inbox'] - Currently active navigation link ID
 * @param {Function} [props.onNavChange] - Callback when a navigation link is clicked (receives link ID)
 * @param {boolean} [props.collapsed=false] - Whether the sidebar is in collapsed (icon-only) mode
 * @param {Function} [props.onCollapsedChange] - Callback when collapsed state changes (receives boolean)
 * @param {boolean} [props.showCollapseButton=true] - Whether to show the collapse toggle button
 * @param {boolean} [props.showUserInfo=true] - Whether to show user info in the footer
 * @param {boolean} [props.showBrandLogo=true] - Whether to show the brand logo in the header
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <Sidebar activeNav="inbox" onNavChange={handleNavChange} />
 *
 * @example
 * <Sidebar
 *   activeNav="leads"
 *   onNavChange={handleNavChange}
 *   collapsed={isSidebarCollapsed}
 *   onCollapsedChange={setIsSidebarCollapsed}
 * />
 */
export function Sidebar({
  activeNav = 'inbox',
  onNavChange,
  collapsed = false,
  onCollapsedChange,
  showCollapseButton = true,
  showUserInfo = true,
  showBrandLogo = true,
  className = '',
}) {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { unreadCount } = useNotifications({ autoRefresh: true, refreshInterval: 30000 });

  /**
   * Handles navigation link click
   *
   * @param {string} linkId - Navigation link identifier
   */
  const handleNavClick = useCallback((linkId) => {
    if (typeof onNavChange === 'function') {
      onNavChange(linkId);
    }
  }, [onNavChange]);

  /**
   * Handles collapse toggle button click
   */
  const handleToggleCollapse = useCallback(() => {
    if (typeof onCollapsedChange === 'function') {
      onCollapsedChange(!collapsed);
    }
  }, [collapsed, onCollapsedChange]);

  /**
   * Handles logout button click
   */
  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      console.warn('[Sidebar] Logout failed');
    }
  }, [logout]);

  /**
   * Handles keydown events for sidebar accessibility
   *
   * @param {React.KeyboardEvent} event
   */
  function handleKeyDown(event) {
    if (event.key === 'Escape' && !collapsed && typeof onCollapsedChange === 'function') {
      onCollapsedChange(true);
    }
  }

  /**
   * Returns the badge count for a given nav link
   *
   * @param {string} linkId - Navigation link identifier
   * @returns {number|undefined} Badge count or undefined
   */
  function getBadgeCount(linkId) {
    if (linkId === 'notifications') {
      return unreadCount > 0 ? unreadCount : undefined;
    }
    return undefined;
  }

  const containerClasses = [
    'flex flex-col h-full bg-white border-r border-neutral-200 shadow-card transition-all duration-200 ease-in-out',
    collapsed ? 'w-16' : 'w-60',
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <aside
      className={containerClasses}
      role="navigation"
      aria-label="Sidebar navigation"
      onKeyDown={handleKeyDown}
    >
      {/* Header: Brand logo and collapse toggle */}
      <div className={`flex items-center justify-between border-b border-neutral-200 ${collapsed ? 'px-3 py-4' : 'px-4 py-4'}`}>
        {showBrandLogo && (
          <SidebarBrandLogo collapsed={collapsed} />
        )}

        {showCollapseButton && (
          <Tooltip content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} position="right" size="sm">
            <button
              type="button"
              className="inline-flex items-center justify-center p-1.5 rounded-xl text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
              onClick={handleToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <CollapseIcon className="h-4 w-4" collapsed={collapsed} />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Navigation links */}
      <nav className={`flex-1 overflow-y-auto py-3 ${collapsed ? 'px-2' : 'px-3'} space-y-1`} aria-label="Main navigation">
        {NAV_LINKS.map((link) => (
          <SidebarNavLink
            key={link.id}
            id={link.id}
            label={link.label}
            href={link.href}
            description={link.description}
            active={activeNav === link.id}
            collapsed={collapsed}
            badge={getBadgeCount(link.id)}
            onClick={handleNavClick}
          />
        ))}
      </nav>

      {/* Footer: User info and logout */}
      {showUserInfo && isAuthenticated && currentUser && (
        <div className={`border-t border-neutral-200 ${collapsed ? 'px-2 py-3' : 'px-4 py-3'}`}>
          <SidebarUserInfo
            user={currentUser}
            collapsed={collapsed}
            onLogout={handleLogout}
          />
        </div>
      )}
    </aside>
  );
}

export default Sidebar;