'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Toast variant style mappings
 * Each variant defines background, text, icon, and border styles
 */
const VARIANT_STYLES = Object.freeze({
  success: {
    container: 'bg-brand-50 border-brand-300 text-brand-800',
    icon: 'text-brand-500',
    progress: 'bg-brand-500',
  },
  error: {
    container: 'bg-red-50 border-red-300 text-red-800',
    icon: 'text-red-500',
    progress: 'bg-red-500',
  },
  warning: {
    container: 'bg-accent-50 border-accent-300 text-accent-800',
    icon: 'text-accent-500',
    progress: 'bg-accent-500',
  },
  info: {
    container: 'bg-blue-50 border-blue-300 text-blue-800',
    icon: 'text-blue-500',
    progress: 'bg-blue-500',
  },
});

/**
 * Position variant mappings for the toast container
 */
const POSITION_CLASSES = Object.freeze({
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
});

/**
 * Success icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function SuccessIcon({ className }) {
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * Error icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function ErrorIcon({ className }) {
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * Warning icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function WarningIcon({ className }) {
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

/**
 * Info icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function InfoIcon({ className }) {
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * Close icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function CloseIcon({ className }) {
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/**
 * Returns the appropriate icon component for a given variant
 *
 * @param {string} variant - Toast variant
 * @param {string} className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function VariantIcon({ variant, className }) {
  switch (variant) {
    case 'success':
      return <SuccessIcon className={className} />;
    case 'error':
      return <ErrorIcon className={className} />;
    case 'warning':
      return <WarningIcon className={className} />;
    case 'info':
      return <InfoIcon className={className} />;
    default:
      return <InfoIcon className={className} />;
  }
}

/**
 * Toast component
 * Displays transient success/error/warning/info messages with auto-dismiss,
 * manual close, optional progress bar, and ARIA live region for accessibility.
 *
 * Variants:
 * - success: Green-themed toast for successful operations
 * - error: Red-themed toast for error messages
 * - warning: Yellow/accent-themed toast for warnings
 * - info: Blue-themed toast for informational messages
 *
 * Features:
 * - Auto-dismiss after configurable duration
 * - Manual dismiss via close button
 * - Progress bar showing remaining time
 * - Pause auto-dismiss on hover
 * - ARIA live region for screen reader announcements
 * - Configurable position on screen
 * - Enter/exit transitions
 *
 * @param {object} props
 * @param {string} props.message - Toast message text to display
 * @param {'success'|'error'|'warning'|'info'} [props.variant='info'] - Visual variant
 * @param {string} [props.title] - Optional title displayed above the message
 * @param {boolean} [props.visible=true] - Whether the toast is visible
 * @param {number} [props.duration=5000] - Auto-dismiss duration in milliseconds (0 = no auto-dismiss)
 * @param {boolean} [props.showCloseButton=true] - Whether to show the close button
 * @param {boolean} [props.showIcon=true] - Whether to show the variant icon
 * @param {boolean} [props.showProgress=true] - Whether to show the auto-dismiss progress bar
 * @param {boolean} [props.pauseOnHover=true] - Whether to pause auto-dismiss on hover
 * @param {'top-right'|'top-left'|'top-center'|'bottom-right'|'bottom-left'|'bottom-center'} [props.position='top-right'] - Screen position
 * @param {boolean} [props.fixed=true] - Whether to use fixed positioning
 * @param {Function} [props.onClose] - Callback invoked when the toast is dismissed
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @param {string} [props.ariaLabel] - Accessible label for the toast
 * @returns {React.ReactElement|null}
 *
 * @example
 * <Toast message="Lead saved successfully!" variant="success" onClose={handleClose} />
 * <Toast message="Failed to sync with Salesforce." variant="error" duration={8000} />
 * <Toast message="SLA breach detected." variant="warning" title="SLA Alert" />
 * <Toast message="Draft generated." variant="info" showProgress={false} />
 */
export function Toast({
  message,
  variant = 'info',
  title,
  visible = true,
  duration = 5000,
  showCloseButton = true,
  showIcon = true,
  showProgress = true,
  pauseOnHover = true,
  position = 'top-right',
  fixed = true,
  onClose,
  className = '',
  ariaLabel,
}) {
  const [isVisible, setIsVisible] = useState(visible);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const remainingTimeRef = useRef(duration);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Sync visibility with prop
  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      setIsExiting(false);
      setProgress(100);
      remainingTimeRef.current = duration;
    } else {
      handleDismiss();
    }
  }, [visible]);

  /**
   * Clears all active timers
   */
  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (progressIntervalRef.current !== null) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  /**
   * Handles toast dismissal with exit animation
   */
  const handleDismiss = useCallback(() => {
    clearTimers();

    if (!mountedRef.current) return;

    setIsExiting(true);

    // Allow exit animation to complete before hiding
    setTimeout(() => {
      if (mountedRef.current) {
        setIsVisible(false);
        setIsExiting(false);
      }

      if (typeof onClose === 'function') {
        onClose();
      }
    }, 200);
  }, [clearTimers, onClose]);

  /**
   * Starts the auto-dismiss timer and progress bar
   */
  const startTimer = useCallback(() => {
    if (duration <= 0) return;

    clearTimers();

    startTimeRef.current = Date.now();

    // Auto-dismiss timer
    timerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        handleDismiss();
      }
    }, remainingTimeRef.current);

    // Progress bar update interval
    if (showProgress) {
      const updateInterval = 50;

      progressIntervalRef.current = setInterval(() => {
        if (!mountedRef.current) {
          clearTimers();
          return;
        }

        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, remainingTimeRef.current - elapsed);
        const progressPercent = (remaining / duration) * 100;

        setProgress(Math.max(0, progressPercent));

        if (remaining <= 0) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }, updateInterval);
    }
  }, [duration, showProgress, clearTimers, handleDismiss]);

  /**
   * Pauses the auto-dismiss timer
   */
  const pauseTimer = useCallback(() => {
    if (duration <= 0 || !pauseOnHover) return;

    clearTimers();

    // Calculate remaining time
    if (startTimeRef.current !== null) {
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    }

    setIsPaused(true);
  }, [duration, pauseOnHover, clearTimers]);

  /**
   * Resumes the auto-dismiss timer
   */
  const resumeTimer = useCallback(() => {
    if (duration <= 0 || !pauseOnHover) return;

    setIsPaused(false);
    startTimer();
  }, [duration, pauseOnHover, startTimer]);

  // Start auto-dismiss timer when visible
  useEffect(() => {
    if (isVisible && !isExiting && duration > 0) {
      remainingTimeRef.current = duration;
      startTimer();
    }

    return () => {
      clearTimers();
    };
  }, [isVisible, isExiting, duration, startTimer, clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  const variantStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.info;
  const positionClass = POSITION_CLASSES[position] || POSITION_CLASSES['top-right'];

  const hasTitle = typeof title === 'string' && title.trim().length > 0;
  const hasMessage = typeof message === 'string' && message.trim().length > 0;

  if (!hasMessage && !hasTitle) {
    return null;
  }

  const containerClasses = [
    'w-full max-w-sm border rounded-2xl shadow-card-hover overflow-hidden transition-all duration-200',
    variantStyle.container,
    isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0',
    fixed ? `fixed z-50 ${positionClass}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const ariaLive = variant === 'error' ? 'assertive' : 'polite';
  const ariaRole = variant === 'error' ? 'alert' : 'status';

  return (
    <div
      className={containerClasses}
      role={ariaRole}
      aria-live={ariaLive}
      aria-atomic="true"
      aria-label={ariaLabel || `${variant} notification`}
      onMouseEnter={pauseOnHover ? pauseTimer : undefined}
      onMouseLeave={pauseOnHover ? resumeTimer : undefined}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Variant icon */}
        {showIcon && (
          <div className={`shrink-0 ${variantStyle.icon}`}>
            <VariantIcon variant={variant} className="h-5 w-5" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {hasTitle && (
            <p className="text-sm font-semibold leading-snug">
              {title}
            </p>
          )}
          {hasMessage && (
            <p className={`text-sm leading-relaxed ${hasTitle ? 'mt-0.5' : ''}`}>
              {message}
            </p>
          )}
        </div>

        {/* Close button */}
        {showCloseButton && (
          <button
            type="button"
            className="shrink-0 inline-flex items-center justify-center rounded-xl p-1 hover:bg-neutral-200/50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 transition-colors"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {showProgress && duration > 0 && (
        <div className="h-1 w-full bg-neutral-200/50">
          <div
            className={`h-full ${variantStyle.progress} transition-all duration-100 ease-linear`}
            style={{ width: `${progress}%` }}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}

export default Toast;