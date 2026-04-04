'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import InboxPanel from '@/components/inbox/InboxPanel';
import DMDetailView from '@/components/inbox/DMDetailView';
import DraftComposer from '@/components/draft/DraftComposer';
import LeadCaptureSidebar from '@/components/lead/LeadCaptureSidebar';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import AuditLogViewer from '@/components/compliance/AuditLogViewer';
import ComplianceBanner from '@/components/compliance/ComplianceBanner';
import ConsentCheckbox from '@/components/compliance/ConsentCheckbox';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Button from '@/components/common/Button';
import { ROLE } from '@/utils/constants';

/**
 * Login form component
 * Renders a simple login form for authentication
 *
 * @param {object} props
 * @param {Function} props.onLogin - Callback when login is submitted
 * @param {boolean} props.isLoading - Whether login is in progress
 * @param {string|null} props.error - Login error message
 * @returns {React.ReactElement}
 */
function LoginForm({ onLogin, isLoading, error }) {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState(ROLE.ADMIN);

  /**
   * Handles form submission
   *
   * @param {React.FormEvent} event
   */
  function handleSubmit(event) {
    event.preventDefault();
    if (username.trim().length > 0 && !isLoading) {
      onLogin(username.trim(), role);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-card p-8 space-y-6">
          {/* Brand header */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex items-center justify-center h-12 w-12 rounded-xl bg-brand-600 text-white font-bold text-lg"
              aria-hidden="true"
            >
              S
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
                Social DM Copilot
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Sign in to manage your inbox
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="login-username"
                className="text-sm font-medium text-neutral-600"
              >
                Username
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your name"
                disabled={isLoading}
                className="input w-full"
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="login-role"
                className="text-sm font-medium text-neutral-600"
              >
                Role
              </label>
              <select
                id="login-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={isLoading}
                className="input w-full"
              >
                <option value={ROLE.ADMIN}>Officer</option>
                <option value={ROLE.AGENT}>Consultant</option>
                <option value={ROLE.VIEWER}>Viewer</option>
              </select>
            </div>

            <Button
              variant="primary"
              size="md"
              type="submit"
              fullWidth
              loading={isLoading}
              disabled={username.trim().length === 0}
              loadingText="Signing in..."
            >
              Sign In
            </Button>
          </form>

          <p className="text-xs text-neutral-400 text-center">
            Stockland Real Estate — Pilot Environment
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Inbox view component
 * Renders the inbox panel alongside the DM detail view, draft composer, and lead sidebar
 *
 * @param {object} props
 * @param {string|null} props.selectedDMId - Currently selected DM ID
 * @param {Function} props.onSelectDM - Callback when a DM is selected
 * @returns {React.ReactElement}
 */
function InboxView({ selectedDMId, onSelectDM }) {
  const [consentChecked, setConsentChecked] = useState(false);

  /**
   * Handles back navigation from detail view on mobile
   */
  function handleBack() {
    onSelectDM(null);
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left: Inbox list */}
      <div className={`w-full sm:w-80 sm:min-w-72 sm:max-w-96 shrink-0 ${selectedDMId ? 'hidden sm:flex sm:flex-col' : 'flex flex-col'}`}>
        <InboxPanel
          onSelectDM={onSelectDM}
          selectedDMId={selectedDMId}
          size="md"
          showSearch
          showPagination
          showHeader
          showRefresh
          autoLoad
          className="h-full"
        />
      </div>

      {/* Center: DM detail and draft */}
      <div className={`flex-1 min-w-0 flex flex-col gap-4 ${!selectedDMId ? 'hidden sm:flex' : 'flex'}`}>
        <div className="flex-1 min-h-0">
          <DMDetailView
            showContext
            showDraft
            showMetadata
            size="md"
            onBack={handleBack}
            className="h-full"
          />
        </div>

        {/* Draft composer and compliance */}
        {selectedDMId && (
          <div className="bg-white rounded-2xl shadow-card p-4 space-y-4">
            <DraftComposer
              size="md"
              showConfidence
              showNextSteps
              showInsertProperty
              showApproveControls
              showRegenerateButton
            />
            <ComplianceBanner
              size="sm"
              showConsent
              showPII
              showIssues
              compact={false}
              autoCheck
            />
            <ConsentCheckbox
              size="sm"
              checked={consentChecked}
              onChange={setConsentChecked}
              showSenderConsent
              showBlockedWarning
              showLegalTooltip
            />
          </div>
        )}
      </div>

      {/* Right: Lead capture sidebar */}
      {selectedDMId && (
        <div className="hidden lg:flex lg:flex-col w-72 min-w-64 max-w-80 shrink-0">
          <div className="bg-white rounded-2xl shadow-card p-4 h-full overflow-y-auto">
            <LeadCaptureSidebar
              size="md"
              showScore
              showSyncButton
              showFlagToggle
              showExtractButton
              showScoreButton
              showPropertyInterests
              showConsent
              showSyncStatus
              editable
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Leads view component
 * Renders the lead capture sidebar in a wider layout
 *
 * @returns {React.ReactElement}
 */
function LeadsView() {
  return (
    <div className="flex h-full gap-4">
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-2xl shadow-card p-4 h-full overflow-y-auto">
          <LeadCaptureSidebar
            size="md"
            showScore
            showSyncButton
            showFlagToggle
            showExtractButton
            showScoreButton
            showPropertyInterests
            showConsent
            showSyncStatus
            editable
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Notifications view component
 * Renders the full notification panel
 *
 * @param {object} props
 * @param {Function} props.onSelectDM - Callback when a DM-linked notification is selected
 * @returns {React.ReactElement}
 */
function NotificationsView({ onSelectDM }) {
  return (
    <div className="h-full">
      <NotificationPanel
        size="md"
        showHeader
        showFilters
        showPagination
        showRefresh
        showMarkAllRead
        autoLoad
        onSelectDM={onSelectDM}
        className="h-full"
      />
    </div>
  );
}

/**
 * Audit log view component
 * Renders the audit log viewer
 *
 * @returns {React.ReactElement}
 */
function AuditView() {
  return (
    <div className="h-full">
      <AuditLogViewer
        size="md"
        showHeader
        showFilters
        showPagination
        showExportButton
        showRefreshButton
        showClearButton
        autoLoad
        title="Audit Log"
        className="h-full"
      />
    </div>
  );
}

/**
 * Compliance view component
 * Renders the compliance banner with regulatory references
 *
 * @returns {React.ReactElement}
 */
function ComplianceView() {
  return (
    <div className="h-full">
      <div className="bg-white rounded-2xl shadow-card p-6 h-full overflow-y-auto space-y-6">
        <h2 className="text-lg font-semibold text-neutral-900">Compliance & Privacy</h2>
        <ComplianceBanner
          size="md"
          showConsent
          showPII
          showIssues
          showRules
          showRegulatory
          showBlockedBanner
          showCheckButton
          autoCheck
        />
      </div>
    </div>
  );
}

/**
 * Settings view component
 * Renders a placeholder settings panel
 *
 * @returns {React.ReactElement}
 */
function SettingsView() {
  return (
    <div className="h-full">
      <div className="bg-white rounded-2xl shadow-card p-6 h-full overflow-y-auto">
        <h2 className="text-lg font-semibold text-neutral-900">Settings</h2>
        <p className="text-sm text-neutral-500 mt-2">
          Application settings will be available in a future release.
        </p>
      </div>
    </div>
  );
}

/**
 * Main content renderer
 * Renders the appropriate view based on the active navigation
 *
 * @param {object} props
 * @param {string} props.activeNav - Currently active navigation ID
 * @param {string|null} props.selectedDMId - Currently selected DM ID
 * @param {Function} props.onSelectDM - Callback when a DM is selected
 * @returns {React.ReactElement}
 */
function MainContent({ activeNav, selectedDMId, onSelectDM }) {
  switch (activeNav) {
    case 'inbox':
      return <InboxView selectedDMId={selectedDMId} onSelectDM={onSelectDM} />;
    case 'leads':
      return <LeadsView />;
    case 'notifications':
      return <NotificationsView onSelectDM={onSelectDM} />;
    case 'audit':
      return <AuditView />;
    case 'compliance':
      return <ComplianceView />;
    case 'settings':
      return <SettingsView />;
    default:
      return <InboxView selectedDMId={selectedDMId} onSelectDM={onSelectDM} />;
  }
}

/**
 * Home page component
 * Entry point for the Social DM Copilot application
 * Renders Header, Sidebar, Dashboard, and the active view based on navigation state
 *
 * Features:
 * - Login form when not authenticated
 * - Header with navigation, notification bell, and user info
 * - Collapsible sidebar with navigation links
 * - Dashboard overview with metrics
 * - Inbox view with DM list, detail, draft composer, and lead sidebar
 * - Leads, Notifications, Audit Log, Compliance, and Settings views
 * - Responsive layout
 *
 * @returns {React.ReactElement}
 */
export default function HomePage() {
  const { currentUser, isAuthenticated, isLoading, login } = useAuth();

  const [activeNav, setActiveNav] = useState('inbox');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedDMId, setSelectedDMId] = useState(null);
  const [showDashboard, setShowDashboard] = useState(true);
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  /**
   * Handles login form submission
   *
   * @param {string} username - User display name
   * @param {string} role - User role
   */
  const handleLogin = useCallback(async (username, role) => {
    setLoginLoading(true);
    setLoginError(null);

    try {
      await login(username, role);
    } catch (err) {
      setLoginError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  }, [login]);

  /**
   * Handles navigation changes from Header or Sidebar
   *
   * @param {string} navId - Navigation link identifier
   */
  const handleNavChange = useCallback((navId) => {
    setActiveNav(navId);
    setSelectedDMId(null);
    setShowDashboard(false);
  }, []);

  /**
   * Handles DM selection from inbox or notifications
   *
   * @param {string|null} dmId - DM identifier or null to deselect
   */
  const handleSelectDM = useCallback((dmId) => {
    setSelectedDMId(dmId || null);

    if (dmId && activeNav !== 'inbox') {
      setActiveNav('inbox');
      setShowDashboard(false);
    }
  }, [activeNav]);

  /**
   * Handles notification selection from the header bell
   *
   * @param {object} notification - Selected notification object
   */
  const handleSelectNotification = useCallback((notification) => {
    if (notification && notification.dmId) {
      handleSelectDM(notification.dmId);
    } else {
      setActiveNav('notifications');
      setShowDashboard(false);
    }
  }, [handleSelectDM]);

  /**
   * Handles lead selection from notifications
   *
   * @param {string} leadId - Lead identifier
   */
  const handleSelectLead = useCallback((leadId) => {
    setActiveNav('leads');
    setShowDashboard(false);
  }, []);

  /**
   * Toggles the dashboard visibility
   */
  const handleToggleDashboard = useCallback(() => {
    setShowDashboard((prev) => !prev);
  }, []);

  // Loading state while restoring auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <LoadingSpinner
          size="xl"
          color="brand"
          label="Loading Social DM Copilot..."
          showLabel
        />
      </div>
    );
  }

  // Login form when not authenticated
  if (!isAuthenticated) {
    return (
      <LoginForm
        onLogin={handleLogin}
        isLoading={loginLoading}
        error={loginError}
      />
    );
  }

  // Map sidebar nav IDs to header nav IDs
  const headerActiveNav = activeNav === 'notifications' || activeNav === 'settings'
    ? 'inbox'
    : activeNav;

  return (
    <div className="flex flex-col h-screen bg-neutral-50 overflow-hidden">
      {/* Header */}
      <Header
        activeNav={headerActiveNav}
        onNavChange={handleNavChange}
        onSelectNotification={handleSelectNotification}
        onSelectDM={handleSelectDM}
        onSelectLead={handleSelectLead}
      />

      {/* Main layout: Sidebar + Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <div className="hidden md:flex">
          <Sidebar
            activeNav={activeNav}
            onNavChange={handleNavChange}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            showCollapseButton
            showUserInfo
            showBrandLogo
          />
        </div>

        {/* Content area */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Dashboard toggle and dashboard */}
          <div className="px-4 sm:px-6 lg:px-8 pt-4">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleDashboard}
                ariaLabel={showDashboard ? 'Hide dashboard' : 'Show dashboard'}
              >
                <svg
                  className={`h-4 w-4 mr-1.5 transition-transform ${showDashboard ? 'rotate-180' : ''}`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                {showDashboard ? 'Hide Dashboard' : 'Show Dashboard'}
              </Button>
            </div>

            {showDashboard && (
              <div className="mb-4">
                <Dashboard
                  size="md"
                  showStatusBreakdown
                  showLeadDistribution
                  showNotificationSummary
                  showRefreshButton
                  autoLoad
                />
              </div>
            )}
          </div>

          {/* Active view */}
          <div className="flex-1 min-h-0 px-4 sm:px-6 lg:px-8 pb-4 overflow-hidden">
            <MainContent
              activeNav={activeNav}
              selectedDMId={selectedDMId}
              onSelectDM={handleSelectDM}
            />
          </div>
        </main>
      </div>
    </div>
  );
}