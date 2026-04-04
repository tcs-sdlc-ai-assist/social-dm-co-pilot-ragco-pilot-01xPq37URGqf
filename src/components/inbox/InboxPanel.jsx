'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDM } from '@/contexts/DMContext';
import { useNotifications } from '@/hooks/useNotifications';
import SearchFilter from '@/components/common/SearchFilter';
import StatusBadge from '@/components/common/StatusBadge';
import PlatformIcon from '@/components/common/PlatformIcon';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/common/Button';
import { formatTimestamp, truncateText } from '@/utils/formatters';
import { STATUS, PAGINATION } from '@/utils/constants';

/**
 * Size variant mappings for the inbox panel
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    container: 'text-xs',
    item: 'px-3 py-2.5',
    sender: 'text-sm',
    preview: 'text-xs',
    meta: 'text-xs',
  },
  md: {
    container: 'text-sm',
    item: 'px-4 py-3',
    sender: 'text-sm',
    preview: 'text-sm',
    meta: 'text-xs',
  },
  lg: {
    container: 'text-base',
    item: 'px-5 py-4',
    sender: 'text-base',
    preview: 'text-sm',
    meta: 'text-sm',
  },
});

/**
 * Status priority for visual ordering of escalated/new items
 */
const STATUS_PRIORITY = Object.freeze({
  [STATUS.ESCALATED]: 0,
  [STATUS.NEW]: 1,
  [STATUS.DRAFTED]: 2,
  [STATUS.SENT]: 3,
});

/**
 * Unread icon SVG component
 * Renders a small dot indicator for unread/new DMs
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes
 * @returns {React.ReactElement}
 */
function UnreadDot({ className }) {
  return (
    <span
      className={`inline-block rounded-full bg-blue-500 ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Escalation icon SVG component
 * Renders a warning/alert icon for escalated DMs
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes
 * @returns {React.ReactElement}
 */
function EscalationIcon({ className }) {
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
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
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
 * InboxItem component
 * Renders a single DM item in the inbox list with sender info,
 * platform icon, status badge, timestamp, and content preview
 *
 * @param {object} props
 * @param {object} props.dm - DM object
 * @param {boolean} props.isSelected - Whether this DM is currently selected
 * @param {Function} props.onSelect - Callback when the DM is clicked
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function InboxItem({ dm, isSelected, onSelect, sizeClass }) {
  const isNew = dm.status === STATUS.NEW;
  const isEscalated = dm.status === STATUS.ESCALATED;

  const itemClasses = [
    'relative flex flex-col gap-1.5 border-b border-neutral-200 cursor-pointer transition-colors',
    sizeClass.item,
    isSelected
      ? 'bg-brand-50 border-l-4 border-l-brand-500'
      : 'border-l-4 border-l-transparent hover:bg-neutral-50',
    isEscalated && !isSelected ? 'bg-red-50/50' : '',
    isNew && !isSelected ? 'bg-blue-50/30' : '',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  /**
   * Handles click on the inbox item
   */
  function handleClick() {
    if (typeof onSelect === 'function') {
      onSelect(dm.id);
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

  const senderName = dm.sender?.name || 'Unknown Sender';
  const senderHandle = dm.sender?.handle || '';
  const platform = dm.sender?.platform || '';
  const timestamp = dm.timestamp || '';
  const content = dm.content || '';
  const status = dm.status || STATUS.NEW;

  return (
    <div
      className={itemClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="option"
      aria-selected={isSelected}
      aria-label={`DM from ${senderName}, status: ${status}`}
      tabIndex={0}
    >
      {/* Top row: sender info, platform, timestamp */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Unread indicator */}
          {isNew && <UnreadDot className="h-2 w-2 shrink-0" />}

          {/* Escalation indicator */}
          {isEscalated && (
            <EscalationIcon className="h-4 w-4 shrink-0 text-red-500" />
          )}

          {/* Platform icon */}
          <PlatformIcon platform={platform} size="sm" />

          {/* Sender name */}
          <span
            className={`font-semibold text-neutral-900 truncate ${sizeClass.sender} ${isNew ? 'font-bold' : ''}`}
          >
            {senderName}
          </span>

          {/* Sender handle */}
          {senderHandle && (
            <span className={`text-neutral-500 truncate hidden sm:inline ${sizeClass.meta}`}>
              {senderHandle}
            </span>
          )}
        </div>

        {/* Timestamp */}
        <span className={`text-neutral-500 shrink-0 whitespace-nowrap ${sizeClass.meta}`}>
          {formatTimestamp(timestamp)}
        </span>
      </div>

      {/* Middle row: content preview */}
      <p className={`text-neutral-600 leading-snug truncate ${sizeClass.preview} ${isNew ? 'font-medium text-neutral-800' : ''}`}>
        {truncateText(content, 120)}
      </p>

      {/* Bottom row: status badge and inquiry type */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} size="sm" />

          {dm.metadata?.inquiryType && (
            <span className="badge badge-neutral text-xs">
              {dm.metadata.inquiryType}
            </span>
          )}
        </div>

        {/* Confidence indicator if available */}
        {dm.metadata?.confidence !== undefined && dm.metadata?.confidence !== null && (
          <span className={`text-neutral-400 ${sizeClass.meta}`}>
            {Math.round(dm.metadata.confidence * 100)}% conf
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * InboxPanel component
 * Unified DM Inbox Panel: displays list of DMs with sender info, timestamp,
 * platform icon, status badge, and content preview. Supports filtering,
 * sorting, selection, and pagination. Highlights unread and escalated DMs.
 *
 * Implements FR-001 (SCRUM-6529)
 *
 * Features:
 * - Paginated DM list with configurable page size
 * - Search and filter bar (text search, platform, status, sort)
 * - DM selection with visual highlight
 * - Unread (New) DM visual indicator
 * - Escalated DM visual indicator with warning styling
 * - Status badge counts in header
 * - Responsive layout
 * - Loading and empty states
 * - Keyboard navigation support
 * - ARIA roles for accessibility
 *
 * @param {object} props
 * @param {Function} [props.onSelectDM] - Callback when a DM is selected (receives dmId)
 * @param {string} [props.selectedDMId] - Currently selected DM ID (controlled mode)
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the inbox panel
 * @param {boolean} [props.showSearch=true] - Whether to show the search/filter bar
 * @param {boolean} [props.showPagination=true] - Whether to show pagination controls
 * @param {boolean} [props.showHeader=true] - Whether to show the inbox header with counts
 * @param {boolean} [props.showRefresh=true] - Whether to show the refresh button
 * @param {boolean} [props.autoLoad=true] - Whether to auto-load DMs on mount
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <InboxPanel onSelectDM={handleSelectDM} selectedDMId={selectedId} />
 *
 * @example
 * <InboxPanel
 *   size="sm"
 *   showSearch={false}
 *   showPagination={false}
 *   onSelectDM={handleSelect}
 * />
 */
export function InboxPanel({
  onSelectDM,
  selectedDMId,
  size = 'md',
  showSearch = true,
  showPagination = true,
  showHeader = true,
  showRefresh = true,
  autoLoad = true,
  className = '',
}) {
  const {
    dms,
    total,
    filters,
    counts,
    loading,
    error,
    initialized,
    loadInbox,
    fetchDMs,
    selectDM,
    setFilters,
    refreshCounts,
    clearError,
  } = useDM();

  const { unreadCount } = useNotifications({ autoRefresh: true });

  const [internalSelectedId, setInternalSelectedId] = useState(null);
  const listRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // Determine the effective selected DM ID (controlled vs uncontrolled)
  const effectiveSelectedId = selectedDMId !== undefined ? selectedDMId : internalSelectedId;

  /**
   * Auto-load inbox on mount if enabled
   */
  useEffect(() => {
    if (autoLoad && !initialized) {
      loadInbox().catch(() => {});
    }
  }, [autoLoad, initialized, loadInbox]);

  /**
   * Handles DM selection
   *
   * @param {string} dmId - DM identifier
   */
  const handleSelectDM = useCallback(async (dmId) => {
    if (!dmId) return;

    // Update internal state for uncontrolled mode
    if (selectedDMId === undefined) {
      setInternalSelectedId(dmId);
    }

    // Select DM in context (fetches context)
    await selectDM(dmId);

    // Notify parent
    if (typeof onSelectDM === 'function') {
      onSelectDM(dmId);
    }
  }, [selectedDMId, selectDM, onSelectDM]);

  /**
   * Handles search query changes from the SearchFilter component
   *
   * @param {string} query - Debounced search query
   */
  const handleQueryChange = useCallback((query) => {
    setFilters({ query, page: 1 });
  }, [setFilters]);

  /**
   * Handles platform filter changes
   *
   * @param {string} platform - Platform filter value
   */
  const handlePlatformChange = useCallback((platform) => {
    setFilters({ platform, page: 1 });
  }, [setFilters]);

  /**
   * Handles status filter changes
   *
   * @param {string[]} status - Status filter values
   */
  const handleStatusChange = useCallback((status) => {
    setFilters({ status, page: 1 });
  }, [setFilters]);

  /**
   * Handles sort option changes
   *
   * @param {{ sortBy: string, sortOrder: string }} sortOptions
   */
  const handleSortChange = useCallback((sortOptions) => {
    setFilters({
      sortBy: sortOptions.sortBy,
      sortOrder: sortOptions.sortOrder,
      page: 1,
    });
  }, [setFilters]);

  /**
   * Handles clearing all filters
   */
  const handleClearAll = useCallback(() => {
    setFilters({
      query: '',
      platform: '',
      status: [],
      sortBy: 'timestamp',
      sortOrder: 'desc',
      page: 1,
    });
  }, [setFilters]);

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
    await fetchDMs(filters);
    await refreshCounts();
  }, [clearError, fetchDMs, filters, refreshCounts]);

  // Calculate pagination values
  const currentPage = filters.page || 1;
  const pageSize = filters.pageSize || PAGINATION.DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;
  const startItem = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, total);

  // Determine loading states
  const isInitializing = loading.initializing;
  const isLoadingInbox = loading.inbox;
  const isLoadingSelected = loading.selected;

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
    <div className={containerClasses} role="region" aria-label="DM Inbox">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-neutral-900">Inbox</h2>

            {/* Total count badge */}
            {total > 0 && (
              <span className="badge badge-neutral">
                {total}
              </span>
            )}

            {/* New DM count badge */}
            {counts.new > 0 && (
              <span className="badge bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {counts.new} new
              </span>
            )}

            {/* Escalated count badge */}
            {counts.escalated > 0 && (
              <span className="badge bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {counts.escalated} escalated
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Notification indicator */}
            {unreadCount > 0 && (
              <span className="badge bg-accent-100 text-accent-800 text-xs font-medium px-2 py-0.5 rounded-full">
                {unreadCount} alert{unreadCount !== 1 ? 's' : ''}
              </span>
            )}

            {/* Refresh button */}
            {showRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                loading={isLoadingInbox}
                ariaLabel="Refresh inbox"
                className="shrink-0"
              >
                <RefreshIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Search and filter bar */}
      {showSearch && (
        <div className="px-4 py-3 border-b border-neutral-200">
          <SearchFilter
            query={filters.query || ''}
            platform={filters.platform || ''}
            status={filters.status || []}
            sortBy={filters.sortBy || 'timestamp'}
            sortOrder={filters.sortOrder || 'desc'}
            onQueryChange={handleQueryChange}
            onPlatformChange={handlePlatformChange}
            onStatusChange={handleStatusChange}
            onSortChange={handleSortChange}
            onClearAll={handleClearAll}
            size={size === 'lg' ? 'md' : 'sm'}
            disabled={isInitializing}
            placeholder="Search DMs..."
          />
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

      {/* DM list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto"
        role="listbox"
        aria-label="DM messages"
      >
        {/* Initializing state */}
        {isInitializing && (
          <LoadingSpinner
            center
            size="lg"
            label="Loading inbox..."
            showLabel
          />
        )}

        {/* Loading state (non-initial) */}
        {!isInitializing && isLoadingInbox && (
          <LoadingSpinner
            center
            size="md"
            label="Fetching DMs..."
            showLabel
          />
        )}

        {/* Empty state */}
        {!isInitializing && !isLoadingInbox && dms.length === 0 && (
          <EmptyState
            title={filters.query || filters.platform || (filters.status && filters.status.length > 0)
              ? 'No DMs match your filters'
              : 'No DMs yet'
            }
            description={filters.query || filters.platform || (filters.status && filters.status.length > 0)
              ? 'Try adjusting your search or filters to find what you\'re looking for.'
              : 'New direct messages will appear here when they arrive.'
            }
            actionLabel={filters.query || filters.platform || (filters.status && filters.status.length > 0)
              ? 'Clear Filters'
              : undefined
            }
            onAction={filters.query || filters.platform || (filters.status && filters.status.length > 0)
              ? handleClearAll
              : undefined
            }
            actionVariant="secondary"
            size={size}
          />
        )}

        {/* DM items */}
        {!isInitializing && !isLoadingInbox && dms.length > 0 && (
          dms.map((dm) => (
            <InboxItem
              key={dm.id}
              dm={dm}
              isSelected={effectiveSelectedId === dm.id}
              onSelect={handleSelectDM}
              sizeClass={sizeClass}
            />
          ))
        )}
      </div>

      {/* Pagination controls */}
      {showPagination && !isInitializing && total > 0 && (
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
              disabled={!hasPrevPage || isLoadingInbox}
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
              disabled={!hasNextPage || isLoadingInbox}
              ariaLabel="Next page"
            >
              <ChevronIcon direction="right" className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InboxPanel;