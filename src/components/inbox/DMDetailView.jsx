'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDM } from '@/contexts/DMContext';
import { useDraft } from '@/contexts/DraftContext';
import StatusBadge from '@/components/common/StatusBadge';
import PlatformIcon from '@/components/common/PlatformIcon';
import ConfidenceMeter from '@/components/common/ConfidenceMeter';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import Tooltip from '@/components/common/Tooltip';
import { formatTimestamp, formatCurrency, truncateText } from '@/utils/formatters';
import { STATUS, CONFIDENCE_THRESHOLD } from '@/utils/constants';

/**
 * Size variant mappings for the detail view
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
 * Sender avatar placeholder component
 * Renders the sender's initials in a colored circle
 *
 * @param {object} props
 * @param {string} props.name - Sender display name
 * @param {string} props.platform - Platform identifier
 * @returns {React.ReactElement}
 */
function SenderAvatar({ name, platform }) {
  const initials = (name || '')
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const bgColor = platform === 'Instagram' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700';

  return (
    <div
      className={`flex items-center justify-center h-10 w-10 rounded-full font-semibold text-sm shrink-0 ${bgColor}`}
      aria-hidden="true"
    >
      {initials || '?'}
    </div>
  );
}

/**
 * Property card component for displaying matched property context
 *
 * @param {object} props
 * @param {object} props.property - Property object from knowledge base
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function PropertyCard({ property, sizeClass }) {
  if (!property) return null;

  const availabilityColors = {
    active: 'bg-brand-100 text-brand-800',
    pending: 'bg-accent-100 text-accent-800',
    withdrawn: 'bg-red-100 text-red-800',
  };

  const availabilityClass = availabilityColors[(property.availability || '').toLowerCase()] || 'bg-neutral-100 text-neutral-700';

  return (
    <div className="border border-neutral-200 rounded-xl p-3 space-y-2 hover:border-neutral-300 transition-colors">
      {/* Property name and availability */}
      <div className="flex items-start justify-between gap-2">
        <h5 className={`font-semibold text-neutral-900 leading-snug ${sizeClass.heading}`}>
          {property.name || 'Unknown Property'}
        </h5>
        {property.availability && (
          <span className={`badge text-xs shrink-0 ${availabilityClass}`}>
            {property.availability}
          </span>
        )}
      </div>

      {/* Address */}
      {property.address && (
        <p className={`text-neutral-500 ${sizeClass.meta}`}>
          {property.address}
        </p>
      )}

      {/* Key details row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {property.listPrice && (
          <span className={`font-semibold text-neutral-900 ${sizeClass.body}`}>
            {formatCurrency(property.listPrice, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        )}
        {property.bedrooms !== undefined && (
          <span className={`text-neutral-600 ${sizeClass.meta}`}>
            {property.bedrooms} bed
          </span>
        )}
        {property.bathrooms !== undefined && (
          <span className={`text-neutral-600 ${sizeClass.meta}`}>
            {property.bathrooms} bath
          </span>
        )}
        {property.squareFeet && (
          <span className={`text-neutral-600 ${sizeClass.meta}`}>
            {property.squareFeet.toLocaleString()} sq ft
          </span>
        )}
      </div>

      {/* Features */}
      {property.features && property.features.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {property.features.slice(0, 4).map((feature, idx) => (
            <span
              key={idx}
              className="badge badge-neutral text-xs"
            >
              {feature}
            </span>
          ))}
          {property.features.length > 4 && (
            <span className={`text-neutral-400 ${sizeClass.meta}`}>
              +{property.features.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Relevance score */}
      {property.relevance !== undefined && (
        <div className="flex items-center gap-1.5">
          <span className={`text-neutral-400 ${sizeClass.meta}`}>Match:</span>
          <div className="flex-1 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.round(property.relevance * 100)}%` }}
              aria-hidden="true"
            />
          </div>
          <span className={`text-neutral-500 font-medium ${sizeClass.meta}`}>
            {Math.round(property.relevance * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * FAQ card component for displaying matched FAQ context
 *
 * @param {object} props
 * @param {object} props.faq - FAQ object from knowledge base
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function FAQCard({ faq, sizeClass }) {
  const [expanded, setExpanded] = useState(false);

  if (!faq) return null;

  return (
    <div className="border border-neutral-200 rounded-xl p-3 space-y-1.5 hover:border-neutral-300 transition-colors">
      {/* Question */}
      <button
        type="button"
        className="flex items-start justify-between gap-2 w-full text-left"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <h5 className={`font-medium text-neutral-800 leading-snug ${sizeClass.heading}`}>
          {faq.question || 'Unknown Question'}
        </h5>
        <svg
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
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

      {/* Category badge and relevance */}
      <div className="flex items-center gap-2">
        {faq.category && (
          <span className="badge badge-neutral text-xs">
            {faq.category}
          </span>
        )}
        {faq.relevance !== undefined && (
          <span className={`text-neutral-400 ${sizeClass.meta}`}>
            {Math.round(faq.relevance * 100)}% match
          </span>
        )}
      </div>

      {/* Answer (expandable) */}
      {expanded && faq.answer && (
        <p className={`text-neutral-600 leading-relaxed pt-1 border-t border-neutral-100 ${sizeClass.body}`}>
          {faq.answer}
        </p>
      )}
    </div>
  );
}

/**
 * Context panel component for displaying retrieved knowledge base context
 *
 * @param {object} props
 * @param {object} props.context - Context object with properties, faqs, keywords
 * @param {object} props.sizeClass - Size variant classes
 * @param {boolean} props.loading - Whether context is loading
 * @returns {React.ReactElement}
 */
function ContextPanel({ context, sizeClass, loading }) {
  const hasProperties = context?.properties && context.properties.length > 0;
  const hasFAQs = context?.faqs && context.faqs.length > 0;
  const hasKeywords = context?.keywords && context.keywords.length > 0;
  const hasContext = hasProperties || hasFAQs;

  if (loading) {
    return (
      <div className="space-y-3">
        <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
          Knowledge Base Context
        </h4>
        <LoadingSpinner
          center
          size="sm"
          label="Retrieving context..."
          showLabel
        />
      </div>
    );
  }

  if (!hasContext) {
    return (
      <div className="space-y-3">
        <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
          Knowledge Base Context
        </h4>
        <EmptyState
          title="No context found"
          description="No matching properties or FAQs were found for this message."
          size="sm"
          showIcon={false}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
        Knowledge Base Context
      </h4>

      {/* Keywords */}
      {hasKeywords && (
        <div className="space-y-1.5">
          <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
            Extracted Keywords
          </span>
          <div className="flex flex-wrap gap-1">
            {context.keywords.slice(0, 10).map((keyword, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600"
              >
                {keyword}
              </span>
            ))}
            {context.keywords.length > 10 && (
              <span className={`text-neutral-400 ${sizeClass.meta}`}>
                +{context.keywords.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Matched Properties */}
      {hasProperties && (
        <div className="space-y-2">
          <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
            Matched Properties ({context.properties.length})
          </span>
          <div className="space-y-2">
            {context.properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                sizeClass={sizeClass}
              />
            ))}
          </div>
        </div>
      )}

      {/* Matched FAQs */}
      {hasFAQs && (
        <div className="space-y-2">
          <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
            Relevant FAQs ({context.faqs.length})
          </span>
          <div className="space-y-2">
            {context.faqs.map((faq) => (
              <FAQCard
                key={faq.id}
                faq={faq}
                sizeClass={sizeClass}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Metadata row component for displaying a label-value pair
 *
 * @param {object} props
 * @param {string} props.label - Metadata label
 * @param {React.ReactNode} props.value - Metadata value
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function MetadataRow({ label, value, sizeClass }) {
  if (value === null || value === undefined || value === '') return null;

  return (
    <div className="flex items-start gap-2">
      <span className={`font-medium text-neutral-500 shrink-0 min-w-20 ${sizeClass.label}`}>
        {label}
      </span>
      <span className={`text-neutral-700 ${sizeClass.body}`}>
        {value}
      </span>
    </div>
  );
}

/**
 * Draft preview section component
 *
 * @param {object} props
 * @param {object} props.draft - Draft object
 * @param {object} props.sizeClass - Size variant classes
 * @param {boolean} props.loading - Whether draft is loading
 * @param {Function} props.onGenerate - Callback to generate a draft
 * @param {Function} props.onRegenerate - Callback to regenerate a draft
 * @returns {React.ReactElement}
 */
function DraftPreview({ draft, sizeClass, loading, onGenerate, onRegenerate }) {
  if (loading) {
    return (
      <div className="space-y-3">
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

  if (!draft) {
    return (
      <div className="space-y-3">
        <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
          Draft Response
        </h4>
        <EmptyState
          title="No draft yet"
          description="Generate a draft response for this DM."
          size="sm"
          showIcon={false}
          actionLabel="Generate Draft"
          onAction={onGenerate}
          actionVariant="primary"
        />
      </div>
    );
  }

  const requiresReview = typeof draft.confidence === 'number' && draft.confidence < CONFIDENCE_THRESHOLD;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
          Draft Response
        </h4>
        <div className="flex items-center gap-2">
          <span className={`badge ${draft.status === 'approved' ? 'badge-success' : draft.status === 'rejected' ? 'bg-red-100 text-red-800' : 'badge-warning'} text-xs`}>
            {draft.status || 'generated'}
          </span>
          {onRegenerate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              ariaLabel="Regenerate draft"
            >
              <svg
                className="h-3.5 w-3.5"
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
          )}
        </div>
      </div>

      {/* Confidence meter */}
      {draft.confidence !== undefined && draft.confidence !== null && (
        <ConfidenceMeter
          score={draft.confidence}
          explanation={draft.confidenceExplanation}
          size="sm"
          showThresholdIndicator
        />
      )}

      {/* Review required warning */}
      {requiresReview && draft.status !== 'edited' && draft.status !== 'approved' && (
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
          <p className={`text-accent-800 ${sizeClass.meta}`}>
            Low-confidence draft — human review required before sending.
          </p>
        </div>
      )}

      {/* Draft content */}
      <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
        <p className={`text-neutral-700 leading-relaxed whitespace-pre-wrap ${sizeClass.body}`}>
          {draft.content}
        </p>
      </div>

      {/* Suggested next steps */}
      {draft.suggestedNextSteps && draft.suggestedNextSteps.length > 0 && (
        <div className="space-y-1.5">
          <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
            Suggested Next Steps
          </span>
          <ul className="space-y-1">
            {draft.suggestedNextSteps.map((step, idx) => (
              <li
                key={idx}
                className={`flex items-start gap-1.5 text-neutral-600 ${sizeClass.meta}`}
              >
                <span className="text-brand-500 shrink-0 mt-0.5">•</span>
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Template reference */}
      {draft.contextReferences?.templateName && (
        <div className={`text-neutral-400 ${sizeClass.meta}`}>
          Template: {draft.contextReferences.templateName}
          {draft.contextReferences.templateCategory && (
            <span> ({draft.contextReferences.templateCategory})</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * DMDetailView component
 * Displays full DM content, sender details, conversation thread, and context panel.
 * Shows retrieved knowledge base context alongside the message.
 *
 * Implements DM detail display for DMInboxService (SCRUM-6529)
 * Implements context display for ContextRetrievalService (SCRUM-6531)
 *
 * Features:
 * - Full DM message content display
 * - Sender information with avatar, name, handle, and platform icon
 * - DM metadata display (inquiry type, sentiment, lead score, consent status)
 * - Status badge with timestamp
 * - Knowledge base context panel (matched properties and FAQs)
 * - Extracted keywords display
 * - Draft preview with confidence meter and suggested next steps
 * - Generate/regenerate draft actions
 * - Loading and empty states
 * - Responsive layout with scrollable sections
 * - ARIA labels for accessibility
 *
 * @param {object} props
 * @param {string} [props.dmId] - DM identifier to display (if not using context)
 * @param {boolean} [props.showContext=true] - Whether to show the knowledge base context panel
 * @param {boolean} [props.showDraft=true] - Whether to show the draft preview section
 * @param {boolean} [props.showMetadata=true] - Whether to show DM metadata details
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the detail view
 * @param {Function} [props.onGenerateDraft] - Callback when generate draft is clicked
 * @param {Function} [props.onRegenerateDraft] - Callback when regenerate draft is clicked
 * @param {Function} [props.onBack] - Callback when back button is clicked (mobile)
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <DMDetailView showContext showDraft />
 *
 * @example
 * <DMDetailView
 *   dmId="dm-001"
 *   showContext
 *   showDraft
 *   onGenerateDraft={handleGenerate}
 *   onBack={handleBack}
 * />
 */
export function DMDetailView({
  dmId,
  showContext = true,
  showDraft = true,
  showMetadata = true,
  size = 'md',
  onGenerateDraft,
  onRegenerateDraft,
  onBack,
  className = '',
}) {
  const {
    selectedDM,
    loading: dmLoading,
    error: dmError,
    selectDM,
    clearError: clearDMError,
  } = useDM();

  const {
    currentDraft,
    loading: draftLoading,
    generate,
    regenerate,
    loadDraft,
    clearDraft,
  } = useDraft();

  const mountedRef = useRef(true);
  const [activeTab, setActiveTab] = useState('message');

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // Determine the DM and context to display
  const dm = selectedDM?.dm || null;
  const context = selectedDM?.context || null;

  // Load DM if dmId prop is provided and differs from selected
  useEffect(() => {
    if (dmId && (!dm || dm.id !== dmId)) {
      selectDM(dmId).catch(() => {});
    }
  }, [dmId, dm, selectDM]);

  // Load draft when DM changes
  useEffect(() => {
    if (dm && dm.id) {
      loadDraft(dm.id).catch(() => {});
    } else {
      clearDraft();
    }
  }, [dm, loadDraft, clearDraft]);

  /**
   * Handles generate draft action
   */
  const handleGenerateDraft = useCallback(async () => {
    if (!dm) return;

    if (typeof onGenerateDraft === 'function') {
      onGenerateDraft(dm);
      return;
    }

    await generate(dm, { context });
  }, [dm, context, generate, onGenerateDraft]);

  /**
   * Handles regenerate draft action
   */
  const handleRegenerateDraft = useCallback(async () => {
    if (!dm) return;

    if (typeof onRegenerateDraft === 'function') {
      onRegenerateDraft(dm);
      return;
    }

    await regenerate(dm, { context });
  }, [dm, context, regenerate, onRegenerateDraft]);

  const isLoadingDM = dmLoading.selected || dmLoading.initializing;
  const isLoadingDraft = draftLoading.generating || draftLoading.loading;

  const containerClasses = [
    'flex flex-col h-full bg-white rounded-2xl shadow-card overflow-hidden',
    sizeClass.container,
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Empty state when no DM is selected
  if (!dm && !isLoadingDM) {
    return (
      <div className={containerClasses} role="region" aria-label="DM Detail">
        <EmptyState
          title="No DM selected"
          description="Select a DM from the inbox to view its details and context."
          size={size}
        />
      </div>
    );
  }

  // Loading state
  if (isLoadingDM && !dm) {
    return (
      <div className={containerClasses} role="region" aria-label="DM Detail">
        <LoadingSpinner
          center
          size="lg"
          label="Loading DM details..."
          showLabel
        />
      </div>
    );
  }

  // Extract DM fields
  const senderName = dm?.sender?.name || 'Unknown Sender';
  const senderHandle = dm?.sender?.handle || '';
  const platform = dm?.sender?.platform || '';
  const timestamp = dm?.timestamp || '';
  const content = dm?.content || '';
  const status = dm?.status || STATUS.NEW;
  const inquiryType = dm?.metadata?.inquiryType || null;
  const sentiment = dm?.metadata?.sentiment || null;
  const leadScore = dm?.metadata?.leadScore || null;
  const confidence = dm?.metadata?.confidence || null;
  const hasConsent = dm?.metadata?.hasConsent || false;
  const consentDate = dm?.metadata?.consentDate || null;
  const consentSource = dm?.metadata?.consentSource || null;

  const isEscalated = status === STATUS.ESCALATED;
  const isNew = status === STATUS.NEW;

  return (
    <div className={containerClasses} role="region" aria-label={`DM Detail: ${senderName}`}>
      {/* Header */}
      <div className={`flex items-center justify-between border-b border-neutral-200 ${sizeClass.padding}`}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Back button (mobile) */}
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              ariaLabel="Back to inbox"
              className="shrink-0 -ml-1 sm:hidden"
            >
              <svg
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
          )}

          {/* Sender avatar */}
          <SenderAvatar name={senderName} platform={platform} />

          {/* Sender info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold text-neutral-900 truncate ${sizeClass.heading}`}>
                {senderName}
              </h3>
              <PlatformIcon platform={platform} size="sm" />
            </div>
            <div className="flex items-center gap-2">
              {senderHandle && (
                <span className={`text-neutral-500 truncate ${sizeClass.meta}`}>
                  {senderHandle}
                </span>
              )}
              <span className={`text-neutral-400 ${sizeClass.meta}`}>
                {formatTimestamp(timestamp)}
              </span>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={status} size={size === 'lg' ? 'md' : 'sm'} />
        </div>
      </div>

      {/* Error state */}
      {dmError && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-200">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-red-700">{dmError}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearDMError}
              ariaLabel="Dismiss error"
              className="text-red-600 hover:text-red-700 shrink-0"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Tab navigation for mobile */}
      <div className="flex items-center border-b border-neutral-200 px-4 sm:hidden">
        <button
          type="button"
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'message'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
          onClick={() => setActiveTab('message')}
        >
          Message
        </button>
        {showContext && (
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'context'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
            onClick={() => setActiveTab('context')}
          >
            Context
          </button>
        )}
        {showDraft && (
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'draft'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
            onClick={() => setActiveTab('draft')}
          >
            Draft
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col sm:flex-row h-full">
          {/* Left column: Message and Draft */}
          <div
            className={`flex-1 overflow-y-auto ${sizeClass.padding} space-y-5 ${
              activeTab !== 'message' && activeTab !== 'draft' ? 'hidden sm:block' : ''
            }`}
          >
            {/* Escalation banner */}
            {isEscalated && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                <svg
                  className="h-5 w-5 shrink-0 text-red-500 mt-0.5"
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
                  <p className={`font-semibold text-red-800 ${sizeClass.body}`}>
                    Escalated
                  </p>
                  <p className={`text-red-700 ${sizeClass.meta}`}>
                    This DM has been escalated and requires immediate attention.
                  </p>
                </div>
              </div>
            )}

            {/* DM Message content */}
            <div className="space-y-2" role="article" aria-label="DM message">
              <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
                Message
              </h4>
              <div className={`p-4 bg-neutral-50 border border-neutral-200 rounded-xl ${isNew ? 'border-blue-200 bg-blue-50/30' : ''}`}>
                <p className={`text-neutral-800 leading-relaxed whitespace-pre-wrap ${sizeClass.body}`}>
                  {content}
                </p>
              </div>
            </div>

            {/* Metadata */}
            {showMetadata && (
              <div className="space-y-2">
                <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
                  Details
                </h4>
                <div className="space-y-1.5 p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                  <MetadataRow
                    label="Platform"
                    value={
                      platform ? (
                        <PlatformIcon platform={platform} size="sm" showLabel />
                      ) : null
                    }
                    sizeClass={sizeClass}
                  />
                  <MetadataRow
                    label="Received"
                    value={formatTimestamp(timestamp, { relative: false, includeTime: true })}
                    sizeClass={sizeClass}
                  />
                  {inquiryType && (
                    <MetadataRow
                      label="Inquiry"
                      value={
                        <span className="badge badge-neutral text-xs capitalize">
                          {inquiryType}
                        </span>
                      }
                      sizeClass={sizeClass}
                    />
                  )}
                  {sentiment && (
                    <MetadataRow
                      label="Sentiment"
                      value={
                        <span className={`badge text-xs capitalize ${
                          sentiment === 'positive' ? 'badge-success' :
                          sentiment === 'negative' ? 'bg-red-100 text-red-800' :
                          'badge-neutral'
                        }`}>
                          {sentiment}
                        </span>
                      }
                      sizeClass={sizeClass}
                    />
                  )}
                  {leadScore !== null && leadScore !== undefined && (
                    <MetadataRow
                      label="Lead Score"
                      value={
                        <Tooltip content={`Lead score: ${leadScore}/100`}>
                          <span className={`font-semibold ${
                            leadScore >= 80 ? 'text-brand-700' :
                            leadScore >= 50 ? 'text-accent-700' :
                            'text-neutral-600'
                          }`}>
                            {leadScore}
                          </span>
                        </Tooltip>
                      }
                      sizeClass={sizeClass}
                    />
                  )}
                  {confidence !== null && confidence !== undefined && (
                    <MetadataRow
                      label="Confidence"
                      value={`${Math.round(confidence * 100)}%`}
                      sizeClass={sizeClass}
                    />
                  )}
                  <MetadataRow
                    label="Consent"
                    value={
                      <span className={`badge text-xs ${hasConsent ? 'badge-success' : 'bg-red-100 text-red-800'}`}>
                        {hasConsent ? 'Verified' : 'Not verified'}
                      </span>
                    }
                    sizeClass={sizeClass}
                  />
                  {hasConsent && consentDate && (
                    <MetadataRow
                      label="Consent Date"
                      value={formatTimestamp(consentDate, { relative: false, includeTime: false })}
                      sizeClass={sizeClass}
                    />
                  )}
                  {hasConsent && consentSource && (
                    <MetadataRow
                      label="Source"
                      value={
                        <span className="badge badge-neutral text-xs capitalize">
                          {consentSource}
                        </span>
                      }
                      sizeClass={sizeClass}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Draft preview (visible on desktop always, on mobile only when draft tab active) */}
            {showDraft && (
              <div className={`${activeTab !== 'draft' && activeTab !== 'message' ? 'hidden sm:block' : ''}`}>
                <DraftPreview
                  draft={currentDraft}
                  sizeClass={sizeClass}
                  loading={isLoadingDraft}
                  onGenerate={handleGenerateDraft}
                  onRegenerate={handleRegenerateDraft}
                />
              </div>
            )}
          </div>

          {/* Right column: Context panel (desktop sidebar, mobile tab) */}
          {showContext && (
            <div
              className={`sm:w-80 sm:min-w-72 sm:max-w-96 sm:border-l border-neutral-200 overflow-y-auto ${sizeClass.padding} ${
                activeTab !== 'context' ? 'hidden sm:block' : ''
              }`}
            >
              <ContextPanel
                context={context}
                sizeClass={sizeClass}
                loading={isLoadingDM}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DMDetailView;