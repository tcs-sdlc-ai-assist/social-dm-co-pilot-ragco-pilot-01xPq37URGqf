'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Tooltip from '@/components/common/Tooltip';
import { useDM } from '@/contexts/DMContext';
import { useDraft } from '@/contexts/DraftContext';
import { CONFIDENCE_THRESHOLD } from '@/utils/constants';

/**
 * Size variant mappings for the consent checkbox
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    container: 'text-xs',
    checkbox: 'h-4 w-4',
    label: 'text-xs',
    body: 'text-xs',
    meta: 'text-xs',
    icon: 'h-3.5 w-3.5',
    padding: 'px-3 py-2',
  },
  md: {
    container: 'text-sm',
    checkbox: 'h-4.5 w-4.5',
    label: 'text-sm',
    body: 'text-sm',
    meta: 'text-xs',
    icon: 'h-4 w-4',
    padding: 'px-4 py-3',
  },
  lg: {
    container: 'text-base',
    checkbox: 'h-5 w-5',
    label: 'text-sm',
    body: 'text-sm',
    meta: 'text-sm',
    icon: 'h-5 w-5',
    padding: 'px-5 py-4',
  },
});

/**
 * Shield icon SVG component for compliance indicator
 *
 * @param {object} props
 * @param {string} props.className - Tailwind classes for sizing
 * @returns {React.ReactElement}
 */
function ShieldIcon({ className }) {
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
 * Regulatory references expandable component
 * Displays Australian Privacy Act and Spam Act references inline
 *
 * @param {object} props
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function RegulatoryTooltipContent({ sizeClass }) {
  return (
    <div className="space-y-2 max-w-xs">
      <p className="font-semibold text-white text-xs">
        Compliance Requirements
      </p>
      <div className="space-y-1.5">
        <div>
          <p className="font-medium text-neutral-200 text-xs">
            Australian Privacy Act 1988
          </p>
          <p className="text-neutral-300 text-xs leading-snug">
            APP 7 — Direct marketing requires consent. Personal information must not be used
            for direct marketing without the individual&apos;s consent.
          </p>
        </div>
        <div>
          <p className="font-medium text-neutral-200 text-xs">
            Spam Act 2003
          </p>
          <p className="text-neutral-300 text-xs leading-snug">
            Section 16 — Unsolicited commercial electronic messages must not be sent without
            the recipient&apos;s consent. Messages must include accurate sender identification.
          </p>
        </div>
        <div>
          <p className="font-medium text-neutral-200 text-xs">
            Application
          </p>
          <p className="text-neutral-300 text-xs leading-snug">
            All outbound DM responses are treated as commercial electronic messages.
            Consent must be verified before sending messages containing personal information.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Consent status indicator component
 * Shows whether the DM sender has verified consent
 *
 * @param {object} props
 * @param {boolean} props.hasConsent - Whether consent has been given
 * @param {string} [props.consentSource] - Source of consent
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function ConsentStatusIndicator({ hasConsent, consentSource, sizeClass }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`font-medium text-neutral-500 ${sizeClass.meta}`}>
        Sender Consent:
      </span>
      <span className={`badge text-xs ${hasConsent ? 'bg-brand-100 text-brand-800' : 'bg-red-100 text-red-800'}`}>
        {hasConsent ? '✓ Verified' : '✗ Not Verified'}
      </span>
      {hasConsent && consentSource && (
        <span className={`text-neutral-400 ${sizeClass.meta}`}>
          via {consentSource}
        </span>
      )}
    </div>
  );
}

/**
 * Blocked send warning component
 * Displays when the send action is blocked due to unchecked consent
 *
 * @param {object} props
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function BlockedSendWarning({ sizeClass }) {
  return (
    <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl">
      <LockIcon className={`${sizeClass.icon} shrink-0 text-red-600 mt-0.5`} />
      <div>
        <p className={`font-semibold text-red-800 ${sizeClass.body}`}>
          Send Action Blocked
        </p>
        <p className={`text-red-700 ${sizeClass.meta}`}>
          You must acknowledge the consent and compliance requirements before sending this message.
          This is required under the Australian Privacy Act 1988 and Spam Act 2003.
        </p>
      </div>
    </div>
  );
}

/**
 * ConsentCheckbox component
 * Consent checkbox component: required consent acknowledgment before sending messages.
 * Blocks send action if unchecked. Displays compliance tooltip with legal references.
 *
 * Implements privacy guardrails per LLD (SCRUM-6533)
 *
 * Features:
 * - Required consent checkbox that must be checked before sending
 * - Blocks send action when unchecked with visual warning
 * - Displays sender consent status from DM metadata
 * - Compliance tooltip with Australian Privacy Act and Spam Act references
 * - Low-confidence draft warning when applicable
 * - PII detection warning when draft contains personal information
 * - Visual state changes for checked/unchecked/blocked states
 * - Disabled state when no DM or draft is selected
 * - ARIA labels and associations for accessibility
 * - Configurable size variants (sm, md, lg)
 * - Callback when consent state changes
 * - Callback to check if send is allowed
 *
 * @param {object} props
 * @param {object} [props.dm] - DM object (overrides DMContext selected DM)
 * @param {object} [props.draft] - Draft object (overrides DraftContext current draft)
 * @param {boolean} [props.checked=false] - Controlled checked state
 * @param {boolean} [props.showSenderConsent=true] - Whether to show sender consent status
 * @param {boolean} [props.showBlockedWarning=true] - Whether to show blocked send warning when unchecked
 * @param {boolean} [props.showLegalTooltip=true] - Whether to show the legal references tooltip
 * @param {boolean} [props.showLowConfidenceWarning=true] - Whether to show low-confidence draft warning
 * @param {boolean} [props.required=true] - Whether the checkbox is required for send
 * @param {boolean} [props.disabled=false] - Whether the checkbox is disabled
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the component
 * @param {Function} [props.onChange] - Callback when consent state changes (receives boolean)
 * @param {Function} [props.onSendAllowed] - Callback to report whether send is allowed (receives boolean)
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <ConsentCheckbox onChange={handleConsentChange} onSendAllowed={handleSendAllowed} />
 *
 * @example
 * <ConsentCheckbox
 *   dm={selectedDM}
 *   draft={currentDraft}
 *   checked={consentChecked}
 *   onChange={setConsentChecked}
 *   showSenderConsent
 *   showLegalTooltip
 * />
 *
 * @example
 * <ConsentCheckbox size="sm" required disabled={!hasDraft} />
 */
export function ConsentCheckbox({
  dm: dmProp,
  draft: draftProp,
  checked: checkedProp,
  showSenderConsent = true,
  showBlockedWarning = true,
  showLegalTooltip = true,
  showLowConfidenceWarning = true,
  required = true,
  disabled = false,
  size = 'md',
  onChange,
  onSendAllowed,
  className = '',
}) {
  const {
    selectedDM,
    loading: dmLoading,
  } = useDM();

  const {
    currentDraft,
    confidenceThreshold,
  } = useDraft();

  const [internalChecked, setInternalChecked] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);

  const mountedRef = useRef(true);
  const checkboxId = useRef(`consent-checkbox-${Math.random().toString(36).slice(2, 9)}`).current;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // Determine DM and draft sources
  const dm = dmProp || selectedDM?.dm || null;
  const draft = draftProp || currentDraft || null;

  // Determine controlled vs uncontrolled checked state
  const isChecked = checkedProp !== undefined ? checkedProp : internalChecked;

  const hasConsent = dm?.metadata?.hasConsent === true;
  const consentSource = dm?.metadata?.consentSource || null;

  const requiresReview = draft
    ? typeof draft.confidence === 'number' && draft.confidence < confidenceThreshold
    : false;

  const isLowConfidenceUnreviewed = requiresReview
    && draft?.status !== 'edited'
    && draft?.status !== 'approved';

  const hasDM = dm !== null;
  const hasDraft = draft !== null;
  const isDisabled = disabled || (!hasDM && !hasDraft);

  // Determine if send is allowed
  const isSendAllowed = isChecked && (!required || isChecked) && !isLowConfidenceUnreviewed;

  // Notify parent of send allowed state changes
  useEffect(() => {
    if (typeof onSendAllowed === 'function') {
      onSendAllowed(isSendAllowed);
    }
  }, [isSendAllowed, onSendAllowed]);

  /**
   * Handles checkbox change
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  const handleChange = useCallback((event) => {
    const newChecked = event.target.checked;

    // Update internal state for uncontrolled mode
    if (checkedProp === undefined) {
      setInternalChecked(newChecked);
    }

    // Hide blocked warning when checked
    if (newChecked) {
      setShowBlocked(false);
    }

    if (typeof onChange === 'function') {
      onChange(newChecked);
    }
  }, [checkedProp, onChange]);

  /**
   * Handles attempt to send without consent
   * Shows the blocked warning if checkbox is unchecked
   */
  const handleSendAttempt = useCallback(() => {
    if (!isChecked && required) {
      setShowBlocked(true);
    }
  }, [isChecked, required]);

  // Show blocked warning when user tries to interact without consent
  useEffect(() => {
    if (isChecked) {
      setShowBlocked(false);
    }
  }, [isChecked]);

  const containerClasses = [
    'flex flex-col space-y-3',
    sizeClass.container,
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const checkboxContainerClasses = [
    'flex items-start gap-3 p-3 border rounded-xl transition-colors',
    isChecked
      ? 'bg-brand-50 border-brand-200'
      : showBlocked
        ? 'bg-red-50 border-red-200'
        : 'bg-neutral-50 border-neutral-200',
    isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-neutral-300',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <div className={containerClasses} role="region" aria-label="Consent Acknowledgment">
      {/* Sender consent status */}
      {showSenderConsent && dm && (
        <ConsentStatusIndicator
          hasConsent={hasConsent}
          consentSource={consentSource}
          sizeClass={sizeClass}
        />
      )}

      {/* Low-confidence draft warning */}
      {showLowConfidenceWarning && isLowConfidenceUnreviewed && (
        <div className="flex items-start gap-2 p-2.5 bg-accent-50 border border-accent-200 rounded-xl">
          <WarningIcon className={`${sizeClass.icon} shrink-0 text-accent-600 mt-0.5`} />
          <div>
            <p className={`font-semibold text-accent-800 ${sizeClass.body}`}>
              Human Review Required
            </p>
            <p className={`text-accent-700 ${sizeClass.meta}`}>
              This draft has a confidence score of {Math.round((draft?.confidence || 0) * 100)}%,
              which is below the {Math.round(confidenceThreshold * 100)}% threshold.
              The draft must be reviewed and edited before it can be sent.
            </p>
          </div>
        </div>
      )}

      {/* Consent checkbox */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={checkboxContainerClasses}
        onClick={!isDisabled ? () => {
          if (!isChecked && required) {
            // Let the checkbox handle the actual toggle
          }
        } : undefined}
      >
        {/* Checkbox icon */}
        <div className="shrink-0 mt-0.5">
          {isChecked ? (
            <ShieldIcon className={`${sizeClass.icon} text-brand-600`} />
          ) : showBlocked ? (
            <LockIcon className={`${sizeClass.icon} text-red-500`} />
          ) : (
            <ShieldIcon className={`${sizeClass.icon} text-neutral-400`} />
          )}
        </div>

        {/* Checkbox input and label */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start gap-2">
            <input
              id={checkboxId}
              type="checkbox"
              checked={isChecked}
              onChange={handleChange}
              disabled={isDisabled}
              required={required}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-brand-600 focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              aria-label="I acknowledge compliance requirements for sending this message"
              aria-describedby={`${checkboxId}-description`}
              aria-required={required}
            />
            <label
              htmlFor={checkboxId}
              className={`font-medium leading-snug cursor-pointer select-none ${
                isChecked ? 'text-brand-800' : showBlocked ? 'text-red-800' : 'text-neutral-700'
              } ${sizeClass.label} ${isDisabled ? 'cursor-not-allowed' : ''}`}
            >
              I confirm that sender consent has been verified and this message complies with
              the Australian Privacy Act 1988 and Spam Act 2003.
              {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
          </div>

          {/* Description text */}
          <p
            id={`${checkboxId}-description`}
            className={`text-neutral-500 leading-snug ${sizeClass.meta}`}
          >
            By checking this box, you acknowledge that the recipient has provided consent for
            this communication, and that the message content has been reviewed for compliance
            with applicable privacy regulations.
          </p>

          {/* Legal tooltip trigger */}
          {showLegalTooltip && (
            <div className="flex items-center gap-1.5">
              <Tooltip
                content="Australian Privacy Act 1988 (APP 6, APP 7) and Spam Act 2003 (Section 16, Section 17) require consent verification before sending commercial electronic messages containing personal information."
                position="bottom"
                size="lg"
              >
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 transition-colors ${sizeClass.meta} font-medium`}
                  aria-label="View compliance legal references"
                >
                  <InfoIcon className="h-3.5 w-3.5" />
                  View legal references
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {/* Blocked send warning */}
      {showBlockedWarning && showBlocked && !isChecked && (
        <BlockedSendWarning sizeClass={sizeClass} />
      )}

      {/* Consent not verified warning */}
      {showSenderConsent && dm && !hasConsent && isChecked && (
        <div className="flex items-start gap-2 p-2.5 bg-accent-50 border border-accent-200 rounded-xl">
          <WarningIcon className={`${sizeClass.icon} shrink-0 text-accent-600 mt-0.5`} />
          <div>
            <p className={`font-semibold text-accent-800 ${sizeClass.body}`}>
              Sender Consent Not Verified
            </p>
            <p className={`text-accent-700 ${sizeClass.meta}`}>
              The sender&apos;s consent has not been verified in the system. Ensure you have obtained
              explicit consent through an alternative channel before proceeding. Sending messages
              without verified consent may violate the Australian Privacy Act and Spam Act.
            </p>
          </div>
        </div>
      )}

      {/* Compliance status summary */}
      {isChecked && !isLowConfidenceUnreviewed && (
        <div className="flex items-center gap-1.5">
          <ShieldIcon className={`h-3.5 w-3.5 text-brand-600 shrink-0`} />
          <span className={`text-brand-700 font-medium ${sizeClass.meta}`}>
            Compliance acknowledged — send action enabled
          </span>
        </div>
      )}

      {/* No DM/Draft state */}
      {!hasDM && !hasDraft && (
        <p className={`text-neutral-400 ${sizeClass.meta}`}>
          Select a DM and generate a draft to enable consent acknowledgment.
        </p>
      )}
    </div>
  );
}

export default ConsentCheckbox;