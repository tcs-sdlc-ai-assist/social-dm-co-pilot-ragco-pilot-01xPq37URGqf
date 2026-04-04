'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Button from '@/components/common/Button';
import Tooltip from '@/components/common/Tooltip';
import Toast from '@/components/common/Toast';
import { useDM } from '@/contexts/DMContext';
import { useDraft } from '@/contexts/DraftContext';
import {
  checkConsentBeforeSend,
  validatePrivacyCompliance,
  getComplianceStatus,
  blockNonCompliantAction,
  checkPIIInContent,
  COMPLIANCE_STATUS,
} from '@/services/compliance-service';
import { detectPII } from '@/utils/pii-filter';
import { CONFIDENCE_THRESHOLD } from '@/utils/constants';

/**
 * Size variant mappings for the compliance banner
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    container: 'text-xs',
    heading: 'text-sm',
    body: 'text-xs',
    meta: 'text-xs',
    label: 'text-xs',
    padding: 'px-3 py-2',
    icon: 'h-4 w-4',
  },
  md: {
    container: 'text-sm',
    heading: 'text-sm',
    body: 'text-sm',
    meta: 'text-xs',
    label: 'text-xs',
    padding: 'px-4 py-3',
    icon: 'h-5 w-5',
  },
  lg: {
    container: 'text-base',
    heading: 'text-base',
    body: 'text-sm',
    meta: 'text-sm',
    label: 'text-sm',
    padding: 'px-5 py-4',
    icon: 'h-5 w-5',
  },
});

/**
 * Compliance status style mappings
 */
const STATUS_STYLES = Object.freeze({
  [COMPLIANCE_STATUS.COMPLIANT]: {
    bg: 'bg-brand-50',
    border: 'border-brand-200',
    text: 'text-brand-800',
    iconColor: 'text-brand-600',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-800',
    label: 'Compliant',
  },
  [COMPLIANCE_STATUS.NON_COMPLIANT]: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    iconColor: 'text-red-600',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-800',
    label: 'Non-Compliant',
  },
  [COMPLIANCE_STATUS.REQUIRES_REVIEW]: {
    bg: 'bg-accent-50',
    border: 'border-accent-200',
    text: 'text-accent-800',
    iconColor: 'text-accent-600',
    badgeBg: 'bg-accent-100',
    badgeText: 'text-accent-800',
    label: 'Review Required',
  },
  [COMPLIANCE_STATUS.BLOCKED]: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-900',
    iconColor: 'text-red-700',
    badgeBg: 'bg-red-200',
    badgeText: 'text-red-900',
    label: 'Blocked',
  },
});

/**
 * Default style for unknown compliance statuses
 */
const DEFAULT_STATUS_STYLE = {
  bg: 'bg-neutral-50',
  border: 'border-neutral-200',
  text: 'text-neutral-700',
  iconColor: 'text-neutral-500',
  badgeBg: 'bg-neutral-100',
  badgeText: 'text-neutral-700',
  label: 'Unknown',
};

/**
 * Shield icon SVG component for compliant state
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
 * Shield exclamation icon SVG component for non-compliant state
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function ShieldExclamationIcon({ className }) {
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
        d="M12 9v3.75m0 3.75h.007v.008H12v-.008zM12 2.714A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

/**
 * Lock icon SVG component for blocked state
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function LockIcon({ className }) {
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
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
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
 * Returns the appropriate status icon component
 *
 * @param {string} status - Compliance status
 * @param {string} className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function StatusIcon({ status, className }) {
  switch (status) {
    case COMPLIANCE_STATUS.COMPLIANT:
      return <ShieldCheckIcon className={className} />;
    case COMPLIANCE_STATUS.BLOCKED:
      return <LockIcon className={className} />;
    case COMPLIANCE_STATUS.REQUIRES_REVIEW:
      return <WarningIcon className={className} />;
    case COMPLIANCE_STATUS.NON_COMPLIANT:
      return <ShieldExclamationIcon className={className} />;
    default:
      return <InfoIcon className={className} />;
  }
}

/**
 * Consent status indicator component
 *
 * @param {object} props
 * @param {boolean} props.hasConsent - Whether consent has been given
 * @param {string} [props.consentDate] - Date consent was given
 * @param {string} [props.consentSource] - Source of consent
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function ConsentIndicator({ hasConsent, consentDate, consentSource, sizeClass }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
          Consent Status
        </span>
        <span className={`badge text-xs ${hasConsent ? 'bg-brand-100 text-brand-800' : 'bg-red-100 text-red-800'}`}>
          {hasConsent ? '✓ Verified' : '✗ Not Verified'}
        </span>
      </div>
      {hasConsent && consentSource && (
        <span className={`text-neutral-400 ${sizeClass.meta}`}>
          via {consentSource}
          {consentDate && (
            <span>
              {' '}on {new Date(consentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/**
 * PII detection indicator component
 *
 * @param {object} props
 * @param {boolean} props.hasPII - Whether PII was detected
 * @param {string[]} props.types - Types of PII detected
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function PIIIndicator({ hasPII, types, sizeClass }) {
  if (!hasPII) return null;

  return (
    <div className="flex items-start gap-2 p-2 bg-accent-50 border border-accent-200 rounded-xl">
      <WarningIcon className={`${sizeClass.icon} shrink-0 text-accent-600 mt-0.5`} />
      <div>
        <p className={`font-semibold text-accent-800 ${sizeClass.body}`}>
          PII Detected in Content
        </p>
        <p className={`text-accent-700 ${sizeClass.meta}`}>
          Detected types: {types.join(', ')}. Ensure sender consent is verified before sending.
        </p>
      </div>
    </div>
  );
}

/**
 * Compliance issues list component
 *
 * @param {object} props
 * @param {string[]} props.issues - Array of compliance issue strings
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function ComplianceIssuesList({ issues, sizeClass }) {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
        Compliance Issues ({issues.length})
      </span>
      <ul className="space-y-1">
        {issues.map((issue, idx) => (
          <li
            key={idx}
            className={`flex items-start gap-1.5 text-red-700 ${sizeClass.meta}`}
          >
            <span className="text-red-400 shrink-0 mt-0.5">•</span>
            <span>{issue}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Compliance rules display component
 *
 * @param {object} props
 * @param {object[]} props.rules - Array of compliance rule objects
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function ComplianceRules({ rules, sizeClass }) {
  const [expanded, setExpanded] = useState(false);

  if (!rules || rules.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        className="flex items-center gap-1.5 w-full text-left"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <InfoIcon className={`h-3.5 w-3.5 text-neutral-400 shrink-0`} />
        <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
          Active Compliance Rules ({rules.length})
        </span>
        <svg
          className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="pl-5 space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-start gap-2 p-2 border border-neutral-200 rounded-xl"
            >
              <span className={`badge text-xs shrink-0 ${rule.active ? 'bg-brand-100 text-brand-800' : 'bg-neutral-100 text-neutral-600'}`}>
                {rule.active ? 'Active' : 'Inactive'}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-medium text-neutral-700 ${sizeClass.body}`}>
                  {rule.name}
                </p>
                <p className={`text-neutral-500 ${sizeClass.meta}`}>
                  {rule.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Regulatory references component
 * Displays Australian Privacy Act and Spam Act references
 *
 * @param {object} props
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function RegulatoryReferences({ sizeClass }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        className="flex items-center gap-1.5 w-full text-left"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <svg
          className="h-3.5 w-3.5 text-neutral-400 shrink-0"
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
            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
          />
        </svg>
        <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
          Regulatory References
        </span>
        <svg
          className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="pl-5 space-y-2">
          <div className="p-2.5 border border-neutral-200 rounded-xl space-y-1">
            <p className={`font-semibold text-neutral-700 ${sizeClass.body}`}>
              Australian Privacy Act 1988
            </p>
            <p className={`text-neutral-500 ${sizeClass.meta}`}>
              Requires that personal information is collected, used, and disclosed in accordance with the
              Australian Privacy Principles (APPs). Consent must be obtained before collecting or using
              personal information for direct marketing purposes.
            </p>
            <p className={`text-neutral-400 ${sizeClass.meta}`}>
              APP 6 — Use or disclosure of personal information
            </p>
            <p className={`text-neutral-400 ${sizeClass.meta}`}>
              APP 7 — Direct marketing
            </p>
          </div>

          <div className="p-2.5 border border-neutral-200 rounded-xl space-y-1">
            <p className={`font-semibold text-neutral-700 ${sizeClass.body}`}>
              Spam Act 2003 (Australia)
            </p>
            <p className={`text-neutral-500 ${sizeClass.meta}`}>
              Prohibits sending unsolicited commercial electronic messages without the recipient&apos;s consent.
              Messages must include accurate sender identification and a functional unsubscribe mechanism.
            </p>
            <p className={`text-neutral-400 ${sizeClass.meta}`}>
              Section 16 — Unsolicited commercial electronic messages must not be sent
            </p>
            <p className={`text-neutral-400 ${sizeClass.meta}`}>
              Section 17 — Commercial electronic messages must include accurate sender information
            </p>
          </div>

          <div className="p-2.5 border border-neutral-200 rounded-xl space-y-1">
            <p className={`font-semibold text-neutral-700 ${sizeClass.body}`}>
              Application to Social DM Copilot
            </p>
            <p className={`text-neutral-500 ${sizeClass.meta}`}>
              All outbound DM responses are treated as commercial electronic messages. PII is encrypted at rest
              and stripped from audit logs. Consent must be verified before sending messages containing personal
              information. Low-confidence AI-generated drafts require mandatory human review before sending.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Blocked action banner component
 * Displays when a non-compliant action has been blocked
 *
 * @param {object} props
 * @param {string} props.reason - Reason the action was blocked
 * @param {string} props.timestamp - ISO timestamp of the block
 * @param {Function} props.onDismiss - Callback to dismiss the banner
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function BlockedActionBanner({ reason, timestamp, onDismiss, sizeClass }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-300 rounded-xl">
      <LockIcon className={`${sizeClass.icon} shrink-0 text-red-700 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-red-900 ${sizeClass.body}`}>
          Action Blocked — Non-Compliant
        </p>
        <p className={`text-red-700 ${sizeClass.meta}`}>
          {reason}
        </p>
        {timestamp && (
          <p className={`text-red-400 mt-1 ${sizeClass.meta}`}>
            Blocked at {new Date(timestamp).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
      {typeof onDismiss === 'function' && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 inline-flex items-center justify-center rounded-xl p-1 text-red-400 hover:text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-colors"
          aria-label="Dismiss blocked action banner"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * ComplianceBanner component
 * Compliance banner component: displays privacy compliance status, consent warnings,
 * and blocking messages when non-compliant actions are attempted. Shows Australian
 * Privacy Act and Spam Act references.
 *
 * Implements privacy guardrails per LLD (SCRUM-6533, SCRUM-6536)
 *
 * Features:
 * - Overall compliance status indicator (Compliant, Non-Compliant, Review Required, Blocked)
 * - Consent status display with verification date and source
 * - PII detection indicator for draft content
 * - Compliance issues list with detailed descriptions
 * - Blocked action banner when non-compliant actions are attempted
 * - Active compliance rules display (expandable)
 * - Australian Privacy Act 1988 and Spam Act 2003 regulatory references (expandable)
 * - Low-confidence draft review requirement indicator
 * - Auto-check compliance on DM/draft changes
 * - Manual compliance check action
 * - Dismissible banners and toast notifications
 * - Loading state during compliance checks
 * - ARIA labels for accessibility
 * - Configurable size variants (sm, md, lg)
 *
 * @param {object} props
 * @param {object} [props.dm] - DM object (overrides DMContext selected DM)
 * @param {object} [props.draft] - Draft object (overrides DraftContext current draft)
 * @param {boolean} [props.showConsent=true] - Whether to show consent status
 * @param {boolean} [props.showPII=true] - Whether to show PII detection indicator
 * @param {boolean} [props.showIssues=true] - Whether to show compliance issues list
 * @param {boolean} [props.showRules=false] - Whether to show active compliance rules
 * @param {boolean} [props.showRegulatory=false] - Whether to show regulatory references
 * @param {boolean} [props.showBlockedBanner=true] - Whether to show blocked action banners
 * @param {boolean} [props.showCheckButton=true] - Whether to show the manual check button
 * @param {boolean} [props.autoCheck=true] - Whether to auto-check compliance on DM/draft changes
 * @param {boolean} [props.compact=false] - Whether to use compact layout (status badge only)
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the banner
 * @param {Function} [props.onComplianceChange] - Callback when compliance status changes (receives result)
 * @param {Function} [props.onBlock] - Callback when an action is blocked (receives block result)
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <ComplianceBanner />
 *
 * @example
 * <ComplianceBanner
 *   dm={selectedDM}
 *   draft={currentDraft}
 *   showConsent
 *   showPII
 *   showRegulatory
 *   onComplianceChange={handleComplianceChange}
 * />
 *
 * @example
 * <ComplianceBanner compact size="sm" />
 */
export function ComplianceBanner({
  dm: dmProp,
  draft: draftProp,
  showConsent = true,
  showPII = true,
  showIssues = true,
  showRules = false,
  showRegulatory = false,
  showBlockedBanner = true,
  showCheckButton = true,
  autoCheck = true,
  compact = false,
  size = 'md',
  onComplianceChange,
  onBlock,
  className = '',
}) {
  const {
    selectedDM,
    loading: dmLoading,
  } = useDM();

  const {
    currentDraft,
    loading: draftLoading,
    confidenceThreshold,
  } = useDraft();

  const [complianceResult, setComplianceResult] = useState(null);
  const [complianceStatus, setComplianceStatus] = useState(null);
  const [piiResult, setPiiResult] = useState({ hasPII: false, types: [] });
  const [blockedAction, setBlockedAction] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [toast, setToast] = useState(null);

  const mountedRef = useRef(true);
  const lastCheckKeyRef = useRef('');

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // Determine DM and draft sources
  const dm = dmProp || selectedDM?.dm || null;
  const draft = draftProp || currentDraft || null;

  const hasConsent = dm?.metadata?.hasConsent === true;
  const consentDate = dm?.metadata?.consentDate || null;
  const consentSource = dm?.metadata?.consentSource || null;

  const requiresReview = draft
    ? typeof draft.confidence === 'number' && draft.confidence < confidenceThreshold
    : false;

  const isLowConfidenceUnreviewed = requiresReview
    && draft?.status !== 'edited'
    && draft?.status !== 'approved';

  /**
   * Shows a toast notification
   *
   * @param {string} message - Toast message
   * @param {'success'|'error'|'warning'|'info'} variant - Toast variant
   */
  function showToast(message, variant = 'info') {
    setToast({ message, variant, key: Date.now() });
  }

  /**
   * Runs a compliance check against the current DM and draft
   */
  const runComplianceCheck = useCallback(async () => {
    if (!dm && !draft) {
      setComplianceResult(null);
      setComplianceStatus(null);
      setPiiResult({ hasPII: false, types: [] });
      return;
    }

    setIsChecking(true);

    try {
      // Check PII in draft content
      if (draft && draft.content) {
        const pii = detectPII(draft.content);
        if (mountedRef.current) {
          setPiiResult(pii);
        }
      } else {
        if (mountedRef.current) {
          setPiiResult({ hasPII: false, types: [] });
        }
      }

      // Run consent check if both DM and draft are available
      if (dm && draft) {
        const result = await checkConsentBeforeSend(dm, draft);

        if (mountedRef.current) {
          setComplianceResult(result);

          if (typeof onComplianceChange === 'function') {
            onComplianceChange(result);
          }
        }
      } else if (dm) {
        // Validate privacy compliance for DM data
        const result = await validatePrivacyCompliance({
          content: dm.content || '',
          hasConsent: dm.metadata?.hasConsent,
          consentDate: dm.metadata?.consentDate,
          consentSource: dm.metadata?.consentSource,
          entityType: 'dm',
          entityId: dm.id,
        });

        if (mountedRef.current) {
          setComplianceResult({
            allowed: result.compliant,
            status: result.status,
            issues: result.issues,
            consentVerified: dm.metadata?.hasConsent === true,
          });

          if (typeof onComplianceChange === 'function') {
            onComplianceChange(result);
          }
        }
      }

      // Fetch overall compliance status
      try {
        const status = await getComplianceStatus();
        if (mountedRef.current) {
          setComplianceStatus(status);
        }
      } catch {
        // Non-critical — compliance status fetch failure should not block
      }
    } catch (err) {
      console.warn('[ComplianceBanner] Compliance check failed:', err.message);
      if (mountedRef.current) {
        showToast('Compliance check failed. Please try again.', 'error');
      }
    } finally {
      if (mountedRef.current) {
        setIsChecking(false);
      }
    }
  }, [dm, draft, onComplianceChange, confidenceThreshold]);

  // Auto-check compliance when DM or draft changes
  useEffect(() => {
    if (!autoCheck) return;

    const checkKey = `${dm?.id || 'none'}-${draft?.id || 'none'}-${draft?.status || 'none'}-${draft?.content?.length || 0}`;

    if (checkKey === lastCheckKeyRef.current) return;
    lastCheckKeyRef.current = checkKey;

    runComplianceCheck();
  }, [autoCheck, dm, draft, runComplianceCheck]);

  /**
   * Handles manual compliance check button click
   */
  const handleManualCheck = useCallback(async () => {
    await runComplianceCheck();
    showToast('Compliance check completed.', 'info');
  }, [runComplianceCheck]);

  /**
   * Handles dismissing the blocked action banner
   */
  function handleDismissBlocked() {
    setBlockedAction(null);
  }

  // Determine the effective compliance status for display
  const effectiveStatus = complianceResult
    ? complianceResult.status || (complianceResult.allowed ? COMPLIANCE_STATUS.COMPLIANT : COMPLIANCE_STATUS.NON_COMPLIANT)
    : null;

  const statusStyle = effectiveStatus
    ? (STATUS_STYLES[effectiveStatus] || DEFAULT_STATUS_STYLE)
    : DEFAULT_STATUS_STYLE;

  const hasIssues = complianceResult && complianceResult.issues && complianceResult.issues.length > 0;

  const containerClasses = [
    'flex flex-col space-y-3',
    sizeClass.container,
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Compact mode: show only a status badge
  if (compact) {
    if (!effectiveStatus && !isChecking) {
      return null;
    }

    return (
      <Tooltip
        content={
          hasIssues
            ? `${complianceResult.issues.length} compliance issue(s) detected`
            : effectiveStatus === COMPLIANCE_STATUS.COMPLIANT
              ? 'All compliance checks passed'
              : isChecking
                ? 'Checking compliance...'
                : 'Compliance status unknown'
        }
      >
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-medium ${statusStyle.badgeBg} ${statusStyle.badgeText} px-2.5 py-0.5 text-xs ${className}`.trim()}
          role="status"
          aria-label={`Compliance: ${statusStyle.label}`}
        >
          <StatusIcon status={effectiveStatus} className="h-3.5 w-3.5" />
          {isChecking ? 'Checking...' : statusStyle.label}
        </span>
      </Tooltip>
    );
  }

  // No DM or draft — show minimal state
  if (!dm && !draft) {
    return (
      <div className={containerClasses} role="region" aria-label="Compliance Status">
        <div className={`flex items-center gap-2 p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl ${sizeClass.padding}`}>
          <ShieldCheckIcon className={`${sizeClass.icon} text-neutral-400`} />
          <span className={`text-neutral-500 ${sizeClass.body}`}>
            Select a DM to view compliance status.
          </span>
        </div>

        {showRegulatory && (
          <RegulatoryReferences sizeClass={sizeClass} />
        )}
      </div>
    );
  }

  return (
    <div className={containerClasses} role="region" aria-label="Compliance Status">
      {/* Status header */}
      <div className={`flex items-center justify-between gap-2 p-2.5 ${statusStyle.bg} border ${statusStyle.border} rounded-xl`}>
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon
            status={effectiveStatus || COMPLIANCE_STATUS.COMPLIANT}
            className={`${sizeClass.icon} shrink-0 ${statusStyle.iconColor}`}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${statusStyle.text} ${sizeClass.body}`}>
                {isChecking ? 'Checking Compliance...' : `Privacy Compliance: ${statusStyle.label}`}
              </span>
              {effectiveStatus && !isChecking && (
                <span className={`badge ${statusStyle.badgeBg} ${statusStyle.badgeText} text-xs`}>
                  {statusStyle.label}
                </span>
              )}
            </div>
            {!isChecking && effectiveStatus === COMPLIANCE_STATUS.COMPLIANT && (
              <p className={`text-brand-600 ${sizeClass.meta}`}>
                All privacy and consent checks passed.
              </p>
            )}
            {!isChecking && effectiveStatus === COMPLIANCE_STATUS.NON_COMPLIANT && (
              <p className={`text-red-600 ${sizeClass.meta}`}>
                One or more compliance requirements are not met.
              </p>
            )}
            {!isChecking && effectiveStatus === COMPLIANCE_STATUS.REQUIRES_REVIEW && (
              <p className={`text-accent-700 ${sizeClass.meta}`}>
                Manual review is required before proceeding.
              </p>
            )}
            {!isChecking && effectiveStatus === COMPLIANCE_STATUS.BLOCKED && (
              <p className={`text-red-700 ${sizeClass.meta}`}>
                Action has been blocked due to compliance violations.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showCheckButton && (
            <Tooltip content="Run compliance check">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleManualCheck}
                loading={isChecking}
                disabled={isChecking}
                ariaLabel="Run compliance check"
              >
                <svg
                  className="h-4 w-4"
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
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Blocked action banner */}
      {showBlockedBanner && blockedAction && (
        <BlockedActionBanner
          reason={blockedAction.reason}
          timestamp={blockedAction.timestamp}
          onDismiss={handleDismissBlocked}
          sizeClass={sizeClass}
        />
      )}

      {/* Low-confidence review warning */}
      {isLowConfidenceUnreviewed && (
        <div className="flex items-start gap-2 p-2.5 bg-accent-50 border border-accent-200 rounded-xl">
          <WarningIcon className={`${sizeClass.icon} shrink-0 text-accent-600 mt-0.5`} />
          <div>
            <p className={`font-semibold text-accent-800 ${sizeClass.body}`}>
              Mandatory Human Review Required
            </p>
            <p className={`text-accent-700 ${sizeClass.meta}`}>
              This draft has a confidence score of {Math.round((draft?.confidence || 0) * 100)}%,
              which is below the {Math.round(confidenceThreshold * 100)}% threshold.
              Per compliance policy, the draft must be reviewed and edited before it can be approved and sent.
            </p>
          </div>
        </div>
      )}

      {/* Consent status */}
      {showConsent && dm && (
        <ConsentIndicator
          hasConsent={hasConsent}
          consentDate={consentDate}
          consentSource={consentSource}
          sizeClass={sizeClass}
        />
      )}

      {/* PII detection indicator */}
      {showPII && piiResult.hasPII && (
        <PIIIndicator
          hasPII={piiResult.hasPII}
          types={piiResult.types}
          sizeClass={sizeClass}
        />
      )}

      {/* Compliance issues list */}
      {showIssues && hasIssues && (
        <ComplianceIssuesList
          issues={complianceResult.issues}
          sizeClass={sizeClass}
        />
      )}

      {/* Active compliance rules */}
      {showRules && complianceStatus && complianceStatus.rules && (
        <ComplianceRules
          rules={complianceStatus.rules}
          sizeClass={sizeClass}
        />
      )}

      {/* Blocked actions count */}
      {showRules && complianceStatus && complianceStatus.blockedActionCount > 0 && (
        <div className={`text-neutral-400 ${sizeClass.meta}`}>
          {complianceStatus.blockedActionCount} action{complianceStatus.blockedActionCount !== 1 ? 's' : ''} blocked in this session
        </div>
      )}

      {/* Regulatory references */}
      {showRegulatory && (
        <RegulatoryReferences sizeClass={sizeClass} />
      )}

      {/* Toast notification */}
      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          variant={toast.variant}
          visible
          duration={4000}
          onClose={() => setToast(null)}
          position="top-right"
        />
      )}
    </div>
  );
}

export default ComplianceBanner;