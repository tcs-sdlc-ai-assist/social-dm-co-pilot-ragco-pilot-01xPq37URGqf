'use client';

import { useState, useCallback } from 'react';
import { useDraft } from '@/contexts/DraftContext';
import { useDM } from '@/contexts/DMContext';
import ConfidenceMeter from '@/components/common/ConfidenceMeter';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import Tooltip from '@/components/common/Tooltip';
import StatusBadge from '@/components/common/StatusBadge';
import { formatTimestamp, formatCurrency, formatConfidenceScore } from '@/utils/formatters';
import { CONFIDENCE_THRESHOLD, STATUS } from '@/utils/constants';

/**
 * Size variant mappings for the draft preview
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
 * Draft status style mappings
 */
const DRAFT_STATUS_STYLES = Object.freeze({
  generated: 'bg-accent-100 text-accent-800',
  edited: 'bg-blue-100 text-blue-800',
  approved: 'bg-brand-100 text-brand-800',
  rejected: 'bg-red-100 text-red-800',
  sent: 'bg-brand-100 text-brand-800',
});

/**
 * Confidence badge component
 * Displays a compact confidence score badge with color coding
 *
 * @param {object} props
 * @param {number} props.confidence - Confidence score (0-1)
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function ConfidenceBadge({ confidence, sizeClass }) {
  if (confidence === undefined || confidence === null || typeof confidence !== 'number') {
    return null;
  }

  const percentage = Math.round(confidence * 100);
  const requiresReview = confidence < CONFIDENCE_THRESHOLD;

  let badgeColor;
  if (confidence >= 0.9) {
    badgeColor = 'bg-brand-100 text-brand-800';
  } else if (confidence >= CONFIDENCE_THRESHOLD) {
    badgeColor = 'bg-brand-100 text-brand-700';
  } else if (confidence >= 0.4) {
    badgeColor = 'bg-accent-100 text-accent-800';
  } else {
    badgeColor = 'bg-red-100 text-red-800';
  }

  return (
    <Tooltip
      content={
        requiresReview
          ? `Confidence: ${percentage}% — below ${Math.round(CONFIDENCE_THRESHOLD * 100)}% threshold, human review required`
          : `Confidence: ${percentage}% — above threshold`
      }
    >
      <span className={`badge ${badgeColor} ${sizeClass.meta}`}>
        {percentage}% conf
        {requiresReview && (
          <svg
            className="h-3 w-3 ml-1 inline-block"
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
        )}
      </span>
    </Tooltip>
  );
}

/**
 * Context source attribution component
 * Displays the knowledge base sources used to generate the draft
 *
 * @param {object} props
 * @param {object} props.contextReferences - Context references from the draft
 * @param {object} props.sizeClass - Size variant classes
 * @param {boolean} [props.expanded=false] - Whether to show expanded details
 * @returns {React.ReactElement|null}
 */
function ContextAttribution({ contextReferences, sizeClass, expanded = false }) {
  const [isExpanded, setIsExpanded] = useState(expanded);

  if (!contextReferences || typeof contextReferences !== 'object') {
    return null;
  }

  const hasProperties = contextReferences.properties && contextReferences.properties.length > 0;
  const hasFAQs = contextReferences.faqs && contextReferences.faqs.length > 0;
  const hasKeywords = contextReferences.keywords && contextReferences.keywords.length > 0;
  const hasTemplate = contextReferences.templateName;

  if (!hasProperties && !hasFAQs && !hasKeywords && !hasTemplate) {
    return null;
  }

  const sourceCount =
    (hasProperties ? contextReferences.properties.length : 0) +
    (hasFAQs ? contextReferences.faqs.length : 0);

  return (
    <div className="space-y-1.5">
      {/* Header with toggle */}
      <button
        type="button"
        className="flex items-center gap-1.5 w-full text-left"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
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
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
          Context Sources ({sourceCount} source{sourceCount !== 1 ? 's' : ''})
        </span>
        <svg
          className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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

      {/* Expanded details */}
      {isExpanded && (
        <div className="pl-5 space-y-2">
          {/* Template reference */}
          {hasTemplate && (
            <div className={`text-neutral-500 ${sizeClass.meta}`}>
              <span className="font-medium text-neutral-600">Template:</span>{' '}
              {contextReferences.templateName}
              {contextReferences.templateCategory && (
                <span className="text-neutral-400"> ({contextReferences.templateCategory})</span>
              )}
            </div>
          )}

          {/* Property sources */}
          {hasProperties && (
            <div className="space-y-1">
              <span className={`font-medium text-neutral-600 ${sizeClass.meta}`}>
                Properties Referenced:
              </span>
              <ul className="space-y-0.5">
                {contextReferences.properties.map((prop, idx) => (
                  <li
                    key={prop.id || idx}
                    className={`flex items-center gap-1.5 text-neutral-500 ${sizeClass.meta}`}
                  >
                    <span className="text-brand-500 shrink-0">•</span>
                    <span className="truncate">{prop.name || prop.id}</span>
                    {prop.relevance !== undefined && (
                      <span className="text-neutral-400 shrink-0">
                        ({Math.round(prop.relevance * 100)}% match)
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* FAQ sources */}
          {hasFAQs && (
            <div className="space-y-1">
              <span className={`font-medium text-neutral-600 ${sizeClass.meta}`}>
                FAQs Referenced:
              </span>
              <ul className="space-y-0.5">
                {contextReferences.faqs.map((faq, idx) => (
                  <li
                    key={faq.id || idx}
                    className={`flex items-center gap-1.5 text-neutral-500 ${sizeClass.meta}`}
                  >
                    <span className="text-brand-500 shrink-0">•</span>
                    <span className="truncate">{faq.question || faq.id}</span>
                    {faq.relevance !== undefined && (
                      <span className="text-neutral-400 shrink-0">
                        ({Math.round(faq.relevance * 100)}% match)
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Keywords */}
          {hasKeywords && (
            <div className="space-y-1">
              <span className={`font-medium text-neutral-600 ${sizeClass.meta}`}>
                Keywords Matched:
              </span>
              <div className="flex flex-wrap gap-1">
                {contextReferences.keywords.slice(0, 10).map((keyword, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600"
                  >
                    {keyword}
                  </span>
                ))}
                {contextReferences.keywords.length > 10 && (
                  <span className={`text-neutral-400 ${sizeClass.meta}`}>
                    +{contextReferences.keywords.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Suggested next steps display component
 *
 * @param {object} props
 * @param {string[]} props.steps - Array of suggested next step strings
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function SuggestedSteps({ steps, sizeClass }) {
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
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Low confidence warning banner component
 *
 * @param {object} props
 * @param {number} props.confidence - Confidence score (0-1)
 * @param {string} props.status - Draft status
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function LowConfidenceWarning({ confidence, status, sizeClass }) {
  if (typeof confidence !== 'number') return null;
  if (confidence >= CONFIDENCE_THRESHOLD) return null;
  if (status === 'edited' || status === 'approved') return null;

  return (
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
          This draft has low confidence ({Math.round(confidence * 100)}%).
          Please review and edit before approving. Threshold is {Math.round(CONFIDENCE_THRESHOLD * 100)}%.
        </p>
      </div>
    </div>
  );
}

/**
 * DraftPreview component
 * Read-only view of a generated draft with highlighted context references,
 * confidence score badge, and context source attribution.
 *
 * Implements draft preview display for DraftGenerationService (SCRUM-6530)
 * Implements confidence score display for FR-008 (SCRUM-6535)
 *
 * Features:
 * - Read-only draft content display with formatted text
 * - Confidence score badge with color coding and threshold indicator
 * - Confidence meter with explanation text
 * - Low-confidence warning banner for drafts requiring human review
 * - Context source attribution (properties, FAQs, keywords, template)
 * - Suggested next steps display
 * - Draft status indicator (generated, edited, approved, rejected)
 * - Template reference information
 * - Generate and regenerate draft actions
 * - Loading and empty states
 * - Responsive layout
 * - ARIA labels for accessibility
 *
 * @param {object} props
 * @param {object} [props.draft] - Draft object (overrides DraftContext current draft)
 * @param {boolean} [props.showConfidence=true] - Whether to show the confidence meter
 * @param {boolean} [props.showConfidenceBadge=true] - Whether to show the confidence badge in the header
 * @param {boolean} [props.showContextAttribution=true] - Whether to show context source attribution
 * @param {boolean} [props.showNextSteps=true] - Whether to show suggested next steps
 * @param {boolean} [props.showTemplateInfo=true] - Whether to show template reference info
 * @param {boolean} [props.showLowConfidenceWarning=true] - Whether to show the low-confidence warning banner
 * @param {boolean} [props.showGenerateButton=true] - Whether to show the generate/regenerate button
 * @param {boolean} [props.showStatus=true] - Whether to show the draft status badge
 * @param {boolean} [props.expandContextByDefault=false] - Whether to expand context attribution by default
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the preview
 * @param {Function} [props.onGenerate] - Callback when generate draft is clicked
 * @param {Function} [props.onRegenerate] - Callback when regenerate draft is clicked
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <DraftPreview />
 *
 * @example
 * <DraftPreview
 *   draft={draftObject}
 *   showConfidence
 *   showContextAttribution
 *   showNextSteps
 * />
 *
 * @example
 * <DraftPreview
 *   size="sm"
 *   showGenerateButton={false}
 *   showContextAttribution={false}
 * />
 */
export function DraftPreview({
  draft: draftProp,
  showConfidence = true,
  showConfidenceBadge = true,
  showContextAttribution = true,
  showNextSteps = true,
  showTemplateInfo = true,
  showLowConfidenceWarning = true,
  showGenerateButton = true,
  showStatus = true,
  expandContextByDefault = false,
  size = 'md',
  onGenerate,
  onRegenerate,
  className = '',
}) {
  const {
    currentDraft,
    loading: draftLoading,
    error: draftError,
    confidenceThreshold,
    generate,
    regenerate,
    clearError,
  } = useDraft();

  const {
    selectedDM,
    loading: dmLoading,
  } = useDM();

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // Determine draft source: prop override or DraftContext
  const draft = draftProp || currentDraft;
  const dm = selectedDM?.dm || null;
  const context = selectedDM?.context || null;

  const isLoadingDM = dmLoading.selected || dmLoading.initializing;
  const isGenerating = draftLoading.generating;
  const isLoadingDraft = draftLoading.loading;

  const requiresReview = draft
    ? typeof draft.confidence === 'number' && draft.confidence < confidenceThreshold
    : false;

  const isLowConfidenceUnreviewed = requiresReview
    && draft?.status !== 'edited'
    && draft?.status !== 'approved';

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
    await generate(dm, { context });
  }, [dm, context, generate, onGenerate, clearError]);

  /**
   * Handles regenerating a draft for the current DM
   */
  const handleRegenerate = useCallback(async () => {
    if (!dm) return;

    if (typeof onRegenerate === 'function') {
      onRegenerate(dm);
      return;
    }

    clearError();
    await regenerate(dm, { context });
  }, [dm, context, regenerate, onRegenerate, clearError]);

  /**
   * Returns the display label for a draft status
   *
   * @param {string} status - Draft status string
   * @returns {string} Display label
   */
  function getDraftStatusLabel(status) {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
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

  // Generating draft state
  if (isGenerating) {
    return (
      <div className={containerClasses} role="region" aria-label="Draft Preview">
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

  // Loading existing draft state
  if (isLoadingDraft && !draft) {
    return (
      <div className={containerClasses} role="region" aria-label="Draft Preview">
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

  // No draft yet — show generate button
  if (!draft) {
    return (
      <div className={containerClasses} role="region" aria-label="Draft Preview">
        <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
          Draft Response
        </h4>
        {showGenerateButton && dm ? (
          <EmptyState
            title="No draft yet"
            description="Generate an AI-powered draft response for this DM."
            size="sm"
            showIcon={false}
            actionLabel="Generate Draft"
            onAction={handleGenerate}
            actionVariant="primary"
          />
        ) : (
          <EmptyState
            title="No draft available"
            description={dm ? 'No draft has been generated for this DM.' : 'Select a DM to view or generate a draft.'}
            size="sm"
            showIcon={false}
          />
        )}
      </div>
    );
  }

  // Draft status style
  const statusStyle = DRAFT_STATUS_STYLES[(draft.status || '').toLowerCase()] || 'bg-neutral-100 text-neutral-700';

  return (
    <div className={containerClasses} role="region" aria-label="Draft Preview">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
            Draft Response
          </h4>
          {showStatus && draft.status && (
            <span className={`badge ${statusStyle} text-xs`}>
              {getDraftStatusLabel(draft.status)}
            </span>
          )}
          {showConfidenceBadge && (
            <ConfidenceBadge confidence={draft.confidence} sizeClass={sizeClass} />
          )}
        </div>

        {/* Regenerate button */}
        {showGenerateButton && dm && (draft.status === 'generated' || draft.status === 'edited') && (
          <Tooltip content="Regenerate draft with fresh context">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRegenerate}
              loading={isGenerating}
              ariaLabel="Regenerate draft"
              disabled={isGenerating}
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
      {showLowConfidenceWarning && isLowConfidenceUnreviewed && (
        <LowConfidenceWarning
          confidence={draft.confidence}
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

      {/* Draft content (read-only) */}
      <div className="space-y-1.5">
        <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
          Draft Preview
        </span>
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
          <p className={`text-neutral-700 leading-relaxed whitespace-pre-wrap ${sizeClass.body}`}>
            {draft.content || 'No content available.'}
          </p>
        </div>
      </div>

      {/* Suggested next steps */}
      {showNextSteps && draft.suggestedNextSteps && draft.suggestedNextSteps.length > 0 && (
        <SuggestedSteps
          steps={draft.suggestedNextSteps}
          sizeClass={sizeClass}
        />
      )}

      {/* Context source attribution */}
      {showContextAttribution && draft.contextReferences && (
        <ContextAttribution
          contextReferences={draft.contextReferences}
          sizeClass={sizeClass}
          expanded={expandContextByDefault}
        />
      )}

      {/* Template reference (simple inline) */}
      {showTemplateInfo && !showContextAttribution && draft.contextReferences?.templateName && (
        <div className={`text-neutral-400 ${sizeClass.meta}`}>
          Template: {draft.contextReferences.templateName}
          {draft.contextReferences.templateCategory && (
            <span> ({draft.contextReferences.templateCategory})</span>
          )}
        </div>
      )}

      {/* Approved/Rejected status indicators */}
      {draft.status === 'approved' && (
        <div className="flex items-center gap-1.5 pt-1">
          <svg
            className="h-4 w-4 text-brand-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className={`text-brand-700 font-medium ${sizeClass.meta}`}>
            Draft approved and sent
          </span>
        </div>
      )}

      {draft.status === 'rejected' && (
        <div className="flex items-center gap-1.5 pt-1">
          <svg
            className="h-4 w-4 text-red-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className={`text-red-600 font-medium ${sizeClass.meta}`}>
            Draft rejected
          </span>
        </div>
      )}

      {/* Draft metadata footer */}
      {draft.createdAt && (
        <div className={`text-neutral-400 ${sizeClass.meta} pt-1 border-t border-neutral-100`}>
          Generated {formatTimestamp(draft.createdAt)}
          {draft.updatedAt && draft.updatedAt !== draft.createdAt && (
            <span> · Updated {formatTimestamp(draft.updatedAt)}</span>
          )}
          {draft.editHistory && draft.editHistory.length > 0 && (
            <span> · {draft.editHistory.length} edit{draft.editHistory.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default DraftPreview;