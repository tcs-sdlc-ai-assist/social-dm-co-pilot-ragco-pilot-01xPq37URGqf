'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Position variant mappings for the tooltip
 * Each position defines the tooltip placement relative to the trigger element
 */
const POSITION_CLASSES = Object.freeze({
  top: {
    tooltip: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    arrow: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-neutral-800',
  },
  bottom: {
    tooltip: 'top-full left-1/2 -translate-x-1/2 mt-2',
    arrow: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-neutral-800',
  },
  left: {
    tooltip: 'right-full top-1/2 -translate-y-1/2 mr-2',
    arrow: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-neutral-800',
  },
  right: {
    tooltip: 'left-full top-1/2 -translate-y-1/2 ml-2',
    arrow: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-neutral-800',
  },
});

/**
 * Size variant mappings for the tooltip
 */
const SIZE_CLASSES = Object.freeze({
  sm: 'max-w-48 px-2 py-1 text-xs',
  md: 'max-w-64 px-3 py-1.5 text-xs',
  lg: 'max-w-80 px-3 py-2 text-sm',
});

/**
 * Arrow size mappings per tooltip size
 */
const ARROW_SIZE_CLASSES = Object.freeze({
  sm: 'border-4',
  md: 'border-[5px]',
  lg: 'border-[6px]',
});

/**
 * Tooltip component
 * Displays contextual information on hover/focus with ARIA tooltip role.
 * Used for confidence score explanations and compliance hints.
 *
 * Implements tooltip display for FR-008 (SCRUM-6535)
 *
 * Features:
 * - Hover and focus trigger support for accessibility
 * - Configurable position (top, bottom, left, right)
 * - Configurable size (sm, md, lg)
 * - Optional delay before showing/hiding
 * - ARIA tooltip role with proper aria-describedby linkage
 * - Keyboard accessible (shows on focus, hides on Escape)
 * - Smooth enter/exit transitions
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Trigger element that the tooltip is attached to
 * @param {string} props.content - Tooltip text content to display
 * @param {'top'|'bottom'|'left'|'right'} [props.position='top'] - Tooltip placement relative to the trigger
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the tooltip
 * @param {number} [props.showDelay=200] - Delay in milliseconds before showing the tooltip
 * @param {number} [props.hideDelay=100] - Delay in milliseconds before hiding the tooltip
 * @param {boolean} [props.disabled=false] - Whether the tooltip is disabled
 * @param {boolean} [props.showArrow=true] - Whether to show the directional arrow
 * @param {string} [props.className=''] - Additional CSS classes for the tooltip container
 * @param {string} [props.tooltipClassName=''] - Additional CSS classes for the tooltip panel
 * @returns {React.ReactElement}
 *
 * @example
 * <Tooltip content="Strong property match found.">
 *   <span>85%</span>
 * </Tooltip>
 *
 * @example
 * <Tooltip content="Human review recommended before sending." position="bottom" size="lg">
 *   <button>Review</button>
 * </Tooltip>
 *
 * @example
 * <Tooltip content="Consent verified for this sender." position="right" showArrow={false}>
 *   <span className="badge-success">Compliant</span>
 * </Tooltip>
 */
export function Tooltip({
  children,
  content,
  position = 'top',
  size = 'md',
  showDelay = 200,
  hideDelay = 100,
  disabled = false,
  showArrow = true,
  className = '',
  tooltipClassName = '',
}) {
  const [visible, setVisible] = useState(false);
  const showTimeoutRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  const tooltipId = useRef(`tooltip-${Math.random().toString(36).slice(2, 9)}`).current;

  const positionStyle = POSITION_CLASSES[position] || POSITION_CLASSES.top;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const arrowSizeClass = ARROW_SIZE_CLASSES[size] || ARROW_SIZE_CLASSES.md;

  /**
   * Clears any pending show/hide timeouts
   */
  const clearTimeouts = useCallback(() => {
    if (showTimeoutRef.current !== null) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current !== null) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  /**
   * Shows the tooltip after the configured delay
   */
  const show = useCallback(() => {
    if (disabled) return;

    clearTimeouts();

    const clampedDelay = Math.max(0, showDelay);

    showTimeoutRef.current = setTimeout(() => {
      setVisible(true);
    }, clampedDelay);
  }, [disabled, showDelay, clearTimeouts]);

  /**
   * Hides the tooltip after the configured delay
   */
  const hide = useCallback(() => {
    clearTimeouts();

    const clampedDelay = Math.max(0, hideDelay);

    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
    }, clampedDelay);
  }, [hideDelay, clearTimeouts]);

  /**
   * Handles keydown events on the trigger element
   * Hides the tooltip when Escape is pressed
   *
   * @param {React.KeyboardEvent} event
   */
  function handleKeyDown(event) {
    if (event.key === 'Escape' && visible) {
      event.stopPropagation();
      clearTimeouts();
      setVisible(false);
    }
  }

  /**
   * Cleanup timeouts on unmount
   */
  useEffect(() => {
    return () => {
      clearTimeouts();
    };
  }, [clearTimeouts]);

  // Don't render tooltip functionality if content is empty or disabled
  const hasContent = content && typeof content === 'string' && content.trim().length > 0;

  if (!hasContent || disabled) {
    return <>{children}</>;
  }

  return (
    <div
      className={`relative inline-flex ${className}`.trim()}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger element with aria-describedby linkage */}
      <div aria-describedby={visible ? tooltipId : undefined}>
        {children}
      </div>

      {/* Tooltip panel */}
      {visible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`absolute z-50 ${positionStyle.tooltip} pointer-events-none ${tooltipClassName}`.trim()}
        >
          <div
            className={`rounded-lg bg-neutral-800 text-white font-normal leading-snug shadow-card-hover whitespace-normal break-words ${sizeClass}`}
          >
            {content}
          </div>

          {/* Directional arrow */}
          {showArrow && (
            <div
              className={`absolute w-0 h-0 ${arrowSizeClass} border-solid ${positionStyle.arrow}`}
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </div>
  );
}

export default Tooltip;