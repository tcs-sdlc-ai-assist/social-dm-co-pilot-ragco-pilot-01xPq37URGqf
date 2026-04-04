'use client';

import { LEAD_SCORE, LEAD_LABELS, getLeadLabel } from '@/utils/constants';
import { formatLeadScore } from '@/utils/formatters';
import Tooltip from '@/components/common/Tooltip';

/**
 * Size variant mappings for the lead score badge
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    container: 'gap-1',
    badge: 'px-2 py-0.5 text-xs',
    icon: 'h-3 w-3',
    score: 'text-xs',
    label: 'text-xs',
  },
  md: {
    container: 'gap-1.5',
    badge: 'px-2.5 py-0.5 text-xs',
    icon: 'h-3.5 w-3.5',
    score: 'text-sm',
    label: 'text-xs',
  },
  lg: {
    container: 'gap-2',
    badge: 'px-3 py-1 text-sm',
    icon: 'h-4 w-4',
    score: 'text-base',
    label: 'text-sm',
  },
});

/**
 * Returns the color style object for a given lead score
 *
 * @param {number} score - Lead score (0-100)
 * @returns {{ bg: string, text: string, bar: string, dot: string, label: string }}
 */
function getScoreStyle(score) {
  if (typeof score !== 'number' || isNaN(score)) {
    return {
      bg: 'bg-neutral-100',
      text: 'text-neutral-600',
      bar: 'bg-neutral-400',
      dot: 'bg-neutral-500',
      label: 'Unscored',
    };
  }

  if (score >= LEAD_SCORE.HOT) {
    return {
      bg: 'bg-brand-100',
      text: 'text-brand-800',
      bar: 'bg-brand-500',
      dot: 'bg-brand-500',
      label: LEAD_LABELS.HOT,
    };
  }

  if (score >= LEAD_SCORE.WARM) {
    return {
      bg: 'bg-accent-100',
      text: 'text-accent-800',
      bar: 'bg-accent-500',
      dot: 'bg-accent-500',
      label: LEAD_LABELS.WARM,
    };
  }

  return {
    bg: 'bg-red-100',
    text: 'text-red-800',
    bar: 'bg-red-500',
    dot: 'bg-red-500',
    label: LEAD_LABELS.COLD,
  };
}

/**
 * Priority flag icon SVG component
 * Renders a flag icon for high-priority leads
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @param {boolean} props.filled - Whether the flag should be filled
 * @returns {React.ReactElement}
 */
function PriorityFlagIcon({ className, filled = false }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill={filled ? 'currentColor' : 'none'}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
      />
    </svg>
  );
}

/**
 * Score bar component
 * Renders a horizontal progress bar representing the lead score
 *
 * @param {object} props
 * @param {number} props.score - Lead score (0-100)
 * @param {string} props.barColor - Tailwind color class for the bar fill
 * @returns {React.ReactElement}
 */
function ScoreBar({ score, barColor }) {
  const percentage = typeof score === 'number' && !isNaN(score)
    ? Math.min(100, Math.max(0, score))
    : 0;

  return (
    <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
      <div
        className={`h-full ${barColor} rounded-full transition-all duration-300 ease-out`}
        style={{ width: `${percentage}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * LeadScoreBadge component
 * Displays a numeric lead score with color coding (high=green, medium=yellow, low=red)
 * and an optional priority flag icon for high-priority leads.
 *
 * Implements lead score visualization for LeadScoringService (SCRUM-6539)
 *
 * Color coding:
 * - Green (brand): Score >= 80 (Hot) — high-priority lead
 * - Yellow (accent): Score >= 50 (Warm) — medium-priority lead
 * - Red: Score < 50 (Cold) — low-priority lead
 *
 * Features:
 * - Numeric score display with color-coded badge
 * - Priority label (Hot, Warm, Cold)
 * - Priority flag icon for high-priority leads
 * - Optional score bar visualization
 * - Tooltip with score details
 * - Configurable size variants (sm, md, lg)
 * - ARIA labels for accessibility
 *
 * @param {object} props
 * @param {number} props.score - Lead score between 0 and 100
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the badge
 * @param {boolean} [props.showLabel=true] - Whether to show the priority label (Hot/Warm/Cold)
 * @param {boolean} [props.showScore=true] - Whether to show the numeric score
 * @param {boolean} [props.showFlag=true] - Whether to show the priority flag icon for high-priority leads
 * @param {boolean} [props.showBar=false] - Whether to show the score bar visualization
 * @param {boolean} [props.showDot=false] - Whether to show the leading dot indicator
 * @param {boolean} [props.showTooltip=true] - Whether to show the tooltip on hover
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <LeadScoreBadge score={92} />
 * <LeadScoreBadge score={65} size="lg" showBar />
 * <LeadScoreBadge score={35} showFlag={false} showLabel={false} />
 * <LeadScoreBadge score={88} size="sm" showDot />
 */
export function LeadScoreBadge({
  score,
  size = 'md',
  showLabel = true,
  showScore = true,
  showFlag = true,
  showBar = false,
  showDot = false,
  showTooltip = true,
  className = '',
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const style = getScoreStyle(score);

  const clampedScore = typeof score === 'number' && !isNaN(score)
    ? Math.min(100, Math.max(0, Math.round(score)))
    : null;

  const isHighPriority = clampedScore !== null && clampedScore >= LEAD_SCORE.HOT;
  const displayLabel = style.label;
  const displayScore = clampedScore !== null ? String(clampedScore) : '—';

  const tooltipContent = clampedScore !== null
    ? `Lead Score: ${clampedScore}/100 — ${displayLabel} priority${isHighPriority ? ' (escalation recommended)' : ''}`
    : 'Lead score not available';

  const badgeContent = (
    <span
      className={`inline-flex items-center ${sizeClass.container} ${className}`.trim()}
      role="status"
      aria-label={`Lead score: ${clampedScore !== null ? `${clampedScore}, ${displayLabel} priority` : 'not scored'}`}
    >
      {/* Priority flag icon for high-priority leads */}
      {showFlag && isHighPriority && (
        <PriorityFlagIcon
          className={`${sizeClass.icon} text-brand-600 shrink-0`}
          filled
        />
      )}

      {/* Badge pill */}
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-medium ${style.bg} ${style.text} ${sizeClass.badge}`}
      >
        {/* Leading dot indicator */}
        {showDot && (
          <span
            className={`inline-block rounded-full ${style.dot} ${size === 'sm' ? 'h-1.5 w-1.5' : size === 'lg' ? 'h-2.5 w-2.5' : 'h-2 w-2'}`}
            aria-hidden="true"
          />
        )}

        {/* Numeric score */}
        {showScore && (
          <span className={`font-semibold ${sizeClass.score}`}>
            {displayScore}
          </span>
        )}

        {/* Priority label */}
        {showLabel && (
          <span className={sizeClass.label}>
            {displayLabel}
          </span>
        )}
      </span>

      {/* Score bar */}
      {showBar && clampedScore !== null && (
        <div className="flex-1 min-w-12 max-w-24">
          <ScoreBar score={clampedScore} barColor={style.bar} />
        </div>
      )}
    </span>
  );

  if (showTooltip) {
    return (
      <Tooltip content={tooltipContent}>
        {badgeContent}
      </Tooltip>
    );
  }

  return badgeContent;
}

export default LeadScoreBadge;