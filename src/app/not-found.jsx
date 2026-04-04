'use client';

import Button from '@/components/common/Button';
import { APP_NAME } from '@/utils/constants';

/**
 * Custom 404 Not Found page
 * Displays a friendly not-found message with a link back to the dashboard.
 * Follows the application's visual design system with centered card layout,
 * brand logo, and primary action button.
 *
 * @returns {React.ReactElement}
 */
export default function NotFound() {
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

          {/* 404 illustration */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-neutral-400">
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
              Page Not Found
            </h2>
            <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
              Head back to the dashboard to continue.
            </p>
          </div>

          {/* Action */}
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={() => {
              window.location.href = '/';
            }}
          >
            Go to Dashboard
          </Button>

          <p className="text-xs text-neutral-400 text-center">
            Stockland Real Estate — Pilot Environment
          </p>
        </div>
      </div>
    </div>
  );
}