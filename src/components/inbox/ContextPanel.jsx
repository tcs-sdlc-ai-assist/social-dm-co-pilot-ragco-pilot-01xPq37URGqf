'use client';

import { useState, useCallback } from 'react';
import { useDM } from '@/contexts/DMContext';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/common/Button';
import Tooltip from '@/components/common/Tooltip';
import { formatCurrency } from '@/utils/formatters';

/**
 * Size variant mappings for the context panel
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
 * Relevance bar color based on score
 *
 * @param {number} relevance - Relevance score (0-1)
 * @returns {string} Tailwind color class for the bar
 */
function getRelevanceBarColor(relevance) {
  if (typeof relevance !== 'number' || isNaN(relevance)) return 'bg-neutral-300';
  if (relevance >= 0.7) return 'bg-brand-500';
  if (relevance >= 0.4) return 'bg-accent-500';
  return 'bg-neutral-400';
}

/**
 * Relevance text color based on score
 *
 * @param {number} relevance - Relevance score (0-1)
 * @returns {string} Tailwind text color class
 */
function getRelevanceTextColor(relevance) {
  if (typeof relevance !== 'number' || isNaN(relevance)) return 'text-neutral-500';
  if (relevance >= 0.7) return 'text-brand-700';
  if (relevance >= 0.4) return 'text-accent-700';
  return 'text-neutral-500';
}

/**
 * Relevance label based on score
 *
 * @param {number} relevance - Relevance score (0-1)
 * @returns {string} Human-readable relevance label
 */
function getRelevanceLabel(relevance) {
  if (typeof relevance !== 'number' || isNaN(relevance)) return 'Unknown';
  if (relevance >= 0.7) return 'High';
  if (relevance >= 0.4) return 'Moderate';
  return 'Low';
}

/**
 * Relevance score display component
 *
 * @param {object} props
 * @param {number} props.relevance - Relevance score (0-1)
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function RelevanceScore({ relevance, sizeClass }) {
  if (relevance === undefined || relevance === null) return null;

  const percentage = Math.round(relevance * 100);
  const barColor = getRelevanceBarColor(relevance);
  const textColor = getRelevanceTextColor(relevance);
  const label = getRelevanceLabel(relevance);

  return (
    <Tooltip content={`Relevance: ${label} (${percentage}% match to DM content)`}>
      <div className="flex items-center gap-1.5">
        <span className={`${sizeClass.meta} text-neutral-400`}>Match:</span>
        <div className="flex-1 h-1.5 bg-neutral-200 rounded-full overflow-hidden min-w-12">
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-300`}
            style={{ width: `${percentage}%` }}
            aria-hidden="true"
          />
        </div>
        <span className={`${sizeClass.meta} font-medium ${textColor}`}>
          {percentage}%
        </span>
      </div>
    </Tooltip>
  );
}

/**
 * Property context card component
 * Displays a matched property from the knowledge base with key details and relevance score
 *
 * @param {object} props
 * @param {object} props.property - Property object from knowledge base
 * @param {object} props.sizeClass - Size variant classes
 * @param {Function} [props.onInsert] - Callback when insert button is clicked (receives property)
 * @param {boolean} [props.showInsert=false] - Whether to show the insert button
 * @returns {React.ReactElement|null}
 */
function PropertyContextCard({ property, sizeClass, onInsert, showInsert = false }) {
  if (!property) return null;

  const availabilityColors = {
    active: 'bg-brand-100 text-brand-800',
    pending: 'bg-accent-100 text-accent-800',
    withdrawn: 'bg-red-100 text-red-800',
  };

  const availabilityClass = availabilityColors[(property.availability || '').toLowerCase()] || 'bg-neutral-100 text-neutral-700';

  /**
   * Handles insert button click
   */
  function handleInsert() {
    if (typeof onInsert === 'function') {
      onInsert(property);
    }
  }

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
        {property.type && (
          <span className={`text-neutral-500 ${sizeClass.meta} capitalize`}>
            {property.type}
          </span>
        )}
      </div>

      {/* Features */}
      {property.features && property.features.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {property.features.slice(0, 5).map((feature, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600"
            >
              {feature}
            </span>
          ))}
          {property.features.length > 5 && (
            <span className={`text-neutral-400 ${sizeClass.meta}`}>
              +{property.features.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Description excerpt */}
      {property.description && (
        <p className={`text-neutral-500 leading-snug line-clamp-2 ${sizeClass.meta}`}>
          {property.description}
        </p>
      )}

      {/* Relevance score and insert action */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex-1">
          <RelevanceScore relevance={property.relevance} sizeClass={sizeClass} />
        </div>

        {showInsert && onInsert && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleInsert}
            ariaLabel={`Insert ${property.name || 'property'} details into draft`}
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
        )}
      </div>
    </div>
  );
}

/**
 * FAQ context card component
 * Displays a matched FAQ from the knowledge base with expandable answer and relevance score
 *
 * @param {object} props
 * @param {object} props.faq - FAQ object from knowledge base
 * @param {object} props.sizeClass - Size variant classes
 * @param {Function} [props.onInsert] - Callback when insert button is clicked (receives faq)
 * @param {boolean} [props.showInsert=false] - Whether to show the insert button
 * @returns {React.ReactElement|null}
 */
function FAQContextCard({ faq, sizeClass, onInsert, showInsert = false }) {
  const [expanded, setExpanded] = useState(false);

  if (!faq) return null;

  /**
   * Handles insert button click
   */
  function handleInsert() {
    if (typeof onInsert === 'function') {
      onInsert(faq);
    }
  }

  return (
    <div className="border border-neutral-200 rounded-xl p-3 space-y-1.5 hover:border-neutral-300 transition-colors">
      {/* Question with expand toggle */}
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
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 capitalize">
            {faq.category}
          </span>
        )}
        {faq.relevance !== undefined && (
          <span className={`${getRelevanceTextColor(faq.relevance)} ${sizeClass.meta}`}>
            {Math.round(faq.relevance * 100)}% match
          </span>
        )}
      </div>

      {/* Answer (expandable) */}
      {expanded && faq.answer && (
        <div className="pt-1.5 border-t border-neutral-100 space-y-2">
          <p className={`text-neutral-600 leading-relaxed ${sizeClass.body}`}>
            {faq.answer}
          </p>

          {/* Insert action */}
          {showInsert && onInsert && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleInsert}
                ariaLabel="Insert FAQ answer into draft"
                className="text-brand-600 hover:text-brand-700"
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
                Insert Answer
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Keywords display component
 * Renders extracted keywords as badges
 *
 * @param {object} props
 * @param {string[]} props.keywords - Array of extracted keywords
 * @param {object} props.sizeClass - Size variant classes
 * @param {number} [props.maxDisplay=12] - Maximum number of keywords to display
 * @returns {React.ReactElement|null}
 */
function KeywordsDisplay({ keywords, sizeClass, maxDisplay = 12 }) {
  if (!keywords || keywords.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
        Extracted Keywords
      </span>
      <div className="flex flex-wrap gap-1">
        {keywords.slice(0, maxDisplay).map((keyword, idx) => (
          <span
            key={idx}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600"
          >
            {keyword}
          </span>
        ))}
        {keywords.length > maxDisplay && (
          <span className={`text-neutral-400 ${sizeClass.meta}`}>
            +{keywords.length - maxDisplay} more
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Context summary header component
 * Displays a summary of matched context items
 *
 * @param {object} props
 * @param {number} props.propertyCount - Number of matched properties
 * @param {number} props.faqCount - Number of matched FAQs
 * @param {number} props.keywordCount - Number of extracted keywords
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function ContextSummary({ propertyCount, faqCount, keywordCount, sizeClass }) {
  const parts = [];

  if (propertyCount > 0) {
    parts.push(`${propertyCount} propert${propertyCount === 1 ? 'y' : 'ies'}`);
  }
  if (faqCount > 0) {
    parts.push(`${faqCount} FAQ${faqCount === 1 ? '' : 's'}`);
  }
  if (keywordCount > 0) {
    parts.push(`${keywordCount} keyword${keywordCount === 1 ? '' : 's'}`);
  }

  if (parts.length === 0) return null;

  return (
    <p className={`text-neutral-400 ${sizeClass.meta}`}>
      Found {parts.join(', ')}
    </p>
  );
}

/**
 * ContextPanel component
 * Displays relevant property info and FAQ entries retrieved from the knowledge base
 * for the selected DM. Shows relevance scores and allows insertion into draft.
 *
 * Implements context display for ContextRetrievalService (SCRUM-6531)
 *
 * Features:
 * - Matched properties display with key details, features, and relevance scores
 * - Matched FAQs display with expandable answers and category badges
 * - Extracted keywords display
 * - Context summary with counts
 * - Insert property/FAQ content into draft callback
 * - Loading and empty states
 * - Responsive layout
 * - ARIA labels for accessibility
 *
 * @param {object} props
 * @param {object} [props.context] - Context object with properties, faqs, keywords (overrides DMContext)
 * @param {boolean} [props.loading=false] - Whether context is loading (overrides DMContext)
 * @param {boolean} [props.showKeywords=true] - Whether to show extracted keywords
 * @param {boolean} [props.showInsertActions=false] - Whether to show insert buttons on context items
 * @param {Function} [props.onInsertProperty] - Callback when a property insert button is clicked (receives property)
 * @param {Function} [props.onInsertFAQ] - Callback when a FAQ insert button is clicked (receives faq)
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the panel
 * @param {string} [props.title='Knowledge Base Context'] - Panel title
 * @param {boolean} [props.showTitle=true] - Whether to show the panel title
 * @param {boolean} [props.showSummary=true] - Whether to show the context summary
 * @param {boolean} [props.bordered=false] - Whether to show a border around the panel
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <ContextPanel />
 *
 * @example
 * <ContextPanel
 *   context={customContext}
 *   loading={false}
 *   showInsertActions
 *   onInsertProperty={handleInsertProperty}
 *   onInsertFAQ={handleInsertFAQ}
 * />
 *
 * @example
 * <ContextPanel
 *   size="sm"
 *   showKeywords={false}
 *   bordered
 *   title="Related Context"
 * />
 */
export function ContextPanel({
  context: contextProp,
  loading: loadingProp,
  showKeywords = true,
  showInsertActions = false,
  onInsertProperty,
  onInsertFAQ,
  size = 'md',
  title = 'Knowledge Base Context',
  showTitle = true,
  showSummary = true,
  bordered = false,
  className = '',
}) {
  const {
    selectedDM,
    loading: dmLoading,
  } = useDM();

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // Determine context source: prop override or DMContext
  const context = contextProp || selectedDM?.context || null;
  const isLoading = loadingProp !== undefined ? loadingProp : dmLoading.selected;

  const hasProperties = context?.properties && context.properties.length > 0;
  const hasFAQs = context?.faqs && context.faqs.length > 0;
  const hasKeywords = context?.keywords && context.keywords.length > 0;
  const hasContext = hasProperties || hasFAQs;

  const propertyCount = context?.properties?.length || 0;
  const faqCount = context?.faqs?.length || 0;
  const keywordCount = context?.keywords?.length || 0;

  /**
   * Handles property insert action
   *
   * @param {object} property - Property object to insert
   */
  const handleInsertProperty = useCallback((property) => {
    if (typeof onInsertProperty === 'function') {
      onInsertProperty(property);
    }
  }, [onInsertProperty]);

  /**
   * Handles FAQ insert action
   *
   * @param {object} faq - FAQ object to insert
   */
  const handleInsertFAQ = useCallback((faq) => {
    if (typeof onInsertFAQ === 'function') {
      onInsertFAQ(faq);
    }
  }, [onInsertFAQ]);

  const containerClasses = [
    'space-y-4',
    sizeClass.container,
    bordered ? 'border border-neutral-200 rounded-2xl p-4' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Loading state
  if (isLoading) {
    return (
      <div
        className={containerClasses}
        role="region"
        aria-label="Knowledge Base Context"
      >
        {showTitle && (
          <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
            {title}
          </h4>
        )}
        <LoadingSpinner
          center
          size="sm"
          label="Retrieving context..."
          showLabel
        />
      </div>
    );
  }

  // Empty state — no context available
  if (!hasContext) {
    return (
      <div
        className={containerClasses}
        role="region"
        aria-label="Knowledge Base Context"
      >
        {showTitle && (
          <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
            {title}
          </h4>
        )}
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
    <div
      className={containerClasses}
      role="region"
      aria-label="Knowledge Base Context"
    >
      {/* Title */}
      {showTitle && (
        <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
          {title}
        </h4>
      )}

      {/* Context summary */}
      {showSummary && (
        <ContextSummary
          propertyCount={propertyCount}
          faqCount={faqCount}
          keywordCount={keywordCount}
          sizeClass={sizeClass}
        />
      )}

      {/* Keywords */}
      {showKeywords && hasKeywords && (
        <KeywordsDisplay
          keywords={context.keywords}
          sizeClass={sizeClass}
        />
      )}

      {/* Matched Properties */}
      {hasProperties && (
        <div className="space-y-2">
          <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
            Matched Properties ({propertyCount})
          </span>
          <div className="space-y-2">
            {context.properties.map((property) => (
              <PropertyContextCard
                key={property.id}
                property={property}
                sizeClass={sizeClass}
                onInsert={showInsertActions ? handleInsertProperty : undefined}
                showInsert={showInsertActions}
              />
            ))}
          </div>
        </div>
      )}

      {/* Matched FAQs */}
      {hasFAQs && (
        <div className="space-y-2">
          <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
            Relevant FAQs ({faqCount})
          </span>
          <div className="space-y-2">
            {context.faqs.map((faq) => (
              <FAQContextCard
                key={faq.id}
                faq={faq}
                sizeClass={sizeClass}
                onInsert={showInsertActions ? handleInsertFAQ : undefined}
                showInsert={showInsertActions}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ContextPanel;