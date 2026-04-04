'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { loadDMs, getDMs, getDMById, updateStatus, searchDMsByQuery, getDMCounts, getDMsByStatusFilter } from '@/services/dm-inbox-service';
import { getContextForDM } from '@/services/context-retrieval-service';
import { STATUS, STATUS_LIST, PLATFORM_LIST, PAGINATION } from '@/utils/constants';

/**
 * DM Context
 * Manages global DM state including list, filters, selected DM, and loading states
 * Wraps DMInboxService and ContextRetrievalService
 * Implements DMContext from LLD (SCRUM-6529, SCRUM-6531)
 *
 * Provides:
 * - dms: Current page of DM objects
 * - selectedDM: Currently selected DM with context
 * - filters: Active filter/sort/pagination state
 * - counts: DM counts by status for inbox badges
 * - loading: Loading state flags
 * - error: Current error state
 * - loadInbox(): Initialize DMs from mock data and load first page
 * - fetchDMs(filters): Fetch DMs with filtering, sorting, and pagination
 * - selectDM(dmId): Select a DM and retrieve its context
 * - clearSelectedDM(): Deselect the current DM
 * - updateDMStatus(dmId, status, options): Update a DM's status
 * - searchDMs(query): Search DMs by query text
 * - setFilters(filters): Update filter state and refetch
 * - refreshCounts(): Refresh DM status counts
 */

/**
 * @typedef {object} DMFilters
 * @property {number} page - Current page number (1-based)
 * @property {number} pageSize - Items per page
 * @property {string[]} status - Status filter values
 * @property {string} platform - Platform filter
 * @property {string} sortBy - Field to sort by
 * @property {string} sortOrder - Sort order ('asc' or 'desc')
 * @property {string} query - Search query string
 */

/**
 * @typedef {object} DMCounts
 * @property {number} total - Total DM count
 * @property {number} new - New DM count
 * @property {number} drafted - Drafted DM count
 * @property {number} sent - Sent DM count
 * @property {number} escalated - Escalated DM count
 */

/**
 * @typedef {object} DMLoadingState
 * @property {boolean} inbox - Whether the inbox is loading
 * @property {boolean} selected - Whether a selected DM is loading
 * @property {boolean} action - Whether a DM action is in progress
 * @property {boolean} initializing - Whether initial data load is in progress
 */

/**
 * @typedef {object} SelectedDMState
 * @property {object|null} dm - The selected DM object
 * @property {object|null} context - Retrieved context for the selected DM
 */

/**
 * @typedef {object} DMContextValue
 * @property {object[]} dms - Current page of DM objects
 * @property {number} total - Total number of DMs matching current filters
 * @property {SelectedDMState} selectedDM - Currently selected DM with context
 * @property {DMFilters} filters - Active filter/sort/pagination state
 * @property {DMCounts} counts - DM counts by status
 * @property {DMLoadingState} loading - Loading state flags
 * @property {string|null} error - Current error message
 * @property {boolean} initialized - Whether initial data load has completed
 * @property {Function} loadInbox - Initialize DMs from mock data
 * @property {Function} fetchDMs - Fetch DMs with filters
 * @property {Function} selectDM - Select a DM by ID
 * @property {Function} clearSelectedDM - Deselect the current DM
 * @property {Function} updateDMStatus - Update a DM's status
 * @property {Function} searchDMs - Search DMs by query
 * @property {Function} setFilters - Update filters and refetch
 * @property {Function} refreshCounts - Refresh DM status counts
 * @property {Function} clearError - Clear the current error
 */

const DMContext = createContext(null);

/**
 * Default filter state
 */
const DEFAULT_FILTERS = Object.freeze({
  page: 1,
  pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
  status: [],
  platform: '',
  sortBy: 'timestamp',
  sortOrder: 'desc',
  query: '',
});

/**
 * Default counts state
 */
const DEFAULT_COUNTS = Object.freeze({
  total: 0,
  new: 0,
  drafted: 0,
  sent: 0,
  escalated: 0,
});

/**
 * Default loading state
 */
const DEFAULT_LOADING = Object.freeze({
  inbox: false,
  selected: false,
  action: false,
  initializing: false,
});

/**
 * DM Context provider component
 * Manages DM inbox state, filtering, selection, and context retrieval
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement}
 */
export function DMProvider({ children }) {
  const [dms, setDMs] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedDM, setSelectedDM] = useState({ dm: null, context: null });
  const [filters, setFiltersState] = useState({ ...DEFAULT_FILTERS });
  const [counts, setCounts] = useState({ ...DEFAULT_COUNTS });
  const [loading, setLoading] = useState({ ...DEFAULT_LOADING });
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);

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
   * Refreshes DM status counts for inbox badges
   *
   * @returns {Promise<DMCounts>}
   */
  const refreshCounts = useCallback(async () => {
    try {
      const newCounts = await getDMCounts();
      safeSetState(setCounts, newCounts);
      return newCounts;
    } catch (err) {
      console.warn('[DMContext] Failed to refresh DM counts:', err.message);
      return counts;
    }
  }, [safeSetState, counts]);

  /**
   * Fetches DMs with the provided or current filters
   * Updates the DM list, total count, and refreshes status counts
   *
   * @param {Partial<DMFilters>} [filterOverrides] - Optional filter overrides
   * @returns {Promise<{ dms: object[], total: number }>}
   */
  const fetchDMs = useCallback(async (filterOverrides = {}) => {
    setLoadingFlag('inbox', true);
    clearError();

    try {
      const activeFilters = { ...filters, ...filterOverrides };

      const result = await getDMs({
        page: activeFilters.page,
        pageSize: activeFilters.pageSize,
        status: activeFilters.status && activeFilters.status.length > 0 ? activeFilters.status : undefined,
        platform: activeFilters.platform || undefined,
        sortBy: activeFilters.sortBy,
        sortOrder: activeFilters.sortOrder,
        query: activeFilters.query || undefined,
      });

      safeSetState(setDMs, result.dms);
      safeSetState(setTotal, result.total);

      // Refresh counts in the background
      refreshCounts().catch(() => {});

      return { dms: result.dms, total: result.total };
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch DMs';
      safeSetState(setError, errorMessage);
      console.warn('[DMContext] Failed to fetch DMs:', errorMessage);
      return { dms: [], total: 0 };
    } finally {
      setLoadingFlag('inbox', false);
    }
  }, [filters, setLoadingFlag, clearError, safeSetState, refreshCounts]);

  /**
   * Initializes the DM inbox by loading mock data into IndexedDB
   * and fetching the first page of DMs
   *
   * @param {object} [options]
   * @param {boolean} [options.force=false] - Force reload even if already initialized
   * @returns {Promise<void>}
   */
  const loadInbox = useCallback(async (options = {}) => {
    const { force = false } = options;

    if (initialized && !force) {
      return;
    }

    setLoadingFlag('initializing', true);
    clearError();

    try {
      // Load mock data into IndexedDB
      await loadDMs({ force });

      // Fetch the first page of DMs
      await fetchDMs({ page: 1 });

      // Refresh counts
      await refreshCounts();

      safeSetState(setInitialized, true);
    } catch (err) {
      const errorMessage = err.message || 'Failed to initialize DM inbox';
      safeSetState(setError, errorMessage);
      console.warn('[DMContext] Failed to initialize inbox:', errorMessage);
    } finally {
      setLoadingFlag('initializing', false);
    }
  }, [initialized, setLoadingFlag, clearError, fetchDMs, refreshCounts, safeSetState]);

  /**
   * Selects a DM by its ID and retrieves its context from the knowledge base
   * Sets the selected DM state with both the DM object and its context
   *
   * @param {string} dmId - DM identifier
   * @returns {Promise<{ dm: object|null, context: object|null }>}
   */
  const selectDM = useCallback(async (dmId) => {
    if (!dmId || typeof dmId !== 'string') {
      safeSetState(setError, 'DM id is required and must be a string');
      return { dm: null, context: null };
    }

    setLoadingFlag('selected', true);
    clearError();

    try {
      // Fetch the DM
      const dm = await getDMById(dmId);

      if (!dm) {
        safeSetState(setError, `DM not found: ${dmId}`);
        safeSetState(setSelectedDM, { dm: null, context: null });
        return { dm: null, context: null };
      }

      // Retrieve context for the DM
      let context = { properties: [], faqs: [], keywords: [] };
      try {
        context = await getContextForDM(dm);
      } catch (contextErr) {
        console.warn('[DMContext] Failed to retrieve context for DM:', contextErr.message);
        // Continue with empty context — context retrieval failure should not block DM selection
      }

      const selectedState = { dm, context };
      safeSetState(setSelectedDM, selectedState);

      return selectedState;
    } catch (err) {
      const errorMessage = err.message || 'Failed to select DM';
      safeSetState(setError, errorMessage);
      safeSetState(setSelectedDM, { dm: null, context: null });
      console.warn('[DMContext] Failed to select DM:', errorMessage);
      return { dm: null, context: null };
    } finally {
      setLoadingFlag('selected', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Clears the currently selected DM
   */
  const clearSelectedDM = useCallback(() => {
    safeSetState(setSelectedDM, { dm: null, context: null });
  }, [safeSetState]);

  /**
   * Updates the status of a DM and refreshes the inbox
   * Also updates the selected DM if it matches the updated DM
   *
   * @param {string} dmId - DM identifier
   * @param {string} status - New status value
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @param {string} [options.reason] - Reason for the status change
   * @returns {Promise<object|null>} Updated DM object or null on failure
   */
  const updateDMStatusAction = useCallback(async (dmId, status, options = {}) => {
    if (!dmId || typeof dmId !== 'string') {
      safeSetState(setError, 'DM id is required and must be a string');
      return null;
    }

    if (!status || !STATUS_LIST.includes(status)) {
      safeSetState(setError, `Invalid DM status: ${status}. Must be one of: ${STATUS_LIST.join(', ')}`);
      return null;
    }

    setLoadingFlag('action', true);
    clearError();

    try {
      const updatedDM = await updateStatus(dmId, status, options);

      // Update the DM in the current list
      safeSetState(setDMs, (prevDMs) =>
        prevDMs.map((dm) => (dm.id === dmId ? updatedDM : dm))
      );

      // Update selected DM if it matches
      setSelectedDM((prev) => {
        if (prev.dm && prev.dm.id === dmId) {
          return { ...prev, dm: updatedDM };
        }
        return prev;
      });

      // Refresh counts in the background
      refreshCounts().catch(() => {});

      return updatedDM;
    } catch (err) {
      const errorMessage = err.message || 'Failed to update DM status';
      safeSetState(setError, errorMessage);
      console.warn('[DMContext] Failed to update DM status:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('action', false);
    }
  }, [setLoadingFlag, clearError, safeSetState, refreshCounts]);

  /**
   * Searches DMs by query text and updates the DM list
   *
   * @param {string} query - Search query string
   * @returns {Promise<{ dms: object[], total: number }>}
   */
  const searchDMsAction = useCallback(async (query) => {
    const newFilters = {
      ...filters,
      query: query || '',
      page: 1, // Reset to first page on new search
    };

    safeSetState(setFiltersState, newFilters);

    return fetchDMs(newFilters);
  }, [filters, safeSetState, fetchDMs]);

  /**
   * Updates filter state and refetches DMs
   *
   * @param {Partial<DMFilters>} newFilters - Filter updates to apply
   * @returns {Promise<{ dms: object[], total: number }>}
   */
  const setFilters = useCallback(async (newFilters) => {
    const mergedFilters = { ...filters, ...newFilters };

    // Reset to page 1 when filters change (except when explicitly setting page)
    if (newFilters.status !== undefined || newFilters.platform !== undefined || newFilters.query !== undefined) {
      if (newFilters.page === undefined) {
        mergedFilters.page = 1;
      }
    }

    safeSetState(setFiltersState, mergedFilters);

    return fetchDMs(mergedFilters);
  }, [filters, safeSetState, fetchDMs]);

  const contextValue = useMemo(
    () => ({
      dms,
      total,
      selectedDM,
      filters,
      counts,
      loading,
      error,
      initialized,
      loadInbox,
      fetchDMs,
      selectDM,
      clearSelectedDM,
      updateDMStatus: updateDMStatusAction,
      searchDMs: searchDMsAction,
      setFilters,
      refreshCounts,
      clearError,
    }),
    [
      dms,
      total,
      selectedDM,
      filters,
      counts,
      loading,
      error,
      initialized,
      loadInbox,
      fetchDMs,
      selectDM,
      clearSelectedDM,
      updateDMStatusAction,
      searchDMsAction,
      setFilters,
      refreshCounts,
      clearError,
    ]
  );

  return (
    <DMContext.Provider value={contextValue}>
      {children}
    </DMContext.Provider>
  );
}

/**
 * Hook to access the DM context
 * Must be used within a DMProvider
 *
 * @returns {DMContextValue} DM context value
 * @throws {Error} If used outside of DMProvider
 */
export function useDM() {
  const context = useContext(DMContext);

  if (context === null) {
    throw new Error('useDM must be used within a DMProvider');
  }

  return context;
}

export default DMContext;