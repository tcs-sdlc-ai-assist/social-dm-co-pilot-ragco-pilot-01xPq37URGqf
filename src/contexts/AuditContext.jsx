'use client';

import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  log,
  logEntityAction,
  logBatch,
  getAuditTrail,
  getEntityHistory,
  getLogsByActionType,
  getUserAuditTrail,
  getLogsByEvent,
  getLogEntry,
  getLogCounts,
  exportLogs,
  logDMAction,
  logDraftAction,
  logLeadAction,
  logNotificationAction,
  logSyncAction,
} from '@/services/audit-log-service';
import { PAGINATION } from '@/utils/constants';

/**
 * Audit Context
 * Manages audit log state, retrieval, and export functionality
 * Wraps AuditLogService
 * Implements AuditContext from LLD (SCRUM-6536, SCRUM-6542)
 *
 * Provides:
 * - logs: Current page of audit log entries
 * - filters: Active filter/sort/pagination state
 * - loading: Loading state flags
 * - error: Current error state
 * - total: Total number of logs matching current filters
 * - logAction(action, userId, details, options): Create a new audit log entry
 * - logEntity(entityType, entityId, action, userId, details): Log an action on a specific entity
 * - logActions(entries): Log multiple actions in batch
 * - fetchLogs(filters): Fetch audit logs with filtering, sorting, and pagination
 * - fetchEntityHistory(entityType, entityId): Fetch audit trail for a specific entity
 * - fetchLogsByAction(action, options): Fetch logs by action type
 * - fetchUserLogs(userId, options): Fetch logs by user
 * - fetchLogsByEventType(eventType): Fetch logs by event type
 * - fetchLogEntry(id): Fetch a single log entry by ID
 * - fetchLogCounts(entityType): Fetch total log counts
 * - exportAuditLogs(options): Export audit logs as CSV
 * - logDM(dmId, action, userId, details): Log a DM-related action
 * - logDraft(draftId, action, userId, details): Log a draft-related action
 * - logLead(leadId, action, userId, details): Log a lead-related action
 * - logNotification(notificationId, action, userId, details): Log a notification-related action
 * - logSync(syncId, action, userId, details): Log a Salesforce sync action
 * - setFilters(filters): Update filter state and refetch
 * - clearError(): Clear the current error
 */

/**
 * @typedef {object} AuditFilters
 * @property {number} page - Current page number (1-based)
 * @property {number} pageSize - Items per page
 * @property {string} entityType - Filter by entity type
 * @property {string} entityId - Filter by entity ID
 * @property {string} action - Filter by action
 * @property {string} performedBy - Filter by user ID
 * @property {string} sortBy - Field to sort by
 * @property {string} sortOrder - Sort order ('asc' or 'desc')
 */

/**
 * @typedef {object} AuditLoadingState
 * @property {boolean} list - Whether the log list is loading
 * @property {boolean} logging - Whether a log action is in progress
 * @property {boolean} exporting - Whether an export is in progress
 * @property {boolean} entry - Whether a single entry is loading
 */

/**
 * @typedef {object} AuditContextValue
 * @property {object[]} logs - Current page of audit log entries
 * @property {number} total - Total number of logs matching current filters
 * @property {AuditFilters} filters - Active filter/sort/pagination state
 * @property {AuditLoadingState} loading - Loading state flags
 * @property {string|null} error - Current error message
 * @property {Function} logAction - Create a new audit log entry
 * @property {Function} logEntity - Log an action on a specific entity
 * @property {Function} logActions - Log multiple actions in batch
 * @property {Function} fetchLogs - Fetch audit logs with filters
 * @property {Function} fetchEntityHistory - Fetch audit trail for a specific entity
 * @property {Function} fetchLogsByAction - Fetch logs by action type
 * @property {Function} fetchUserLogs - Fetch logs by user
 * @property {Function} fetchLogsByEventType - Fetch logs by event type
 * @property {Function} fetchLogEntry - Fetch a single log entry by ID
 * @property {Function} fetchLogCounts - Fetch total log counts
 * @property {Function} exportAuditLogs - Export audit logs as CSV
 * @property {Function} logDM - Log a DM-related action
 * @property {Function} logDraft - Log a draft-related action
 * @property {Function} logLead - Log a lead-related action
 * @property {Function} logNotification - Log a notification-related action
 * @property {Function} logSync - Log a Salesforce sync action
 * @property {Function} setFilters - Update filters and refetch
 * @property {Function} clearError - Clear the current error
 */

const AuditContext = createContext(null);

/**
 * Default filter state
 */
const DEFAULT_FILTERS = Object.freeze({
  page: 1,
  pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
  entityType: '',
  entityId: '',
  action: '',
  performedBy: '',
  sortBy: 'timestamp',
  sortOrder: 'desc',
});

/**
 * Default loading state
 */
const DEFAULT_LOADING = Object.freeze({
  list: false,
  logging: false,
  exporting: false,
  entry: false,
});

/**
 * Audit Context provider component
 * Manages audit log state, retrieval, logging, and export functionality
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement}
 */
export function AuditProvider({ children }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFiltersState] = useState({ ...DEFAULT_FILTERS });
  const [loading, setLoading] = useState({ ...DEFAULT_LOADING });
  const [error, setError] = useState(null);

  // Ref to track mounted state for async operations
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Helper to safely update state only if component is still mounted
   */
  const safeSetState = useCallback((setter, value) => {
    if (mountedRef.current) {
      setter(value);
    }
  }, []);

  /**
   * Updates a specific loading flag
   *
   * @param {string} key - Loading state key
   * @param {boolean} value - Loading state value
   */
  const setLoadingFlag = useCallback((key, value) => {
    if (mountedRef.current) {
      setLoading((prev) => ({ ...prev, [key]: value }));
    }
  }, []);

  /**
   * Clears the current error state
   */
  const clearError = useCallback(() => {
    safeSetState(setError, null);
  }, [safeSetState]);

  /**
   * Fetches audit logs with the provided or current filters
   * Updates the log list and total count
   *
   * @param {Partial<AuditFilters>} [filterOverrides] - Optional filter overrides
   * @returns {Promise<{ logs: object[], total: number }>}
   */
  const fetchLogs = useCallback(async (filterOverrides = {}) => {
    setLoadingFlag('list', true);
    clearError();

    try {
      const activeFilters = { ...filters, ...filterOverrides };

      const result = await getAuditTrail({
        page: activeFilters.page,
        pageSize: activeFilters.pageSize,
        entityType: activeFilters.entityType || undefined,
        entityId: activeFilters.entityId || undefined,
        action: activeFilters.action || undefined,
        performedBy: activeFilters.performedBy || undefined,
        sortBy: activeFilters.sortBy,
        sortOrder: activeFilters.sortOrder,
      });

      safeSetState(setLogs, result.logs);
      safeSetState(setTotal, result.total);

      return { logs: result.logs, total: result.total };
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch audit logs';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to fetch audit logs:', errorMessage);
      return { logs: [], total: 0 };
    } finally {
      setLoadingFlag('list', false);
    }
  }, [filters, setLoadingFlag, clearError, safeSetState]);

  /**
   * Creates a new audit log entry
   *
   * @param {string} action - Action performed
   * @param {string} userId - User or system identifier
   * @param {object|string} [details] - Additional details
   * @param {object} [options]
   * @param {string} [options.entityType] - Entity type
   * @param {string} [options.entityId] - Entity identifier
   * @param {string} [options.timestamp] - ISO timestamp
   * @returns {Promise<object|null>} Saved audit log entry or null on failure
   */
  const logAction = useCallback(async (action, userId, details, options = {}) => {
    if (!action || typeof action !== 'string') {
      safeSetState(setError, 'Action is required and must be a string');
      return null;
    }

    if (!userId || typeof userId !== 'string') {
      safeSetState(setError, 'User ID is required and must be a string');
      return null;
    }

    setLoadingFlag('logging', true);
    clearError();

    try {
      const entry = await log(action, userId, details, options);
      return entry;
    } catch (err) {
      const errorMessage = err.message || 'Failed to create audit log entry';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to create audit log entry:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('logging', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Logs an action on a specific entity
   *
   * @param {string} entityType - Entity type
   * @param {string} entityId - Entity identifier
   * @param {string} action - Action performed
   * @param {string} userId - User or system identifier
   * @param {object|string} [details] - Additional details
   * @returns {Promise<object|null>} Saved audit log entry or null on failure
   */
  const logEntity = useCallback(async (entityType, entityId, action, userId, details) => {
    if (!entityType || typeof entityType !== 'string') {
      safeSetState(setError, 'Entity type is required and must be a string');
      return null;
    }

    if (!entityId || typeof entityId !== 'string') {
      safeSetState(setError, 'Entity ID is required and must be a string');
      return null;
    }

    if (!action || typeof action !== 'string') {
      safeSetState(setError, 'Action is required and must be a string');
      return null;
    }

    if (!userId || typeof userId !== 'string') {
      safeSetState(setError, 'User ID is required and must be a string');
      return null;
    }

    setLoadingFlag('logging', true);
    clearError();

    try {
      const entry = await logEntityAction(entityType, entityId, action, userId, details);
      return entry;
    } catch (err) {
      const errorMessage = err.message || 'Failed to log entity action';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to log entity action:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('logging', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Logs multiple actions in batch
   *
   * @param {object[]} entries - Array of log entry objects
   * @returns {Promise<object[]|null>} Array of saved entries or null on failure
   */
  const logActions = useCallback(async (entries) => {
    if (!Array.isArray(entries)) {
      safeSetState(setError, 'Entries must be an array');
      return null;
    }

    if (entries.length === 0) return [];

    setLoadingFlag('logging', true);
    clearError();

    try {
      const savedEntries = await logBatch(entries);
      return savedEntries;
    } catch (err) {
      const errorMessage = err.message || 'Failed to log batch actions';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to log batch actions:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('logging', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Fetches the audit trail for a specific entity
   *
   * @param {string} entityType - Entity type
   * @param {string} entityId - Entity identifier
   * @returns {Promise<object[]|null>} Array of audit log entries or null on failure
   */
  const fetchEntityHistory = useCallback(async (entityType, entityId) => {
    if (!entityType || typeof entityType !== 'string') {
      safeSetState(setError, 'Entity type is required and must be a string');
      return null;
    }

    if (!entityId || typeof entityId !== 'string') {
      safeSetState(setError, 'Entity ID is required and must be a string');
      return null;
    }

    setLoadingFlag('list', true);
    clearError();

    try {
      const history = await getEntityHistory(entityType, entityId);
      return history;
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch entity history';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to fetch entity history:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('list', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Fetches audit logs by action type
   *
   * @param {string} action - Action to filter by
   * @param {object} [options]
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.pageSize] - Items per page
   * @returns {Promise<{ logs: object[], total: number }|null>}
   */
  const fetchLogsByAction = useCallback(async (action, options = {}) => {
    if (!action || typeof action !== 'string') {
      safeSetState(setError, 'Action is required and must be a string');
      return null;
    }

    setLoadingFlag('list', true);
    clearError();

    try {
      const result = await getLogsByActionType(action, options);
      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch logs by action';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to fetch logs by action:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('list', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Fetches audit logs by user
   *
   * @param {string} userId - User identifier
   * @param {object} [options]
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.pageSize] - Items per page
   * @returns {Promise<{ logs: object[], total: number }|null>}
   */
  const fetchUserLogs = useCallback(async (userId, options = {}) => {
    if (!userId || typeof userId !== 'string') {
      safeSetState(setError, 'User ID is required and must be a string');
      return null;
    }

    setLoadingFlag('list', true);
    clearError();

    try {
      const result = await getUserAuditTrail(userId, options);
      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch user audit trail';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to fetch user audit trail:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('list', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Fetches audit logs by event type
   *
   * @param {string} eventType - Event type string
   * @returns {Promise<object[]|null>} Array of audit log entries or null on failure
   */
  const fetchLogsByEventType = useCallback(async (eventType) => {
    if (!eventType || typeof eventType !== 'string') {
      safeSetState(setError, 'Event type is required and must be a string');
      return null;
    }

    setLoadingFlag('list', true);
    clearError();

    try {
      const entries = await getLogsByEvent(eventType);
      return entries;
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch logs by event type';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to fetch logs by event type:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('list', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Fetches a single audit log entry by its ID
   *
   * @param {number|string} id - Audit log entry identifier
   * @returns {Promise<object|null>} Audit log entry or null
   */
  const fetchLogEntryAction = useCallback(async (id) => {
    if (id === undefined || id === null) {
      safeSetState(setError, 'Log entry ID is required');
      return null;
    }

    setLoadingFlag('entry', true);
    clearError();

    try {
      const entry = await getLogEntry(id);
      return entry;
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch log entry';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to fetch log entry:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('entry', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Fetches total log counts, optionally filtered by entity type
   *
   * @param {string} [entityType] - Optional entity type filter
   * @returns {Promise<number|null>} Count of audit log entries or null on failure
   */
  const fetchLogCountsAction = useCallback(async (entityType) => {
    try {
      const count = await getLogCounts(entityType);
      return count;
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch log counts';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to fetch log counts:', errorMessage);
      return null;
    }
  }, [safeSetState]);

  /**
   * Exports audit logs as a CSV string
   *
   * @param {object} [options]
   * @param {string} [options.entityType] - Filter by entity type
   * @param {string} [options.action] - Filter by action
   * @param {string} [options.performedBy] - Filter by user ID
   * @returns {Promise<string|null>} CSV-formatted string or null on failure
   */
  const exportAuditLogs = useCallback(async (options = {}) => {
    setLoadingFlag('exporting', true);
    clearError();

    try {
      const csv = await exportLogs(options);
      return csv;
    } catch (err) {
      const errorMessage = err.message || 'Failed to export audit logs';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to export audit logs:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('exporting', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Convenience method to log a DM-related action
   *
   * @param {string} dmId - DM identifier
   * @param {string} action - Action performed
   * @param {string} userId - User or system identifier
   * @param {object|string} [details] - Additional details
   * @returns {Promise<object|null>} Saved audit log entry or null on failure
   */
  const logDM = useCallback(async (dmId, action, userId, details) => {
    if (!dmId || typeof dmId !== 'string') {
      safeSetState(setError, 'DM ID is required and must be a string');
      return null;
    }

    setLoadingFlag('logging', true);
    clearError();

    try {
      const entry = await logDMAction(dmId, action, userId, details);
      return entry;
    } catch (err) {
      const errorMessage = err.message || 'Failed to log DM action';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to log DM action:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('logging', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Convenience method to log a draft-related action
   *
   * @param {string|number} draftId - Draft identifier
   * @param {string} action - Action performed
   * @param {string} userId - User or system identifier
   * @param {object|string} [details] - Additional details
   * @returns {Promise<object|null>} Saved audit log entry or null on failure
   */
  const logDraft = useCallback(async (draftId, action, userId, details) => {
    if (draftId === undefined || draftId === null) {
      safeSetState(setError, 'Draft ID is required');
      return null;
    }

    setLoadingFlag('logging', true);
    clearError();

    try {
      const entry = await logDraftAction(draftId, action, userId, details);
      return entry;
    } catch (err) {
      const errorMessage = err.message || 'Failed to log draft action';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to log draft action:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('logging', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Convenience method to log a lead-related action
   *
   * @param {string} leadId - Lead identifier
   * @param {string} action - Action performed
   * @param {string} userId - User or system identifier
   * @param {object|string} [details] - Additional details
   * @returns {Promise<object|null>} Saved audit log entry or null on failure
   */
  const logLead = useCallback(async (leadId, action, userId, details) => {
    if (!leadId || typeof leadId !== 'string') {
      safeSetState(setError, 'Lead ID is required and must be a string');
      return null;
    }

    setLoadingFlag('logging', true);
    clearError();

    try {
      const entry = await logLeadAction(leadId, action, userId, details);
      return entry;
    } catch (err) {
      const errorMessage = err.message || 'Failed to log lead action';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to log lead action:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('logging', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Convenience method to log a notification-related action
   *
   * @param {string|number} notificationId - Notification identifier
   * @param {string} action - Action performed
   * @param {string} userId - User or system identifier
   * @param {object|string} [details] - Additional details
   * @returns {Promise<object|null>} Saved audit log entry or null on failure
   */
  const logNotification = useCallback(async (notificationId, action, userId, details) => {
    if (notificationId === undefined || notificationId === null) {
      safeSetState(setError, 'Notification ID is required');
      return null;
    }

    setLoadingFlag('logging', true);
    clearError();

    try {
      const entry = await logNotificationAction(notificationId, action, userId, details);
      return entry;
    } catch (err) {
      const errorMessage = err.message || 'Failed to log notification action';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to log notification action:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('logging', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Convenience method to log a Salesforce sync action
   *
   * @param {string} syncId - Sync operation identifier
   * @param {string} action - Action performed
   * @param {string} userId - User or system identifier
   * @param {object|string} [details] - Additional details
   * @returns {Promise<object|null>} Saved audit log entry or null on failure
   */
  const logSync = useCallback(async (syncId, action, userId, details) => {
    if (!syncId || typeof syncId !== 'string') {
      safeSetState(setError, 'Sync ID is required and must be a string');
      return null;
    }

    setLoadingFlag('logging', true);
    clearError();

    try {
      const entry = await logSyncAction(syncId, action, userId, details);
      return entry;
    } catch (err) {
      const errorMessage = err.message || 'Failed to log sync action';
      safeSetState(setError, errorMessage);
      console.warn('[AuditContext] Failed to log sync action:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('logging', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Updates filter state and refetches audit logs
   *
   * @param {Partial<AuditFilters>} newFilters - Filter updates to apply
   * @returns {Promise<{ logs: object[], total: number }>}
   */
  const setFilters = useCallback(async (newFilters) => {
    const mergedFilters = { ...filters, ...newFilters };

    // Reset to page 1 when filters change (except when explicitly setting page)
    if (
      newFilters.entityType !== undefined ||
      newFilters.entityId !== undefined ||
      newFilters.action !== undefined ||
      newFilters.performedBy !== undefined
    ) {
      if (newFilters.page === undefined) {
        mergedFilters.page = 1;
      }
    }

    safeSetState(setFiltersState, mergedFilters);

    return fetchLogs(mergedFilters);
  }, [filters, safeSetState, fetchLogs]);

  const contextValue = useMemo(
    () => ({
      logs,
      total,
      filters,
      loading,
      error,
      logAction,
      logEntity,
      logActions,
      fetchLogs,
      fetchEntityHistory,
      fetchLogsByAction,
      fetchUserLogs,
      fetchLogsByEventType,
      fetchLogEntry: fetchLogEntryAction,
      fetchLogCounts: fetchLogCountsAction,
      exportAuditLogs,
      logDM,
      logDraft,
      logLead,
      logNotification,
      logSync,
      setFilters,
      clearError,
    }),
    [
      logs,
      total,
      filters,
      loading,
      error,
      logAction,
      logEntity,
      logActions,
      fetchLogs,
      fetchEntityHistory,
      fetchLogsByAction,
      fetchUserLogs,
      fetchLogsByEventType,
      fetchLogEntryAction,
      fetchLogCountsAction,
      exportAuditLogs,
      logDM,
      logDraft,
      logLead,
      logNotification,
      logSync,
      setFilters,
      clearError,
    ]
  );

  return (
    <AuditContext.Provider value={contextValue}>
      {children}
    </AuditContext.Provider>
  );
}

/**
 * Hook to access the audit context
 * Must be used within an AuditProvider
 *
 * @returns {AuditContextValue} Audit context value
 * @throws {Error} If used outside of AuditProvider
 */
export function useAudit() {
  const context = useContext(AuditContext);

  if (context === null) {
    throw new Error('useAudit must be used within an AuditProvider');
  }

  return context;
}

export default AuditContext;