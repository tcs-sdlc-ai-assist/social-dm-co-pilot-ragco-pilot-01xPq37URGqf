'use client';

/**
 * Size variant mappings for the spinner
 */
const SIZE_CLASSES = Object.freeze({
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
});

/**
 * Color variant mappings for the spinner
 */
const COLOR_CLASSES = Object.freeze({
  brand: 'text-brand-600',
  white: 'text-white',
  neutral: 'text-neutral-500',
  accent: 'text-accent-600',
  current: 'text-current',
});

/**
 * Text size mappings per spinner size
 */
const LABEL_SIZE_CLASSES = Object.freeze({
  xs: 'text-xs',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
});

/**
 * LoadingSpinner component
 * Animated spinner with accessible label for async operation feedback.
 * Renders an SVG spinner with configurable size, color, and optional visible label.
 * Uses ARIA attributes for screen reader accessibility.
 *
 * @param {object} props
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} [props.size='md'] - Size variant for the spinner
 * @param {'brand'|'white'|'neutral'|'accent'|'current'} [props.color='brand'] - Color variant
 * @param {string} [props.label='Loading'] - Accessible label for the spinner (used by screen readers)
 * @param {boolean} [props.showLabel=false] - Whether to display the label text visually below the spinner
 * @param {boolean} [props.center=false] - Whether to center the spinner within its container
 * @param {boolean} [props.fullScreen=false] - Whether to render as a full-screen overlay spinner
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <LoadingSpinner />
 * <LoadingSpinner size="lg" color="brand" showLabel label="Loading DMs..." />
 * <LoadingSpinner size="sm" color="white" />
 * <LoadingSpinner fullScreen label="Initializing..." showLabel />
 * <LoadingSpinner center size="xl" />
 */
export function LoadingSpinner({
  size = 'md',
  color = 'brand',
  label = 'Loading',
  showLabel = false,
  center = false,
  fullScreen = false,
  className = '',
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const colorClass = COLOR_CLASSES[color] || COLOR_CLASSES.brand;
  const labelSizeClass = LABEL_SIZE_CLASSES[size] || LABEL_SIZE_CLASSES.md;

  const spinner = (
    <svg
      className={`animate-spin ${sizeClass} ${colorClass}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  const content = (
    <div
      className={`inline-flex flex-col items-center justify-center gap-2 ${className}`.trim()}
      role="status"
      aria-label={label}
    >
      {spinner}
      {showLabel && (
        <span className={`font-medium text-neutral-600 ${labelSizeClass}`}>
          {label}
        </span>
      )}
      {!showLabel && (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/20">
        {content}
      </div>
    );
  }

  if (center) {
    return (
      <div className="flex items-center justify-center w-full py-8">
        {content}
      </div>
    );
  }

  return content;
}

export default LoadingSpinner;