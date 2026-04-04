'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLead } from '@/contexts/LeadContext';
import { useDM } from '@/contexts/DMContext';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import Tooltip from '@/components/common/Tooltip';
import Toast from '@/components/common/Toast';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { formatTimestamp } from '@/utils/formatters';

/**
 * Size variant mappings for the Salesforce button component
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    container: 'text-xs',
    heading: 'text-sm',
    body: 'text-xs',
    meta: 'text-xs',
    label: 'text-xs',
    padding: 'px-3 py-2',
  },
  md: {
    container: 'text-sm',
    heading: 'text-sm',
    body: 'text-sm',
    meta: 'text-xs',
    label: 'text-xs',
    padding: 'px-4 py-3',
  },
  lg: {
    container: 'text-base',
    heading: 'text-base',
    body: 'text-sm',
    meta: 'text-sm',
    label: 'text-sm',
    padding: 'px-5 py-4',
  },
});

/**
 * Sync status style mappings
 */
const SYNC_STATUS_STYLES = Object.freeze({
  success: {
    bg: 'bg-brand-100',
    text: 'text-brand-800',
    icon: '✓',
    label: 'Synced',
  },
  failed: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    icon: '✗',
    label: 'Failed',
  },
  pending: {
    bg: 'bg-accent-100',
    text: 'text-accent-800',
    icon: '⏳',
    label: 'Pending',
  },
});

/**
 * Cloud upload icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function CloudUploadIcon({ className }) {
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
        d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
      />
    </svg>
  );
}

/**
 * Check circle icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function CheckCircleIcon({ className }) {
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
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

/**
 * Retry icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function RetryIcon({ className }) {
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
 * Warning icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function WarningIcon({ className }) {
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
 * Sync status indicator component
 * Displays the current Salesforce sync status with appropriate styling
 *
 * @param {object} props
 * @param {string} props.syncStatus - Salesforce sync status
 * @param {string} [props.salesforceId] - Salesforce record ID
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function SyncStatusDisplay({ syncStatus, salesforceId, sizeClass }) {
  if (!syncStatus) return null;

  const style = SYNC_STATUS_STYLES[syncStatus] || SYNC_STATUS_STYLES.pending;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className={`badge ${style.bg} ${style.text} text-xs`}>
          {style.icon} {style.label}
        </span>
        <span className={`text-neutral-500 ${sizeClass.meta}`}>
          Salesforce Sync
        </span>
      </div>
      {salesforceId && (
        <Tooltip content={`Salesforce ID: ${salesforceId}`}>
          <span className={`text-neutral-400 truncate max-w-32 ${sizeClass.meta}`}>
            {salesforceId}
          </span>
        </Tooltip>
      )}
    </div>
  );
}

/**
 * Circuit breaker warning component
 * Displays a warning when the Salesforce sync circuit breaker is open
 *
 * @param {object} props
 * @param {object} props.circuitBreakerState - Circuit breaker state object
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function CircuitBreakerWarning({ circuitBreakerState, sizeClass }) {
  if (!circuitBreakerState || !circuitBreakerState.isOpen) return null;

  const cooldownSeconds = Math.round(circuitBreakerState.cooldownMs / 1000);

  return (
    <div className="flex items-start gap-2 p-2.5 bg-accent-50 border border-accent-200 rounded-xl">
      <WarningIcon className="h-4 w-4 shrink-0 text-accent-600 mt-0.5" />
      <div>
        <p className={`font-semibold text-accent-800 ${sizeClass.body}`}>
          Salesforce Sync Temporarily Disabled
        </p>
        <p className={`text-accent-700 ${sizeClass.meta}`}>
          Sync has been paused after {circuitBreakerState.failureCount} consecutive failures.
          Will auto-resume after {cooldownSeconds}s cooldown period.
        </p>
      </div>
    </div>
  );
}

/**
 * Lead summary component for the confirmation dialog
 * Displays key lead details before syncing to Salesforce
 *
 * @param {object} props
 * @param {object} props.lead - Lead object
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function LeadSummary({ lead, sizeClass }) {
  if (!lead) return null;

  return (
    <div className="space-y-2 p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
      <div className="flex items-center justify-between gap-2">
        <span className={`font-semibold text-neutral-900 ${sizeClass.body}`}>
          {lead.name || 'Unknown Lead'}
        </span>
        {lead.platform && (
          <span className="badge badge-neutral text-xs">
            {lead.platform}
          </span>
        )}
      </div>

      {lead.contact && (lead.contact.email || lead.contact.phone) && (
        <div className="space-y-0.5">
          {lead.contact.email && (
            <p className={`text-neutral-600 ${sizeClass.meta}`}>
              Email: {lead.contact.email}
            </p>
          )}
          {lead.contact.phone && (
            <p className={`text-neutral-600 ${sizeClass.meta}`}>
              Phone: {lead.contact.phone}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {lead.intent && (
          <span className={`text-neutral-500 capitalize ${sizeClass.meta}`}>
            Intent: {lead.intent}
          </span>
        )}
        {lead.location && (
          <span className={`text-neutral-500 ${sizeClass.meta}`}>
            Location: {lead.location}
          </span>
        )}
        {typeof lead.score === 'number' && (
          <span className={`font-medium ${
            lead.score >= 80 ? 'text-brand-700' :
            lead.score >= 50 ? 'text-accent-700' :
            'text-neutral-600'
          } ${sizeClass.meta}`}>
            Score: {lead.score}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * SalesforceButton component
 * Salesforce sync button component: 'Create Lead in Salesforce' button with loading state,
 * success/error feedback toast, and confirmation dialog. Triggers simulated Salesforce sync.
 *
 * Implements FR-005 (SCRUM-6538)
 *
 * Features:
 * - Create Lead in Salesforce button with cloud upload icon
 * - Confirmation dialog before syncing with lead summary
 * - Loading state during sync with spinner and loading text
 * - Success toast with Salesforce record ID
 * - Error toast with failure message
 * - Sync status indicator (success, failed, pending)
 * - Circuit breaker warning when sync is temporarily disabled
 * - Retry button for failed syncs
 * - Already synced state with Salesforce ID display
 * - Disabled state when no lead is available or sync is in progress
 * - ARIA labels for accessibility
 *
 * @param {object} props
 * @param {object} [props.lead] - Lead object (overrides LeadContext selected lead)
 * @param {boolean} [props.showConfirmation=true] - Whether to show confirmation dialog before syncing
 * @param {boolean} [props.showSyncStatus=true] - Whether to show the sync status indicator
 * @param {boolean} [props.showCircuitBreakerWarning=true] - Whether to show circuit breaker warning
 * @param {boolean} [props.showRetryButton=true] - Whether to show retry button for failed syncs
 * @param {boolean} [props.fullWidth=false] - Whether the button should take full width
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the component
 * @param {Function} [props.onSync] - Callback when sync is triggered (receives lead)
 * @param {Function} [props.onSyncSuccess] - Callback when sync succeeds (receives result)
 * @param {Function} [props.onSyncError] - Callback when sync fails (receives error message)
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <SalesforceButton />
 *
 * @example
 * <SalesforceButton
 *   lead={leadObject}
 *   showConfirmation
 *   onSyncSuccess={handleSyncSuccess}
 *   onSyncError={handleSyncError}
 * />
 *
 * @example
 * <SalesforceButton
 *   size="sm"
 *   fullWidth
 *   showRetryButton
 *   showCircuitBreakerWarning
 * />
 */
export function SalesforceButton({
  lead: leadProp,
  showConfirmation = true,
  showSyncStatus = true,
  showCircuitBreakerWarning = true,
  showRetryButton = true,
  fullWidth = false,
  size = 'md',
  onSync,
  onSyncSuccess,
  onSyncError,
  className = '',
}) {
  const {
    selectedLead,
    loading: leadLoading,
    error: leadError,
    sync,
    getSyncStatus,
    getCircuitBreakerStatus,
    clearError: clearLeadError,
  } = useLead();

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [localSyncStatus, setLocalSyncStatus] = useState(null);
  const [localSalesforceId, setLocalSalesforceId] = useState(null);
  const [circuitBreakerState, setCircuitBreakerState] = useState(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // Determine lead source
  const lead = leadProp || selectedLead?.lead || null;

  const isSyncing = leadLoading.syncing;
  const isAnyLoading = isSyncing || leadLoading.extracting || leadLoading.scoring;

  // Determine sync state from lead or local state
  const syncStatus = localSyncStatus || lead?.syncStatus || null;
  const salesforceId = localSalesforceId || lead?.salesforceId || null;
  const isSynced = syncStatus === 'success';
  const isFailed = syncStatus === 'failed';
  const canSync = lead && lead.id && !isSynced;
  const canRetry = lead && lead.id && isFailed;

  // Sync local state with lead changes
  useEffect(() => {
    if (lead) {
      setLocalSyncStatus(lead.syncStatus || null);
      setLocalSalesforceId(lead.salesforceId || null);
    } else {
      setLocalSyncStatus(null);
      setLocalSalesforceId(null);
    }
  }, [lead]);

  // Check circuit breaker state on mount and when lead changes
  useEffect(() => {
    if (lead && lead.id) {
      try {
        const cbState = getCircuitBreakerStatus();
        setCircuitBreakerState(cbState);
      } catch {
        // Ignore circuit breaker check failures
      }
    }
  }, [lead, getCircuitBreakerStatus]);

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
   * Handles the sync button click
   * Opens confirmation dialog if enabled, otherwise triggers sync directly
   */
  function handleSyncClick() {
    if (!canSync && !canRetry) return;

    if (showConfirmation) {
      setShowConfirmModal(true);
    } else {
      handleConfirmSync();
    }
  }

  /**
   * Handles the retry button click for failed syncs
   */
  function handleRetryClick() {
    if (!canRetry) return;

    if (showConfirmation) {
      setShowConfirmModal(true);
    } else {
      handleConfirmSync();
    }
  }

  /**
   * Handles confirmed sync action
   * Triggers the Salesforce sync via LeadContext
   */
  const handleConfirmSync = useCallback(async () => {
    if (!lead || !lead.id) return;

    setShowConfirmModal(false);

    // Notify parent if custom handler provided
    if (typeof onSync === 'function') {
      onSync(lead);
      return;
    }

    clearLeadError();

    const result = await sync(lead.id);

    if (result) {
      if (mountedRef.current) {
        setLocalSyncStatus('success');
        setLocalSalesforceId(result.salesforceId);
      }

      showToast(
        `Lead synced to Salesforce successfully. ID: ${result.salesforceId}`,
        'success'
      );

      if (typeof onSyncSuccess === 'function') {
        onSyncSuccess(result);
      }

      // Refresh circuit breaker state
      try {
        const cbState = getCircuitBreakerStatus();
        if (mountedRef.current) {
          setCircuitBreakerState(cbState);
        }
      } catch {
        // Ignore
      }
    } else {
      if (mountedRef.current) {
        setLocalSyncStatus('failed');
      }

      const errorMessage = leadError || 'Failed to sync lead to Salesforce. Please try again.';
      showToast(errorMessage, 'error');

      if (typeof onSyncError === 'function') {
        onSyncError(errorMessage);
      }

      // Refresh circuit breaker state
      try {
        const cbState = getCircuitBreakerStatus();
        if (mountedRef.current) {
          setCircuitBreakerState(cbState);
        }
      } catch {
        // Ignore
      }
    }
  }, [lead, sync, clearLeadError, onSync, onSyncSuccess, onSyncError, leadError, getCircuitBreakerStatus]);

  /**
   * Handles closing the confirmation modal
   */
  function handleCancelSync() {
    setShowConfirmModal(false);
  }

  const containerClasses = [
    'flex flex-col space-y-3',
    sizeClass.container,
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // No lead state — render disabled button
  if (!lead) {
    return (
      <div className={containerClasses} role="region" aria-label="Salesforce Sync">
        <Tooltip content="Select a lead to sync to Salesforce">
          <Button
            variant="primary"
            size={size === 'lg' ? 'md' : 'sm'}
            disabled
            fullWidth={fullWidth}
            ariaLabel="Create Lead in Salesforce"
          >
            <CloudUploadIcon className="h-3.5 w-3.5 mr-1.5" />
            Create Lead in Salesforce
          </Button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={containerClasses} role="region" aria-label="Salesforce Sync">
      {/* Circuit breaker warning */}
      {showCircuitBreakerWarning && circuitBreakerState && circuitBreakerState.isOpen && (
        <CircuitBreakerWarning
          circuitBreakerState={circuitBreakerState}
          sizeClass={sizeClass}
        />
      )}

      {/* Sync status indicator */}
      {showSyncStatus && syncStatus && (
        <SyncStatusDisplay
          syncStatus={syncStatus}
          salesforceId={salesforceId}
          sizeClass={sizeClass}
        />
      )}

      {/* Main sync button */}
      {!isSynced && !isFailed && (
        <Tooltip
          content={
            circuitBreakerState && circuitBreakerState.isOpen
              ? 'Salesforce sync is temporarily disabled due to repeated failures'
              : 'Sync this lead to Salesforce CRM'
          }
        >
          <Button
            variant="primary"
            size={size === 'lg' ? 'md' : 'sm'}
            onClick={handleSyncClick}
            loading={isSyncing}
            disabled={isAnyLoading || !canSync || (circuitBreakerState && circuitBreakerState.isOpen)}
            fullWidth={fullWidth}
            loadingText="Syncing to Salesforce..."
            ariaLabel="Create Lead in Salesforce"
          >
            <CloudUploadIcon className="h-3.5 w-3.5 mr-1.5" />
            Create Lead in Salesforce
          </Button>
        </Tooltip>
      )}

      {/* Already synced state */}
      {isSynced && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size={size === 'lg' ? 'md' : 'sm'}
            disabled
            fullWidth={fullWidth}
            ariaLabel="Already synced to Salesforce"
          >
            <CheckCircleIcon className="h-3.5 w-3.5 mr-1.5 text-brand-600" />
            Synced to Salesforce
          </Button>
        </div>
      )}

      {/* Failed state with retry */}
      {isFailed && (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl">
            <WarningIcon className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <div>
              <p className={`font-semibold text-red-800 ${sizeClass.body}`}>
                Sync Failed
              </p>
              <p className={`text-red-700 ${sizeClass.meta}`}>
                The lead could not be synced to Salesforce. Please try again.
              </p>
            </div>
          </div>

          {showRetryButton && (
            <Tooltip
              content={
                circuitBreakerState && circuitBreakerState.isOpen
                  ? 'Salesforce sync is temporarily disabled due to repeated failures'
                  : 'Retry syncing this lead to Salesforce'
              }
            >
              <Button
                variant="primary"
                size={size === 'lg' ? 'md' : 'sm'}
                onClick={handleRetryClick}
                loading={isSyncing}
                disabled={isAnyLoading || (circuitBreakerState && circuitBreakerState.isOpen)}
                fullWidth={fullWidth}
                loadingText="Retrying..."
                ariaLabel="Retry Salesforce sync"
              >
                <RetryIcon className="h-3.5 w-3.5 mr-1.5" />
                Retry Salesforce Sync
              </Button>
            </Tooltip>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        open={showConfirmModal}
        onClose={handleCancelSync}
        title="Sync Lead to Salesforce"
        size="sm"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancelSync}
              disabled={isSyncing}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmSync}
              loading={isSyncing}
              loadingText="Syncing..."
              ariaLabel="Confirm Salesforce sync"
            >
              <CloudUploadIcon className="h-3.5 w-3.5 mr-1.5" />
              Sync to Salesforce
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className={`text-neutral-600 ${sizeClass.body}`}>
            Are you sure you want to create this lead in Salesforce? The following data will be synced:
          </p>

          <LeadSummary lead={lead} sizeClass={sizeClass} />

          {lead && !lead.hasConsent && (
            <div className="flex items-start gap-2 p-2.5 bg-accent-50 border border-accent-200 rounded-xl">
              <WarningIcon className="h-4 w-4 shrink-0 text-accent-600 mt-0.5" />
              <p className={`text-accent-700 ${sizeClass.meta}`}>
                This lead has not provided explicit consent. Ensure compliance with privacy regulations before syncing.
              </p>
            </div>
          )}

          {circuitBreakerState && circuitBreakerState.failureCount > 0 && !circuitBreakerState.isOpen && (
            <p className={`text-neutral-400 ${sizeClass.meta}`}>
              Note: {circuitBreakerState.failureCount} recent sync failure{circuitBreakerState.failureCount !== 1 ? 's' : ''} detected.
              Sync may take longer than usual.
            </p>
          )}
        </div>
      </Modal>

      {/* Toast notification */}
      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          variant={toast.variant}
          visible
          duration={5000}
          onClose={() => setToast(null)}
          position="top-right"
        />
      )}
    </div>
  );
}

export default SalesforceButton;