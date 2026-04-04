'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDraft } from '@/contexts/DraftContext';
import { useDM } from '@/contexts/DMContext';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import Tooltip from '@/components/common/Tooltip';
import Toast from '@/components/common/Toast';
import ConfidenceMeter from '@/components/common/ConfidenceMeter';
import { CONFIDENCE_THRESHOLD, STATUS } from '@/utils/constants';

/**
 * Size variant mappings for the review actions component
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
 * Approve icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function ApproveIcon({ className }) {
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * Reject icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function RejectIcon({ className }) {
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
 * Edit icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function EditIcon({ className }) {
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
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
      />
    </svg>
  );
}

/**
 * Send icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function SendIcon({ className }) {
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
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
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
 * Low confidence warning banner component
 * Displays a mandatory review warning when draft confidence is below threshold
 *
 * @param {object} props
 * @param {number} props.confidence - Confidence score (0-1)
 * @param {number} props.threshold - Confidence threshold
 * @param {string} props.status - Draft status
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function LowConfidenceWarning({ confidence, threshold, status, sizeClass }) {
  if (typeof confidence !== 'number') return null;
  if (confidence >= threshold) return null;
  if (status === 'edited' || status === 'approved') return null;

  return (
    <div className="flex items-start gap-2 p-2.5 bg-accent-50 border border-accent-200 rounded-xl">
      <WarningIcon className="h-4 w-4 shrink-0 text-accent-600 mt-0.5" />
      <div>
        <p className={`font-semibold text-accent-800 ${sizeClass.body}`}>
          Mandatory Human Review Required
        </p>
        <p className={`text-accent-700 ${sizeClass.meta}`}>
          This draft has a confidence score of {Math.round(confidence * 100)}%, which is below
          the {Math.round(threshold * 100)}% threshold. You must review and edit the draft before
          it can be approved and sent.
        </p>
      </div>
    </div>
  );
}

/**
 * Draft status summary component
 * Displays the current draft status with appropriate styling
 *
 * @param {object} props
 * @param {string} props.status - Draft status
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function DraftStatusSummary({ status, sizeClass }) {
  if (!status) return null;

  const statusStyles = {
    generated: 'bg-accent-100 text-accent-800',
    edited: 'bg-blue-100 text-blue-800',
    approved: 'bg-brand-100 text-brand-800',
    rejected: 'bg-red-100 text-red-800',
    sent: 'bg-brand-100 text-brand-800',
  };

  const statusClass = statusStyles[(status || '').toLowerCase()] || 'bg-neutral-100 text-neutral-700';
  const displayLabel = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';

  if (status === 'approved') {
    return (
      <div className="flex items-center gap-1.5">
        <ApproveIcon className="h-4 w-4 text-brand-600" />
        <span className={`text-brand-700 font-medium ${sizeClass.meta}`}>
          Draft approved and sent
        </span>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-1.5">
        <RejectIcon className="h-4 w-4 text-red-500" />
        <span className={`text-red-600 font-medium ${sizeClass.meta}`}>
          Draft rejected
        </span>
      </div>
    );
  }

  return (
    <span className={`badge ${statusClass} text-xs`}>
      {displayLabel}
    </span>
  );
}

/**
 * ReviewActions component
 * Human review workflow action component: Approve, Edit, Reject, and Send buttons
 * with conditional rendering based on confidence threshold and review status.
 * Low-confidence drafts show mandatory review warning and block approval until edited.
 *
 * Implements human review workflow for DraftReviewService (SCRUM-6532)
 *
 * Features:
 * - Approve & Send button (blocked for low-confidence unreviewed drafts)
 * - Edit button to enter edit mode
 * - Reject button with optional reason modal
 * - Low-confidence mandatory review warning banner
 * - Confidence meter display
 * - Draft status summary (generated, edited, approved, rejected)
 * - Loading states for async operations
 * - Toast notifications for action feedback
 * - Conditional rendering based on draft status and confidence
 * - ARIA labels for accessibility
 *
 * @param {object} props
 * @param {object} [props.draft] - Draft object (overrides DraftContext current draft)
 * @param {boolean} [props.showConfidence=true] - Whether to show the confidence meter
 * @param {boolean} [props.showWarning=true] - Whether to show the low-confidence warning banner
 * @param {boolean} [props.showStatus=true] - Whether to show the draft status summary
 * @param {boolean} [props.showEditButton=true] - Whether to show the Edit button
 * @param {boolean} [props.showRejectButton=true] - Whether to show the Reject button
 * @param {boolean} [props.showApproveButton=true] - Whether to show the Approve & Send button
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the component
 * @param {Function} [props.onApprove] - Callback when draft is approved (receives result)
 * @param {Function} [props.onReject] - Callback when draft is rejected (receives result)
 * @param {Function} [props.onEdit] - Callback when Edit button is clicked
 * @param {Function} [props.onSend] - Callback when draft is sent
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <ReviewActions />
 *
 * @example
 * <ReviewActions
 *   draft={draftObject}
 *   showConfidence
 *   onApprove={handleApprove}
 *   onReject={handleReject}
 *   onEdit={handleEdit}
 * />
 *
 * @example
 * <ReviewActions
 *   size="sm"
 *   showEditButton={false}
 *   showRejectButton={false}
 * />
 */
export function ReviewActions({
  draft: draftProp,
  showConfidence = true,
  showWarning = true,
  showStatus = true,
  showEditButton = true,
  showRejectButton = true,
  showApproveButton = true,
  size = 'md',
  onApprove,
  onReject,
  onEdit,
  onSend,
  className = '',
}) {
  const {
    currentDraft,
    loading: draftLoading,
    error: draftError,
    confidenceThreshold,
    approve,
    reject,
    clearError,
  } = useDraft();

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast] = useState(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // Determine draft source: prop override or DraftContext
  const draft = draftProp || currentDraft;

  const isApproving = draftLoading.approving;
  const isRejecting = draftLoading.rejecting;
  const isEditing = draftLoading.editing;
  const isAnyLoading = isApproving || isRejecting || isEditing || draftLoading.generating;

  const requiresReview = draft
    ? typeof draft.confidence === 'number' && draft.confidence < confidenceThreshold
    : false;

  const isLowConfidenceUnreviewed = requiresReview
    && draft?.status !== 'edited'
    && draft?.status !== 'approved';

  const canEdit = draft && (draft.status === 'generated' || draft.status === 'edited');
  const canApprove = draft && (draft.status === 'generated' || draft.status === 'edited');
  const canReject = draft && (draft.status === 'generated' || draft.status === 'edited');

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
   * Handles approving the draft
   */
  const handleApprove = useCallback(async () => {
    if (!draft || !draft.id) return;

    clearError();

    const result = await approve(draft.id);

    if (result) {
      showToast('Draft approved and sent successfully.', 'success');

      if (typeof onApprove === 'function') {
        onApprove(result);
      }

      if (typeof onSend === 'function') {
        onSend(result);
      }
    } else {
      showToast(draftError || 'Failed to approve draft.', 'error');
    }
  }, [draft, approve, clearError, onApprove, onSend, draftError]);

  /**
   * Handles rejecting the draft
   */
  const handleReject = useCallback(async () => {
    if (!draft || !draft.id) return;

    clearError();

    const result = await reject(draft.id, { reason: rejectReason || undefined });

    if (result) {
      setShowRejectModal(false);
      setRejectReason('');
      showToast('Draft rejected.', 'info');

      if (typeof onReject === 'function') {
        onReject(result);
      }
    } else {
      showToast('Failed to reject draft.', 'error');
    }
  }, [draft, reject, rejectReason, clearError, onReject]);

  /**
   * Handles clicking the Edit button
   */
  function handleEditClick() {
    if (typeof onEdit === 'function') {
      onEdit(draft);
    }
  }

  /**
   * Opens the reject confirmation modal
   */
  function handleRejectClick() {
    setShowRejectModal(true);
  }

  /**
   * Closes the reject modal and resets the reason
   */
  function handleRejectCancel() {
    setShowRejectModal(false);
    setRejectReason('');
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

  // No draft state — render nothing
  if (!draft) {
    return null;
  }

  // Draft is already in a terminal state
  const isTerminal = draft.status === 'approved' || draft.status === 'rejected' || draft.status === 'sent';

  return (
    <div className={containerClasses} role="region" aria-label="Review Actions">
      {/* Low-confidence warning banner */}
      {showWarning && isLowConfidenceUnreviewed && (
        <LowConfidenceWarning
          confidence={draft.confidence}
          threshold={confidenceThreshold}
          status={draft.status}
          sizeClass={sizeClass}
        />
      )}

      {/* Confidence meter */}
      {showConfidence && draft.confidence !== undefined && draft.confidence !== null && (
        <ConfidenceMeter
          score={draft.confidence}
          explanation={draft.confidenceExplanation}
          size="sm"
          showThresholdIndicator
        />
      )}

      {/* Error state */}
      {draftError && (
        <div className="flex items-center justify-between gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl">
          <p className={`text-red-700 ${sizeClass.meta}`}>{draftError}</p>
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
      )}

      {/* Action buttons row */}
      {!isTerminal && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-neutral-200">
          {/* Left side: Reject and Edit */}
          <div className="flex items-center gap-2">
            {showRejectButton && canReject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRejectClick}
                disabled={isAnyLoading}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <RejectIcon className="h-3.5 w-3.5 mr-1.5" />
                Reject
              </Button>
            )}

            {showEditButton && canEdit && (
              <Tooltip content="Edit draft content before approving">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleEditClick}
                  disabled={isAnyLoading}
                  ariaLabel="Edit draft"
                >
                  <EditIcon className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              </Tooltip>
            )}
          </div>

          {/* Right side: Approve & Send */}
          <div className="flex items-center gap-2">
            {showApproveButton && canApprove && (
              <Tooltip
                content={
                  isLowConfidenceUnreviewed
                    ? `Low-confidence draft (${Math.round((draft.confidence || 0) * 100)}%) must be edited before approval. Threshold is ${Math.round(confidenceThreshold * 100)}%.`
                    : 'Approve and send this draft response'
                }
              >
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApprove}
                  loading={isApproving}
                  disabled={isAnyLoading || isLowConfidenceUnreviewed}
                  loadingText="Approving..."
                >
                  <SendIcon className="h-3.5 w-3.5 mr-1.5" />
                  Approve &amp; Send
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
      )}

      {/* Terminal status display */}
      {isTerminal && showStatus && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-neutral-200">
          <DraftStatusSummary status={draft.status} sizeClass={sizeClass} />

          {/* Show review info for approved drafts */}
          {draft.status === 'approved' && draft.editHistory && draft.editHistory.length > 0 && (
            <span className={`text-neutral-400 ${sizeClass.meta}`}>
              {draft.editHistory.length} edit{draft.editHistory.length !== 1 ? 's' : ''} before approval
            </span>
          )}
        </div>
      )}

      {/* Non-terminal status badge */}
      {!isTerminal && showStatus && draft.status && (
        <div className="flex items-center gap-2">
          <DraftStatusSummary status={draft.status} sizeClass={sizeClass} />

          {requiresReview && draft.status === 'edited' && (
            <span className={`text-brand-600 font-medium ${sizeClass.meta}`}>
              ✓ Reviewed — ready for approval
            </span>
          )}

          {draft.editHistory && draft.editHistory.length > 0 && (
            <span className={`text-neutral-400 ${sizeClass.meta}`}>
              {draft.editHistory.length} edit{draft.editHistory.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Reject Confirmation Modal */}
      <Modal
        open={showRejectModal}
        onClose={handleRejectCancel}
        title="Reject Draft"
        size="sm"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRejectCancel}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleReject}
              loading={isRejecting}
              loadingText="Rejecting..."
            >
              Reject Draft
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className={`text-neutral-600 ${sizeClass.body}`}>
            Are you sure you want to reject this draft? The draft will be marked as rejected
            and a new draft can be generated.
          </p>

          {draft && draft.confidence !== undefined && draft.confidence !== null && (
            <div className="flex items-center gap-2">
              <span className={`text-neutral-500 ${sizeClass.meta}`}>
                Current confidence:
              </span>
              <span className={`font-semibold ${
                draft.confidence >= confidenceThreshold ? 'text-brand-700' : 'text-accent-700'
              } ${sizeClass.meta}`}>
                {Math.round(draft.confidence * 100)}%
              </span>
            </div>
          )}

          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional)..."
            className={`block w-full px-3 py-2 border border-neutral-300 rounded-xl bg-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors resize-y min-h-20 ${sizeClass.body}`}
            aria-label="Rejection reason"
            disabled={isRejecting}
          />
        </div>
      </Modal>

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

export default ReviewActions;