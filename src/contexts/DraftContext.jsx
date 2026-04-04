'use client';

import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { generateDraft, regenerateDraft, getDraftForDM, generateDraftForDM, requiresHumanReview, getConfidenceThreshold } from '@/services/draft-generation-service';
import { reviewDraft, editDraft, approveDraft, rejectDraft, checkReviewRequired, getReviewHistory, validatePrivacyCompliance } from '@/services/draft-review-service';

/**
 * Draft Context
 * Manages draft generation, editing, and review state
 * Wraps DraftGenerationService and DraftReviewService
 * Implements DraftContext from LLD (SCRUM-6530, SCRUM-6532, SCRUM-6535)
 *
 * Provides:
 * - currentDraft: Currently active draft object
 * - reviewState: Review state for the current draft (dm, requiresReview, piiDetected)
 * - loading: Loading state flags
 * - error: Current error state
 * - generate(dm, options): Generate a draft for a DM
 * - regenerate(dm, options): Force regeneration of a draft
 * - loadDraft(dmId): Load existing draft for a DM
 * - edit(draftId, newContent, options): Edit a draft's content
 * - approve(draftId, options): Approve a draft for sending
 * - reject(draftId, options): Reject a draft
 * - review(draftId, options): Load a draft for human review
 * - checkReview(draftId): Check if a draft requires human review
 * - getHistory(draftId): Get edit history for a draft
 * - validatePrivacy(draftId): Validate draft privacy compliance
 * - clearDraft(): Clear the current draft state
 * - clearError(): Clear the current error
 */

/**
 * @typedef {object} DraftLoadingState
 * @property {boolean} generating - Whether a draft is being generated
 * @property {boolean} loading - Whether a draft is being loaded
 * @property {boolean} editing - Whether a draft edit is in progress
 * @property {boolean} approving - Whether a draft approval is in progress
 * @property {boolean} rejecting - Whether a draft rejection is in progress
 * @property {boolean} reviewing - Whether a draft review is being loaded
 */

/**
 * @typedef {object} DraftReviewState
 * @property {object|null} dm - Associated DM object
 * @property {boolean} requiresReview - Whether human review is required
 * @property {object|null} piiDetected - PII detection result
 */

/**
 * @typedef {object} DraftContextValue
 * @property {object|null} currentDraft - Currently active draft object
 * @property {DraftReviewState} reviewState - Review state for the current draft
 * @property {DraftLoadingState} loading - Loading state flags
 * @property {string|null} error - Current error message
 * @property {number} confidenceThreshold - Confidence threshold for human review
 * @property {Function} generate - Generate a draft for a DM
 * @property {Function} regenerate - Force regeneration of a draft
 * @property {Function} loadDraft - Load existing draft for a DM
 * @property {Function} edit - Edit a draft's content
 * @property {Function} approve - Approve a draft for sending
 * @property {Function} reject - Reject a draft
 * @property {Function} review - Load a draft for human review
 * @property {Function} checkReview - Check if a draft requires human review
 * @property {Function} getHistory - Get edit history for a draft
 * @property {Function} validatePrivacy - Validate draft privacy compliance
 * @property {Function} clearDraft - Clear the current draft state
 * @property {Function} clearError - Clear the current error
 */

const DraftContext = createContext(null);

/**
 * Default loading state
 */
const DEFAULT_LOADING = Object.freeze({
  generating: false,
  loading: false,
  editing: false,
  approving: false,
  rejecting: false,
  reviewing: false,
});

/**
 * Default review state
 */
const DEFAULT_REVIEW_STATE = Object.freeze({
  dm: null,
  requiresReview: false,
  piiDetected: null,
});

/**
 * Draft Context provider component
 * Manages draft generation, editing, review, approval, and rejection state
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement}
 */
export function DraftProvider({ children }) {
  const [currentDraft, setCurrentDraft] = useState(null);
  const [reviewState, setReviewState] = useState({ ...DEFAULT_REVIEW_STATE });
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
   * Clears the current draft and review state
   */
  const clearDraft = useCallback(() => {
    safeSetState(setCurrentDraft, null);
    safeSetState(setReviewState, { ...DEFAULT_REVIEW_STATE });
  }, [safeSetState]);

  /**
   * Generates a draft for a DM
   * Retrieves context, selects a template, fills placeholders, and calculates confidence
   *
   * @param {object} dm - DM object
   * @param {string} dm.id - DM identifier
   * @param {string} dm.content - DM message content
   * @param {object} dm.sender - Sender information
   * @param {object} [dm.metadata] - DM metadata
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @param {object} [options.context] - Pre-retrieved context
   * @returns {Promise<object|null>} Generated draft or null on failure
   */
  const generate = useCallback(async (dm, options = {}) => {
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

    setLoadingFlag('generating', true);
    clearError();

    try {
      const draft = await generateDraft(dm, options);

      safeSetState(setCurrentDraft, draft);

      // Update review state based on draft confidence
      const needsReview = requiresHumanReview(draft);
      safeSetState(setReviewState, (prev) => ({
        ...prev,
        requiresReview: needsReview,
      }));

      return draft;
    } catch (err) {
      const errorMessage = err.message || 'Failed to generate draft';
      safeSetState(setError, errorMessage);
      console.warn('[DraftContext] Failed to generate draft:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('generating', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Force regenerates a draft for a DM
   * Replaces the existing draft with a newly generated one
   *
   * @param {object} dm - DM object
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<object|null>} Regenerated draft or null on failure
   */
  const regenerateDraftAction = useCallback(async (dm, options = {}) => {
    if (!dm || typeof dm !== 'object') {
      safeSetState(setError, 'DM must be a non-null object');
      return null;
    }

    setLoadingFlag('generating', true);
    clearError();

    try {
      const draft = await regenerateDraft(dm, options);

      safeSetState(setCurrentDraft, draft);

      // Update review state based on draft confidence
      const needsReview = requiresHumanReview(draft);
      safeSetState(setReviewState, (prev) => ({
        ...prev,
        requiresReview: needsReview,
      }));

      return draft;
    } catch (err) {
      const errorMessage = err.message || 'Failed to regenerate draft';
      safeSetState(setError, errorMessage);
      console.warn('[DraftContext] Failed to regenerate draft:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('generating', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Loads an existing draft for a DM by its DM ID
   *
   * @param {string} dmId - DM identifier
   * @returns {Promise<object|null>} Draft object or null if not found
   */
  const loadDraft = useCallback(async (dmId) => {
    if (!dmId || typeof dmId !== 'string') {
      safeSetState(setError, 'DM id is required and must be a string');
      return null;
    }

    setLoadingFlag('loading', true);
    clearError();

    try {
      const draft = await getDraftForDM(dmId);

      safeSetState(setCurrentDraft, draft);

      if (draft) {
        const needsReview = requiresHumanReview(draft);
        safeSetState(setReviewState, (prev) => ({
          ...prev,
          requiresReview: needsReview,
        }));
      } else {
        safeSetState(setReviewState, { ...DEFAULT_REVIEW_STATE });
      }

      return draft;
    } catch (err) {
      const errorMessage = err.message || 'Failed to load draft';
      safeSetState(setError, errorMessage);
      console.warn('[DraftContext] Failed to load draft:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('loading', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Loads a draft for human review
   * Returns the draft along with its associated DM for context
   *
   * @param {number|string} draftId - Draft identifier
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<{ draft: object, dm: object|null, requiresReview: boolean, piiDetected: object }|null>}
   */
  const reviewAction = useCallback(async (draftId, options = {}) => {
    if (draftId === undefined || draftId === null) {
      safeSetState(setError, 'Draft id is required');
      return null;
    }

    setLoadingFlag('reviewing', true);
    clearError();

    try {
      const result = await reviewDraft(draftId, options);

      safeSetState(setCurrentDraft, result.draft);
      safeSetState(setReviewState, {
        dm: result.dm,
        requiresReview: result.requiresReview,
        piiDetected: result.piiDetected,
      });

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to load draft for review';
      safeSetState(setError, errorMessage);
      console.warn('[DraftContext] Failed to load draft for review:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('reviewing', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Edits a draft's content
   * Validates content, checks for PII, and records the edit in history
   *
   * @param {number|string} draftId - Draft identifier
   * @param {string} newContent - Updated draft content
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<object|null>} Updated draft or null on failure
   */
  const editAction = useCallback(async (draftId, newContent, options = {}) => {
    if (draftId === undefined || draftId === null) {
      safeSetState(setError, 'Draft id is required');
      return null;
    }

    if (newContent === undefined || newContent === null || typeof newContent !== 'string') {
      safeSetState(setError, 'New content is required and must be a string');
      return null;
    }

    setLoadingFlag('editing', true);
    clearError();

    try {
      const updatedDraft = await editDraft(draftId, newContent, options);

      safeSetState(setCurrentDraft, updatedDraft);

      // After editing, the draft no longer requires review (it has been reviewed)
      safeSetState(setReviewState, (prev) => ({
        ...prev,
        requiresReview: false,
      }));

      return updatedDraft;
    } catch (err) {
      const errorMessage = err.message || 'Failed to edit draft';
      safeSetState(setError, errorMessage);
      console.warn('[DraftContext] Failed to edit draft:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('editing', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Approves a draft for sending
   * Blocks approval if the draft has low confidence and has not been reviewed/edited
   *
   * @param {number|string} draftId - Draft identifier
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @returns {Promise<{ draft: object, dm: object|null }|null>} Approved draft and updated DM or null on failure
   */
  const approveAction = useCallback(async (draftId, options = {}) => {
    if (draftId === undefined || draftId === null) {
      safeSetState(setError, 'Draft id is required');
      return null;
    }

    setLoadingFlag('approving', true);
    clearError();

    try {
      const result = await approveDraft(draftId, options);

      safeSetState(setCurrentDraft, result.draft);

      // Update review state with the updated DM
      if (result.dm) {
        safeSetState(setReviewState, (prev) => ({
          ...prev,
          dm: result.dm,
          requiresReview: false,
        }));
      }

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to approve draft';
      safeSetState(setError, errorMessage);
      console.warn('[DraftContext] Failed to approve draft:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('approving', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Rejects a draft with an optional reason
   *
   * @param {number|string} draftId - Draft identifier
   * @param {object} [options]
   * @param {string} [options.performedBy='system'] - User or system identifier
   * @param {string} [options.reason] - Reason for rejection
   * @returns {Promise<object|null>} Rejected draft or null on failure
   */
  const rejectAction = useCallback(async (draftId, options = {}) => {
    if (draftId === undefined || draftId === null) {
      safeSetState(setError, 'Draft id is required');
      return null;
    }

    setLoadingFlag('rejecting', true);
    clearError();

    try {
      const rejectedDraft = await rejectDraft(draftId, options);

      safeSetState(setCurrentDraft, rejectedDraft);

      return rejectedDraft;
    } catch (err) {
      const errorMessage = err.message || 'Failed to reject draft';
      safeSetState(setError, errorMessage);
      console.warn('[DraftContext] Failed to reject draft:', errorMessage);
      return null;
    } finally {
      setLoadingFlag('rejecting', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Checks whether a draft requires human review based on confidence threshold
   *
   * @param {number|string} draftId - Draft identifier
   * @returns {Promise<{ requiresReview: boolean, confidence: number|null, threshold: number }|null>}
   */
  const checkReviewAction = useCallback(async (draftId) => {
    if (draftId === undefined || draftId === null) {
      safeSetState(setError, 'Draft id is required');
      return null;
    }

    try {
      const result = await checkReviewRequired(draftId);

      safeSetState(setReviewState, (prev) => ({
        ...prev,
        requiresReview: result.requiresReview,
      }));

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to check review requirement';
      safeSetState(setError, errorMessage);
      console.warn('[DraftContext] Failed to check review requirement:', errorMessage);
      return null;
    }
  }, [safeSetState]);

  /**
   * Retrieves the edit history for a draft
   *
   * @param {number|string} draftId - Draft identifier
   * @returns {Promise<object[]|null>} Array of edit history entries or null on failure
   */
  const getHistoryAction = useCallback(async (draftId) => {
    if (draftId === undefined || draftId === null) {
      safeSetState(setError, 'Draft id is required');
      return null;
    }

    try {
      const history = await getReviewHistory(draftId);
      return history;
    } catch (err) {
      const errorMessage = err.message || 'Failed to get review history';
      safeSetState(setError, errorMessage);
      console.warn('[DraftContext] Failed to get review history:', errorMessage);
      return null;
    }
  }, [safeSetState]);

  /**
   * Validates that a draft meets privacy compliance requirements
   *
   * @param {number|string} draftId - Draft identifier
   * @returns {Promise<{ compliant: boolean, issues: string[] }|null>}
   */
  const validatePrivacyAction = useCallback(async (draftId) => {
    if (draftId === undefined || draftId === null) {
      safeSetState(setError, 'Draft id is required');
      return null;
    }

    try {
      const result = await validatePrivacyCompliance(draftId);
      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to validate privacy compliance';
      safeSetState(setError, errorMessage);
      console.warn('[DraftContext] Failed to validate privacy compliance:', errorMessage);
      return null;
    }
  }, [safeSetState]);

  const confidenceThreshold = getConfidenceThreshold();

  const contextValue = useMemo(
    () => ({
      currentDraft,
      reviewState,
      loading,
      error,
      confidenceThreshold,
      generate,
      regenerate: regenerateDraftAction,
      loadDraft,
      edit: editAction,
      approve: approveAction,
      reject: rejectAction,
      review: reviewAction,
      checkReview: checkReviewAction,
      getHistory: getHistoryAction,
      validatePrivacy: validatePrivacyAction,
      clearDraft,
      clearError,
    }),
    [
      currentDraft,
      reviewState,
      loading,
      error,
      confidenceThreshold,
      generate,
      regenerateDraftAction,
      loadDraft,
      editAction,
      approveAction,
      rejectAction,
      reviewAction,
      checkReviewAction,
      getHistoryAction,
      validatePrivacyAction,
      clearDraft,
      clearError,
    ]
  );

  return (
    <DraftContext.Provider value={contextValue}>
      {children}
    </DraftContext.Provider>
  );
}

/**
 * Hook to access the draft context
 * Must be used within a DraftProvider
 *
 * @returns {DraftContextValue} Draft context value
 * @throws {Error} If used outside of DraftProvider
 */
export function useDraft() {
  const context = useContext(DraftContext);

  if (context === null) {
    throw new Error('useDraft must be used within a DraftProvider');
  }

  return context;
}

export default DraftContext;