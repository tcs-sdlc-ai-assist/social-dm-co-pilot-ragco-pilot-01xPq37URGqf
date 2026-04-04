'use client';

import Button from '@/components/common/Button';

/**
 * Size variant mappings for the empty state container
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    container: 'py-6 px-4',
    icon: 'h-8 w-8',
    title: 'text-sm',
    description: 'text-xs',
    gap: 'gap-2',
  },
  md: {
    container: 'py-10 px-6',
    icon: 'h-12 w-12',
    title: 'text-base',
    description: 'text-sm',
    gap: 'gap-3',
  },
  lg: {
    container: 'py-16 px-8',
    icon: 'h-16 w-16',
    title: 'text-lg',
    description: 'text-base',
    gap: 'gap-4',
  },
});

/**
 * Default empty state icon (inbox/document outline)
 * Renders a simple outline icon representing an empty container
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function DefaultIcon({ className }) {
  return (
    <svg
      className={className}
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
        d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-17.5 0V6.75a2.25 2.25 0 012.25-2.25h13.5a2.25 2.25 0 012.25 2.25v6.75m-17.5 0v4.5a2.25 2.25 0 002.25 2.25h13.5a2.25 2.25 0 002.25-2.25v-4.5"
      />
    </svg>
  );
}

/**
 * EmptyState component
 * Displays a centered message with an optional icon and action button
 * when a list or container has no content to show.
 *
 * Used across the application for empty DM inboxes, empty notification lists,
 * empty lead lists, empty search results, and other empty data states.
 *
 * @param {object} props
 * @param {string} [props.title='No items found'] - Primary heading text
 * @param {string} [props.description] - Secondary descriptive text below the title
 * @param {React.ReactNode} [props.icon] - Custom icon element to display above the title
 * @param {boolean} [props.showIcon=true] - Whether to show the icon (default or custom)
 * @param {string} [props.actionLabel] - Label for the optional action button
 * @param {Function} [props.onAction] - Click handler for the optional action button
 * @param {'primary'|'secondary'|'ghost'} [props.actionVariant='primary'] - Variant for the action button
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the empty state
 * @param {boolean} [props.bordered=false] - Whether to show a dashed border around the container
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @param {React.ReactNode} [props.children] - Optional custom content rendered below the description
 * @returns {React.ReactElement}
 *
 * @example
 * <EmptyState title="No DMs yet" description="New messages will appear here." />
 *
 * @example
 * <EmptyState
 *   title="No notifications"
 *   description="You're all caught up!"
 *   showIcon={false}
 * />
 *
 * @example
 * <EmptyState
 *   title="No results found"
 *   description="Try adjusting your search or filters."
 *   actionLabel="Clear Filters"
 *   onAction={handleClearFilters}
 *   actionVariant="secondary"
 * />
 *
 * @example
 * <EmptyState
 *   title="No leads extracted"
 *   description="Leads will appear here once DMs are processed."
 *   size="lg"
 *   bordered
 * />
 */
export function EmptyState({
  title = 'No items found',
  description,
  icon,
  showIcon = true,
  actionLabel,
  onAction,
  actionVariant = 'primary',
  size = 'md',
  bordered = false,
  className = '',
  children,
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  const hasAction = typeof actionLabel === 'string' && actionLabel.trim().length > 0 && typeof onAction === 'function';
  const hasDescription = typeof description === 'string' && description.trim().length > 0;
  const hasTitle = typeof title === 'string' && title.trim().length > 0;

  const containerClasses = [
    'flex flex-col items-center justify-center text-center',
    sizeClass.container,
    sizeClass.gap,
    bordered ? 'border-2 border-dashed border-neutral-300 rounded-2xl' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <div className={containerClasses} role="status" aria-label={hasTitle ? title : 'Empty state'}>
      {/* Icon */}
      {showIcon && (
        <div className="text-neutral-400">
          {icon || <DefaultIcon className={sizeClass.icon} />}
        </div>
      )}

      {/* Title */}
      {hasTitle && (
        <h3 className={`font-semibold text-neutral-700 ${sizeClass.title}`}>
          {title}
        </h3>
      )}

      {/* Description */}
      {hasDescription && (
        <p className={`text-neutral-500 max-w-sm leading-relaxed ${sizeClass.description}`}>
          {description}
        </p>
      )}

      {/* Custom children content */}
      {children && (
        <div className="w-full">
          {children}
        </div>
      )}

      {/* Action button */}
      {hasAction && (
        <div className="mt-1">
          <Button
            variant={actionVariant}
            size={size === 'lg' ? 'md' : 'sm'}
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export default EmptyState;