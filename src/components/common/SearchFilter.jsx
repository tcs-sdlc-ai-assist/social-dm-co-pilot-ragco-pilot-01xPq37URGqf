'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { STATUS, STATUS_LIST, PLATFORM, PLATFORM_LIST } from '@/utils/constants';

/**
 * Sort option definitions for the inbox
 */
const SORT_OPTIONS = Object.freeze([
  { value: 'timestamp:desc', label: 'Newest First' },
  { value: 'timestamp:asc', label: 'Oldest First' },
  { value: 'sender.name:asc', label: 'Sender A–Z' },
  { value: 'sender.name:desc', label: 'Sender Z–A' },
  { value: 'status:asc', label: 'Status A–Z' },
  { value: 'status:desc', label: 'Status Z–A' },
]);

/**
 * Platform filter options including an "All" option
 */
const PLATFORM_OPTIONS = Object.freeze([
  { value: '', label: 'All Platforms' },
  ...PLATFORM_LIST.map((p) => ({ value: p, label: p })),
]);

/**
 * Status filter options including an "All" option
 */
const STATUS_OPTIONS = Object.freeze([
  { value: '', label: 'All Statuses' },
  ...STATUS_LIST.map((s) => ({ value: s, label: s })),
]);

/**
 * Size variant mappings for the search filter bar
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    container: 'gap-2',
    input: 'px-3 py-1.5 text-xs',
    select: 'px-2 py-1.5 text-xs',
    icon: 'h-3.5 w-3.5',
    button: 'px-2 py-1.5 text-xs',
  },
  md: {
    container: 'gap-3',
    input: 'px-3 py-2 text-sm',
    select: 'px-3 py-2 text-sm',
    icon: 'h-4 w-4',
    button: 'px-3 py-2 text-sm',
  },
  lg: {
    container: 'gap-4',
    input: 'px-4 py-2.5 text-base',
    select: 'px-4 py-2.5 text-base',
    icon: 'h-5 w-5',
    button: 'px-4 py-2.5 text-base',
  },
});

/**
 * Search icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function SearchIcon({ className }) {
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
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

/**
 * Clear icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function ClearIcon({ className }) {
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
 * SearchFilter component
 * Search and filter bar with text search input (debounced), platform filter dropdown,
 * status filter dropdown, and sort options for the DM inbox.
 *
 * Implements search and filter UI for DMInboxService (SCRUM-6529)
 *
 * Features:
 * - Debounced text search input (300ms default) to avoid excessive service calls
 * - Platform filter dropdown (All, Facebook, Instagram)
 * - Status filter dropdown (All, New, Drafted, Sent, Escalated)
 * - Sort options dropdown (Newest/Oldest, Sender A-Z/Z-A, Status A-Z/Z-A)
 * - Clear all filters button when any filter is active
 * - Responsive layout: stacks on small screens, inline on larger screens
 * - ARIA labels for accessibility
 *
 * @param {object} props
 * @param {string} [props.query=''] - Current search query string
 * @param {string} [props.platform=''] - Current platform filter value
 * @param {string[]} [props.status=[]] - Current status filter values
 * @param {string} [props.sortBy='timestamp'] - Current sort field
 * @param {string} [props.sortOrder='desc'] - Current sort order ('asc' or 'desc')
 * @param {Function} [props.onQueryChange] - Callback when search query changes (receives debounced value)
 * @param {Function} [props.onPlatformChange] - Callback when platform filter changes
 * @param {Function} [props.onStatusChange] - Callback when status filter changes
 * @param {Function} [props.onSortChange] - Callback when sort option changes (receives { sortBy, sortOrder })
 * @param {Function} [props.onClearAll] - Callback when all filters are cleared
 * @param {number} [props.debounceDelay=300] - Debounce delay in milliseconds for search input
 * @param {string} [props.placeholder='Search DMs...'] - Placeholder text for the search input
 * @param {boolean} [props.showPlatformFilter=true] - Whether to show the platform filter dropdown
 * @param {boolean} [props.showStatusFilter=true] - Whether to show the status filter dropdown
 * @param {boolean} [props.showSortOptions=true] - Whether to show the sort options dropdown
 * @param {boolean} [props.showClearButton=true] - Whether to show the clear all button when filters are active
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the filter bar
 * @param {boolean} [props.disabled=false] - Whether the filter bar is disabled
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <SearchFilter
 *   query={filters.query}
 *   platform={filters.platform}
 *   status={filters.status}
 *   sortBy={filters.sortBy}
 *   sortOrder={filters.sortOrder}
 *   onQueryChange={handleQueryChange}
 *   onPlatformChange={handlePlatformChange}
 *   onStatusChange={handleStatusChange}
 *   onSortChange={handleSortChange}
 *   onClearAll={handleClearAll}
 * />
 *
 * @example
 * <SearchFilter
 *   query={searchQuery}
 *   onQueryChange={setSearchQuery}
 *   showPlatformFilter={false}
 *   showSortOptions={false}
 *   placeholder="Search leads..."
 *   size="sm"
 * />
 */
export function SearchFilter({
  query = '',
  platform = '',
  status = [],
  sortBy = 'timestamp',
  sortOrder = 'desc',
  onQueryChange,
  onPlatformChange,
  onStatusChange,
  onSortChange,
  onClearAll,
  debounceDelay = 300,
  placeholder = 'Search DMs...',
  showPlatformFilter = true,
  showStatusFilter = true,
  showSortOptions = true,
  showClearButton = true,
  size = 'md',
  disabled = false,
  className = '',
}) {
  const [localQuery, setLocalQuery] = useState(query);
  const debouncedQuery = useDebounce(localQuery, debounceDelay);
  const isInitialMount = useRef(true);
  const inputRef = useRef(null);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // Sync external query prop changes into local state
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  // Emit debounced query changes to parent
  useEffect(() => {
    // Skip the initial mount to avoid triggering on first render
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (typeof onQueryChange === 'function') {
      onQueryChange(debouncedQuery);
    }
  }, [debouncedQuery, onQueryChange]);

  /**
   * Handles text input changes
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  function handleQueryInput(event) {
    setLocalQuery(event.target.value);
  }

  /**
   * Clears the search query input
   */
  function handleClearQuery() {
    setLocalQuery('');

    if (typeof onQueryChange === 'function') {
      onQueryChange('');
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  /**
   * Handles platform filter dropdown changes
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   */
  function handlePlatformSelect(event) {
    if (typeof onPlatformChange === 'function') {
      onPlatformChange(event.target.value);
    }
  }

  /**
   * Handles status filter dropdown changes
   * Converts single select value to array format for consistency
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   */
  function handleStatusSelect(event) {
    if (typeof onStatusChange === 'function') {
      const value = event.target.value;
      onStatusChange(value ? [value] : []);
    }
  }

  /**
   * Handles sort option dropdown changes
   * Parses the combined "field:order" value into separate sortBy and sortOrder
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   */
  function handleSortSelect(event) {
    if (typeof onSortChange === 'function') {
      const [newSortBy, newSortOrder] = event.target.value.split(':');
      onSortChange({ sortBy: newSortBy, sortOrder: newSortOrder });
    }
  }

  /**
   * Handles clearing all filters
   */
  function handleClearAll() {
    setLocalQuery('');

    if (typeof onClearAll === 'function') {
      onClearAll();
    }
  }

  /**
   * Handles keydown events on the search input
   * Clears the input when Escape is pressed
   *
   * @param {React.KeyboardEvent<HTMLInputElement>} event
   */
  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      handleClearQuery();
    }
  }

  // Determine if any filter is active (for showing the clear button)
  const hasActiveFilters =
    localQuery.trim().length > 0 ||
    platform.length > 0 ||
    (Array.isArray(status) && status.length > 0) ||
    sortBy !== 'timestamp' ||
    sortOrder !== 'desc';

  // Build the current sort value for the dropdown
  const currentSortValue = `${sortBy}:${sortOrder}`;

  // Determine the current status value for the single-select dropdown
  const currentStatusValue = Array.isArray(status) && status.length > 0 ? status[0] : '';

  const containerClasses = [
    'flex flex-col sm:flex-row sm:items-center sm:flex-wrap',
    sizeClass.container,
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <div className={containerClasses} role="search" aria-label="Filter and search">
      {/* Search input with icon */}
      <div className="relative flex-1 min-w-0 sm:min-w-48">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-400">
          <SearchIcon className={sizeClass.icon} />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={localQuery}
          onChange={handleQueryInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`block w-full pl-10 pr-8 border border-neutral-300 rounded-xl bg-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${sizeClass.input}`.trim()}
          aria-label="Search"
        />

        {/* Clear query button */}
        {localQuery.length > 0 && !disabled && (
          <button
            type="button"
            onClick={handleClearQuery}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-600 transition-colors"
            aria-label="Clear search"
          >
            <ClearIcon className={sizeClass.icon} />
          </button>
        )}
      </div>

      {/* Platform filter dropdown */}
      {showPlatformFilter && (
        <select
          value={platform}
          onChange={handlePlatformSelect}
          disabled={disabled}
          className={`border border-neutral-300 rounded-xl bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${sizeClass.select}`.trim()}
          aria-label="Filter by platform"
        >
          {PLATFORM_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {/* Status filter dropdown */}
      {showStatusFilter && (
        <select
          value={currentStatusValue}
          onChange={handleStatusSelect}
          disabled={disabled}
          className={`border border-neutral-300 rounded-xl bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${sizeClass.select}`.trim()}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {/* Sort options dropdown */}
      {showSortOptions && (
        <select
          value={currentSortValue}
          onChange={handleSortSelect}
          disabled={disabled}
          className={`border border-neutral-300 rounded-xl bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${sizeClass.select}`.trim()}
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {/* Clear all filters button */}
      {showClearButton && hasActiveFilters && !disabled && (
        <button
          type="button"
          onClick={handleClearAll}
          className={`inline-flex items-center justify-center font-medium text-neutral-700 bg-white border border-neutral-300 rounded-xl hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors ${sizeClass.button}`.trim()}
          aria-label="Clear all filters"
        >
          <ClearIcon className={`${sizeClass.icon} mr-1.5`} />
          Clear
        </button>
      )}
    </div>
  );
}

export default SearchFilter;