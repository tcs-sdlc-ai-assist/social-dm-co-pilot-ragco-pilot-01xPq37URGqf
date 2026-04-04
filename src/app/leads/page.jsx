'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLead } from '@/contexts/LeadContext';
import { useDM } from '@/contexts/DMContext';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import LeadCaptureSidebar from '@/components/lead/LeadCaptureSidebar';
import LeadScoreBadge from '@/components/lead/LeadScoreBadge';
import SalesforceButton from '@/components/lead/SalesforceButton';
import SearchFilter from '@/components/common/SearchFilter';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/common/Button';
import Tooltip from '@/components/common/Tooltip';
import StatusBadge from '@/components/common/StatusBadge';
import PlatformIcon from '@/components/common/PlatformIcon';
import Toast from '@/components/common/Toast';
import { formatTimestamp, formatCurrency, formatLeadScore } from '@/utils/formatters';
import { LEAD_SCORE, LEAD_LABELS, getLeadLabel, STATUS, PAGINATION } from '@/utils/constants';

/**
 * Score filter options for the leads table
 */
const SCORE_FILTER_OPTIONS = Object.freeze([
  { value: '', label: 'All Scores' },
  { value: 'hot', label: `Hot (≥${LEAD_SCORE.HOT})` },
  { value: 'warm', label: `Warm (${LEAD_SCORE.WARM}–${LEAD_SCORE.HOT - 1})` },
  { value: 'cold', label: `Cold (<${LEAD_SCORE.WARM})` },
]);

/**
 * Status filter options for the leads table
 */
const STATUS_FILTER_OPTIONS = Object.freeze([
  { value: '', label: 'All Statuses' },
  { value: 'New', label: 'New' },
  { value: 'Drafted', label: 'Drafted' },
  { value: 'Sent', label: 'Sent' },
  { value: 'Escalated', label: 'Escalated' },
]);

/**
 * Sort options for the leads table
 */
const SORT_OPTIONS = Object.freeze([
  { value: 'score:desc', label: 'Score: High → Low' },
  { value: 'score:asc', label: 'Score: Low → High' },
  { value: 'createdAt:desc', label: 'Newest First' },
  { value: 'createdAt:asc', label: 'Oldest First' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'name:desc', label: 'Name Z–A' },
]);

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
 * @param {string} props.className - Tailwind classes for sizing
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
 * Search icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function SearchIcon({ className }) {
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
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

/**
 * Clear icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function ClearIcon({ className }) {
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
 * Sync status badge component
 *
 * @param {object} props
 * @param {string} props.syncStatus - Salesforce sync status
 * @returns {React.ReactElement|null}
 */
function SyncStatusBadge({ syncStatus }) {
  if (!syncStatus) return null;

  const styles = {
    success: 'bg-brand-100 text-brand-800',
    failed: 'bg-red-100 text-red-800',
    pending: 'bg-accent-100 text-accent-800',
  };

  const icons = {
    success: '✓',
    failed: '✗',
    pending: '⏳',
  };

  const style = styles[syncStatus] || 'bg-neutral-100 text-neutral-700';
  const icon = icons[syncStatus] || '?';
  const label = syncStatus.charAt(0).toUpperCase() + syncStatus.slice(1);

  return (
    <span className={`badge text-xs ${style}`}>
      {icon} {label}
    </span>
  );
}

/**
 * Lead table row component
 * Displays a single lead in the table with key details
 *
 * @param {object} props
 * @param {object} props.lead - Lead object
 * @param {boolean} props.isSelected - Whether this lead is currently selected
 * @param {Function} props.onSelect - Callback when the lead is clicked
 * @returns {React.ReactElement}
 */
function LeadTableRow({ lead, isSelected, onSelect }) {
  if (!lead) return null;

  const isEscalated = lead.status === STATUS.ESCALATED;
  const isHot = typeof lead.score === 'number' && lead.score >= LEAD_SCORE.HOT;

  const rowClasses = [
    'border-b border-neutral-200 transition-colors cursor-pointer',
    isSelected
      ? 'bg-brand-50 border-l-4 border-l-brand-500'
      : 'border-l-4 border-l-transparent hover:bg-neutral-50',
    isEscalated && !isSelected ? 'bg-red-50/30' : '',
    isHot && !isSelected && !isEscalated ? 'bg-brand-50/20' : '',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  /**
   * Handles click on the row
   */
  function handleClick() {
    if (typeof onSelect === 'function') {
      onSelect(lead.id);
    }
  }

  /**
   * Handles keyboard activation
   *
   * @param {React.KeyboardEvent} event
   */
  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }

  return (
    <tr
      className={rowClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="row"
      aria-selected={isSelected}
      tabIndex={0}
    >
      {/* Name & Platform */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <PlatformIcon platform={lead.platform} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900 truncate">
              {lead.name || 'Unknown'}
            </p>
            {lead.handle && (
              <p className="text-xs text-neutral-500 truncate">
                {lead.handle}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Score */}
      <td className="px-4 py-3">
        <LeadScoreBadge
          score={lead.score}
          size="sm"
          showLabel
          showFlag
          showBar={false}
          showDot={false}
          showTooltip
        />
      </td>

      {/* Intent */}
      <td className="px-4 py-3">
        {lead.intent && (
          <span className="badge badge-neutral text-xs capitalize">
            {lead.intent}
          </span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={lead.status} size="sm" />
      </td>

      {/* Location */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-neutral-600 truncate block max-w-32">
          {lead.location || '—'}
        </span>
      </td>

      {/* Budget */}
      <td className="px-4 py-3 hidden xl:table-cell">
        <span className="text-xs text-neutral-600">
          {lead.budget && (lead.budget.min || lead.budget.max)
            ? lead.budget.min && lead.budget.max
              ? `${formatCurrency(lead.budget.min, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} – ${formatCurrency(lead.budget.max, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              : lead.budget.max
                ? `Up to ${formatCurrency(lead.budget.max, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : `From ${formatCurrency(lead.budget.min, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            : '—'
          }
        </span>
      </td>

      {/* Sync Status */}
      <td className="px-4 py-3 hidden md:table-cell">
        <SyncStatusBadge syncStatus={lead.syncStatus} />
      </td>

      {/* Created */}
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className="text-xs text-neutral-500 whitespace-nowrap">
          {formatTimestamp(lead.createdAt)}
        </span>
      </td>
    </tr>
  );
}

/**
 * Lead detail panel component
 * Displays detailed information about the selected lead
 *
 * @param {object} props
 * @param {object} props.lead - Selected lead object
 * @param {object} props.scoreBreakdown - Score breakdown for the lead
 * @param {boolean} props.isLoading - Whether the lead is loading
 * @param {Function} props.onClose - Callback to close the detail panel
 * @returns {React.ReactElement}
 */
function LeadDetailPanel({ lead, scoreBreakdown, isLoading, onClose }) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner
          center
          size="md"
          label="Loading lead details..."
          showLabel
        />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          title="Select a lead"
          description="Choose a lead from the table to view details, scoring breakdown, and Salesforce sync status."
          size="md"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Detail header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
        <div className="flex items-center gap-3 min-w-0">
          <PlatformIcon platform={lead.platform} size="md" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-neutral-900 truncate">
              {lead.name || 'Unknown Lead'}
            </h3>
            {lead.handle && (
              <p className="text-xs text-neutral-500 truncate">{lead.handle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={lead.status} size="sm" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            ariaLabel="Close lead detail"
            className="lg:hidden"
          >
            <ClearIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Score breakdown */}
        {scoreBreakdown && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-neutral-700">Score Breakdown</h4>
            <div className="flex items-center gap-3">
              <LeadScoreBadge
                score={scoreBreakdown.score}
                size="md"
                showLabel
                showFlag
                showBar
                showTooltip
              />
              {scoreBreakdown.escalationRequired && (
                <span className="badge bg-red-100 text-red-800 text-xs">
                  Escalation Required
                </span>
              )}
            </div>

            {scoreBreakdown.breakdown && scoreBreakdown.breakdown.length > 0 && (
              <div className="space-y-1.5">
                {scoreBreakdown.breakdown.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-neutral-500 capitalize">{item.component}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (item.score / 20) * 100)}%` }}
                          aria-hidden="true"
                        />
                      </div>
                      <span className="font-medium text-neutral-700 min-w-6 text-right">
                        {item.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Salesforce sync */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-neutral-700">Salesforce Sync</h4>
          <SalesforceButton
            lead={lead}
            showConfirmation
            showSyncStatus
            showCircuitBreakerWarning
            showRetryButton
            fullWidth
            size="md"
          />
        </div>

        {/* Lead capture sidebar (editable form) */}
        <LeadCaptureSidebar
          lead={lead}
          size="sm"
          showScore={false}
          showSyncButton={false}
          showFlagToggle
          showExtractButton={false}
          showScoreButton
          showPropertyInterests
          showConsent
          showSyncStatus={false}
          editable
        />
      </div>
    </div>
  );
}

/**
 * Leads page component
 * Main workspace for lead management. Renders a responsive layout with
 * Header, Sidebar, lead list table with filtering/sorting/pagination,
 * and a lead detail panel with scoring info and Salesforce sync status.
 *
 * Implements:
 * - FR-005 (SCRUM-6537): Lead extraction and capture
 * - FR-005 (SCRUM-6538): Salesforce sync
 * - FR-005 (SCRUM-6539): Lead scoring
 *
 * Layout:
 * - Left: Collapsible sidebar navigation
 * - Center: Lead list table with search, filters, and pagination
 * - Right: Lead detail panel with scoring breakdown and Salesforce sync
 *
 * @returns {React.ReactElement}
 */
export default function LeadsPage() {
  const { currentUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    leads,
    total,
    selectedLead,
    filters,
    loading: leadLoading,
    error: leadError,
    fetchLeads,
    selectLead,
    clearSelectedLead,
    score,
    scoreBatch,
    setFilters,
    clearError: clearLeadError,
  } = useLead();

  const [activeNav, setActiveNav] = useState('leads');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [localQuery, setLocalQuery] = useState('');
  const [localScoreFilter, setLocalScoreFilter] = useState('');
  const [localStatusFilter, setLocalStatusFilter] = useState('');
  const [localSortValue, setLocalSortValue] = useState('score:desc');
  const [toast, setToast] = useState(null);

  const listRef = useRef(null);
  const mountedRef = useRef(true);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Auto-load leads on mount
   */
  useEffect(() => {
    if (isAuthenticated && !initialLoadRef.current) {
      initialLoadRef.current = true;
      fetchLeads({ page: 1, sortBy: 'score', sortOrder: 'desc' }).catch(() => {});
    }
  }, [isAuthenticated, fetchLeads]);

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
   * Handles navigation changes from Header or Sidebar
   *
   * @param {string} navId - Navigation link identifier
   */
  const handleNavChange = useCallback((navId) => {
    setActiveNav(navId);

    if (navId !== 'leads') {
      setSelectedLeadId(null);
      clearSelectedLead();
    }
  }, [clearSelectedLead]);

  /**
   * Handles lead selection from the table
   *
   * @param {string} leadId - Lead identifier
   */
  const handleSelectLead = useCallback(async (leadId) => {
    if (!leadId) return;

    setSelectedLeadId(leadId);
    await selectLead(leadId);
  }, [selectLead]);

  /**
   * Handles closing the lead detail panel
   */
  const handleCloseDetail = useCallback(() => {
    setSelectedLeadId(null);
    clearSelectedLead();
  }, [clearSelectedLead]);

  /**
   * Handles notification selection from the header bell
   *
   * @param {object} notification - Selected notification object
   */
  const handleSelectNotification = useCallback((notification) => {
    if (notification && notification.leadId) {
      handleSelectLead(notification.leadId);
    }
  }, [handleSelectLead]);

  /**
   * Handles DM selection from notifications
   *
   * @param {string} dmId - DM identifier
   */
  const handleSelectDM = useCallback((dmId) => {
    // Navigate to inbox for DM selection — stays on leads page
  }, []);

  /**
   * Handles lead selection from notifications
   *
   * @param {string} leadId - Lead identifier
   */
  const handleSelectLeadFromNotification = useCallback((leadId) => {
    if (leadId) {
      handleSelectLead(leadId);
    }
  }, [handleSelectLead]);

  /**
   * Handles search query input changes
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  function handleQueryInput(event) {
    setLocalQuery(event.target.value);
  }

  /**
   * Handles search query submission
   */
  const handleSearchSubmit = useCallback(() => {
    setFilters({ query: localQuery, page: 1 }).catch(() => {});
  }, [localQuery, setFilters]);

  /**
   * Handles search query keydown
   *
   * @param {React.KeyboardEvent<HTMLInputElement>} event
   */
  function handleSearchKeyDown(event) {
    if (event.key === 'Enter') {
      handleSearchSubmit();
    }
    if (event.key === 'Escape') {
      setLocalQuery('');
      setFilters({ query: '', page: 1 }).catch(() => {});
    }
  }

  /**
   * Handles clearing the search query
   */
  function handleClearQuery() {
    setLocalQuery('');
    setFilters({ query: '', page: 1 }).catch(() => {});
  }

  /**
   * Handles score filter dropdown changes
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   */
  function handleScoreFilterChange(event) {
    const value = event.target.value;
    setLocalScoreFilter(value);

    // Map score filter to actual filter logic
    // We use the existing status/platform filters and apply score filtering client-side
    // by adjusting the sort and letting the context handle it
    // For the pilot, we refetch with appropriate sort
    const sortOverrides = {};
    if (value === 'hot' || value === 'warm' || value === 'cold') {
      sortOverrides.sortBy = 'score';
      sortOverrides.sortOrder = 'desc';
    }

    setFilters({ ...sortOverrides, page: 1 }).catch(() => {});
  }

  /**
   * Handles status filter dropdown changes
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   */
  function handleStatusFilterChange(event) {
    const value = event.target.value;
    setLocalStatusFilter(value);
    setFilters({ status: value ? [value] : [], page: 1 }).catch(() => {});
  }

  /**
   * Handles sort option dropdown changes
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   */
  function handleSortChange(event) {
    const value = event.target.value;
    setLocalSortValue(value);
    const [sortBy, sortOrder] = value.split(':');
    setFilters({ sortBy, sortOrder, page: 1 }).catch(() => {});
  }

  /**
   * Handles clearing all filters
   */
  function handleClearAll() {
    setLocalQuery('');
    setLocalScoreFilter('');
    setLocalStatusFilter('');
    setLocalSortValue('score:desc');
    setFilters({
      query: '',
      status: [],
      platform: '',
      intent: '',
      sortBy: 'score',
      sortOrder: 'desc',
      page: 1,
    }).catch(() => {});
  }

  /**
   * Handles page navigation
   *
   * @param {number} page - Target page number
   */
  const handlePageChange = useCallback((page) => {
    setFilters({ page }).catch(() => {});

    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [setFilters]);

  /**
   * Handles refresh button click
   */
  const handleRefresh = useCallback(async () => {
    clearLeadError();
    await fetchLeads(filters);
    showToast('Leads refreshed.', 'info');
  }, [clearLeadError, fetchLeads, filters]);

  /**
   * Handles score all visible leads
   */
  const handleScoreAll = useCallback(async () => {
    if (leads.length === 0) return;

    const leadIds = leads.map((l) => l.id);
    const result = await scoreBatch(leadIds, { performedBy: currentUser?.username || 'system' });

    if (result) {
      showToast(
        `Scored ${result.scored.length} lead${result.scored.length !== 1 ? 's' : ''}${result.errors.length > 0 ? ` (${result.errors.length} error${result.errors.length !== 1 ? 's' : ''})` : ''}.`,
        result.errors.length > 0 ? 'warning' : 'success'
      );
    } else {
      showToast('Failed to score leads.', 'error');
    }
  }, [leads, scoreBatch, currentUser]);

  // Filter leads by score tier client-side (since the repository doesn't have a score range filter)
  const filteredLeads = localScoreFilter
    ? leads.filter((lead) => {
        const s = typeof lead.score === 'number' ? lead.score : 0;
        if (localScoreFilter === 'hot') return s >= LEAD_SCORE.HOT;
        if (localScoreFilter === 'warm') return s >= LEAD_SCORE.WARM && s < LEAD_SCORE.HOT;
        if (localScoreFilter === 'cold') return s < LEAD_SCORE.WARM;
        return true;
      })
    : leads;

  // Calculate pagination values
  const currentPage = filters.page || 1;
  const pageSize = filters.pageSize || PAGINATION.DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;
  const startItem = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, total);

  // Determine loading states
  const isLoadingList = leadLoading.list;
  const isLoadingSelected = leadLoading.selected;
  const isScoring = leadLoading.scoring;
  const isAnyLoading = isLoadingList || isScoring;

  // Determine if any filter is active
  const hasActiveFilters =
    localQuery.length > 0 ||
    localScoreFilter.length > 0 ||
    localStatusFilter.length > 0 ||
    localSortValue !== 'score:desc';

  const hasLeadSelected = selectedLeadId !== null;

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
            Please sign in to access leads.
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
        onSelectLead={handleSelectLeadFromNotification}
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
          {/* Lead list table (left/center column) */}
          <div
            className={`flex-1 min-w-0 flex flex-col bg-white rounded-2xl shadow-card overflow-hidden m-4 mr-0 ${
              hasLeadSelected ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Table header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-neutral-900">Leads</h2>

                {total > 0 && (
                  <span className="badge badge-neutral">
                    {total}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Score all button */}
                <Tooltip content="Re-score all visible leads">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleScoreAll}
                    loading={isScoring}
                    disabled={isAnyLoading || leads.length === 0}
                    ariaLabel="Score all leads"
                  >
                    <svg
                      className="h-3.5 w-3.5 mr-1.5"
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
                        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                      />
                    </svg>
                    Score All
                  </Button>
                </Tooltip>

                {/* Refresh button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  loading={isLoadingList}
                  ariaLabel="Refresh leads"
                  className="shrink-0"
                >
                  <RefreshIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Filters row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-3 px-4 py-3 border-b border-neutral-200">
              {/* Search input */}
              <div className="relative flex-1 min-w-0 sm:min-w-48 sm:max-w-64">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-400">
                  <SearchIcon className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={localQuery}
                  onChange={handleQueryInput}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search leads..."
                  disabled={isLoadingList}
                  className="block w-full pl-10 pr-8 px-3 py-2 text-sm border border-neutral-300 rounded-xl bg-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed"
                  aria-label="Search leads"
                />
                {localQuery.length > 0 && !isLoadingList && (
                  <button
                    type="button"
                    onClick={handleClearQuery}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-600 transition-colors"
                    aria-label="Clear search"
                  >
                    <ClearIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Score filter */}
              <select
                value={localScoreFilter}
                onChange={handleScoreFilterChange}
                disabled={isLoadingList}
                className="border border-neutral-300 rounded-xl bg-white text-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed"
                aria-label="Filter by score"
              >
                {SCORE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={localStatusFilter}
                onChange={handleStatusFilterChange}
                disabled={isLoadingList}
                className="border border-neutral-300 rounded-xl bg-white text-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed"
                aria-label="Filter by status"
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* Sort options */}
              <select
                value={localSortValue}
                onChange={handleSortChange}
                disabled={isLoadingList}
                className="border border-neutral-300 rounded-xl bg-white text-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed"
                aria-label="Sort by"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* Clear all filters */}
              {hasActiveFilters && !isLoadingList && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center justify-center font-medium text-neutral-700 bg-white border border-neutral-300 rounded-xl hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors px-3 py-2 text-sm"
                  aria-label="Clear all filters"
                >
                  <ClearIcon className="h-4 w-4 mr-1.5" />
                  Clear
                </button>
              )}
            </div>

            {/* Error state */}
            {leadError && (
              <div className="px-4 py-3 bg-red-50 border-b border-red-200">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-red-700">{leadError}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearLeadError}
                    ariaLabel="Dismiss error"
                    className="text-red-600 hover:text-red-700 shrink-0"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            {/* Table */}
            <div
              ref={listRef}
              className="flex-1 overflow-auto"
            >
              {/* Loading state */}
              {isLoadingList && filteredLeads.length === 0 && (
                <LoadingSpinner
                  center
                  size="lg"
                  label="Loading leads..."
                  showLabel
                />
              )}

              {/* Empty state */}
              {!isLoadingList && filteredLeads.length === 0 && (
                <EmptyState
                  title={hasActiveFilters
                    ? 'No leads match your filters'
                    : 'No leads yet'
                  }
                  description={hasActiveFilters
                    ? 'Try adjusting your filters to find what you\'re looking for.'
                    : 'Leads will appear here once DMs are processed and lead data is extracted.'
                  }
                  actionLabel={hasActiveFilters ? 'Clear Filters' : undefined}
                  onAction={hasActiveFilters ? handleClearAll : undefined}
                  actionVariant="secondary"
                  size="md"
                />
              )}

              {/* Lead table */}
              {!isLoadingList && filteredLeads.length > 0 && (
                <table className="w-full min-w-[640px]" role="table" aria-label="Leads">
                  <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">
                        Score
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">
                        Intent
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden lg:table-cell">
                        Location
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden xl:table-cell">
                        Budget
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden md:table-cell">
                        Sync
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden sm:table-cell">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <LeadTableRow
                        key={lead.id}
                        lead={lead}
                        isSelected={selectedLeadId === lead.id}
                        onSelect={handleSelectLead}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination controls */}
            {!isLoadingList && total > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-neutral-200 bg-neutral-50">
                {/* Page info */}
                <span className="text-xs text-neutral-500">
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

                  <span className="px-2 font-medium text-neutral-700 text-xs">
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
          </div>

          {/* Lead detail panel (right column) */}
          <div
            className={`w-full lg:w-96 lg:min-w-80 lg:max-w-[28rem] shrink-0 bg-white rounded-2xl shadow-card overflow-hidden m-4 ml-4 flex flex-col ${
              hasLeadSelected ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <LeadDetailPanel
              lead={selectedLead?.lead || null}
              scoreBreakdown={selectedLead?.scoreBreakdown || null}
              isLoading={isLoadingSelected}
              onClose={handleCloseDetail}
            />
          </div>
        </main>
      </div>

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