'use client';

import { useEffect, useRef, useCallback } from 'react';
import Button from '@/components/common/Button';

/**
 * Size variant mappings for the modal
 */
const SIZE_CLASSES = Object.freeze({
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-full mx-4',
});

/**
 * Close icon SVG component
 * Renders an X icon for the close button
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
 * Returns all focusable elements within a container
 *
 * @param {HTMLElement} container - DOM element to search within
 * @returns {HTMLElement[]} Array of focusable elements
 */
function getFocusableElements(container) {
  if (!container) return [];

  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll(selector));
}

/**
 * Modal component
 * Reusable modal dialog with accessible overlay, focus trap, close button,
 * title, body, and action slots. Uses ARIA dialog role for accessibility.
 *
 * Features:
 * - Focus trap: Tab/Shift+Tab cycles within the modal
 * - Focus restoration: Returns focus to the trigger element on close
 * - Escape key: Closes the modal when Escape is pressed
 * - Overlay click: Optionally closes the modal when clicking the backdrop
 * - Scroll lock: Prevents body scrolling while the modal is open
 * - ARIA attributes: role="dialog", aria-modal, aria-labelledby, aria-describedby
 *
 * @param {object} props
 * @param {boolean} props.open - Whether the modal is visible
 * @param {Function} props.onClose - Callback invoked when the modal should close
 * @param {string} [props.title] - Modal title displayed in the header
 * @param {React.ReactNode} props.children - Modal body content
 * @param {React.ReactNode} [props.actions] - Action buttons rendered in the footer
 * @param {'sm'|'md'|'lg'|'xl'|'full'} [props.size='md'] - Size variant for the modal width
 * @param {boolean} [props.showCloseButton=true] - Whether to show the close button in the header
 * @param {boolean} [props.closeOnOverlayClick=true] - Whether clicking the overlay closes the modal
 * @param {boolean} [props.closeOnEscape=true] - Whether pressing Escape closes the modal
 * @param {string} [props.className=''] - Additional CSS classes for the modal panel
 * @param {string} [props.overlayClassName=''] - Additional CSS classes for the overlay
 * @param {string} [props.ariaLabel] - Accessible label for the dialog (used if no title)
 * @param {string} [props.ariaDescribedBy] - ID of the element describing the dialog
 * @returns {React.ReactElement|null}
 *
 * @example
 * <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Confirm Action">
 *   <p>Are you sure you want to proceed?</p>
 * </Modal>
 *
 * @example
 * <Modal
 *   open={isOpen}
 *   onClose={handleClose}
 *   title="Edit Draft"
 *   size="lg"
 *   actions={
 *     <>
 *       <Button variant="secondary" onClick={handleClose}>Cancel</Button>
 *       <Button variant="primary" onClick={handleSave}>Save</Button>
 *     </>
 *   }
 * >
 *   <textarea className="input w-full" rows={6} />
 * </Modal>
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  actions,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = '',
  overlayClassName = '',
  ariaLabel,
  ariaDescribedBy,
}) {
  const modalRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 9)}`).current;
  const bodyId = useRef(`modal-body-${Math.random().toString(36).slice(2, 9)}`).current;

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  /**
   * Handles close action
   * Invokes the onClose callback if provided
   */
  const handleClose = useCallback(() => {
    if (typeof onClose === 'function') {
      onClose();
    }
  }, [onClose]);

  /**
   * Handles overlay click
   * Closes the modal if closeOnOverlayClick is enabled
   *
   * @param {React.MouseEvent} event
   */
  function handleOverlayClick(event) {
    if (event.target === event.currentTarget && closeOnOverlayClick) {
      handleClose();
    }
  }

  /**
   * Handles keydown events for focus trap and Escape key
   *
   * @param {React.KeyboardEvent} event
   */
  function handleKeyDown(event) {
    if (event.key === 'Escape' && closeOnEscape) {
      event.stopPropagation();
      handleClose();
      return;
    }

    if (event.key === 'Tab') {
      const focusableElements = getFocusableElements(modalRef.current);

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: wrap to last element if at the beginning
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: wrap to first element if at the end
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  /**
   * Manages focus and scroll lock when the modal opens/closes
   * - Saves and restores the previously focused element
   * - Moves focus into the modal on open
   * - Locks body scroll while open
   */
  useEffect(() => {
    if (open) {
      // Save the currently focused element for restoration
      previousActiveElementRef.current = document.activeElement;

      // Lock body scroll
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Focus the modal or the first focusable element within it
      const focusTimer = setTimeout(() => {
        if (modalRef.current) {
          const focusableElements = getFocusableElements(modalRef.current);

          if (focusableElements.length > 0) {
            focusableElements[0].focus();
          } else {
            modalRef.current.focus();
          }
        }
      }, 0);

      return () => {
        clearTimeout(focusTimer);

        // Restore body scroll
        document.body.style.overflow = originalOverflow;

        // Restore focus to the previously focused element
        if (
          previousActiveElementRef.current &&
          typeof previousActiveElementRef.current.focus === 'function'
        ) {
          previousActiveElementRef.current.focus();
        }
      };
    }
  }, [open]);

  // Don't render anything if the modal is not open
  if (!open) {
    return null;
  }

  const hasTitle = typeof title === 'string' && title.trim().length > 0;
  const labelledBy = hasTitle ? titleId : undefined;
  const describedBy = ariaDescribedBy || bodyId;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayClassName}`.trim()}
      role="presentation"
    >
      {/* Overlay backdrop */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="fixed inset-0 bg-neutral-900/50 transition-opacity"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={!hasTitle ? (ariaLabel || 'Dialog') : undefined}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`relative z-10 w-full ${sizeClass} bg-white rounded-2xl shadow-card-hover flex flex-col max-h-[90vh] focus:outline-none ${className}`.trim()}
      >
        {/* Header */}
        {(hasTitle || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            {hasTitle && (
              <h2
                id={titleId}
                className="text-lg font-semibold text-neutral-900 truncate pr-4"
              >
                {title}
              </h2>
            )}

            {!hasTitle && <div />}

            {showCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                ariaLabel="Close dialog"
                className="shrink-0 -mr-1"
              >
                <CloseIcon className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}

        {/* Body */}
        <div
          id={bodyId}
          className="flex-1 overflow-y-auto px-6 py-4"
        >
          {children}
        </div>

        {/* Footer / Actions */}
        {actions && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;