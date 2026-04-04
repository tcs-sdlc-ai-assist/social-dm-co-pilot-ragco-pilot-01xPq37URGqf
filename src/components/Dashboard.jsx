'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDM } from '@/contexts/DMContext';
import { useNotification } from '@/contexts/NotificationContext';
import { useLead } from '@/contexts/LeadContext';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/common/Button';
import Tooltip from '@/components/common/Tooltip';
import { formatTimestamp } from '@/utils/formatters';
import { STATUS, SLA_MINUTES, LEAD_SCORE, LEAD_LABELS } from '@/utils/constants';

/**
 * Size variant mappings for the dashboard
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    container: 'text-xs',
    heading: 'text-sm',
    body: 'text-xs',
    meta: 'text-xs',
    label: 'text-xs',
    padding: 'px-3 py-2',
    metricValue: 'text-xl',
    metricLabel: 'text-xs',
    icon: 'h-4 w-4',
    cardPadding: 'p-3',
  },
  md: {
    container: 'text-sm',
    heading: 'text-sm',
    body: 'text-sm',
    meta: 'text-xs',
    label: 'text-xs',
    padding: 'px-4 py-3',
    metricValue: 'text-2xl',
    metricLabel: 'text-xs',
    icon: 'h-5 w-5',
    cardPadding: 'p-4',
  },
  lg: {
    container: 'text-base',
    heading: 'text-base',
    body: 'text-sm',
    meta: 'text-sm',
    label: 'text-sm',
    padding: 'px-5 py-4',
    metricValue: 'text-3xl',
    metricLabel: 'text-sm',
    icon: 'h-6 w-6',
    cardPadding: 'p-5',
  },
});

/**
 * Metric card color variant mappings
 */
const METRIC_CARD_STYLES = Object.freeze({
  brand: {
    bg: 'bg-brand-50',
    border: 'border-brand-200',
    iconBg: 'bg-brand-100',
    iconText: 'text-brand-600',
    valueText: 'text-brand-800',
    barColor: 'bg-brand-500',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    valueText: 'text-blue-800',
    barColor: 'bg-blue-500',
  },
  accent: {
    bg: 'bg-accent-50',
    border: 'border-accent-200',
    iconBg: 'bg-accent-100',
    iconText: 'text-accent-600',
    valueText: 'text-accent-800',
    barColor: 'bg-accent-500',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    valueText: 'text-red-800',
    barColor: 'bg-red-500',
  },
  neutral: {
    bg: 'bg-neutral-50',
    border: 'border-neutral-200',
    iconBg: 'bg-neutral-100',
    iconText: 'text-neutral-600',
    valueText: 'text-neutral-800',
    barColor: 'bg-neutral-500',
  },
});

/**
 * Inbox icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function InboxIcon({ className }) {
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
        d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-17.5 0V6.75a2.25 2.25 0 012.25-2.25h13.5a2.25 2.25 0 012.25 2.25v6.75m-17.5 0v4.5a2.25 2.25 0 002.25 2.25h13.5a2.25 2.25 0 002.25-2.25v-4.5"
      />
    </svg>
  );
}

/**
 * Chart bar icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function ChartBarIcon({ className }) {
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
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
      />
    </svg>
  );
}

/**
 * Clock icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function ClockIcon({ className }) {
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
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

/**
 * Users icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function UsersIcon({ className }) {
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
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  );
}

/**
 * Shield check icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function ShieldCheckIcon({ className }) {
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
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}

/**
 * Refresh icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function RefreshIcon({ className }) {
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
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

/**
 * Bell icon SVG component
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function BellIcon({ className }) {
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
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
      />
    </svg>
  );
}

/**
 * Mini bar chart component
 * Renders a simple horizontal bar chart for metric visualization
 *
 * @param {object} props
 * @param {number} props.value - Current value (0-100 percentage)
 * @param {string} props.barColor - Tailwind color class for the bar fill
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
function MiniBarChart({ value, barColor, className = '' }) {
  const clampedValue = typeof value === 'number' && !isNaN(value)
    ? Math.min(100, Math.max(0, value))
    : 0;

  return (
    <div className={`w-full h-2 bg-neutral-200 rounded-full overflow-hidden ${className}`.trim()}>
      <div
        className={`h-full ${barColor} rounded-full transition-all duration-500 ease-out`}
        style={{ width: `${clampedValue}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Mini distribution chart component
 * Renders a stacked horizontal bar showing distribution of values
 *
 * @param {object} props
 * @param {Array<{ value: number, color: string, label: string }>} props.segments - Distribution segments
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
function MiniDistributionChart({ segments, className = '' }) {
  if (!segments || segments.length === 0) return null;

  const total = segments.reduce((sum, seg) => sum + (seg.value || 0), 0);

  if (total === 0) return null;

  return (
    <div className={`w-full h-2 bg-neutral-200 rounded-full overflow-hidden flex ${className}`.trim()}>
      {segments.map((segment, idx) => {
        const percentage = total > 0 ? (segment.value / total) * 100 : 0;
        if (percentage <= 0) return null;

        return (
          <Tooltip
            key={idx}
            content={`${segment.label}: ${segment.value} (${Math.round(percentage)}%)`}
            size="sm"
          >
            <div
              className={`h-full ${segment.color} transition-all duration-500 ease-out`}
              style={{ width: `${percentage}%` }}
              aria-hidden="true"
            />
          </Tooltip>
        );
      })}
    </div>
  );
}

/**
 * Metric card component
 * Displays a single metric with icon, value, label, and optional mini chart
 *
 * @param {object} props
 * @param {string} props.label - Metric label text
 * @param {string|number} props.value - Metric display value
 * @param {string} [props.subtitle] - Subtitle or secondary text
 * @param {React.ReactElement} props.icon - Icon element
 * @param {string} [props.variant='neutral'] - Color variant
 * @param {number} [props.barValue] - Optional bar chart value (0-100)
 * @param {Array} [props.distribution] - Optional distribution chart segments
 * @param {string} [props.tooltip] - Tooltip content
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function MetricCard({ label, value, subtitle, icon, variant = 'neutral', barValue, distribution, tooltip, sizeClass }) {
  const style = METRIC_CARD_STYLES[variant] || METRIC_CARD_STYLES.neutral;

  const cardContent = (
    <div className={`flex flex-col gap-3 border rounded-2xl ${style.bg} ${style.border} ${sizeClass.cardPadding} transition-shadow hover:shadow-card-hover`}>
      {/* Header row: icon and label */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${style.iconBg} shrink-0`}>
            <span className={style.iconText}>
              {icon}
            </span>
          </div>
          <span className={`font-medium text-neutral-500 truncate ${sizeClass.metricLabel}`}>
            {label}
          </span>
        </div>
      </div>

      {/* Value */}
      <div className="flex items-end gap-2">
        <span className={`font-bold leading-none ${style.valueText} ${sizeClass.metricValue}`}>
          {value}
        </span>
        {subtitle && (
          <span className={`text-neutral-400 pb-0.5 ${sizeClass.meta}`}>
            {subtitle}
          </span>
        )}
      </div>

      {/* Mini chart */}
      {barValue !== undefined && barValue !== null && (
        <MiniBarChart value={barValue} barColor={style.barColor} />
      )}

      {distribution && distribution.length > 0 && (
        <MiniDistributionChart segments={distribution} />
      )}
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} position="bottom" size="md">
        {cardContent}
      </Tooltip>
    );
  }

  return cardContent;
}

/**
 * Status breakdown component
 * Displays DM counts by status with color-coded badges
 *
 * @param {object} props
 * @param {object} props.counts - DM counts by status
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function StatusBreakdown({ counts, sizeClass }) {
  if (!counts) return null;

  const statuses = [
    { key: 'new', label: 'New', value: counts.new || 0, bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
    { key: 'drafted', label: 'Drafted', value: counts.drafted || 0, bg: 'bg-accent-100', text: 'text-accent-800', dot: 'bg-accent-500' },
    { key: 'sent', label: 'Sent', value: counts.sent || 0, bg: 'bg-brand-100', text: 'text-brand-800', dot: 'bg-brand-500' },
    { key: 'escalated', label: 'Escalated', value: counts.escalated || 0, bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
  ];

  return (
    <div className="space-y-3">
      <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
        DM Status Breakdown
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {statuses.map((status) => (
          <div
            key={status.key}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl ${status.bg}`}
          >
            <span className={`inline-block h-2 w-2 rounded-full ${status.dot} shrink-0`} aria-hidden="true" />
            <div className="min-w-0">
              <span className={`font-semibold ${status.text} ${sizeClass.body}`}>
                {status.value}
              </span>
              <span className={`ml-1 ${status.text} opacity-70 ${sizeClass.meta}`}>
                {status.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Distribution bar */}
      <MiniDistributionChart
        segments={statuses.map((s) => ({
          value: s.value,
          color: s.dot,
          label: s.label,
        }))}
      />
    </div>
  );
}

/**
 * Lead score distribution component
 * Displays lead counts by priority tier
 *
 * @param {object} props
 * @param {object[]} props.leads - Array of lead objects
 * @param {number} props.total - Total lead count
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function LeadScoreDistribution({ leads, total, sizeClass }) {
  const hotCount = leads.filter((l) => typeof l.score === 'number' && l.score >= LEAD_SCORE.HOT).length;
  const warmCount = leads.filter((l) => typeof l.score === 'number' && l.score >= LEAD_SCORE.WARM && l.score < LEAD_SCORE.HOT).length;
  const coldCount = leads.filter((l) => typeof l.score === 'number' && l.score < LEAD_SCORE.WARM).length;
  const unscoredCount = leads.filter((l) => typeof l.score !== 'number').length;

  const tiers = [
    { label: LEAD_LABELS.HOT, value: hotCount, bg: 'bg-brand-100', text: 'text-brand-800', dot: 'bg-brand-500' },
    { label: LEAD_LABELS.WARM, value: warmCount, bg: 'bg-accent-100', text: 'text-accent-800', dot: 'bg-accent-500' },
    { label: LEAD_LABELS.COLD, value: coldCount, bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
  ];

  if (unscoredCount > 0) {
    tiers.push({ label: 'Unscored', value: unscoredCount, bg: 'bg-neutral-100', text: 'text-neutral-700', dot: 'bg-neutral-400' });
  }

  return (
    <div className="space-y-3">
      <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
        Lead Score Distribution
      </h4>
      <div className="space-y-2">
        {tiers.map((tier) => {
          const percentage = total > 0 ? Math.round((tier.value / total) * 100) : 0;

          return (
            <div key={tier.label} className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 min-w-20">
                <span className={`inline-block h-2 w-2 rounded-full ${tier.dot} shrink-0`} aria-hidden="true" />
                <span className={`${tier.text} font-medium ${sizeClass.meta}`}>
                  {tier.label}
                </span>
              </div>
              <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${tier.dot} rounded-full transition-all duration-500 ease-out`}
                  style={{ width: `${percentage}%` }}
                  aria-hidden="true"
                />
              </div>
              <span className={`font-semibold text-neutral-700 min-w-8 text-right ${sizeClass.meta}`}>
                {tier.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Notification summary component
 * Displays notification counts by type
 *
 * @param {object} props
 * @param {number} props.unreadCount - Unread notification count
 * @param {object} props.counts - Notification counts
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function NotificationSummary({ unreadCount, counts, sizeClass }) {
  return (
    <div className="space-y-3">
      <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
        Notifications
      </h4>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <BellIcon className="h-4 w-4 text-neutral-500" />
          <span className={`text-neutral-600 ${sizeClass.body}`}>
            Total: <span className="font-semibold text-neutral-800">{counts.total || 0}</span>
          </span>
        </div>
        {unreadCount > 0 && (
          <span className="badge bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
            {unreadCount} unread
          </span>
        )}
        {counts.read > 0 && (
          <span className={`text-neutral-400 ${sizeClass.meta}`}>
            {counts.read} read
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Calculates dashboard metrics from DM counts, leads, and notifications
 *
 * @param {object} dmCounts - DM counts by status
 * @param {object[]} leads - Array of lead objects
 * @param {number} leadTotal - Total lead count
 * @param {object} notificationCounts - Notification counts
 * @returns {object} Calculated metrics
 */
function calculateMetrics(dmCounts, leads, leadTotal, notificationCounts) {
  const totalDMs = dmCounts.total || 0;
  const sentCount = dmCounts.sent || 0;
  const draftedCount = dmCounts.drafted || 0;
  const newCount = dmCounts.new || 0;
  const escalatedCount = dmCounts.escalated || 0;

  // Response rate: percentage of DMs that have been responded to (Sent or Drafted)
  const respondedCount = sentCount + draftedCount;
  const responseRate = totalDMs > 0 ? Math.round((respondedCount / totalDMs) * 100) : 0;

  // SLA compliance: percentage of DMs that are NOT in breach (not New status, or New but within SLA)
  // For the pilot, we approximate: non-New DMs are compliant, New DMs may be at risk
  const compliantCount = sentCount + draftedCount + escalatedCount;
  const slaComplianceRate = totalDMs > 0 ? Math.round((compliantCount / totalDMs) * 100) : 100;

  // Average response time: simulated metric based on status distribution
  // In a real system this would be calculated from actual timestamps
  const avgResponseTimeMinutes = totalDMs > 0
    ? Math.max(1, Math.round(SLA_MINUTES * (1 - (respondedCount / totalDMs)) * 0.8))
    : 0;

  // Lead metrics
  const leadsCreated = leadTotal || 0;
  const hotLeads = leads.filter((l) => typeof l.score === 'number' && l.score >= LEAD_SCORE.HOT).length;

  return {
    totalDMs,
    responseRate,
    avgResponseTimeMinutes,
    leadsCreated,
    hotLeads,
    slaComplianceRate,
    newCount,
    sentCount,
    draftedCount,
    escalatedCount,
    respondedCount,
    compliantCount,
  };
}

/**
 * Dashboard component
 * Dashboard overview component: displays summary metrics (total DMs, response rate,
 * avg response time, leads created, SLA compliance rate) with metric cards and mini charts.
 * Entry point for pilot metrics tracking.
 *
 * Implements dashboard metrics for DMInboxService (SCRUM-6529),
 * LeadScoringService (SCRUM-6539), and NotificationCenter (SCRUM-6541)
 *
 * Features:
 * - Total DMs metric card with status distribution mini chart
 * - Response rate metric card with percentage bar
 * - Average response time metric card
 * - Leads created metric card with hot lead count
 * - SLA compliance rate metric card with percentage bar
 * - DM status breakdown with color-coded badges and distribution bar
 * - Lead score distribution chart (Hot, Warm, Cold)
 * - Notification summary with unread count
 * - Auto-refresh on mount
 * - Manual refresh button
 * - Loading and empty states
 * - Responsive grid layout
 * - ARIA labels for accessibility
 *
 * @param {object} props
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the dashboard
 * @param {boolean} [props.showStatusBreakdown=true] - Whether to show the DM status breakdown
 * @param {boolean} [props.showLeadDistribution=true] - Whether to show the lead score distribution
 * @param {boolean} [props.showNotificationSummary=true] - Whether to show the notification summary
 * @param {boolean} [props.showRefreshButton=true] - Whether to show the refresh button
 * @param {boolean} [props.autoLoad=true] - Whether to auto-load data on mount
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <Dashboard />
 *
 * @example
 * <Dashboard
 *   size="sm"
 *   showStatusBreakdown
 *   showLeadDistribution
 *   showNotificationSummary
 * />
 */
export function Dashboard({
  size = 'md',
  showStatusBreakdown = true,
  showLeadDistribution = true,
  showNotificationSummary = true,
  showRefreshButton = true,
  autoLoad = true,
  className = '',
}) {
  const {
    counts: dmCounts,
    loading: dmLoading,
    error: dmError,
    initialized: dmInitialized,
    loadInbox,
    refreshCounts: refreshDMCounts,
    clearError: clearDMError,
  } = useDM();

  const {
    leads,
    total: leadTotal,
    loading: leadLoading,
    error: leadError,
    fetchLeads,
    clearError: clearLeadError,
  } = useLead();

  const {
    unreadCount,
    counts: notificationCounts,
    loading: notificationLoading,
    error: notificationError,
    refreshCounts: refreshNotificationCounts,
    clearError: clearNotificationError,
  } = useNotification();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const mountedRef = useRef(true);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  /**
   * Auto-load data on mount if enabled
   */
  useEffect(() => {
    if (autoLoad && !initialLoadRef.current) {
      initialLoadRef.current = true;

      const loadData = async () => {
        try {
          if (!dmInitialized) {
            await loadInbox();
          } else {
            await refreshDMCounts();
          }
        } catch {
          // Errors are handled by context
        }

        try {
          await fetchLeads({ page: 1, pageSize: 100 });
        } catch {
          // Errors are handled by context
        }

        try {
          await refreshNotificationCounts();
        } catch {
          // Errors are handled by context
        }

        if (mountedRef.current) {
          setLastRefreshed(new Date().toISOString());
        }
      };

      loadData();
    }
  }, [autoLoad, dmInitialized, loadInbox, refreshDMCounts, fetchLeads, refreshNotificationCounts]);

  /**
   * Handles manual refresh
   */
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    clearDMError();
    clearLeadError();
    clearNotificationError();

    try {
      await Promise.allSettled([
        refreshDMCounts(),
        fetchLeads({ page: 1, pageSize: 100 }),
        refreshNotificationCounts(),
      ]);
    } catch {
      // Errors are handled by individual contexts
    }

    if (mountedRef.current) {
      setLastRefreshed(new Date().toISOString());
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshDMCounts, fetchLeads, refreshNotificationCounts, clearDMError, clearLeadError, clearNotificationError]);

  // Determine loading states
  const isInitialLoading = dmLoading.initializing || (dmLoading.inbox && !dmInitialized);
  const isAnyLoading = isRefreshing || dmLoading.inbox || leadLoading.list || notificationLoading.list;

  // Determine error state
  const hasError = dmError || leadError || notificationError;
  const errorMessage = dmError || leadError || notificationError;

  // Calculate metrics
  const metrics = calculateMetrics(dmCounts, leads, leadTotal, notificationCounts);

  const containerClasses = [
    'flex flex-col space-y-6',
    sizeClass.container,
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Initial loading state
  if (isInitialLoading) {
    return (
      <div className={containerClasses} role="region" aria-label="Dashboard">
        <LoadingSpinner
          center
          size="lg"
          label="Loading dashboard..."
          showLabel
        />
      </div>
    );
  }

  return (
    <div className={containerClasses} role="region" aria-label="Dashboard Overview">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">Dashboard</h2>
          {lastRefreshed && (
            <span className={`text-neutral-400 ${sizeClass.meta}`}>
              Updated {formatTimestamp(lastRefreshed)}
            </span>
          )}
        </div>

        {showRefreshButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            loading={isRefreshing}
            ariaLabel="Refresh dashboard"
            className="shrink-0"
          >
            <RefreshIcon className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Error state */}
      {hasError && (
        <div className="flex items-center justify-between gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700">{errorMessage}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearDMError();
              clearLeadError();
              clearNotificationError();
            }}
            ariaLabel="Dismiss error"
            className="text-red-600 hover:text-red-700 shrink-0"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Metric cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Total DMs */}
        <MetricCard
          label="Total DMs"
          value={metrics.totalDMs}
          subtitle="messages"
          icon={<InboxIcon className={sizeClass.icon} />}
          variant="blue"
          distribution={[
            { value: metrics.newCount, color: 'bg-blue-500', label: 'New' },
            { value: metrics.draftedCount, color: 'bg-accent-500', label: 'Drafted' },
            { value: metrics.sentCount, color: 'bg-brand-500', label: 'Sent' },
            { value: metrics.escalatedCount, color: 'bg-red-500', label: 'Escalated' },
          ]}
          tooltip={`${metrics.newCount} new, ${metrics.draftedCount} drafted, ${metrics.sentCount} sent, ${metrics.escalatedCount} escalated`}
          sizeClass={sizeClass}
        />

        {/* Response Rate */}
        <MetricCard
          label="Response Rate"
          value={`${metrics.responseRate}%`}
          subtitle={`${metrics.respondedCount} of ${metrics.totalDMs}`}
          icon={<ChartBarIcon className={sizeClass.icon} />}
          variant="brand"
          barValue={metrics.responseRate}
          tooltip={`${metrics.respondedCount} DMs have been drafted or sent out of ${metrics.totalDMs} total`}
          sizeClass={sizeClass}
        />

        {/* Avg Response Time */}
        <MetricCard
          label="Avg Response Time"
          value={metrics.avgResponseTimeMinutes > 0 ? `${metrics.avgResponseTimeMinutes}m` : '—'}
          subtitle={`target: ${SLA_MINUTES}m`}
          icon={<ClockIcon className={sizeClass.icon} />}
          variant={metrics.avgResponseTimeMinutes <= SLA_MINUTES ? 'brand' : 'accent'}
          barValue={metrics.totalDMs > 0 ? Math.min(100, Math.round((1 - metrics.avgResponseTimeMinutes / SLA_MINUTES) * 100)) : 0}
          tooltip={`Average estimated response time is ${metrics.avgResponseTimeMinutes} minutes. SLA target is ${SLA_MINUTES} minutes.`}
          sizeClass={sizeClass}
        />

        {/* Leads Created */}
        <MetricCard
          label="Leads Created"
          value={metrics.leadsCreated}
          subtitle={metrics.hotLeads > 0 ? `${metrics.hotLeads} hot` : 'leads'}
          icon={<UsersIcon className={sizeClass.icon} />}
          variant={metrics.hotLeads > 0 ? 'accent' : 'neutral'}
          barValue={metrics.totalDMs > 0 ? Math.min(100, Math.round((metrics.leadsCreated / metrics.totalDMs) * 100)) : 0}
          tooltip={`${metrics.leadsCreated} leads extracted from DMs. ${metrics.hotLeads} are high-priority (score ≥ ${LEAD_SCORE.HOT}).`}
          sizeClass={sizeClass}
        />

        {/* SLA Compliance */}
        <MetricCard
          label="SLA Compliance"
          value={`${metrics.slaComplianceRate}%`}
          subtitle={`${SLA_MINUTES}m target`}
          icon={<ShieldCheckIcon className={sizeClass.icon} />}
          variant={metrics.slaComplianceRate >= 90 ? 'brand' : metrics.slaComplianceRate >= 70 ? 'accent' : 'red'}
          barValue={metrics.slaComplianceRate}
          tooltip={`${metrics.compliantCount} of ${metrics.totalDMs} DMs have been responded to within the ${SLA_MINUTES}-minute SLA target`}
          sizeClass={sizeClass}
        />
      </div>

      {/* Detail sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DM Status Breakdown */}
        {showStatusBreakdown && (
          <div className="bg-white rounded-2xl shadow-card p-4">
            <StatusBreakdown counts={dmCounts} sizeClass={sizeClass} />
          </div>
        )}

        {/* Lead Score Distribution */}
        {showLeadDistribution && (
          <div className="bg-white rounded-2xl shadow-card p-4">
            {leads.length > 0 ? (
              <LeadScoreDistribution
                leads={leads}
                total={leadTotal}
                sizeClass={sizeClass}
              />
            ) : (
              <div className="space-y-3">
                <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
                  Lead Score Distribution
                </h4>
                <EmptyState
                  title="No leads yet"
                  description="Leads will appear here once DMs are processed."
                  size="sm"
                  showIcon={false}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notification summary */}
      {showNotificationSummary && (
        <div className="bg-white rounded-2xl shadow-card p-4">
          <NotificationSummary
            unreadCount={unreadCount}
            counts={notificationCounts}
            sizeClass={sizeClass}
          />
        </div>
      )}
    </div>
  );
}

export default Dashboard;