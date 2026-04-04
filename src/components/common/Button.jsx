'use client';

/**
 * Size variant mappings for the button
 */
const SIZE_CLASSES = Object.freeze({
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
});

/**
 * Icon size mappings per button size
 */
const ICON_SIZE_CLASSES = Object.freeze({
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
});

/**
 * Variant style mappings for the button
 * Each variant defines base, hover, focus, and disabled styles
 */
const VARIANT_CLASSES = Object.freeze({
  primary: {
    base: 'text-white bg-brand-600 border border-transparent',
    hover: 'hover:bg-brand-700',
    focus: 'focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
    disabled: 'disabled:bg-brand-300 disabled:cursor-not-allowed',
  },
  secondary: {
    base: 'text-neutral-700 bg-white border border-neutral-300',
    hover: 'hover:bg-neutral-50',
    focus: 'focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
    disabled: 'disabled:text-neutral-400 disabled:bg-neutral-100 disabled:cursor-not-allowed',
  },
  danger: {
    base: 'text-white bg-red-600 border border-transparent',
    hover: 'hover:bg-red-700',
    focus: 'focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
    disabled: 'disabled:bg-red-300 disabled:cursor-not-allowed',
  },
  ghost: {
    base: 'text-neutral-700 bg-transparent border border-transparent',
    hover: 'hover:bg-neutral-100',
    focus: 'focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
    disabled: 'disabled:text-neutral-400 disabled:cursor-not-allowed',
  },
});

/**
 * Loading spinner SVG component
 * Renders an animated spinner icon for the loading state
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function LoadingSpinner({ className }) {
  return (
    <svg
      className={`animate-spin ${className}`}
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
}

/**
 * Button component
 * Reusable button primitive supporting multiple variants, sizes, loading state,
 * disabled state, icons, and proper ARIA attributes for accessibility.
 *
 * Variants:
 * - primary: Brand-colored filled button for primary actions
 * - secondary: White/bordered button for secondary actions
 * - danger: Red filled button for destructive actions
 * - ghost: Transparent button for tertiary/inline actions
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Button label/content
 * @param {'primary'|'secondary'|'danger'|'ghost'} [props.variant='primary'] - Visual variant
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant
 * @param {boolean} [props.loading=false] - Whether the button is in a loading state
 * @param {boolean} [props.disabled=false] - Whether the button is disabled
 * @param {boolean} [props.fullWidth=false] - Whether the button should take full width
 * @param {'button'|'submit'|'reset'} [props.type='button'] - HTML button type attribute
 * @param {React.ReactNode} [props.leftIcon] - Icon element rendered before the label
 * @param {React.ReactNode} [props.rightIcon] - Icon element rendered after the label
 * @param {string} [props.loadingText] - Text to display during loading state (replaces children)
 * @param {string} [props.ariaLabel] - Accessible label for the button
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @param {Function} [props.onClick] - Click handler
 * @param {object} [props.rest] - Additional HTML button attributes
 * @returns {React.ReactElement}
 *
 * @example
 * <Button variant="primary" onClick={handleSave}>Save</Button>
 * <Button variant="secondary" size="sm" leftIcon={<PlusIcon />}>Add Item</Button>
 * <Button variant="danger" loading loadingText="Deleting...">Delete</Button>
 * <Button variant="ghost" disabled>Cancel</Button>
 * <Button fullWidth type="submit">Submit Form</Button>
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  type = 'button',
  leftIcon,
  rightIcon,
  loadingText,
  ariaLabel,
  className = '',
  onClick,
  ...rest
}) {
  const variantStyle = VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const iconSizeClass = ICON_SIZE_CLASSES[size] || ICON_SIZE_CLASSES.md;

  const isDisabled = disabled || loading;

  const buttonClasses = [
    'inline-flex items-center justify-center font-medium rounded-xl transition-colors focus:outline-none',
    sizeClass,
    variantStyle.base,
    !isDisabled ? variantStyle.hover : '',
    variantStyle.focus,
    variantStyle.disabled,
    fullWidth ? 'w-full' : '',
    loading ? 'cursor-wait' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  /**
   * Handles click events
   * Prevents click when loading or disabled
   *
   * @param {React.MouseEvent} event
   */
  function handleClick(event) {
    if (isDisabled) {
      event.preventDefault();
      return;
    }

    if (typeof onClick === 'function') {
      onClick(event);
    }
  }

  return (
    <button
      type={type}
      className={buttonClasses}
      disabled={isDisabled}
      onClick={handleClick}
      aria-label={ariaLabel || undefined}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {/* Loading spinner */}
      {loading && (
        <LoadingSpinner className={`${iconSizeClass} ${(loadingText || children) ? 'mr-2' : ''}`} />
      )}

      {/* Left icon (hidden during loading) */}
      {!loading && leftIcon && (
        <span className={`inline-flex shrink-0 ${children ? 'mr-2' : ''}`} aria-hidden="true">
          {leftIcon}
        </span>
      )}

      {/* Button label */}
      {loading && loadingText ? loadingText : children}

      {/* Right icon (hidden during loading) */}
      {!loading && rightIcon && (
        <span className={`inline-flex shrink-0 ${children ? 'ml-2' : ''}`} aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </button>
  );
}

export default Button;