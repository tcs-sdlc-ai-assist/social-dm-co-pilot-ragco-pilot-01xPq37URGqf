'use client';

import { formatConfidenceScore } from '@/utils/formatters';
import { CONFIDENCE_THRESHOLD } from '@/utils/constants';

/**
 * Color tier definitions for confidence score visualization
 * Maps score ranges to Tailwind color classes
 */
const COLOR_TIERS = Object.freeze([
  {
    min: 0,
    max: 0.4,
    bar: 'bg-red-500',
    text: 'text-red-700',
    bg: 'bg-red-100',
    label: 'Low',
    description: 'Low confidence — human review strongly recommended before sending.',
  },
  {
    min: 0.4,
    max: CONFIDENCE_THRESHOLD,
    bar: 'bg-accent-500',
    text: 'text-accent-800',
    bg: 'bg-accent-100',
    label: 'Moderate',
    description: 'Moderate confidence — human review recommended before sending.',
  },
  {
    min: CONFIDENCE_THRESHOLD,
    max: 0.9,
    bar: 'bg-brand-500',
    text: 'text-brand-800',
    bg: 'bg-brand-100',
    label: 'Good',
    description: 'Good confidence — draft is likely suitable for sending.',
  },
  {
    min: 0.9,
    max: 1.01,
    bar: 'bg-brand-600',
    text: 'text-brand-900',
    bg: 'bg-brand-100',
    label: 'High',
    description: 'High confidence — strong context match and template fit.',
  },
]);

/**
 * Returns the color tier for a given confidence score
 *
 * @param {number} score - Confidence score (0-1)
 * @returns {object} Color tier object with bar, text, bg, label, and description
 */
function getColorTier(score) {
  if (typeof score !== 'number' || isNaN(score)) {
    return COLOR_TIERS[0];
  }

  const clamped = Math.max(0, Math.min(1, score));

  for (const tier of COLOR_TIERS) {
    if (clamped >= tier.min && clamped < tier.max) {
      return tier;
    }
  }

  return COLOR_TIERS[COLOR_TIERS.length - 1];
}

/**
 * Size variant mappings for the meter
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    container: 'gap-1.5',
    barHeight: 'h-1.5',
    text: 'text-xs',
    label: 'text-xs',
  },
  md: {
    container: 'gap-2',
    barHeight: 'h-2',
    text: 'text-sm',
    label: 'text-xs',
  },
  lg: {
    container: 'gap-2.5',
    barHeight: 'h-3',
    text: 'text-base',
    label: 'text-sm',
  },
});

/**
 * ConfidenceMeter component
 * Displays a visual meter (progress bar) with numeric score, color coding
 * (red/yellow/green), and tooltip explaining score basis.
 * Implements confidence score visualization for FR-008 (SCRUM-6535)
 *
 * Color coding:
 * - Red (0-40%): Low confidence — human review strongly recommended
 * - Yellow (40%-threshold): Moderate confidence — human review recommended
 * - Green (threshold-90%): Good confidence — likely suitable for sending
 * - Dark green (90-100%): High confidence — strong context match
 *
 * The threshold is configurable via NEXT_PUBLIC_CONFIDENCE_THRESHOLD (default 0.7)
 *
 * @param {object} props
 * @param {number} props.score - Confidence score between 0 and 1
 * @param {string} [props.explanation] - Explanation text for the confidence score basis
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the meter
 * @param {boolean} [props.showLabel=true] - Whether to show the confidence tier label (Low/Moderate/Good/High)
 * @param {boolean} [props.showScore=true] - Whether to show the numeric percentage score
 * @param {boolean} [props.showTooltip=true] - Whether to show the tooltip on hover
 * @param {boolean} [props.showThresholdIndicator=false] - Whether to show the threshold marker on the bar
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <ConfidenceMeter score={0.85} explanation="Strong property match found." />
 * <ConfidenceMeter score={0.45} size="lg" showThresholdIndicator />
 * <ConfidenceMeter score={0.92} showLabel={false} />
 */
export function ConfidenceMeter({
  score,
  explanation,
  size = 'md',
  showLabel = true,
  showScore = true,
  showTooltip = true,
  showThresholdIndicator = false,
  className = '',
}) {
  const clampedScore = typeof score === 'number' && !isNaN(score)
    ? Math.max(0, Math.min(1, score))
    : 0;

  const tier = getColorTier(clampedScore);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const percentageWidth = Math.round(clampedScore * 100);
  const formattedScore = formatConfidenceScore(clampedScore);
  const requiresReview = clampedScore < CONFIDENCE_THRESHOLD;

  const tooltipText = explanation
    ? `${tier.description} ${explanation}`
    : tier.description;

  return (
    <div
      className={`flex flex-col ${sizeClass.container} ${className}`.trim()}
      role="meter"
      aria-valuenow={percentageWidth}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Confidence score: ${formattedScore}`}
      title={showTooltip ? tooltipText : undefined}
    >
      {/* Header row: label and score */}
      {(showLabel || showScore) && (
        <div className="flex items-center justify-between">
          {showLabel && (
            <span className={`font-medium ${sizeClass.label} ${tier.text}`}>
              {tier.label} Confidence
              {requiresReview && (
                <span className="ml-1 text-red-600 font-normal">
                  — Review Required
                </span>
              )}
            </span>
          )}
          {showScore && (
            <span className={`font-semibold ${sizeClass.text} ${tier.text}`}>
              {formattedScore}
            </span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className={`relative w-full rounded-full bg-neutral-200 ${sizeClass.barHeight} overflow-hidden`}>
        <div
          className={`${tier.bar} ${sizeClass.barHeight} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${percentageWidth}%` }}
          aria-hidden="true"
        />

        {/* Threshold indicator marker */}
        {showThresholdIndicator && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-neutral-700 opacity-40"
            style={{ left: `${Math.round(CONFIDENCE_THRESHOLD * 100)}%` }}
            aria-hidden="true"
            title={`Threshold: ${formatConfidenceScore(CONFIDENCE_THRESHOLD)}`}
          />
        )}
      </div>

      {/* Explanation text */}
      {explanation && (
        <p className={`${sizeClass.label} text-neutral-600 leading-snug`}>
          {explanation}
        </p>
      )}
    </div>
  );
}

export default ConfidenceMeter;