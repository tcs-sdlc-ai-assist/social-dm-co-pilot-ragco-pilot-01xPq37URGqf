'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Button from '@/components/common/Button';

/**
 * Notifications page component
 * Main workspace for notification management. Renders a responsive layout with
 * Header, Sidebar, and full NotificationPanel with filtering by type
 * (high-priority lead, SLA breach), read status, and pagination.
 *
 * Implements:
 * - FR-007 (SCRUM-6540): Notification center with high-priority lead alerts
 * - FR-007 (SCRUM-6541): SLA breach warnings and notification lifecycle
 *
 * Layout:
 * - Left: Collapsible sidebar navigation
 * - Center: Full NotificationPanel with filters, list, and pagination
 *
 * @returns {React.ReactElement}
 */
export default function NotificationsPage() {
  const { currentUser, isAuthenticated, isLoading: authLoading } = useAuth();

  const [activeNav, setActiveNav] = useState('notifications');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /**
   * Handles navigation changes from Header or Sidebar
   *
   * @param {string} navId - Navigation link identifier
   */
  const handleNavChange = useCallback((navId) => {
    setActiveNav(navId);
  }, []);

  /**
   * Handles notification selection from the header bell
   *
   * @param {object} notification - Selected notification object
   */
  const handleSelectNotification = useCallback((notification) => {
    // Notification selection stays on notifications page
  }, []);

  /**
   * Handles DM selection from notifications
   *
   * @param {string} dmId - DM identifier
   */
  const handleSelectDM = useCallback((dmId) => {
    // DM selection from notification — could navigate to inbox in future
  }, []);

  /**
   * Handles lead selection from notifications
   *
   * @param {string} leadId - Lead identifier
   */
  const handleSelectLead = useCallback((leadId) => {
    // Lead selection from notification — could navigate to leads in future
  }, []);

  /**
   * Handles notification selection from the panel
   *
   * @param {object} notification - Selected notification object
   */
  const handlePanelSelectNotification = useCallback((notification) => {
    // Panel notification selection — could open detail view in future
  }, []);

  /**
   * Handles DM-linked notification selection from the panel
   *
   * @param {string} dmId - DM identifier
   */
  const handlePanelSelectDM = useCallback((dmId) => {
    // DM-linked notification selection
  }, []);

  /**
   * Handles lead-linked notification selection from the panel
   *
   * @param {string} leadId - Lead identifier
   */
  const handlePanelSelectLead = useCallback((leadId) => {
    // Lead-linked notification selection
  }, []);

  // Auth loading state
  if (authLoading) {
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

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="bg-white rounded-2xl shadow-card p-8 text-center space-y-4 max-w-sm">
          <div
            className="flex items-center justify-center h-12 w-12 rounded-xl bg-brand-600 text-white font-bold text-lg mx-auto"
            aria-hidden="true"
          >
            S
          </div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
            Social DM Copilot
          </h1>
          <p className="text-sm text-neutral-500">
            Please sign in to access notifications.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              window.location.href = '/';
            }}
          >
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-50 overflow-hidden">
      {/* Header */}
      <Header
        activeNav={activeNav}
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
        <main className="flex-1 min-w-0 flex overflow-hidden p-4">
          <NotificationPanel
            size="md"
            showHeader
            showFilters
            showPagination
            showRefresh
            showMarkAllRead
            autoLoad
            onSelectNotification={handlePanelSelectNotification}
            onSelectDM={handlePanelSelectDM}
            onSelectLead={handlePanelSelectLead}
            className="flex-1"
          />
        </main>
      </div>
    </div>
  );
}