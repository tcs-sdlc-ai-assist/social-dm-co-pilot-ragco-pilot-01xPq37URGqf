'use client';

import { useState, useCallback } from 'react';
import { useAuth, APP_ROLE_LABELS } from '@/contexts/AuthContext';
import NotificationBell from '@/components/notifications/NotificationBell';
import Button from '@/components/common/Button';
import Tooltip from '@/components/common/Tooltip';
import { APP_NAME, ROLE } from '@/utils/constants';

/**
 * Navigation link definitions for the header
 */
const NAV_LINKS = Object.freeze([
  { id: 'inbox', label: 'Inbox', href: '#inbox' },
  { id: 'leads', label: 'Leads', href: '#leads' },
  { id: 'compliance', label: 'Compliance', href: '#compliance' },
  { id: 'audit', label: 'Audit Log', href: '#audit' },
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
 * Menu icon SVG component (hamburger)
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function MenuIcon({ className }) {
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
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
 * Stockland brand logo placeholder component
 * Renders a stylized brand mark for the application header
 *
 * @returns {React.ReactElement}
 */
function BrandLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex items-center justify-center h-8 w-8 rounded-xl bg-brand-600 text-white font-bold text-sm shrink-0"
        aria-hidden="true"
      >
        S
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-sm font-bold text-neutral-900 tracking-tight">
          {APP_NAME}
        </span>
        <span className="text-xs text-neutral-500 font-medium">
          Stockland
        </span>
      </div>
    </div>
  );
}

/**
 * User info display component
 * Shows the authenticated user's name and role badge
 *
 * @param {object} props
 * @param {object} props.user - Current user object
 * @param {string} props.user.username - User display name
 * @param {string} props.user.role - User role
 * @param {string} props.user.roleLabel - Human-readable role label
 * @returns {React.ReactElement|null}
 */
function UserInfo({ user }) {
  if (!user) return null;

  const roleBadgeStyle = ROLE_BADGE_STYLES[user.role] || ROLE_BADGE_STYLES[ROLE.VIEWER];
  const roleLabel = user.roleLabel || APP_ROLE_LABELS[user.role] || user.role;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-neutral-200 text-neutral-600 shrink-0">
        <UserIcon className="h-4 w-4" />
      </div>
      <div className="hidden sm:flex flex-col leading-tight">
        <span className="text-sm font-medium text-neutral-800 truncate max-w-32">
          {user.username}
        </span>
        <span className={`inline-flex items-center self-start px-1.5 py-0 rounded-full text-xs font-medium ${roleBadgeStyle}`}>
          {roleLabel}
        </span>
      </div>
    </div>
  );
}

/**
 * Navigation link component
 *
 * @param {object} props
 * @param {string} props.id - Link identifier
 * @param {string} props.label - Link display label
 * @param {string} props.href - Link href
 * @param {boolean} props.active - Whether the link is currently active
 * @param {Function} props.onClick - Click handler
 * @returns {React.ReactElement}
 */
function NavLink({ id, label, href, active, onClick }) {
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

  return (
    <a
      href={href}
      onClick={handleClick}
      className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
        active
          ? 'bg-brand-50 text-brand-700'
          : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      {label}
    </a>
  );
}

/**
 * Header component
 * Application header component: displays app title (Social DM Co-Pilot), user info,
 * role badge, notification bell, and navigation links. Responsive layout with
 * Stockland branding.
 *
 * Features:
 * - Application brand logo and title
 * - Navigation links (Inbox, Leads, Compliance, Audit Log)
 * - Active navigation state tracking
 * - Notification bell with unread count badge
 * - Authenticated user info with role badge
 * - Logout button
 * - Responsive mobile menu (hamburger toggle)
 * - ARIA labels for accessibility
 * - Keyboard accessible navigation
 *
 * @param {object} props
 * @param {string} [props.activeNav='inbox'] - Currently active navigation link ID
 * @param {Function} [props.onNavChange] - Callback when a navigation link is clicked (receives link ID)
 * @param {Function} [props.onSelectNotification] - Callback when a notification is selected
 * @param {Function} [props.onSelectDM] - Callback when a DM-linked notification is selected
 * @param {Function} [props.onSelectLead] - Callback when a lead-linked notification is selected
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <Header activeNav="inbox" onNavChange={handleNavChange} />
 *
 * @example
 * <Header
 *   activeNav="leads"
 *   onNavChange={handleNavChange}
 *   onSelectNotification={handleSelectNotification}
 *   onSelectDM={handleSelectDM}
 * />
 */
export function Header({
  activeNav = 'inbox',
  onNavChange,
  onSelectNotification,
  onSelectDM,
  onSelectLead,
  className = '',
}) {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /**
   * Handles navigation link click
   *
   * @param {string} linkId - Navigation link identifier
   */
  const handleNavClick = useCallback((linkId) => {
    if (typeof onNavChange === 'function') {
      onNavChange(linkId);
    }
    setMobileMenuOpen(false);
  }, [onNavChange]);

  /**
   * Handles logout button click
   */
  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      console.warn('[Header] Logout failed');
    }
    setMobileMenuOpen(false);
  }, [logout]);

  /**
   * Toggles the mobile menu
   */
  function handleToggleMobileMenu() {
    setMobileMenuOpen((prev) => !prev);
  }

  /**
   * Handles keydown events for mobile menu accessibility
   *
   * @param {React.KeyboardEvent} event
   */
  function handleMobileMenuKeyDown(event) {
    if (event.key === 'Escape' && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }

  const containerClasses = [
    'sticky top-0 z-40 w-full bg-white border-b border-neutral-200 shadow-card',
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <header
      className={containerClasses}
      role="banner"
      onKeyDown={handleMobileMenuKeyDown}
    >
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Left section: Brand logo and desktop navigation */}
          <div className="flex items-center gap-6">
            {/* Brand logo */}
            <BrandLogo />

            {/* Desktop navigation */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.id}
                  id={link.id}
                  label={link.label}
                  href={link.href}
                  active={activeNav === link.id}
                  onClick={handleNavClick}
                />
              ))}
            </nav>
          </div>

          {/* Right section: Notifications, user info, logout, mobile menu toggle */}
          <div className="flex items-center gap-3">
            {/* Notification bell */}
            {isAuthenticated && (
              <NotificationBell
                size="md"
                showBadge
                autoRefresh
                refreshInterval={30000}
                onSelectNotification={onSelectNotification}
                onSelectDM={onSelectDM}
                onSelectLead={onSelectLead}
                dropdownAlign="right"
              />
            )}

            {/* User info (desktop) */}
            {isAuthenticated && currentUser && (
              <div className="hidden sm:flex items-center gap-3">
                <div className="h-5 w-px bg-neutral-200" aria-hidden="true" />
                <UserInfo user={currentUser} />
                <Tooltip content="Sign out">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    ariaLabel="Sign out"
                    className="text-neutral-500 hover:text-neutral-700"
                  >
                    <LogoutIcon className="h-4 w-4" />
                  </Button>
                </Tooltip>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors md:hidden"
              onClick={handleToggleMobileMenu}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? (
                <CloseIcon className="h-5 w-5" />
              ) : (
                <MenuIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden border-t border-neutral-200 bg-white"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                href={link.href}
                onClick={(event) => {
                  event.preventDefault();
                  handleNavClick(link.id);
                }}
                className={`block px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                  activeNav === link.id
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
                aria-current={activeNav === link.id ? 'page' : undefined}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Mobile user info and logout */}
          {isAuthenticated && currentUser && (
            <div className="px-4 py-3 border-t border-neutral-200">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-neutral-200 text-neutral-600 shrink-0">
                    <UserIcon className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex flex-col leading-tight min-w-0">
                    <span className="text-sm font-medium text-neutral-800 truncate">
                      {currentUser.username}
                    </span>
                    <span className={`inline-flex items-center self-start px-1.5 py-0 rounded-full text-xs font-medium ${ROLE_BADGE_STYLES[currentUser.role] || ROLE_BADGE_STYLES[ROLE.VIEWER]}`}>
                      {currentUser.roleLabel || APP_ROLE_LABELS[currentUser.role] || currentUser.role}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  ariaLabel="Sign out"
                  className="text-neutral-500 hover:text-neutral-700 shrink-0"
                >
                  <LogoutIcon className="h-4 w-4 mr-1.5" />
                  Sign out
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export default Header;