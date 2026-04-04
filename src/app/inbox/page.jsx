'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDM } from '@/contexts/DMContext';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import InboxPanel from '@/components/inbox/InboxPanel';
import DMDetailView from '@/components/inbox/DMDetailView';
import ContextPanel from '@/components/inbox/ContextPanel';
import DraftComposer from '@/components/draft/DraftComposer';
import LeadCaptureSidebar from '@/components/lead/LeadCaptureSidebar';
import ComplianceBanner from '@/components/compliance/ComplianceBanner';
import ConsentCheckbox from '@/components/compliance/ConsentCheckbox';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Button from '@/components/common/Button';

/**
 * Inbox page component
 * Main workspace for Social Media Officers. Renders a responsive multi-panel layout
 * with Header, Sidebar, InboxPanel, DMDetailView, ContextPanel, DraftComposer,
 * LeadCaptureSidebar, ComplianceBanner, and ConsentCheckbox.
 *
 * Implements:
 * - FR-001 (SCRUM-6529): DM Inbox with filtering, sorting, and selection
 * - FR-003 (SCRUM-6530): Draft generation and composer
 * - FR-002 (SCRUM-6531): Context retrieval and display
 * - FR-004 (SCRUM-6532): Draft review workflow
 * - FR-008 (SCRUM-6535): Confidence scoring and display
 * - FR-005 (SCRUM-6537): Lead extraction and capture sidebar
 *
 * Layout:
 * - Left: Collapsible sidebar navigation
 * - Center-left: Inbox panel (DM list with search/filter)
 * - Center: DM detail view with context panel
 * - Center-bottom: Draft composer with compliance banner and consent checkbox
 * - Right: Lead capture sidebar
 *
 * @returns {React.ReactElement}
 */
export default function InboxPage() {
  const { currentUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedDM } = useDM();

  const [activeNav, setActiveNav] = useState('inbox');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedDMId, setSelectedDMId] = useState(null);
  const [consentChecked, setConsentChecked] = useState(false);

  /**
   * Handles navigation changes from Header or Sidebar
   *
   * @param {string} navId - Navigation link identifier
   */
  const handleNavChange = useCallback((navId) => {
    setActiveNav(navId);

    if (navId !== 'inbox') {
      setSelectedDMId(null);
    }
  }, []);

  /**
   * Handles DM selection from inbox panel or notifications
   *
   * @param {string|null} dmId - DM identifier or null to deselect
   */
  const handleSelectDM = useCallback((dmId) => {
    setSelectedDMId(dmId || null);
    setConsentChecked(false);
  }, []);

  /**
   * Handles notification selection from the header bell
   *
   * @param {object} notification - Selected notification object
   */
  const handleSelectNotification = useCallback((notification) => {
    if (notification && notification.dmId) {
      handleSelectDM(notification.dmId);
    }
  }, [handleSelectDM]);

  /**
   * Handles lead selection from notifications
   *
   * @param {string} leadId - Lead identifier
   */
  const handleSelectLead = useCallback((leadId) => {
    // Lead selection stays on inbox page — lead sidebar will show the lead
  }, []);

  /**
   * Handles back navigation from detail view on mobile
   */
  const handleBack = useCallback(() => {
    setSelectedDMId(null);
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

  // Redirect to login if not authenticated (handled by root page, but guard here too)
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
            Please sign in to access the inbox.
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

  const hasDMSelected = selectedDMId !== null;

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
        <main className="flex-1 min-w-0 flex overflow-hidden">
          {/* Inbox panel (left column) */}
          <div
            className={`w-full sm:w-80 sm:min-w-72 sm:max-w-96 shrink-0 border-r border-neutral-200 ${
              hasDMSelected ? 'hidden sm:flex sm:flex-col' : 'flex flex-col'
            }`}
          >
            <InboxPanel
              onSelectDM={handleSelectDM}
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

          {/* Center column: DM detail + Draft composer */}
          <div
            className={`flex-1 min-w-0 flex flex-col overflow-hidden ${
              !hasDMSelected ? 'hidden sm:flex' : 'flex'
            }`}
          >
            {/* DM detail view */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <DMDetailView
                showContext
                showDraft={false}
                showMetadata
                size="md"
                onBack={handleBack}
                className="h-full"
              />
            </div>

            {/* Draft composer and compliance section */}
            {hasDMSelected && (
              <div className="shrink-0 border-t border-neutral-200 bg-white overflow-y-auto max-h-[45%]">
                <div className="p-4 space-y-4">
                  {/* Draft composer */}
                  <DraftComposer
                    size="md"
                    showConfidence
                    showNextSteps
                    showInsertProperty
                    showApproveControls
                    showRegenerateButton
                  />

                  {/* Compliance banner */}
                  <ComplianceBanner
                    size="sm"
                    showConsent
                    showPII
                    showIssues
                    compact={false}
                    autoCheck
                  />

                  {/* Consent checkbox */}
                  <ConsentCheckbox
                    size="sm"
                    checked={consentChecked}
                    onChange={setConsentChecked}
                    showSenderConsent
                    showBlockedWarning
                    showLegalTooltip
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right column: Context panel + Lead capture sidebar */}
          {hasDMSelected && (
            <div className="hidden lg:flex lg:flex-col w-80 min-w-72 max-w-96 shrink-0 border-l border-neutral-200 overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {/* Context panel */}
                <div className="p-4 border-b border-neutral-200">
                  <ContextPanel
                    size="md"
                    showKeywords
                    showInsertActions={false}
                    showTitle
                    showSummary
                    title="Knowledge Base Context"
                  />
                </div>

                {/* Lead capture sidebar */}
                <div className="p-4">
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
          )}

          {/* Empty state when no DM is selected (visible on larger screens) */}
          {!hasDMSelected && (
            <div className="hidden sm:flex flex-1 items-center justify-center">
              <div className="text-center space-y-3 px-6">
                <div className="text-neutral-400">
                  <svg
                    className="h-16 w-16 mx-auto"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-17.5 0V6.75a2.25 2.25 0 012.25-2.25h13.5a2.25 2.25 0 012.25 2.25v6.75m-17.5 0v4.5a2.25 2.25 0 002.25 2.25h13.5a2.25 2.25 0 002.25-2.25v-4.5"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-neutral-700">
                  Select a DM to get started
                </h3>
                <p className="text-sm text-neutral-500 max-w-sm">
                  Choose a message from the inbox to view details, generate a draft response,
                  retrieve context, and capture lead information.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}