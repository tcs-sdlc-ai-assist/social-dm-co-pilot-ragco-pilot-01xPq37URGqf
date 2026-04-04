'use client';

import LoadingSpinner from '@/components/common/LoadingSpinner';
import { APP_NAME } from '@/utils/constants';

/**
 * Global loading component
 * Displayed by Next.js App Router during page transitions and async data loading.
 * Renders a centered full-screen LoadingSpinner with the application name.
 *
 * @returns {React.ReactElement}
 */
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <LoadingSpinner
        size="xl"
        color="brand"
        label={`Loading ${APP_NAME}...`}
        showLabel
      />
    </div>
  );
}