'use client';

import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { extractLead, extractLeadsFromBatch, getLeadForDM, isLeadExtracted, flagForManualEntry, enrichLead } from '@/services/lead-extraction-service';
import { scoreLead, scoreLeadData, getScoreBreakdown, scoreLeadsInBatch, checkEscalation, rescoreLead, getPriorityLabel } from '@/services/lead-scoring-service';
import { syncLeadToSalesforce, syncLeadsInBatch, getSyncStatus, retrySyncFailed, getCircuitBreakerState } from '@/services/salesforce-sync-service';
import { getAllLeads, getLeadById, getHighPriorityLeads, searchLeads } from '@/repositories/lead-repository';
import { PAGINATION, STATUS } from '@/utils/constants';

/**
 * Lead Context
 * Manages lead extraction, scoring, and Salesforce sync state
 * Wraps LeadExtractionService, LeadScoringService, and SalesforceSyncService
 * Implements LeadContext from LLD (SCRUM-6537, SCRUM-6538, SCRUM-6539)
 *
 * Provides:
 * - leads: Current page of lead objects
 * - selectedLead: Currently selected lead with score breakdown
 * - filters: Active filter/sort/pagination state
 * - loading: Loading state flags
 * - error: Current error state
 * - extract(dm, options): Extract a lead from a DM
 * - extractBatch(dms, options): Extract leads from multiple DMs
 * - score(leadId, options): Score a lead
 * - scoreBatch(leadIds, options): Score multiple leads
 * - rescore(leadId, options): Re-score a lead with latest rules
 * - sync(leadId, options): Sync a lead to Salesforce
 * - syncBatch(leadIds, options): Sync multiple leads to Salesforce
 * - retrySyncFailures(options): Retry all failed syncs
 * - selectLead(leadId): Select a lead and retrieve its score breakdown
 * - clearSelectedLead(): Deselect the current lead
 * - fetchLeads(filters): Fetch leads with filtering, sorting, and pagination
 * - searchLeadsAction(query): Search leads by query text
 * - setFilters(filters): Update filter state and refetch
 * - getLeadForDMAction(dmId): Get the lead extracted from a specific DM
 * - flagLead(leadId, options): Flag a lead for manual entry
 * - enrichLeadAction(leadId, dm, options): Enrich a lead with additional context
 * - checkLeadEscalation(leadId): Check if a lead requires escalation
 * - getSyncStatusAction(leadId): Get Salesforce sync status for a lead
 * - getCircuitBreakerStatus(): Get current circuit breaker state
 * - clearError(): Clear the current error
 */

/**
 * @typedef {object} LeadFilters
 * @property {number} page - Current page number (1-based)
 * @property {number} pageSize - Items per page
 * @property {string[]} status - Status filter values
 * @property {string} platform - Platform filter
 * @property {string} intent - Intent filter
 * @property {string} assignedTo - Assigned agent filter
 * @property {string} sortBy - Field to sort by
 * @property {string} sortOrder - Sort order ('asc' or 'desc')
 * @property {string} query - Search query string
 */

/**
 * @typedef {object} LeadLoadingState
 * @property {boolean} list - Whether the lead list is loading
 * @property {boolean} selected - Whether a selected lead is loading
 * @property {boolean} extracting - Whether lead extraction is in progress
 * @property {boolean} scoring - Whether lead scoring is in progress
 * @property {boolean} syncing - Whether Salesforce sync is in progress
 * @property {boolean} action - Whether a general lead action is in progress
 */

/**
 * @typedef {object} SelectedLeadState
 * @property {object|null} lead - The selected lead object
 * @property {object|null} scoreBreakdown - Score breakdown for the selected lead
 */

/**
 * @typedef {object} LeadContextValue
 * @property {object[]} leads - Current page of lead objects
 * @property {number} total - Total number of leads matching current filters
 * @property {SelectedLeadState} selectedLead - Currently selected lead with score breakdown
 * @property {LeadFilters} filters - Active filter/sort/pagination state
 * @property {LeadLoadingState} loading - Loading state flags
 * @property {string|null} error - Current error message
 * @property {Function} extract - Extract a lead from a DM
 * @property {Function} extractBatch - Extract leads from multiple DMs
 * @property {Function} score - Score a lead
 * @property {Function} scoreBatch - Score multiple leads
 * @property {Function} rescore - Re-score a lead
 * @property {Function} sync - Sync a lead to Salesforce
 * @property {Function} syncBatch - Sync multiple leads
 * @property {Function} retrySyncFailures - Retry all failed syncs
 * @property {Function} selectLead - Select a lead by ID
 * @property {Function} clearSelectedLead - Deselect the current lead
 * @property {Function} fetchLeads - Fetch leads with filters
 * @property {Function} searchLeadsAction - Search leads by query
 * @property {Function} setFilters - Update filters and refetch
 * @property {Function} getLeadForDMAction - Get lead for a DM
 * @property {Function} flagLead - Flag a lead for manual entry
 * @property {Function} enrichLeadAction - Enrich a lead
 * @property {Function} checkLeadEscalation - Check escalation requirement
 * @property {Function} getSyncStatusAction - Get sync status
 * @property {Function} getCircuitBreakerStatus - Get circuit breaker state
 * @property {Function} clearError - Clear the current error
 */

const LeadContext = createContext(null);

/**
 * Default filter state
 */
const DEFAULT_FILTERS = Object.freeze({
  page: 1,
  pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
  status: [],
  platform: '',
  intent: '',
  assignedTo: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  query: '',
});

/**
 * Default loading state
 */
const DEFAULT_LOADING = Object.freeze({
  list: false,
  selected: false,
  extracting: false,
  scoring: false,
  syncing: false,
  action: false,
});

/**
 * Lead Context provider component
 * Manages lead extraction, scoring, Salesforce sync, and list state
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement}
 */
export function LeadProvider({ children }) {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedLead, setSelectedLead] = useState({ lead: null, scoreBreakdown: null });
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
   * Fetches leads with the provided or current filters
   * Updates the lead list and total count
   *
   * @param {Partial<LeadFilters>} [filterOverrides] - Optional filter overrides
   * @returns {Promise<{ leads: object[], total: number }>}
   */
  const fetchLeads = useCallback(async (filterOverrides = {}) => {
    setLoadingFlag('list', true);
    clearError();

    try {
      const activeFilters = { ...filters, ...filterOverrides };

      let result;

      if (activeFilters.query && activeFilters.query.trim().length > 0) {
        result = await searchLeads(activeFilters.query, {
          page: activeFilters.page,
          pageSize: activeFilters.pageSize,
          status: activeFilters.status && activeFilters.status.length > 0 ? activeFilters.status : undefined,
          platform: activeFilters.platform || undefined,
        });
      } else {
        result = await getAllLeads({
          page: activeFilters.page,
          pageSize: activeFilters.pageSize,
          status: activeFilters.status && activeFilters.status.length > 0 ? activeFilters.status : undefined,
          platform: activeFilters.platform || undefined,
          intent: activeFilters.intent || undefined,
          assignedTo: activeFilters.assignedTo || undefined,
          sortBy: activeFilters.sortBy,
          sortOrder: activeFilters.sortOrder,
        });
      }

      safeSetState(setLeads, result.leads);
      safeSetState(setTotal, result.total);

      return { leads: result.leads, total: result.total };
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch leads';
      safeSetState(setError, errorMessage);
      console.warn('[LeadContext] Failed to fetch leads:', errorMessage);
      return { leads: [], total: 0 };
    } finally {
      setLoadingFlag('list', false);
    }
  }, [filters, setLoadingFlag, clearError, safeSetState]);

  /**
   * Extracts a lead from a DM
   * Parses DM content to identify structured lead data
   *
   * @param {object} dm - DM object
   * @param {string} dm.id - DM identifier
   * @param {string} dm.content - DM message content
   * @param {object} dm.sender - Sender information
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @param {string} [options.assignedTo] - Agent to assign the lead to
   * @returns {Promise<{ lead: object, extractionConfidence: number, complete: boolean, warnings: string[] }|null>}
   */
  const extract = useCallback(async (dm, options = {}) => {
    if (!dm || typeof dm !== 'object') {
      safeSetState(setError, 'DM must be a non-null object');
      return null;
    }

    if (!dm.id || typeof dm.id !== 'string') {
      safeSetState(setError, 'DM must have a string id');
      return null;
    }

    if (!dm.content || typeof dm.content !== 'string' || dm.content.trim().length === 0) {
      safeSetState(setError, 'DM must have non-empty content');
      return null;
    }

    setLoadingFlag('extracting', true);
    clearError();

    try {
      const result = await extractLead(dm, options);

      // Update the lead in the current list if it exists
      safeSetState(setLeads, (prevLeads) => {
        const existingIndex = prevLeads.findIndex((l) => l.id === result.lead.id);
        if (existingIndex >= 0) {
          const updated = [...prevLeads];
          updated[existingIndex] = result.lead;
          return updated;
        }
        return [result.lead, ...prevLeads];
      });

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to extract lead';
      safeSetState(setError, errorMessage);
      console.warn('[LeadContext] Failed to extract lead:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('extracting', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Extracts leads from multiple DMs in batch
   *
   * @param {object[]} dms - Array of DM objects
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @param {string} [options.assignedTo] - Default agent to assign leads to
   * @returns {Promise<{ extracted: object[], errors: Array<{ dmId: string, error: string }> }|null>}
   */
  const extractBatch = useCallback(async (dms, options = {}) => {
    if (!Array.isArray(dms)) {
      safeSetState(setError, 'DMs must be an array');
      return null;
    }

    setLoadingFlag('extracting', true);
    clearError();

    try {
      const result = await extractLeadsFromBatch(dms, options);

      // Refresh the lead list after batch extraction
      await fetchLeads();

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to extract leads in batch';
      safeSetState(setError, errorMessage);
      console.warn('[LeadContext] Failed to extract leads in batch:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('extracting', false);
    }
  }, [setLoadingFlag, clearError, safeSetState, fetchLeads]);

  /**
   * Scores a lead by its ID
   * Evaluates lead based on intent, engagement, budget, and location
   *
   * @param {string} leadId - Lead identifier
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<{ lead: object, score: number, priority: string, escalationRequired: boolean, breakdown: object[] }|null>}
   */
  const score = useCallback(async (leadId, options = {}) => {
    if (!leadId || typeof leadId !== 'string') {
      safeSetState(setError, 'Lead id is required and must be a string');
      return null;
    }

    setLoadingFlag('scoring', true);
    clearError();

    try {
      const result = await scoreLead(leadId, options);

      // Update the lead in the current list
      safeSetState(setLeads, (prevLeads) =>
        prevLeads.map((l) => (l.id === leadId ? result.lead : l))
      );

      // Update selected lead if it matches
      setSelectedLead((prev) => {
        if (prev.lead && prev.lead.id === leadId) {
          return {
            lead: result.lead,
            scoreBreakdown: {
              score: result.score,
              priority: result.priority,
              escalationRequired: result.escalationRequired,
              breakdown: result.breakdown,
            },
          };
        }
        return prev;
      });

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to score lead';
      safeSetState(setError, errorMessage);
      console.warn('[LeadContext] Failed to score lead:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('scoring', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Scores multiple leads in batch
   *
   * @param {string[]} leadIds - Array of lead identifiers
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<{ scored: Array<{ leadId: string, score: number, priority: string }>, errors: Array<{ leadId: string, error: string }> }|null>}
   */
  const scoreBatch = useCallback(async (leadIds, options = {}) => {
    if (!Array.isArray(leadIds)) {
      safeSetState(setError, 'Lead IDs must be an array');
      return null;
    }

    setLoadingFlag('scoring', true);
    clearError();

    try {
      const result = await scoreLeadsInBatch(leadIds, options);

      // Refresh the lead list after batch scoring
      await fetchLeads();

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to score leads in batch';
      safeSetState(setError, errorMessage);
      console.warn('[LeadContext] Failed to score leads in batch:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('scoring', false);
    }
  }, [setLoadingFlag, clearError, safeSetState, fetchLeads]);

  /**
   * Re-scores a lead using the latest scoring rules
   *
   * @param {string} leadId - Lead identifier
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<{ lead: object, score: number, priority: string, previousScore: number, scoreChanged: boolean }|null>}
   */
  const rescore = useCallback(async (leadId, options = {}) => {
    if (!leadId || typeof leadId !== 'string') {
      safeSetState(setError, 'Lead id is required and must be a string');
      return null;
    }

    setLoadingFlag('scoring', true);
    clearError();

    try {
      const result = await rescoreLead(leadId, options);

      // Update the lead in the current list
      safeSetState(setLeads, (prevLeads) =>
        prevLeads.map((l) => (l.id === leadId ? result.lead : l))
      );

      // Update selected lead if it matches
      setSelectedLead((prev) => {
        if (prev.lead && prev.lead.id === leadId) {
          return { ...prev, lead: result.lead };
        }
        return prev;
      });

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to re-score lead';
      safeSetState(setError, errorMessage);
      console.warn('[LeadContext] Failed to re-score lead:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('scoring', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Syncs a lead to Salesforce CRM
   *
   * @param {string} leadId - Lead identifier
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<{ leadId: string, salesforceId: string, syncStatus: string }|null>}
   */
  const sync = useCallback(async (leadId, options = {}) => {
    if (!leadId || typeof leadId !== 'string') {
      safeSetState(setError, 'Lead id is required and must be a string');
      return null;
    }

    setLoadingFlag('syncing', true);
    clearError();

    try {
      const result = await syncLeadToSalesforce(leadId, options);

      // Refresh the lead to get updated salesforceId and syncStatus
      try {
        const updatedLead = await getLeadById(leadId);
        if (updatedLead) {
          safeSetState(setLeads, (prevLeads) =>
            prevLeads.map((l) => (l.id === leadId ? updatedLead : l))
          );

          // Update selected lead if it matches
          setSelectedLead((prev) => {
            if (prev.lead && prev.lead.id === leadId) {
              return { ...prev, lead: updatedLead };
            }
            return prev;
          });
        }
      } catch {
        // Non-critical — the sync result is still valid
        console.warn('[LeadContext] Failed to refresh lead after sync');
      }

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to sync lead to Salesforce';
      safeSetState(setError, errorMessage);
      console.warn('[LeadContext] Failed to sync lead to Salesforce:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('syncing', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Syncs multiple leads to Salesforce in batch
   *
   * @param {string[]} leadIds - Array of lead identifiers
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<{ synced: Array<{ leadId: string, salesforceId: string }>, errors: Array<{ leadId: string, error: string }> }|null>}
   */
  const syncBatch = useCallback(async (leadIds, options = {}) => {
    if (!Array.isArray(leadIds)) {
      safeSetState(setError, 'Lead IDs must be an array');
      return null;
    }

    setLoadingFlag('syncing', true);
    clearError();

    try {
      const result = await syncLeadsInBatch(leadIds, options);

      // Refresh the lead list after batch sync
      await fetchLeads();

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to sync leads in batch';
      safeSetState(setError, errorMessage);
      console.warn('[LeadContext] Failed to sync leads in batch:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('syncing', false);
    }
  }, [setLoadingFlag, clearError, safeSetState, fetchLeads]);

  /**
   * Retries all previously failed Salesforce syncs
   *
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<{ retried: Array<{ leadId: string, salesforceId: string }>, errors: Array<{ leadId: string, error: string }> }|null>}
   */
  const retrySyncFailures = useCallback(async (options = {}) => {
    setLoadingFlag('syncing', true);
    clearError();

    try {
      const result = await retrySyncFailed(options);

      // Refresh the lead list after retry
      await fetchLeads();

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to retry sync failures';
      safeSetState(setError, errorMessage);
      console.warn('[LeadContext] Failed to retry sync failures:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('syncing', false);
    }
  }, [setLoadingFlag, clearError, safeSetState, fetchLeads]);

  /**
   * Selects a lead by its ID and retrieves its score breakdown
   *
   * @param {string} leadId - Lead identifier
   * @returns {Promise<{ lead: object|null, scoreBreakdown: object|null }>}
   */
  const selectLeadAction = useCallback(async (leadId) => {
    if (!leadId || typeof leadId !== 'string') {
      safeSetState(setError, 'Lead id is required and must be a string');
      return { lead: null, scoreBreakdown: null };
    }

    setLoadingFlag('selected', true);
    clearError();

    try {
      const lead = await getLeadById(leadId);

      if (!lead) {
        safeSetState(setError, `Lead not found: ${leadId}`);
        safeSetState(setSelectedLead, { lead: null, scoreBreakdown: null });
        return { lead: null, scoreBreakdown: null };
      }

      // Retrieve score breakdown
      let scoreBreakdownResult = null;
      try {
        scoreBreakdownResult = await getScoreBreakdown(leadId);
      } catch (breakdownErr) {
        console.warn('[LeadContext] Failed to retrieve score breakdown:', breakdownErr.message);
        // Continue with null breakdown — score breakdown failure should not block lead selection
      }

      const selectedState = { lead, scoreBreakdown: scoreBreakdownResult };
      safeSetState(setSelectedLead, selectedState);

      return selectedState;
    } catch (err) {
      const errorMessage = err.message || 'Failed to select lead';
      safeSetState(setError, errorMessage);
      safeSetState(setSelectedLead, { lead: null, scoreBreakdown: null });
      console.warn('[LeadContext] Failed to select lead:', errorMessage);
      return { lead: null, scoreBreakdown: null };
    } finally {
      setLoadingFlag('selected', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Clears the currently selected lead
   */
  const clearSelectedLead = useCallback(() => {
    safeSetState(setSelectedLead, { lead: null, scoreBreakdown: null });
  }, [safeSetState]);

  /**
   * Searches leads by query text and updates the lead list
   *
   * @param {string} query - Search query string
   * @returns {Promise<{ leads: object[], total: number }>}
   */
  const searchLeadsAction = useCallback(async (query) => {
    const newFilters = {
      ...filters,
      query: query || '',
      page: 1,
    };

    safeSetState(setFiltersState, newFilters);

    return fetchLeads(newFilters);
  }, [filters, safeSetState, fetchLeads]);

  /**
   * Updates filter state and refetches leads
   *
   * @param {Partial<LeadFilters>} newFilters - Filter updates to apply
   * @returns {Promise<{ leads: object[], total: number }>}
   */
  const setFilters = useCallback(async (newFilters) => {
    const mergedFilters = { ...filters, ...newFilters };

    // Reset to page 1 when filters change (except when explicitly setting page)
    if (
      newFilters.status !== undefined ||
      newFilters.platform !== undefined ||
      newFilters.intent !== undefined ||
      newFilters.assignedTo !== undefined ||
      newFilters.query !== undefined
    ) {
      if (newFilters.page === undefined) {
        mergedFilters.page = 1;
      }
    }

    safeSetState(setFiltersState, mergedFilters);

    return fetchLeads(mergedFilters);
  }, [filters, safeSetState, fetchLeads]);

  /**
   * Gets the lead extracted from a specific DM
   *
   * @param {string} dmId - DM identifier
   * @returns {Promise<object|null>} Lead object or null if not extracted
   */
  const getLeadForDMAction = useCallback(async (dmId) => {
    if (!dmId || typeof dmId !== 'string') {
      return null;
    }

    try {
      return await getLeadForDM(dmId);
    } catch (err) {
      console.warn('[LeadContext] Failed to get lead for DM:', err.message);
      return null;
    }
  }, []);

  /**
   * Flags a lead for manual entry/review
   *
   * @param {string} leadId - Lead identifier
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @param {string} [options.reason] - Reason for flagging
   * @returns {Promise<object|null>} Updated lead object or null on failure
   */
  const flagLeadAction = useCallback(async (leadId, options = {}) => {
    if (!leadId || typeof leadId !== 'string') {
      safeSetState(setError, 'Lead id is required and must be a string');
      return null;
    }

    setLoadingFlag('action', true);
    clearError();

    try {
      const updatedLead = await flagForManualEntry(leadId, options);

      // Update the lead in the current list
      safeSetState(setLeads, (prevLeads) =>
        prevLeads.map((l) => (l.id === leadId ? updatedLead : l))
      );

      // Update selected lead if it matches
      setSelectedLead((prev) => {
        if (prev.lead && prev.lead.id === leadId) {
          return { ...prev, lead: updatedLead };
        }
        return prev;
      });

      return updatedLead;
    } catch (err) {
      const errorMessage = err.message || 'Failed to flag lead for manual entry';
      safeSetState(setError, errorMessage);
      console.warn('[LeadContext] Failed to flag lead:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('action', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Enriches a lead with additional context from the DM and knowledge base
   *
   * @param {string} leadId - Lead identifier
   * @param {object} dm - Original DM object for context
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<object|null>} Enriched lead object or null on failure
   */
  const enrichLeadAction = useCallback(async (leadId, dm, options = {}) => {
    if (!leadId || typeof leadId !== 'string') {
      safeSetState(setError, 'Lead id is required and must be a string');
      return null;
    }

    if (!dm || typeof dm !== 'object') {
      safeSetState(setError, 'DM must be a non-null object');
      return null;
    }

    setLoadingFlag('action', true);
    clearError();

    try {
      const updatedLead = await enrichLead(leadId, dm, options);

      // Update the lead in the current list
      safeSetState(setLeads, (prevLeads) =>
        prevLeads.map((l) => (l.id === leadId ? updatedLead : l))
      );

      // Update selected lead if it matches
      setSelectedLead((prev) => {
        if (prev.lead && prev.lead.id === leadId) {
          return { ...prev, lead: updatedLead };
        }
        return prev;
      });

      return updatedLead;
    } catch (err) {
      const errorMessage = err.message || 'Failed to enrich lead';
      safeSetState(setError, errorMessage);
      console.warn('[LeadContext] Failed to enrich lead:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('action', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Checks if a lead requires escalation based on its current score
   *
   * @param {string} leadId - Lead identifier
   * @returns {Promise<{ escalationRequired: boolean, score: number, priority: string }|null>}
   */
  const checkLeadEscalation = useCallback(async (leadId) => {
    if (!leadId || typeof leadId !== 'string') {
      safeSetState(setError, 'Lead id is required and must be a string');
      return null;
    }

    try {
      return await checkEscalation(leadId);
    } catch (err) {
      const errorMessage = err.message || 'Failed to check lead escalation';
      safeSetState(setError, errorMessage);
      console.warn('[LeadContext] Failed to check lead escalation:', errorMessage);
      return null;
    }
  }, [safeSetState]);

  /**
   * Gets the Salesforce sync status for a lead
   *
   * @param {string} leadId - Lead identifier
   * @returns {Promise<{ leadId: string, salesforceId: string|null, syncStatus: string }|null>}
   */
  const getSyncStatusAction = useCallback(async (leadId) => {
    if (!leadId || typeof leadId !== 'string') {
      return null;
    }

    try {
      return await getSyncStatus(leadId);
    } catch (err) {
      console.warn('[LeadContext] Failed to get sync status:', err.message);
      return null;
    }
  }, []);

  /**
   * Gets the current circuit breaker state for Salesforce sync
   *
   * @returns {{ isOpen: boolean, failureCount: number, maxFailures: number, cooldownMs: number, openedAt: number|null }}
   */
  const getCircuitBreakerStatus = useCallback(() => {
    return getCircuitBreakerState();
  }, []);

  const contextValue = useMemo(
    () => ({
      leads,
      total,
      selectedLead,
      filters,
      loading,
      error,
      extract,
      extractBatch,
      score,
      scoreBatch,
      rescore,
      sync,
      syncBatch,
      retrySyncFailures,
      selectLead: selectLeadAction,
      clearSelectedLead,
      fetchLeads,
      searchLeads: searchLeadsAction,
      setFilters,
      getLeadForDM: getLeadForDMAction,
      flagLead: flagLeadAction,
      enrichLead: enrichLeadAction,
      checkLeadEscalation,
      getSyncStatus: getSyncStatusAction,
      getCircuitBreakerStatus,
      clearError,
    }),
    [
      leads,
      total,
      selectedLead,
      filters,
      loading,
      error,
      extract,
      extractBatch,
      score,
      scoreBatch,
      rescore,
      sync,
      syncBatch,
      retrySyncFailures,
      selectLeadAction,
      clearSelectedLead,
      fetchLeads,
      searchLeadsAction,
      setFilters,
      getLeadForDMAction,
      flagLeadAction,
      enrichLeadAction,
      checkLeadEscalation,
      getSyncStatusAction,
      getCircuitBreakerStatus,
      clearError,
    ]
  );

  return (
    <LeadContext.Provider value={contextValue}>
      {children}
    </LeadContext.Provider>
  );
}

/**
 * Hook to access the lead context
 * Must be used within a LeadProvider
 *
 * @returns {LeadContextValue} Lead context value
 * @throws {Error} If used outside of LeadProvider
 */
export function useLead() {
  const context = useContext(LeadContext);

  if (context === null) {
    throw new Error('useLead must be used within a LeadProvider');
  }

  return context;
}

export default LeadContext;