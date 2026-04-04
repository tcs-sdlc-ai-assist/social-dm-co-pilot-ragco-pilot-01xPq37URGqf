'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAudit } from '@/contexts/AuditContext';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import Tooltip from '@/components/common/Tooltip';
import Toast from '@/components/common/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import { formatTimestamp } from '@/utils/formatters';
import { PAGINATION } from '@/utils/constants';

/**
 * Size variant mappings for the audit log viewer
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    container: 'text-xs',
    heading: 'text-sm',
    body: 'text-xs',
    meta: 'text-xs',
    label: 'text-xs',
    padding: 'px-3 py-2',
    input: 'px-2.5 py-1.5 text-xs',
    select: 'px-2 py-1.5 text-xs',
    cell: 'px-3 py-2',
    icon: 'h-3.5 w-3.5',
    button: 'px-2 py-1.5 text-xs',
  },
  md: {
    container: 'text-sm',
    heading: 'text-sm',
    body: 'text-sm',
    meta: 'text-xs',
    label: 'text-xs',
    padding: 'px-4 py-3',
    input: 'px-3 py-2 text-sm',
    select: 'px-3 py-2 text-sm',
    cell: 'px-4 py-3',
    icon: 'h-4 w-4',
    button: 'px-3 py-2 text-sm',
  },
  lg: {
    container: 'text-base',
    heading: 'text-base',
    body: 'text-sm',
    meta: 'text-sm',
    label: 'text-sm',
    padding: 'px-5 py-4',
    input: 'px-3 py-2.5 text-sm',
    select: 'px-4 py-2.5 text-sm',
    cell: 'px-5 py-4',
    icon: 'h-5 w-5',
    button: 'px-4 py-2.5 text-sm',
  },
});

/**
 * Entity type filter options
 */
const ENTITY_TYPE_OPTIONS = Object.freeze([
  { value: '', label: 'All Entities' },
  { value: 'dm', label: 'DM' },
  { value: 'draft', label: 'Draft' },
  { value: 'lead', label: 'Lead' },
  { value: 'notification', label: 'Notification' },
  { value: 'salesforce_sync', label: 'Salesforce Sync' },
  { value: 'system', label: 'System' },
]);

/**
 * Action type filter options
 */
const ACTION_TYPE_OPTIONS = Object.freeze([
  { value: '', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'extract', label: 'Extract' },
  { value: 'score', label: 'Score' },
  { value: 'sync', label: 'Sync' },
  { value: 'sync_failed', label: 'Sync Failed' },
  { value: 'escalate', label: 'Escalate' },
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
  { value: 'send', label: 'Send' },
  { value: 'acknowledge', label: 'Acknowledge' },
]);

/**
 * Sort options for the audit log table
 */
const SORT_OPTIONS = Object.freeze([
  { value: 'timestamp:desc', label: 'Newest First' },
  { value: 'timestamp:asc', label: 'Oldest First' },
  { value: 'entityType:asc', label: 'Entity A–Z' },
  { value: 'entityType:desc', label: 'Entity Z–A' },
  { value: 'action:asc', label: 'Action A–Z' },
  { value: 'action:desc', label: 'Action Z–A' },
]);

/**
 * Entity type badge color mappings
 */
const ENTITY_TYPE_STYLES = Object.freeze({
  dm: 'bg-blue-100 text-blue-800',
  draft: 'bg-accent-100 text-accent-800',
  lead: 'bg-brand-100 text-brand-800',
  notification: 'bg-pink-100 text-pink-800',
  salesforce_sync: 'bg-purple-100 text-purple-800',
  system: 'bg-neutral-100 text-neutral-700',
});

/**
 * Action type badge color mappings
 */
const ACTION_TYPE_STYLES = Object.freeze({
  create: 'bg-brand-100 text-brand-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  extract: 'bg-accent-100 text-accent-800',
  score: 'bg-purple-100 text-purple-800',
  sync: 'bg-brand-100 text-brand-800',
  sync_failed: 'bg-red-100 text-red-800',
  escalate: 'bg-red-100 text-red-800',
  approve: 'bg-brand-100 text-brand-800',
  reject: 'bg-red-100 text-red-800',
  send: 'bg-brand-100 text-brand-800',
  acknowledge: 'bg-blue-100 text-blue-800',
});

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
 * Download icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function DownloadIcon({ className }) {
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
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
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
 * Expand icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @param {boolean} props.expanded - Whether the row is expanded
 * @returns {React.ReactElement}
 */
function ExpandIcon({ className, expanded }) {
  return (
    <svg
      className={`${className} transition-transform ${expanded ? 'rotate-180' : ''}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/**
 * Formats a details object or string for display
 *
 * @param {*} details - Details value to format
 * @returns {string} Formatted details string
 */
function formatDetails(details) {
  if (details === null || details === undefined) return '—';

  if (typeof details === 'string') {
    return details.length > 0 ? details : '—';
  }

  if (typeof details === 'object') {
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  }

  return String(details);
}

/**
 * Formats a details object as a compact summary for the table cell
 *
 * @param {*} details - Details value to summarize
 * @param {number} [maxLength=80] - Maximum summary length
 * @returns {string} Compact summary string
 */
function summarizeDetails(details, maxLength = 80) {
  if (details === null || details === undefined) return '—';

  if (typeof details === 'string') {
    if (details.length === 0) return '—';
    return details.length > maxLength ? details.slice(0, maxLength) + '…' : details;
  }

  if (typeof details === 'object') {
    const keys = Object.keys(details);
    if (keys.length === 0) return '—';

    const parts = [];
    for (const key of keys.slice(0, 4)) {
      const value = details[key];
      if (value === null || value === undefined) continue;
      if (typeof value === 'object') {
        parts.push(`${key}: {…}`);
      } else {
        const strVal = String(value);
        parts.push(`${key}: ${strVal.length > 20 ? strVal.slice(0, 20) + '…' : strVal}`);
      }
    }

    if (keys.length > 4) {
      parts.push(`+${keys.length - 4} more`);
    }

    const summary = parts.join(', ');
    return summary.length > maxLength ? summary.slice(0, maxLength) + '…' : summary;
  }

  return String(details);
}

/**
 * Audit log table row component
 * Displays a single audit log entry with expandable details
 *
 * @param {object} props
 * @param {object} props.log - Audit log entry object
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function AuditLogRow({ log, sizeClass }) {
  const [expanded, setExpanded] = useState(false);

  if (!log) return null;

  const entityStyle = ENTITY_TYPE_STYLES[log.entityType] || 'bg-neutral-100 text-neutral-700';
  const actionStyle = ACTION_TYPE_STYLES[log.action] || 'bg-neutral-100 text-neutral-700';
  const hasDetails = log.details !== null && log.details !== undefined &&
    (typeof log.details === 'string' ? log.details.length > 0 : Object.keys(log.details).length > 0);

  return (
    <>
      <tr
        className={`border-b border-neutral-200 transition-colors hover:bg-neutral-50 ${expanded ? 'bg-neutral-50' : ''}`}
      >
        {/* Expand toggle */}
        <td className={`${sizeClass.cell} w-10`}>
          {hasDetails ? (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-xl p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 transition-colors"
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
              aria-expanded={expanded}
            >
              <ExpandIcon className="h-3.5 w-3.5" expanded={expanded} />
            </button>
          ) : (
            <span className="inline-block w-5" />
          )}
        </td>

        {/* Timestamp */}
        <td className={`${sizeClass.cell} whitespace-nowrap text-neutral-500`}>
          {formatTimestamp(log.timestamp, { relative: false, includeTime: true })}
        </td>

        {/* Entity Type */}
        <td className={sizeClass.cell}>
          <span className={`badge ${entityStyle} text-xs`}>
            {log.entityType || 'unknown'}
          </span>
        </td>

        {/* Entity ID */}
        <td className={`${sizeClass.cell} text-neutral-600 truncate max-w-32`}>
          <Tooltip content={log.entityId || '—'}>
            <span className="truncate block max-w-32">
              {log.entityId || '—'}
            </span>
          </Tooltip>
        </td>

        {/* Action */}
        <td className={sizeClass.cell}>
          <span className={`badge ${actionStyle} text-xs`}>
            {log.action || 'unknown'}
          </span>
        </td>

        {/* Performed By */}
        <td className={`${sizeClass.cell} text-neutral-600`}>
          {log.performedBy || '—'}
        </td>

        {/* Details Summary */}
        <td className={`${sizeClass.cell} text-neutral-500 truncate max-w-48`}>
          <Tooltip content={hasDetails ? 'Click expand to view full details' : 'No details'}>
            <span className="truncate block max-w-48">
              {summarizeDetails(log.details)}
            </span>
          </Tooltip>
        </td>
      </tr>

      {/* Expanded details row */}
      {expanded && hasDetails && (
        <tr className="border-b border-neutral-200 bg-neutral-50">
          <td colSpan={7} className={`${sizeClass.cell} pl-14`}>
            <div className="space-y-1.5">
              <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
                Details
              </span>
              <pre className={`p-3 bg-white border border-neutral-200 rounded-xl overflow-x-auto text-neutral-700 leading-relaxed whitespace-pre-wrap break-words ${sizeClass.meta}`}>
                {formatDetails(log.details)}
              </pre>
              <div className="flex items-center gap-3 flex-wrap">
                {log.id !== undefined && log.id !== null && (
                  <span className={`text-neutral-400 ${sizeClass.meta}`}>
                    Log ID: {log.id}
                  </span>
                )}
                {log.eventType && (
                  <span className={`text-neutral-400 ${sizeClass.meta}`}>
                    Event: {log.eventType}
                  </span>
                )}
                {log.timestamp && (
                  <span className={`text-neutral-400 ${sizeClass.meta}`}>
                    {formatTimestamp(log.timestamp, { relative: true })}
                  </span>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * AuditLogViewer component
 * Audit log viewer component: displays filterable table of audit log entries with
 * action, user, timestamp, and details columns. Includes export to CSV button
 * and search functionality.
 *
 * Implements audit log display for AuditLogService (SCRUM-6536, SCRUM-6542)
 *
 * Features:
 * - Paginated table of audit log entries
 * - Entity type filter dropdown (DM, Draft, Lead, Notification, Salesforce Sync, System)
 * - Action type filter dropdown (Create, Update, Delete, Extract, Score, Sync, etc.)
 * - Performed by (user) text search with debounce
 * - Sort options (Newest/Oldest, Entity A-Z/Z-A, Action A-Z/Z-A)
 * - Expandable detail rows with formatted JSON display
 * - Export to CSV button with download trigger
 * - Refresh button to reload audit logs
 * - Clear all filters button when any filter is active
 * - Entity type and action type color-coded badges
 * - Timestamp display with absolute formatting
 * - Entity ID display with tooltip for long IDs
 * - Details summary with expand/collapse
 * - Loading and empty states
 * - Toast notifications for export and error feedback
 * - Responsive layout
 * - ARIA labels for accessibility
 *
 * @param {object} props
 * @param {boolean} [props.showHeader=true] - Whether to show the panel header
 * @param {boolean} [props.showFilters=true] - Whether to show the filter controls
 * @param {boolean} [props.showPagination=true] - Whether to show pagination controls
 * @param {boolean} [props.showExportButton=true] - Whether to show the export to CSV button
 * @param {boolean} [props.showRefreshButton=true] - Whether to show the refresh button
 * @param {boolean} [props.showClearButton=true] - Whether to show the clear filters button
 * @param {boolean} [props.autoLoad=true] - Whether to auto-load audit logs on mount
 * @param {string} [props.entityTypeFilter] - Pre-set entity type filter
 * @param {string} [props.entityIdFilter] - Pre-set entity ID filter
 * @param {string} [props.actionFilter] - Pre-set action filter
 * @param {string} [props.performedByFilter] - Pre-set performed by filter
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the viewer
 * @param {string} [props.title='Audit Log'] - Panel title
 * @param {boolean} [props.bordered=false] - Whether to show a border around the panel
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <AuditLogViewer />
 *
 * @example
 * <AuditLogViewer
 *   entityTypeFilter="lead"
 *   showExportButton
 *   showFilters
 * />
 *
 * @example
 * <AuditLogViewer
 *   size="sm"
 *   showHeader={false}
 *   entityIdFilter="lead-001"
 *   entityTypeFilter="lead"
 * />
 */
export function AuditLogViewer({
  showHeader = true,
  showFilters = true,
  showPagination = true,
  showExportButton = true,
  showRefreshButton = true,
  showClearButton = true,
  autoLoad = true,
  entityTypeFilter: entityTypeProp,
  entityIdFilter: entityIdProp,
  actionFilter: actionProp,
  performedByFilter: performedByProp,
  size = 'md',
  title = 'Audit Log',
  bordered = false,
  className = '',
}) {
  const {
    logs,
    total,
    filters,
    loading,
    error,
    fetchLogs,
    exportAuditLogs,
    setFilters,
    clearError,
  } = useAudit();

  const [localEntityType, setLocalEntityType] = useState(entityTypeProp || '');
  const [localAction, setLocalAction] = useState(actionProp || '');
  const [localPerformedBy, setLocalPerformedBy] = useState(performedByProp || '');
  const [localEntityId, setLocalEntityId] = useState(entityIdProp || '');
  const [localSortValue, setLocalSortValue] = useState('timestamp:desc');
  const [toast, setToast] = useState(null);

  const debouncedPerformedBy = useDebounce(localPerformedBy, 300);
  const debouncedEntityId = useDebounce(localEntityId, 300);

  const listRef = useRef(null);
  const mountedRef = useRef(true);
  const initialLoadRef = useRef(false);
  const isInitialMountPerformedBy = useRef(true);
  const isInitialMountEntityId = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  /**
   * Auto-load audit logs on mount if enabled
   */
  useEffect(() => {
    if (autoLoad && !initialLoadRef.current) {
      initialLoadRef.current = true;

      const initialFilters = {};
      if (entityTypeProp) initialFilters.entityType = entityTypeProp;
      if (entityIdProp) initialFilters.entityId = entityIdProp;
      if (actionProp) initialFilters.action = actionProp;
      if (performedByProp) initialFilters.performedBy = performedByProp;

      fetchLogs({ page: 1, ...initialFilters }).catch(() => {});
    }
  }, [autoLoad, fetchLogs, entityTypeProp, entityIdProp, actionProp, performedByProp]);

  /**
   * Emit debounced performedBy changes
   */
  useEffect(() => {
    if (isInitialMountPerformedBy.current) {
      isInitialMountPerformedBy.current = false;
      return;
    }

    setFilters({ performedBy: debouncedPerformedBy || '', page: 1 }).catch(() => {});
  }, [debouncedPerformedBy, setFilters]);

  /**
   * Emit debounced entityId changes
   */
  useEffect(() => {
    if (isInitialMountEntityId.current) {
      isInitialMountEntityId.current = false;
      return;
    }

    setFilters({ entityId: debouncedEntityId || '', page: 1 }).catch(() => {});
  }, [debouncedEntityId, setFilters]);

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
   * Handles entity type filter dropdown changes
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   */
  function handleEntityTypeChange(event) {
    const value = event.target.value;
    setLocalEntityType(value);
    setFilters({ entityType: value || '', page: 1 }).catch(() => {});
  }

  /**
   * Handles action type filter dropdown changes
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   */
  function handleActionChange(event) {
    const value = event.target.value;
    setLocalAction(value);
    setFilters({ action: value || '', page: 1 }).catch(() => {});
  }

  /**
   * Handles performed by input changes
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  function handlePerformedByChange(event) {
    setLocalPerformedBy(event.target.value);
  }

  /**
   * Handles entity ID input changes
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  function handleEntityIdChange(event) {
    setLocalEntityId(event.target.value);
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
    setLocalEntityType('');
    setLocalAction('');
    setLocalPerformedBy('');
    setLocalEntityId('');
    setLocalSortValue('timestamp:desc');
    setFilters({
      entityType: '',
      entityId: '',
      action: '',
      performedBy: '',
      sortBy: 'timestamp',
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
    clearError();
    await fetchLogs(filters);
    showToast('Audit log refreshed.', 'info');
  }, [clearError, fetchLogs, filters]);

  /**
   * Handles export to CSV button click
   * Generates a CSV file and triggers a browser download
   */
  const handleExport = useCallback(async () => {
    const exportOptions = {};
    if (localEntityType) exportOptions.entityType = localEntityType;
    if (localAction) exportOptions.action = localAction;
    if (localPerformedBy) exportOptions.performedBy = localPerformedBy;

    const csv = await exportAuditLogs(exportOptions);

    if (csv) {
      // Trigger browser download
      try {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('Audit log exported successfully.', 'success');
      } catch {
        showToast('Failed to download CSV file.', 'error');
      }
    } else {
      showToast('Failed to export audit log.', 'error');
    }
  }, [exportAuditLogs, localEntityType, localAction, localPerformedBy]);

  /**
   * Handles keydown events on the performed by input
   * Clears the input when Escape is pressed
   *
   * @param {React.KeyboardEvent<HTMLInputElement>} event
   */
  function handlePerformedByKeyDown(event) {
    if (event.key === 'Escape') {
      setLocalPerformedBy('');
    }
  }

  /**
   * Handles keydown events on the entity ID input
   *
   * @param {React.KeyboardEvent<HTMLInputElement>} event
   */
  function handleEntityIdKeyDown(event) {
    if (event.key === 'Escape') {
      setLocalEntityId('');
    }
  }

  // Calculate pagination values
  const currentPage = filters.page || 1;
  const pageSize = filters.pageSize || PAGINATION.DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;
  const startItem = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, total);

  // Determine loading states
  const isLoadingList = loading.list;
  const isExporting = loading.exporting;
  const isAnyLoading = isLoadingList || isExporting;

  // Determine if any filter is active
  const hasActiveFilters =
    localEntityType.length > 0 ||
    localAction.length > 0 ||
    localPerformedBy.length > 0 ||
    localEntityId.length > 0 ||
    localSortValue !== 'timestamp:desc';

  const containerClasses = [
    'flex flex-col h-full bg-white rounded-2xl shadow-card overflow-hidden',
    sizeClass.container,
    bordered ? 'border border-neutral-200' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <div className={containerClasses} role="region" aria-label="Audit Log Viewer">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>

            {/* Total count badge */}
            {total > 0 && (
              <span className="badge badge-neutral">
                {total}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Export to CSV button */}
            {showExportButton && (
              <Tooltip content="Export audit log to CSV">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExport}
                  loading={isExporting}
                  disabled={isAnyLoading || total === 0}
                  ariaLabel="Export audit log to CSV"
                  loadingText="Exporting..."
                >
                  <DownloadIcon className="h-4 w-4 mr-1.5" />
                  Export CSV
                </Button>
              </Tooltip>
            )}

            {/* Refresh button */}
            {showRefreshButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                loading={isLoadingList}
                ariaLabel="Refresh audit log"
                className="shrink-0"
              >
                <RefreshIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-3 px-4 py-3 border-b border-neutral-200">
          {/* Entity type filter */}
          <select
            value={localEntityType}
            onChange={handleEntityTypeChange}
            disabled={isLoadingList}
            className={`border border-neutral-300 rounded-xl bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${sizeClass.select}`}
            aria-label="Filter by entity type"
          >
            {ENTITY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Action type filter */}
          <select
            value={localAction}
            onChange={handleActionChange}
            disabled={isLoadingList}
            className={`border border-neutral-300 rounded-xl bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${sizeClass.select}`}
            aria-label="Filter by action type"
          >
            {ACTION_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Entity ID search */}
          <div className="relative flex-1 min-w-0 sm:min-w-36 sm:max-w-48">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-400">
              <SearchIcon className={sizeClass.icon} />
            </div>
            <input
              type="text"
              value={localEntityId}
              onChange={handleEntityIdChange}
              onKeyDown={handleEntityIdKeyDown}
              placeholder="Entity ID..."
              disabled={isLoadingList}
              className={`block w-full pl-9 pr-8 border border-neutral-300 rounded-xl bg-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${sizeClass.input}`}
              aria-label="Search by entity ID"
            />
            {localEntityId.length > 0 && !isLoadingList && (
              <button
                type="button"
                onClick={() => setLocalEntityId('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-600 transition-colors"
                aria-label="Clear entity ID search"
              >
                <ClearIcon className={sizeClass.icon} />
              </button>
            )}
          </div>

          {/* Performed by search */}
          <div className="relative flex-1 min-w-0 sm:min-w-36 sm:max-w-48">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-400">
              <SearchIcon className={sizeClass.icon} />
            </div>
            <input
              type="text"
              value={localPerformedBy}
              onChange={handlePerformedByChange}
              onKeyDown={handlePerformedByKeyDown}
              placeholder="Performed by..."
              disabled={isLoadingList}
              className={`block w-full pl-9 pr-8 border border-neutral-300 rounded-xl bg-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${sizeClass.input}`}
              aria-label="Search by performed by"
            />
            {localPerformedBy.length > 0 && !isLoadingList && (
              <button
                type="button"
                onClick={() => setLocalPerformedBy('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-600 transition-colors"
                aria-label="Clear performed by search"
              >
                <ClearIcon className={sizeClass.icon} />
              </button>
            )}
          </div>

          {/* Sort options */}
          <select
            value={localSortValue}
            onChange={handleSortChange}
            disabled={isLoadingList}
            className={`border border-neutral-300 rounded-xl bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${sizeClass.select}`}
            aria-label="Sort by"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Clear all filters button */}
          {showClearButton && hasActiveFilters && !isLoadingList && (
            <button
              type="button"
              onClick={handleClearAll}
              className={`inline-flex items-center justify-center font-medium text-neutral-700 bg-white border border-neutral-300 rounded-xl hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors ${sizeClass.button}`}
              aria-label="Clear all filters"
            >
              <ClearIcon className={`${sizeClass.icon} mr-1.5`} />
              Clear
            </button>
          )}
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

      {/* Table */}
      <div
        ref={listRef}
        className="flex-1 overflow-auto"
      >
        {/* Loading state */}
        {isLoadingList && logs.length === 0 && (
          <LoadingSpinner
            center
            size="lg"
            label="Loading audit logs..."
            showLabel
          />
        )}

        {/* Empty state */}
        {!isLoadingList && logs.length === 0 && (
          <EmptyState
            title={hasActiveFilters
              ? 'No audit logs match your filters'
              : 'No audit logs yet'
            }
            description={hasActiveFilters
              ? 'Try adjusting your filters to find what you\'re looking for.'
              : 'Audit log entries will appear here as actions are performed in the system.'
            }
            actionLabel={hasActiveFilters ? 'Clear Filters' : undefined}
            onAction={hasActiveFilters ? handleClearAll : undefined}
            actionVariant="secondary"
            size={size}
          />
        )}

        {/* Audit log table */}
        {!isLoadingList && logs.length > 0 && (
          <table className="w-full min-w-[640px]" role="table" aria-label="Audit log entries">
            <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0 z-10">
              <tr>
                <th className={`${sizeClass.cell} w-10 text-left font-medium text-neutral-500`}>
                  <span className="sr-only">Expand</span>
                </th>
                <th className={`${sizeClass.cell} text-left font-medium text-neutral-500 whitespace-nowrap`}>
                  Timestamp
                </th>
                <th className={`${sizeClass.cell} text-left font-medium text-neutral-500`}>
                  Entity
                </th>
                <th className={`${sizeClass.cell} text-left font-medium text-neutral-500`}>
                  Entity ID
                </th>
                <th className={`${sizeClass.cell} text-left font-medium text-neutral-500`}>
                  Action
                </th>
                <th className={`${sizeClass.cell} text-left font-medium text-neutral-500`}>
                  User
                </th>
                <th className={`${sizeClass.cell} text-left font-medium text-neutral-500`}>
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <AuditLogRow
                  key={log.id}
                  log={log}
                  sizeClass={sizeClass}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination controls */}
      {showPagination && !isLoadingList && total > 0 && (
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
              disabled={!hasPrevPage || isLoadingList}
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
              disabled={!hasNextPage || isLoadingList}
              ariaLabel="Next page"
            >
              <ChevronIcon direction="right" className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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

export default AuditLogViewer;