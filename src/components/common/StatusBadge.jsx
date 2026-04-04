'use client';

import { STATUS } from '@/utils/constants';

/**
 * Status color and style mappings for each DM status
 * Uses Tailwind utility classes consistent with the application's design system
 */
const STATUS_STYLES = Object.freeze({
  [STATUS.NEW]: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
    label: 'New',
  },
  [STATUS.DRAFTED]: {
    bg: 'bg-accent-100',
    text: 'text-accent-800',
    dot: 'bg-accent-500',
    label: 'Drafted',
  },
  [STATUS.SENT]: {
    bg: 'bg-brand-100',
    text: 'text-brand-800',
    dot: 'bg-brand-500',
    label: 'Sent',
  },
  [STATUS.ESCALATED]: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    dot: 'bg-red-500',
    label: 'Escalated',
  },
});

/**
 * Default style for unknown or unrecognized statuses
 */
const DEFAULT_STYLE = {
  bg: 'bg-neutral-100',
  text: 'text-neutral-700',
  dot: 'bg-neutral-500',
  label: 'Unknown',
};

/**
 * Size variant mappings for the badge
 */
const SIZE_CLASSES = Object.freeze({
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
});

/**
 * Size variant mappings for the status dot indicator
 */
const DOT_SIZE_CLASSES = Object.freeze({
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-2.5 w-2.5',
});

/**
 * StatusBadge component
 * Displays a color-coded badge for DM status values (New, Drafted, Sent, Escalated)
 * Includes an optional leading dot indicator and proper ARIA labeling for accessibility
 *
 * Implements status display for DMInboxService (SCRUM-6529)
 *
 * @param {object} props
 * @param {string} props.status - DM status value (New, Drafted, Sent, Escalated)
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Badge size variant
 * @param {boolean} [props.showDot=true] - Whether to show the leading dot indicator
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <StatusBadge status="New" />
 * <StatusBadge status="Escalated" size="lg" showDot={false} />
 */
export function StatusBadge({ status, size = 'md', showDot = true, className = '' }) {
  const style = STATUS_STYLES[status] || DEFAULT_STYLE;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const dotSizeClass = DOT_SIZE_CLASSES[size] || DOT_SIZE_CLASSES.md;
  const displayLabel = style.label || status || 'Unknown';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${style.bg} ${style.text} ${sizeClass} ${className}`.trim()}
      role="status"
      aria-label={`Status: ${displayLabel}`}
    >
      {showDot && (
        <span
          className={`inline-block rounded-full ${style.dot} ${dotSizeClass}`}
          aria-hidden="true"
        />
      )}
      {displayLabel}
    </span>
  );
}

export default StatusBadge;