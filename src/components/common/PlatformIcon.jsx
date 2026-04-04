'use client';

import { PLATFORM } from '@/utils/constants';
import { formatPlatform } from '@/utils/formatters';

/**
 * Size variant mappings for the platform icon
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    container: 'h-5 w-5',
    icon: 'h-3 w-3',
    text: 'text-xs',
  },
  md: {
    container: 'h-6 w-6',
    icon: 'h-4 w-4',
    text: 'text-sm',
  },
  lg: {
    container: 'h-8 w-8',
    icon: 'h-5 w-5',
    text: 'text-base',
  },
});

/**
 * Platform style mappings for colors and visual treatment
 */
const PLATFORM_STYLES = Object.freeze({
  [PLATFORM.FACEBOOK]: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-200',
    label: 'Facebook',
  },
  [PLATFORM.INSTAGRAM]: {
    bg: 'bg-pink-100',
    text: 'text-pink-700',
    border: 'border-pink-200',
    label: 'Instagram',
  },
});

/**
 * Default style for unknown or unrecognized platforms
 */
const DEFAULT_STYLE = {
  bg: 'bg-neutral-100',
  text: 'text-neutral-600',
  border: 'border-neutral-200',
  label: 'Unknown',
};

/**
 * Facebook SVG icon path
 * Simplified Facebook "f" logo
 *
 * @param {string} className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function FacebookIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

/**
 * Instagram SVG icon path
 * Simplified Instagram camera logo
 *
 * @param {string} className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function InstagramIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

/**
 * PlatformIcon component
 * Displays a Facebook or Instagram icon/badge based on the platform prop
 * with appropriate colors and ARIA labels for accessibility
 *
 * Implements platform identification display for DMInboxService (SCRUM-6529)
 *
 * @param {object} props
 * @param {string} props.platform - Platform identifier ('Facebook' or 'Instagram')
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the icon
 * @param {boolean} [props.showLabel=false] - Whether to show the platform name text alongside the icon
 * @param {boolean} [props.showBadge=true] - Whether to show the icon inside a colored badge container
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <PlatformIcon platform="Facebook" />
 * <PlatformIcon platform="Instagram" size="lg" showLabel />
 * <PlatformIcon platform="Facebook" showBadge={false} />
 */
export function PlatformIcon({
  platform,
  size = 'md',
  showLabel = false,
  showBadge = true,
  className = '',
}) {
  const style = PLATFORM_STYLES[platform] || DEFAULT_STYLE;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const displayLabel = formatPlatform(platform) || style.label;

  /**
   * Renders the appropriate platform SVG icon
   *
   * @returns {React.ReactElement}
   */
  function renderIcon() {
    switch (platform) {
      case PLATFORM.FACEBOOK:
        return <FacebookIcon className={sizeClass.icon} />;
      case PLATFORM.INSTAGRAM:
        return <InstagramIcon className={sizeClass.icon} />;
      default:
        return (
          <span className={`font-semibold ${sizeClass.text}`} aria-hidden="true">
            {(displayLabel.charAt(0) || '?').toUpperCase()}
          </span>
        );
    }
  }

  const iconElement = showBadge ? (
    <span
      className={`inline-flex items-center justify-center rounded-full ${style.bg} ${style.text} ${sizeClass.container}`}
      aria-hidden="true"
    >
      {renderIcon()}
    </span>
  ) : (
    <span className={`inline-flex items-center justify-center ${style.text}`} aria-hidden="true">
      {renderIcon()}
    </span>
  );

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`.trim()}
      role="img"
      aria-label={`Platform: ${displayLabel}`}
    >
      {iconElement}
      {showLabel && (
        <span className={`font-medium ${sizeClass.text} ${style.text}`}>
          {displayLabel}
        </span>
      )}
    </span>
  );
}

export default PlatformIcon;