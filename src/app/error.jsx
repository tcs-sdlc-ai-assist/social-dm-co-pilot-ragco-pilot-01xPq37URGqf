'use client';

import { useEffect } from 'react';
import Button from '@/components/common/Button';
import { APP_NAME } from '@/utils/constants';

/**
 * Global error boundary component
 * Catches and displays runtime errors with a retry button and error details.
 * Displayed by Next.js App Router when an unhandled error occurs in a route segment.
 * Logs errors to the audit log service when available.
 *
 * Features:
 * - Centered card layout with brand logo
 * - Error message display with optional detail expansion
 * - Retry button to attempt recovery via reset()
 * - Go to Dashboard fallback navigation
 * - Audit log integration for error tracking
 * - Follows application visual design system
 *
 * @param {object} props
 * @param {Error} props.error - The error that was thrown
 * @param {Function} props.reset - Function to attempt recovery by re-rendering the segment
 * @returns {React.ReactElement}
 */
export default function Error({ error, reset }) {
  /**
   * Log the error to the audit log service when it occurs
   * Uses a dynamic import to avoid blocking the error boundary if the service fails
   */
  useEffect(() => {
    console.error('[Error Boundary]', error);

    async function logError() {
      try {
        const { log } = await import('@/services/audit-log-service');
        await log('update', 'system', {
          action: 'error_boundary',
          errorMessage: error?.message || 'Unknown error',
          errorName: error?.name || 'Error',
          errorStack: error?.stack ? error.stack.slice(0, 500) : undefined,
        }, {
          entityType: 'system',
          entityId: 'error-boundary',
        });
      } catch {
        // Audit log failure should not block the error boundary
        console.warn('[Error Boundary] Failed to write audit log for error');
      }
    }

    logError();
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-card p-8 space-y-6">
          {/* Brand header */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex items-center justify-center h-12 w-12 rounded-xl bg-brand-600 text-white font-bold text-lg"
              aria-hidden="true"
            >
              S
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
                {APP_NAME}
              </h1>
            </div>
          </div>

          {/* Error illustration */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-red-400">
              <svg
                className="h-16 w-16 mx-auto"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-neutral-800">
              Something Went Wrong
            </h2>
            <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">
              An unexpected error occurred. You can try again or head back to the dashboard.
            </p>
          </div>

          {/* Error details */}
          {error?.message && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700 break-words">
                {error.message}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={() => reset()}
            >
              Try Again
            </Button>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => {
                window.location.href = '/';
              }}
            >
              Go to Dashboard
            </Button>
          </div>

          <p className="text-xs text-neutral-400 text-center">
            Stockland Real Estate — Pilot Environment
          </p>
        </div>
      </div>
    </div>
  );
}