'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import AuditLogViewer from '@/components/compliance/AuditLogViewer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Button from '@/components/common/Button';

/**
 * Audit log page component
 * Main workspace for audit log management. Renders a responsive layout with
 * Header, Sidebar, and full AuditLogViewer with filtering by entity type,
 * action type, performed by user, search, sorting, pagination, and CSV export.
 *
 * Implements:
 * - SCRUM-6536: Audit log service with centralized logging and PII stripping
 * - SCRUM-6542: Audit log viewer with filtering, export, and compliance trail
 *
 * Layout:
 * - Left: Collapsible sidebar navigation
 * - Center: Full AuditLogViewer with filters, table, pagination, and export
 *
 * @returns {React.ReactElement}
 */
export default function AuditPage() {
  const { currentUser, isAuthenticated, isLoading: authLoading } = useAuth();

  const [activeNav, setActiveNav] = useState('audit');
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
    // Notification selection stays on audit page
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
            Please sign in to access the audit log.
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
            className="flex-1"
          />
        </main>
      </div>
    </div>
  );
}