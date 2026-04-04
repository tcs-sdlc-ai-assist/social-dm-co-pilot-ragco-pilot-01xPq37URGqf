'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDM } from '@/contexts/DMContext';
import { useDraft } from '@/contexts/DraftContext';
import ConfidenceMeter from '@/components/common/ConfidenceMeter';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import Tooltip from '@/components/common/Tooltip';
import Modal from '@/components/common/Modal';
import Toast from '@/components/common/Toast';
import { formatTimestamp, formatCurrency } from '@/utils/formatters';
import { CONFIDENCE_THRESHOLD, STATUS } from '@/utils/constants';

/**
 * Size variant mappings for the draft composer
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    container: 'text-xs',
    heading: 'text-sm',
    body: 'text-xs',
    meta: 'text-xs',
    label: 'text-xs',
    padding: 'px-3 py-2',
    textarea: 'text-xs min-h-32',
  },
  md: {
    container: 'text-sm',
    heading: 'text-sm',
    body: 'text-sm',
    meta: 'text-xs',
    label: 'text-xs',
    padding: 'px-4 py-3',
    textarea: 'text-sm min-h-40',
  },
  lg: {
    container: 'text-base',
    heading: 'text-base',
    body: 'text-sm',
    meta: 'text-sm',
    label: 'text-sm',
    padding: 'px-5 py-4',
    textarea: 'text-sm min-h-48',
  },
});

/**
 * Property insert card component
 * Displays a property from context for insertion into the draft
 *
 * @param {object} props
 * @param {object} props.property - Property object from knowledge base
 * @param {Function} props.onInsert - Callback when insert is clicked
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function PropertyInsertCard({ property, onInsert, sizeClass }) {
  if (!property) return null;

  /**
   * Builds a property info snippet for insertion
   *
   * @returns {string} Formatted property info text
   */
  function buildInsertText() {
    const parts = [];

    if (property.name) {
      parts.push(property.name);
    }

    if (property.address) {
      parts.push(`at ${property.address}`);
    }

    const details = [];
    if (property.listPrice) {
      details.push(formatCurrency(property.listPrice, { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
    }
    if (property.bedrooms !== undefined) {
      details.push(`${property.bedrooms} bed`);
    }
    if (property.bathrooms !== undefined) {
      details.push(`${property.bathrooms} bath`);
    }
    if (property.squareFeet) {
      details.push(`${property.squareFeet.toLocaleString()} sq ft`);
    }

    if (details.length > 0) {
      parts.push(`(${details.join(', ')})`);
    }

    if (property.features && property.features.length > 0) {
      parts.push(`Features: ${property.features.slice(0, 4).join(', ')}`);
    }

    return parts.join(' ');
  }

  function handleInsert() {
    if (typeof onInsert === 'function') {
      onInsert(buildInsertText());
    }
  }

  return (
    <div className="flex items-start justify-between gap-2 p-2.5 border border-neutral-200 rounded-xl hover:border-neutral-300 transition-colors">
      <div className="min-w-0 flex-1">
        <h5 className={`font-semibold text-neutral-900 leading-snug truncate ${sizeClass.heading}`}>
          {property.name || 'Unknown Property'}
        </h5>
        {property.address && (
          <p className={`text-neutral-500 truncate ${sizeClass.meta}`}>
            {property.address}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          {property.listPrice && (
            <span className={`font-semibold text-neutral-800 ${sizeClass.meta}`}>
              {formatCurrency(property.listPrice, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          )}
          {property.bedrooms !== undefined && (
            <span className={`text-neutral-500 ${sizeClass.meta}`}>
              {property.bedrooms} bed
            </span>
          )}
          {property.bathrooms !== undefined && (
            <span className={`text-neutral-500 ${sizeClass.meta}`}>
              {property.bathrooms} bath
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleInsert}
        ariaLabel={`Insert ${property.name || 'property'} info into draft`}
        className="shrink-0 text-brand-600 hover:text-brand-700"
      >
        <svg
          className="h-3.5 w-3.5 mr-1"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Insert
      </Button>
    </div>
  );
}

/**
 * Suggested next steps display component
 *
 * @param {object} props
 * @param {string[]} props.steps - Array of suggested next step strings
 * @param {object} props.sizeClass - Size variant classes
 * @param {Function} [props.onInsertStep] - Callback when a step is clicked for insertion
 * @returns {React.ReactElement|null}
 */
function SuggestedNextSteps({ steps, sizeClass, onInsertStep }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
        Suggested Next Steps
      </span>
      <ul className="space-y-1">
        {steps.map((step, idx) => (
          <li
            key={idx}
            className={`flex items-start gap-1.5 text-neutral-600 ${sizeClass.meta}`}
          >
            <span className="text-brand-500 shrink-0 mt-0.5">•</span>
            <span className="flex-1">{step}</span>
            {typeof onInsertStep === 'function' && (
              <button
                type="button"
                onClick={() => onInsertStep(step)}
                className="shrink-0 text-brand-600 hover:text-brand-700 text-xs font-medium transition-colors"
                aria-label={`Insert step: ${step}`}
              >
                + Add
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Draft status indicator component
 *
 * @param {object} props
 * @param {string} props.status - Draft status string
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function DraftStatusIndicator({ status, sizeClass }) {
  const statusStyles = {
    generated: 'bg-accent-100 text-accent-800',
    edited: 'bg-blue-100 text-blue-800',
    approved: 'bg-brand-100 text-brand-800',
    rejected: 'bg-red-100 text-red-800',
    sent: 'bg-brand-100 text-brand-800',
  };

  const statusClass = statusStyles[(status || '').toLowerCase()] || 'bg-neutral-100 text-neutral-700';
  const displayLabel = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';

  return (
    <span className={`badge ${statusClass} text-xs`}>
      {displayLabel}
    </span>
  );
}

/**
 * DraftComposer component
 * Co-Pilot Draft Composer: displays auto-generated reply preview, editable text area,
 * 'Insert Property Info' button, 'Suggest Next Step' button, confidence meter,
 * and send/approve controls.
 *
 * Implements FR-003 (SCRUM-6530) and FR-008 (SCRUM-6535)
 *
 * Features:
 * - Auto-generated draft display with editable text area
 * - Generate and regenerate draft actions
 * - Confidence meter with color coding and threshold indicator
 * - Insert Property Info modal with context properties
 * - Suggested next steps display with insert capability
 * - Approve/send and reject controls with human review enforcement
 * - Low-confidence warning banner requiring human review
 * - Draft status indicator (generated, edited, approved, rejected)
 * - Edit history tracking
 * - Privacy compliance validation before approval
 * - Loading and empty states
 * - Toast notifications for actions
 * - ARIA labels for accessibility
 *
 * @param {object} props
 * @param {object} [props.dm] - DM object (overrides DMContext selected DM)
 * @param {object} [props.context] - Context object (overrides DMContext selected context)
 * @param {boolean} [props.showConfidence=true] - Whether to show the confidence meter
 * @param {boolean} [props.showNextSteps=true] - Whether to show suggested next steps
 * @param {boolean} [props.showInsertProperty=true] - Whether to show the insert property button
 * @param {boolean} [props.showApproveControls=true] - Whether to show approve/reject controls
 * @param {boolean} [props.showRegenerateButton=true] - Whether to show the regenerate button
 * @param {boolean} [props.showTemplateInfo=true] - Whether to show template reference info
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the composer
 * @param {Function} [props.onApprove] - Callback when draft is approved
 * @param {Function} [props.onReject] - Callback when draft is rejected
 * @param {Function} [props.onSend] - Callback when draft is sent
 * @param {Function} [props.onEdit] - Callback when draft is edited
 * @param {Function} [props.onGenerate] - Callback when draft is generated
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <DraftComposer />
 *
 * @example
 * <DraftComposer
 *   dm={selectedDM}
 *   context={dmContext}
 *   showApproveControls
 *   onApprove={handleApprove}
 *   onReject={handleReject}
 * />
 */
export function DraftComposer({
  dm: dmProp,
  context: contextProp,
  showConfidence = true,
  showNextSteps = true,
  showInsertProperty = true,
  showApproveControls = true,
  showRegenerateButton = true,
  showTemplateInfo = true,
  size = 'md',
  onApprove,
  onReject,
  onSend,
  onEdit,
  onGenerate,
  className = '',
}) {
  const {
    selectedDM,
    loading: dmLoading,
  } = useDM();

  const {
    currentDraft,
    reviewState,
    loading: draftLoading,
    error: draftError,
    confidenceThreshold,
    generate,
    regenerate,
    loadDraft,
    edit,
    approve,
    reject,
    clearDraft,
    clearError,
  } = useDraft();

  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const textareaRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // Determine DM and context sources
  const dm = dmProp || selectedDM?.dm || null;
  const context = contextProp || selectedDM?.context || null;
  const draft = currentDraft;

  const isLoadingDM = dmLoading.selected || dmLoading.initializing;
  const isGenerating = draftLoading.generating;
  const isLoadingDraft = draftLoading.loading;
  const isEditing_ = draftLoading.editing;
  const isApproving = draftLoading.approving;
  const isRejecting = draftLoading.rejecting;
  const isAnyLoading = isGenerating || isLoadingDraft || isEditing_ || isApproving || isRejecting;

  const requiresReview = draft
    ? typeof draft.confidence === 'number' && draft.confidence < confidenceThreshold
    : false;

  const isLowConfidenceUnreviewed = requiresReview
    && draft?.status !== 'edited'
    && draft?.status !== 'approved';

  const canEdit = draft && (draft.status === 'generated' || draft.status === 'edited');
  const canApprove = draft && (draft.status === 'generated' || draft.status === 'edited');
  const canReject = draft && (draft.status === 'generated' || draft.status === 'edited');

  const hasProperties = context?.properties && context.properties.length > 0;

  // Sync edit content with draft content
  useEffect(() => {
    if (draft && draft.content) {
      setEditContent(draft.content);
      setHasUnsavedChanges(false);
      setIsEditing(false);
    } else {
      setEditContent('');
      setHasUnsavedChanges(false);
      setIsEditing(false);
    }
  }, [draft]);

  /**
   * Shows a toast notification
   *
   * @param {string} message - Toast message
   * @param {'success'|'error'|'warning'|'info'} variant - Toast variant
   */
  function showToast(message, variant = 'info') {
    setToast({ message, variant, key: Date.now() });
  }

  /**
   * Handles generating a draft for the current DM
   */
  const handleGenerate = useCallback(async () => {
    if (!dm) return;

    if (typeof onGenerate === 'function') {
      onGenerate(dm);
      return;
    }

    clearError();

    const result = await generate(dm, { context });

    if (result) {
      showToast('Draft generated successfully.', 'success');
    } else if (draftError) {
      showToast('Failed to generate draft.', 'error');
    }
  }, [dm, context, generate, onGenerate, clearError, draftError]);

  /**
   * Handles regenerating a draft for the current DM
   */
  const handleRegenerate = useCallback(async () => {
    if (!dm) return;

    clearError();

    const result = await regenerate(dm, { context });

    if (result) {
      showToast('Draft regenerated successfully.', 'success');
    } else {
      showToast('Failed to regenerate draft.', 'error');
    }
  }, [dm, context, regenerate, clearError]);

  /**
   * Handles entering edit mode
   */
  function handleStartEditing() {
    if (!canEdit) return;
    setIsEditing(true);

    // Focus the textarea after state update
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  }

  /**
   * Handles text area content changes
   *
   * @param {React.ChangeEvent<HTMLTextAreaElement>} event
   */
  function handleContentChange(event) {
    const newContent = event.target.value;
    setEditContent(newContent);
    setHasUnsavedChanges(newContent !== (draft?.content || ''));
  }

  /**
   * Handles saving edits to the draft
   */
  const handleSaveEdit = useCallback(async () => {
    if (!draft || !draft.id) return;

    if (!editContent || editContent.trim().length === 0) {
      showToast('Draft content cannot be empty.', 'warning');
      return;
    }

    clearError();

    const result = await edit(draft.id, editContent);

    if (result) {
      setIsEditing(false);
      setHasUnsavedChanges(false);
      showToast('Draft saved successfully.', 'success');

      if (typeof onEdit === 'function') {
        onEdit(result);
      }
    } else {
      showToast('Failed to save draft edits.', 'error');
    }
  }, [draft, editContent, edit, clearError, onEdit]);

  /**
   * Handles cancelling edit mode
   */
  function handleCancelEdit() {
    if (draft && draft.content) {
      setEditContent(draft.content);
    }
    setIsEditing(false);
    setHasUnsavedChanges(false);
  }

  /**
   * Handles approving the draft
   */
  const handleApprove = useCallback(async () => {
    if (!draft || !draft.id) return;

    clearError();

    const result = await approve(draft.id);

    if (result) {
      showToast('Draft approved and sent.', 'success');

      if (typeof onApprove === 'function') {
        onApprove(result);
      }
    } else {
      showToast(draftError || 'Failed to approve draft.', 'error');
    }
  }, [draft, approve, clearError, onApprove, draftError]);

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
   * Handles inserting property info text into the draft
   *
   * @param {string} text - Property info text to insert
   */
  const handleInsertPropertyText = useCallback((text) => {
    if (!text) return;

    const newContent = editContent
      ? `${editContent}\n\n${text}`
      : text;

    setEditContent(newContent);
    setHasUnsavedChanges(true);
    setIsEditing(true);
    setShowPropertyModal(false);

    // Focus the textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 0);
  }, [editContent]);

  /**
   * Handles inserting a suggested next step into the draft
   *
   * @param {string} step - Next step text to insert
   */
  const handleInsertStep = useCallback((step) => {
    if (!step) return;

    const stepText = `\n\nNext step: ${step}`;
    const newContent = editContent
      ? `${editContent}${stepText}`
      : stepText.trim();

    setEditContent(newContent);
    setHasUnsavedChanges(true);
    setIsEditing(true);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 0);
  }, [editContent]);

  /**
   * Handles keyboard shortcuts in the textarea
   *
   * @param {React.KeyboardEvent<HTMLTextAreaElement>} event
   */
  function handleTextareaKeyDown(event) {
    // Ctrl/Cmd + S to save
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      if (hasUnsavedChanges) {
        handleSaveEdit();
      }
    }

    // Escape to cancel editing
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelEdit();
    }
  }

  const containerClasses = [
    'flex flex-col space-y-4',
    sizeClass.container,
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // No DM selected state
  if (!dm && !isLoadingDM) {
    return (
      <div className={containerClasses} role="region" aria-label="Draft Composer">
        <EmptyState
          title="No DM selected"
          description="Select a DM from the inbox to generate or view a draft response."
          size={size === 'lg' ? 'md' : 'sm'}
          showIcon={false}
        />
      </div>
    );
  }

  // Loading DM state
  if (isLoadingDM && !dm) {
    return (
      <div className={containerClasses} role="region" aria-label="Draft Composer">
        <LoadingSpinner
          center
          size="sm"
          label="Loading DM..."
          showLabel
        />
      </div>
    );
  }

  // Generating draft state
  if (isGenerating) {
    return (
      <div className={containerClasses} role="region" aria-label="Draft Composer">
        <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
          Draft Response
        </h4>
        <LoadingSpinner
          center
          size="sm"
          label="Generating draft..."
          showLabel
        />
      </div>
    );
  }

  // No draft yet — show generate button
  if (!draft && !isLoadingDraft) {
    return (
      <div className={containerClasses} role="region" aria-label="Draft Composer">
        <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
          Draft Response
        </h4>
        <EmptyState
          title="No draft yet"
          description="Generate an AI-powered draft response for this DM."
          size="sm"
          showIcon={false}
          actionLabel="Generate Draft"
          onAction={handleGenerate}
          actionVariant="primary"
        />
      </div>
    );
  }

  // Loading existing draft state
  if (isLoadingDraft && !draft) {
    return (
      <div className={containerClasses} role="region" aria-label="Draft Composer">
        <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
          Draft Response
        </h4>
        <LoadingSpinner
          center
          size="sm"
          label="Loading draft..."
          showLabel
        />
      </div>
    );
  }

  return (
    <div className={containerClasses} role="region" aria-label="Draft Composer">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
            Draft Response
          </h4>
          {draft && <DraftStatusIndicator status={draft.status} sizeClass={sizeClass} />}
        </div>

        <div className="flex items-center gap-2">
          {/* Regenerate button */}
          {showRegenerateButton && canEdit && (
            <Tooltip content="Regenerate draft with fresh context">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                loading={isGenerating}
                ariaLabel="Regenerate draft"
                disabled={isAnyLoading}
              >
                <svg
                  className="h-4 w-4"
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
              </Button>
            </Tooltip>
          )}

          {/* Insert Property Info button */}
          {showInsertProperty && hasProperties && canEdit && (
            <Tooltip content="Insert property information into draft">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowPropertyModal(true)}
                disabled={isAnyLoading}
                ariaLabel="Insert property info"
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
                    d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                  />
                </svg>
                Insert Property
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

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

      {/* Low-confidence warning banner */}
      {isLowConfidenceUnreviewed && (
        <div className="flex items-start gap-2 p-2.5 bg-accent-50 border border-accent-200 rounded-xl">
          <svg
            className="h-4 w-4 shrink-0 text-accent-600 mt-0.5"
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
          <div>
            <p className={`font-semibold text-accent-800 ${sizeClass.body}`}>
              Human Review Required
            </p>
            <p className={`text-accent-700 ${sizeClass.meta}`}>
              This draft has low confidence ({Math.round((draft?.confidence || 0) * 100)}%).
              Please review and edit before approving. Threshold is {Math.round(confidenceThreshold * 100)}%.
            </p>
          </div>
        </div>
      )}

      {/* Confidence meter */}
      {showConfidence && draft && draft.confidence !== undefined && draft.confidence !== null && (
        <ConfidenceMeter
          score={draft.confidence}
          explanation={draft.confidenceExplanation}
          size="sm"
          showThresholdIndicator
        />
      )}

      {/* Draft content area */}
      <div className="space-y-2">
        {isEditing ? (
          /* Editable textarea */
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
                Editing Draft
              </span>
              {hasUnsavedChanges && (
                <span className={`text-accent-600 font-medium ${sizeClass.meta}`}>
                  Unsaved changes
                </span>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={handleContentChange}
              onKeyDown={handleTextareaKeyDown}
              disabled={isAnyLoading}
              className={`block w-full px-3 py-2.5 border border-neutral-300 rounded-xl bg-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors resize-y disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed leading-relaxed ${sizeClass.textarea}`}
              aria-label="Edit draft content"
              placeholder="Type your draft response here..."
            />
            <div className="flex items-center justify-between gap-2">
              <span className={`text-neutral-400 ${sizeClass.meta}`}>
                {editContent.length} characters • Ctrl+S to save • Esc to cancel
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isEditing_}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveEdit}
                  loading={isEditing_}
                  disabled={!hasUnsavedChanges || isAnyLoading}
                  loadingText="Saving..."
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Read-only draft preview */
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
                Draft Preview
              </span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartEditing}
                  disabled={isAnyLoading}
                  ariaLabel="Edit draft"
                >
                  <svg
                    className="h-3.5 w-3.5 mr-1"
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
                  Edit
                </Button>
              )}
            </div>
            <div
              className={`p-3 bg-neutral-50 border border-neutral-200 rounded-xl cursor-pointer hover:border-neutral-300 transition-colors ${canEdit ? '' : 'cursor-default'}`}
              onClick={canEdit ? handleStartEditing : undefined}
              onKeyDown={canEdit ? (e) => { if (e.key === 'Enter') handleStartEditing(); } : undefined}
              role={canEdit ? 'button' : undefined}
              tabIndex={canEdit ? 0 : undefined}
              aria-label={canEdit ? 'Click to edit draft' : undefined}
            >
              <p className={`text-neutral-700 leading-relaxed whitespace-pre-wrap ${sizeClass.body}`}>
                {draft?.content || 'No content available.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Suggested next steps */}
      {showNextSteps && draft?.suggestedNextSteps && draft.suggestedNextSteps.length > 0 && (
        <SuggestedNextSteps
          steps={draft.suggestedNextSteps}
          sizeClass={sizeClass}
          onInsertStep={canEdit ? handleInsertStep : undefined}
        />
      )}

      {/* Template reference */}
      {showTemplateInfo && draft?.contextReferences?.templateName && (
        <div className={`text-neutral-400 ${sizeClass.meta}`}>
          Template: {draft.contextReferences.templateName}
          {draft.contextReferences.templateCategory && (
            <span> ({draft.contextReferences.templateCategory})</span>
          )}
        </div>
      )}

      {/* Approve/Reject controls */}
      {showApproveControls && draft && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-neutral-200">
          <div className="flex items-center gap-2">
            {canReject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRejectModal(true)}
                disabled={isAnyLoading}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canApprove && (
              <Tooltip
                content={
                  isLowConfidenceUnreviewed
                    ? 'Low-confidence draft must be edited before approval'
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
                  <svg
                    className="h-3.5 w-3.5 mr-1.5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Approve &amp; Send
                </Button>
              </Tooltip>
            )}

            {draft?.status === 'approved' && (
              <span className="badge badge-success text-xs">
                ✓ Approved
              </span>
            )}

            {draft?.status === 'rejected' && (
              <span className="badge bg-red-100 text-red-800 text-xs">
                ✗ Rejected
              </span>
            )}
          </div>
        </div>
      )}

      {/* Insert Property Info Modal */}
      <Modal
        open={showPropertyModal}
        onClose={() => setShowPropertyModal(false)}
        title="Insert Property Info"
        size="md"
      >
        <div className="space-y-3">
          <p className={`text-neutral-500 ${sizeClass.meta}`}>
            Select a property to insert its details into the draft.
          </p>
          {hasProperties ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {context.properties.map((property) => (
                <PropertyInsertCard
                  key={property.id}
                  property={property}
                  onInsert={handleInsertPropertyText}
                  sizeClass={sizeClass}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No properties available"
              description="No matching properties were found in the knowledge base for this DM."
              size="sm"
              showIcon={false}
            />
          )}
        </div>
      </Modal>

      {/* Reject Confirmation Modal */}
      <Modal
        open={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason('');
        }}
        title="Reject Draft"
        size="sm"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowRejectModal(false);
                setRejectReason('');
              }}
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
            Are you sure you want to reject this draft? You can optionally provide a reason.
          </p>
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

export default DraftComposer;