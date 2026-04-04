'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDraft } from '@/contexts/DraftContext';
import { useDM } from '@/contexts/DMContext';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import Tooltip from '@/components/common/Tooltip';
import Toast from '@/components/common/Toast';
import ConfidenceMeter from '@/components/common/ConfidenceMeter';
import { validateDraftContent } from '@/utils/validators';
import { CONFIDENCE_THRESHOLD } from '@/utils/constants';

/**
 * Size variant mappings for the draft editor
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
 * Maximum number of undo/redo history entries to retain
 */
const MAX_HISTORY_SIZE = 50;

/**
 * Maximum allowed draft content length
 */
const MAX_CONTENT_LENGTH = 5000;

/**
 * Minimum allowed draft content length
 */
const MIN_CONTENT_LENGTH = 1;

/**
 * Undo icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function UndoIcon({ className }) {
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
        d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
      />
    </svg>
  );
}

/**
 * Redo icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function RedoIcon({ className }) {
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
        d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3"
      />
    </svg>
  );
}

/**
 * Save icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function SaveIcon({ className }) {
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
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

/**
 * Validation status indicator component
 * Displays real-time validation feedback for draft content
 *
 * @param {object} props
 * @param {object} props.validation - Validation result from validateDraftContent
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function ValidationStatus({ validation, sizeClass }) {
  if (!validation) return null;

  if (validation.valid) {
    return (
      <div className="flex items-center gap-1.5">
        <svg
          className="h-3.5 w-3.5 text-brand-500 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className={`text-brand-600 ${sizeClass.meta}`}>Content valid</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {validation.errors.map((error, idx) => (
        <div key={idx} className="flex items-start gap-1.5">
          <svg
            className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className={`text-red-600 ${sizeClass.meta}`}>{error}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Edit history panel component
 * Displays the audit-tracked edit history for the current draft
 *
 * @param {object} props
 * @param {object[]} props.history - Array of edit history entries
 * @param {object} props.sizeClass - Size variant classes
 * @param {Function} [props.onRestore] - Callback when a history entry is clicked for restoration
 * @returns {React.ReactElement|null}
 */
function EditHistoryPanel({ history, sizeClass, onRestore }) {
  const [expanded, setExpanded] = useState(false);

  if (!history || history.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        className="flex items-center gap-1.5 w-full text-left"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <svg
          className="h-3.5 w-3.5 text-neutral-400 shrink-0"
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
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
          Edit History ({history.length} edit{history.length !== 1 ? 's' : ''})
        </span>
        <svg
          className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="pl-5 space-y-2 max-h-48 overflow-y-auto">
          {history.map((entry, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-2 p-2 border border-neutral-200 rounded-xl hover:border-neutral-300 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {entry.status && (
                    <span className="badge badge-neutral text-xs">
                      {entry.status}
                    </span>
                  )}
                  {entry.editedAt && (
                    <span className={`text-neutral-400 ${sizeClass.meta}`}>
                      {new Date(entry.editedAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                  {entry.editedBy && (
                    <span className={`text-neutral-400 ${sizeClass.meta}`}>
                      by {entry.editedBy}
                    </span>
                  )}
                </div>
                {entry.content && (
                  <p className={`text-neutral-500 leading-snug line-clamp-2 mt-0.5 ${sizeClass.meta}`}>
                    {entry.content}
                  </p>
                )}
              </div>
              {typeof onRestore === 'function' && entry.content && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRestore(entry.content)}
                  ariaLabel={`Restore version from ${entry.editedAt || 'history'}`}
                  className="shrink-0 text-brand-600 hover:text-brand-700"
                >
                  Restore
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Character count display component
 *
 * @param {object} props
 * @param {number} props.current - Current character count
 * @param {number} props.max - Maximum allowed characters
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function CharacterCount({ current, max, sizeClass }) {
  const percentage = max > 0 ? (current / max) * 100 : 0;

  let colorClass = 'text-neutral-400';
  if (percentage >= 95) {
    colorClass = 'text-red-500 font-medium';
  } else if (percentage >= 80) {
    colorClass = 'text-accent-600';
  }

  return (
    <span className={`${colorClass} ${sizeClass.meta}`}>
      {current.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}

/**
 * DraftEditor component
 * Draft editor component: textarea for editing draft content with character count,
 * undo/redo, and real-time validation. Tracks edit history for audit logging.
 *
 * Implements human review and edit workflow for DraftReviewService (SCRUM-6532)
 *
 * Features:
 * - Editable textarea with real-time content validation
 * - Character count with visual feedback near limits
 * - Undo/redo support with keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z)
 * - Save with Ctrl+S keyboard shortcut
 * - Edit history panel showing previous versions with restore capability
 * - Low-confidence warning banner requiring human review
 * - Confidence meter display for the current draft
 * - Validation status indicator (valid/invalid with error messages)
 * - Unsaved changes indicator
 * - Loading and empty states
 * - Toast notifications for save/error feedback
 * - ARIA labels for accessibility
 *
 * @param {object} props
 * @param {object} [props.draft] - Draft object (overrides DraftContext current draft)
 * @param {boolean} [props.showConfidence=true] - Whether to show the confidence meter
 * @param {boolean} [props.showHistory=true] - Whether to show the edit history panel
 * @param {boolean} [props.showValidation=true] - Whether to show real-time validation status
 * @param {boolean} [props.showCharacterCount=true] - Whether to show the character count
 * @param {boolean} [props.showUndoRedo=true] - Whether to show undo/redo buttons
 * @param {boolean} [props.autoFocus=false] - Whether to auto-focus the textarea on mount
 * @param {number} [props.maxLength=5000] - Maximum content length
 * @param {number} [props.minLength=1] - Minimum content length
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the editor
 * @param {Function} [props.onSave] - Callback when draft is saved (receives updated draft)
 * @param {Function} [props.onChange] - Callback when content changes (receives new content string)
 * @param {Function} [props.onValidationChange] - Callback when validation state changes (receives validation result)
 * @param {string} [props.placeholder='Type your draft response here...'] - Textarea placeholder text
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <DraftEditor />
 *
 * @example
 * <DraftEditor
 *   draft={draftObject}
 *   showConfidence
 *   showHistory
 *   onSave={handleSave}
 *   onChange={handleChange}
 * />
 *
 * @example
 * <DraftEditor
 *   size="sm"
 *   autoFocus
 *   maxLength={2000}
 *   showUndoRedo
 *   placeholder="Write your reply..."
 * />
 */
export function DraftEditor({
  draft: draftProp,
  showConfidence = true,
  showHistory = true,
  showValidation = true,
  showCharacterCount = true,
  showUndoRedo = true,
  autoFocus = false,
  maxLength = MAX_CONTENT_LENGTH,
  minLength = MIN_CONTENT_LENGTH,
  size = 'md',
  onSave,
  onChange,
  onValidationChange,
  placeholder = 'Type your draft response here...',
  className = '',
}) {
  const {
    currentDraft,
    loading: draftLoading,
    error: draftError,
    confidenceThreshold,
    edit,
    clearError,
  } = useDraft();

  const {
    selectedDM,
    loading: dmLoading,
  } = useDM();

  const [content, setContent] = useState('');
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validation, setValidation] = useState(null);
  const [toast, setToast] = useState(null);

  const textareaRef = useRef(null);
  const mountedRef = useRef(true);
  const lastSavedContentRef = useRef('');
  const isUndoRedoRef = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // Determine draft source: prop override or DraftContext
  const draft = draftProp || currentDraft;
  const dm = selectedDM?.dm || null;

  const isLoadingDM = dmLoading.selected || dmLoading.initializing;
  const isEditing = draftLoading.editing;
  const isAnyLoading = draftLoading.generating || draftLoading.loading || isEditing;

  const canEdit = draft && (draft.status === 'generated' || draft.status === 'edited');

  const requiresReview = draft
    ? typeof draft.confidence === 'number' && draft.confidence < confidenceThreshold
    : false;

  const isLowConfidenceUnreviewed = requiresReview
    && draft?.status !== 'edited'
    && draft?.status !== 'approved';

  // Sync content with draft content when draft changes
  useEffect(() => {
    if (draft && draft.content) {
      setContent(draft.content);
      lastSavedContentRef.current = draft.content;
      setHasUnsavedChanges(false);
      setUndoStack([]);
      setRedoStack([]);
    } else {
      setContent('');
      lastSavedContentRef.current = '';
      setHasUnsavedChanges(false);
      setUndoStack([]);
      setRedoStack([]);
    }
  }, [draft]);

  // Auto-focus textarea on mount if enabled
  useEffect(() => {
    if (autoFocus && textareaRef.current && canEdit) {
      textareaRef.current.focus();
    }
  }, [autoFocus, canEdit]);

  // Real-time validation
  useEffect(() => {
    if (!showValidation) return;

    const trimmed = content.trim();

    if (trimmed.length === 0 && !hasUnsavedChanges) {
      setValidation(null);
      return;
    }

    const result = validateDraftContent(content, {
      minLength,
      maxLength,
      allowHtml: false,
    });

    setValidation(result);

    if (typeof onValidationChange === 'function') {
      onValidationChange(result);
    }
  }, [content, minLength, maxLength, showValidation, hasUnsavedChanges, onValidationChange]);

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
   * Pushes the current content onto the undo stack
   *
   * @param {string} previousContent - Content before the change
   */
  function pushUndoState(previousContent) {
    setUndoStack((prev) => {
      const newStack = [...prev, previousContent];
      if (newStack.length > MAX_HISTORY_SIZE) {
        return newStack.slice(newStack.length - MAX_HISTORY_SIZE);
      }
      return newStack;
    });
    // Clear redo stack on new edit
    setRedoStack([]);
  }

  /**
   * Handles text area content changes
   *
   * @param {React.ChangeEvent<HTMLTextAreaElement>} event
   */
  function handleContentChange(event) {
    const newContent = event.target.value;

    // Only push undo state for non-undo/redo changes
    if (!isUndoRedoRef.current) {
      pushUndoState(content);
    }
    isUndoRedoRef.current = false;

    setContent(newContent);
    setHasUnsavedChanges(newContent !== lastSavedContentRef.current);

    if (typeof onChange === 'function') {
      onChange(newContent);
    }
  }

  /**
   * Handles undo action
   * Restores the previous content from the undo stack
   */
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;

    const previousContent = undoStack[undoStack.length - 1];

    setRedoStack((prev) => [...prev, content]);
    setUndoStack((prev) => prev.slice(0, -1));

    isUndoRedoRef.current = true;
    setContent(previousContent);
    setHasUnsavedChanges(previousContent !== lastSavedContentRef.current);

    if (typeof onChange === 'function') {
      onChange(previousContent);
    }
  }, [undoStack, content, onChange]);

  /**
   * Handles redo action
   * Restores the next content from the redo stack
   */
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    const nextContent = redoStack[redoStack.length - 1];

    setUndoStack((prev) => [...prev, content]);
    setRedoStack((prev) => prev.slice(0, -1));

    isUndoRedoRef.current = true;
    setContent(nextContent);
    setHasUnsavedChanges(nextContent !== lastSavedContentRef.current);

    if (typeof onChange === 'function') {
      onChange(nextContent);
    }
  }, [redoStack, content, onChange]);

  /**
   * Handles saving edits to the draft
   */
  const handleSave = useCallback(async () => {
    if (!draft || !draft.id) return;

    if (!content || content.trim().length === 0) {
      showToast('Draft content cannot be empty.', 'warning');
      return;
    }

    // Validate before saving
    const result = validateDraftContent(content, {
      minLength,
      maxLength,
      allowHtml: false,
    });

    if (!result.valid) {
      showToast(`Validation failed: ${result.errors[0]}`, 'warning');
      return;
    }

    clearError();

    const updatedDraft = await edit(draft.id, content);

    if (updatedDraft) {
      lastSavedContentRef.current = content;
      setHasUnsavedChanges(false);
      showToast('Draft saved successfully.', 'success');

      if (typeof onSave === 'function') {
        onSave(updatedDraft);
      }
    } else {
      showToast(draftError || 'Failed to save draft.', 'error');
    }
  }, [draft, content, minLength, maxLength, edit, clearError, onSave, draftError]);

  /**
   * Handles restoring content from edit history
   *
   * @param {string} historicContent - Content to restore
   */
  const handleRestoreFromHistory = useCallback((historicContent) => {
    if (!historicContent || typeof historicContent !== 'string') return;

    pushUndoState(content);
    setContent(historicContent);
    setHasUnsavedChanges(historicContent !== lastSavedContentRef.current);

    if (typeof onChange === 'function') {
      onChange(historicContent);
    }

    showToast('Previous version restored. Save to apply changes.', 'info');

    // Focus the textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  }, [content, onChange]);

  /**
   * Handles keyboard shortcuts in the textarea
   *
   * @param {React.KeyboardEvent<HTMLTextAreaElement>} event
   */
  function handleKeyDown(event) {
    // Ctrl/Cmd + S to save
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      if (hasUnsavedChanges && !isAnyLoading) {
        handleSave();
      }
    }

    // Ctrl/Cmd + Z to undo
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      handleUndo();
    }

    // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y to redo
    if (
      ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'z') ||
      ((event.ctrlKey || event.metaKey) && event.key === 'y')
    ) {
      event.preventDefault();
      handleRedo();
    }

    // Escape to discard changes
    if (event.key === 'Escape') {
      event.preventDefault();
      if (hasUnsavedChanges && draft && draft.content) {
        setContent(draft.content);
        setHasUnsavedChanges(false);
        setUndoStack([]);
        setRedoStack([]);
        showToast('Changes discarded.', 'info');
      }
    }
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

  // No draft state
  if (!draft && !isLoadingDM && !draftLoading.generating && !draftLoading.loading) {
    return (
      <div className={containerClasses} role="region" aria-label="Draft Editor">
        <EmptyState
          title="No draft to edit"
          description="Generate a draft first, then edit it here."
          size={size === 'lg' ? 'md' : 'sm'}
          showIcon={false}
        />
      </div>
    );
  }

  // Loading draft state
  if ((draftLoading.generating || draftLoading.loading) && !draft) {
    return (
      <div className={containerClasses} role="region" aria-label="Draft Editor">
        <LoadingSpinner
          center
          size="sm"
          label="Loading draft..."
          showLabel
        />
      </div>
    );
  }

  // Draft not editable state
  if (draft && !canEdit) {
    return (
      <div className={containerClasses} role="region" aria-label="Draft Editor">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
              Draft Editor
            </h4>
            <span className={`badge ${draft.status === 'approved' ? 'bg-brand-100 text-brand-800' : draft.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-neutral-100 text-neutral-700'} text-xs`}>
              {draft.status ? draft.status.charAt(0).toUpperCase() + draft.status.slice(1) : 'Unknown'}
            </span>
          </div>
          <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
            <p className={`text-neutral-700 leading-relaxed whitespace-pre-wrap ${sizeClass.body}`}>
              {draft.content || 'No content available.'}
            </p>
          </div>
          <p className={`text-neutral-400 ${sizeClass.meta}`}>
            This draft cannot be edited in its current status.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses} role="region" aria-label="Draft Editor">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
            Draft Editor
          </h4>
          {draft && draft.status && (
            <span className={`badge ${draft.status === 'edited' ? 'bg-blue-100 text-blue-800' : 'bg-accent-100 text-accent-800'} text-xs`}>
              {draft.status.charAt(0).toUpperCase() + draft.status.slice(1)}
            </span>
          )}
          {hasUnsavedChanges && (
            <span className={`text-accent-600 font-medium ${sizeClass.meta}`}>
              • Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Undo button */}
          {showUndoRedo && (
            <Tooltip content="Undo (Ctrl+Z)">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndo}
                disabled={undoStack.length === 0 || isAnyLoading}
                ariaLabel="Undo"
              >
                <UndoIcon className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}

          {/* Redo button */}
          {showUndoRedo && (
            <Tooltip content="Redo (Ctrl+Shift+Z)">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRedo}
                disabled={redoStack.length === 0 || isAnyLoading}
                ariaLabel="Redo"
              >
                <RedoIcon className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}

          {/* Save button */}
          <Tooltip content="Save changes (Ctrl+S)">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={isEditing}
              disabled={!hasUnsavedChanges || isAnyLoading || (validation && !validation.valid)}
              loadingText="Saving..."
              ariaLabel="Save draft"
            >
              <SaveIcon className="h-3.5 w-3.5 mr-1.5" />
              Save
            </Button>
          </Tooltip>
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

      {/* Textarea editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
            Edit Content
          </span>
          {showCharacterCount && (
            <CharacterCount
              current={content.length}
              max={maxLength}
              sizeClass={sizeClass}
            />
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          disabled={isAnyLoading || !canEdit}
          className={`block w-full px-3 py-2.5 border border-neutral-300 rounded-xl bg-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors resize-y disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed leading-relaxed ${sizeClass.textarea} ${
            validation && !validation.valid && hasUnsavedChanges
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
              : ''
          }`}
          aria-label="Edit draft content"
          placeholder={placeholder}
          maxLength={maxLength + 100} // Allow slight overflow for better UX, validation catches it
        />

        {/* Footer row: validation, shortcuts hint */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            {showValidation && hasUnsavedChanges && (
              <ValidationStatus validation={validation} sizeClass={sizeClass} />
            )}
          </div>
          <span className={`text-neutral-400 shrink-0 ${sizeClass.meta}`}>
            Ctrl+S save • Ctrl+Z undo • Esc discard
          </span>
        </div>
      </div>

      {/* Edit history panel */}
      {showHistory && draft && draft.editHistory && draft.editHistory.length > 0 && (
        <EditHistoryPanel
          history={draft.editHistory}
          sizeClass={sizeClass}
          onRestore={canEdit ? handleRestoreFromHistory : undefined}
        />
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

export default DraftEditor;