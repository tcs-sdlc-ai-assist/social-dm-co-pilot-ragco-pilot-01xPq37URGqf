'use client';

import StatusBadge from '@/components/common/StatusBadge';
import PlatformIcon from '@/components/common/PlatformIcon';
import { formatTimestamp, truncateText } from '@/utils/formatters';
import { STATUS } from '@/utils/constants';

/**
 * Size variant mappings for the DM list item
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    item: 'px-3 py-2.5',
    sender: 'text-sm',
    preview: 'text-xs',
    meta: 'text-xs',
  },
  md: {
    item: 'px-4 py-3',
    sender: 'text-sm',
    preview: 'text-sm',
    meta: 'text-xs',
  },
  lg: {
    item: 'px-5 py-4',
    sender: 'text-base',
    preview: 'text-sm',
    meta: 'text-sm',
  },
});

/**
 * Unread dot indicator for New DMs
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes
 * @returns {React.ReactElement}
 */
function UnreadDot({ className }) {
  return (
    <span
      className={`inline-block rounded-full bg-blue-500 ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Escalation warning icon for Escalated DMs
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes
 * @returns {React.ReactElement}
 */
function EscalationIcon({ className }) {
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

/**
 * DMListItem component
 * Individual DM list item for the inbox panel. Displays sender name, handle,
 * platform icon, timestamp, content preview, status badge, and optional
 * inquiry type and confidence indicators. Supports click and keyboard
 * selection with visual highlight for the selected state.
 *
 * Implements DM list item display for DMInboxService (SCRUM-6529)
 *
 * Features:
 * - Sender name and handle display with platform icon
 * - Relative timestamp formatting
 * - Content preview with truncation
 * - Status badge (New, Drafted, Sent, Escalated)
 * - Unread (New) visual indicator dot
 * - Escalated visual indicator with warning icon and background tint
 * - Inquiry type badge when available
 * - Confidence percentage when available
 * - Selected state with brand-colored left border and background
 * - Keyboard accessible (Enter/Space to select)
 * - ARIA role="option" with aria-selected for listbox integration
 *
 * @param {object} props
 * @param {object} props.dm - DM object
 * @param {string} props.dm.id - DM identifier
 * @param {object} props.dm.sender - Sender information
 * @param {string} props.dm.sender.name - Sender display name
 * @param {string} [props.dm.sender.handle] - Sender handle
 * @param {string} [props.dm.sender.platform] - Platform identifier
 * @param {string} props.dm.timestamp - ISO timestamp
 * @param {string} props.dm.content - Message content
 * @param {string} props.dm.status - DM status (New, Drafted, Sent, Escalated)
 * @param {object} [props.dm.metadata] - DM metadata
 * @param {string} [props.dm.metadata.inquiryType] - Type of inquiry
 * @param {number} [props.dm.metadata.confidence] - Confidence score (0-1)
 * @param {boolean} [props.isSelected=false] - Whether this DM is currently selected
 * @param {Function} [props.onSelect] - Callback when the DM is clicked (receives dmId)
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the list item
 * @param {number} [props.previewLength=120] - Maximum character length for content preview
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <DMListItem
 *   dm={dmObject}
 *   isSelected={selectedId === dmObject.id}
 *   onSelect={handleSelectDM}
 * />
 *
 * @example
 * <DMListItem
 *   dm={dmObject}
 *   isSelected={false}
 *   onSelect={handleSelect}
 *   size="sm"
 *   previewLength={80}
 * />
 */
export function DMListItem({
  dm,
  isSelected = false,
  onSelect,
  size = 'md',
  previewLength = 120,
  className = '',
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  const isNew = dm.status === STATUS.NEW;
  const isEscalated = dm.status === STATUS.ESCALATED;

  const senderName = dm.sender?.name || 'Unknown Sender';
  const senderHandle = dm.sender?.handle || '';
  const platform = dm.sender?.platform || '';
  const timestamp = dm.timestamp || '';
  const content = dm.content || '';
  const status = dm.status || STATUS.NEW;
  const inquiryType = dm.metadata?.inquiryType || null;
  const confidence = dm.metadata?.confidence;

  const itemClasses = [
    'relative flex flex-col gap-1.5 border-b border-neutral-200 cursor-pointer transition-colors',
    sizeClass.item,
    isSelected
      ? 'bg-brand-50 border-l-4 border-l-brand-500'
      : 'border-l-4 border-l-transparent hover:bg-neutral-50',
    isEscalated && !isSelected ? 'bg-red-50/50' : '',
    isNew && !isSelected ? 'bg-blue-50/30' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  /**
   * Handles click on the list item
   */
  function handleClick() {
    if (typeof onSelect === 'function') {
      onSelect(dm.id);
    }
  }

  /**
   * Handles keyboard activation (Enter or Space)
   *
   * @param {React.KeyboardEvent} event
   */
  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }

  return (
    <div
      className={itemClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="option"
      aria-selected={isSelected}
      aria-label={`DM from ${senderName}, status: ${status}`}
      tabIndex={0}
    >
      {/* Top row: sender info, platform, timestamp */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Unread indicator */}
          {isNew && <UnreadDot className="h-2 w-2 shrink-0" />}

          {/* Escalation indicator */}
          {isEscalated && (
            <EscalationIcon className="h-4 w-4 shrink-0 text-red-500" />
          )}

          {/* Platform icon */}
          <PlatformIcon platform={platform} size="sm" />

          {/* Sender name */}
          <span
            className={`font-semibold text-neutral-900 truncate ${sizeClass.sender} ${isNew ? 'font-bold' : ''}`}
          >
            {senderName}
          </span>

          {/* Sender handle */}
          {senderHandle && (
            <span className={`text-neutral-500 truncate hidden sm:inline ${sizeClass.meta}`}>
              {senderHandle}
            </span>
          )}
        </div>

        {/* Timestamp */}
        <span className={`text-neutral-500 shrink-0 whitespace-nowrap ${sizeClass.meta}`}>
          {formatTimestamp(timestamp)}
        </span>
      </div>

      {/* Middle row: content preview */}
      <p className={`text-neutral-600 leading-snug truncate ${sizeClass.preview} ${isNew ? 'font-medium text-neutral-800' : ''}`}>
        {truncateText(content, previewLength)}
      </p>

      {/* Bottom row: status badge, inquiry type, and confidence */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} size="sm" />

          {inquiryType && (
            <span className="badge badge-neutral text-xs">
              {inquiryType}
            </span>
          )}
        </div>

        {/* Confidence indicator if available */}
        {confidence !== undefined && confidence !== null && (
          <span className={`text-neutral-400 ${sizeClass.meta}`}>
            {Math.round(confidence * 100)}% conf
          </span>
        )}
      </div>
    </div>
  );
}

export default DMListItem;