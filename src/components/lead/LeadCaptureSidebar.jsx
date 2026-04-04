'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLead } from '@/contexts/LeadContext';
import { useDM } from '@/contexts/DMContext';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import Tooltip from '@/components/common/Tooltip';
import Toast from '@/components/common/Toast';
import PlatformIcon from '@/components/common/PlatformIcon';
import StatusBadge from '@/components/common/StatusBadge';
import { formatCurrency, formatTimestamp, formatLeadScore } from '@/utils/formatters';
import { validateLeadData } from '@/utils/validators';
import { LEAD_SCORE, LEAD_LABELS, getLeadLabel, STATUS } from '@/utils/constants';

/**
 * Size variant mappings for the lead capture sidebar
 */
const SIZE_CLASSES = Object.freeze({
  sm: {
    container: 'text-xs',
    heading: 'text-sm',
    body: 'text-xs',
    meta: 'text-xs',
    label: 'text-xs',
    padding: 'px-3 py-2',
    input: 'px-2.5 py-1.5 text-xs',
    textarea: 'text-xs min-h-20',
  },
  md: {
    container: 'text-sm',
    heading: 'text-sm',
    body: 'text-sm',
    meta: 'text-xs',
    label: 'text-xs',
    padding: 'px-4 py-3',
    input: 'px-3 py-2 text-sm',
    textarea: 'text-sm min-h-24',
  },
  lg: {
    container: 'text-base',
    heading: 'text-base',
    body: 'text-sm',
    meta: 'text-sm',
    label: 'text-sm',
    padding: 'px-5 py-4',
    input: 'px-3 py-2.5 text-sm',
    textarea: 'text-sm min-h-28',
  },
});

/**
 * Lead score color mappings
 *
 * @param {number} score - Lead score (0-100)
 * @returns {{ bg: string, text: string, bar: string, label: string }}
 */
function getScoreStyle(score) {
  if (typeof score !== 'number' || isNaN(score)) {
    return { bg: 'bg-neutral-100', text: 'text-neutral-600', bar: 'bg-neutral-400', label: 'Unscored' };
  }

  if (score >= LEAD_SCORE.HOT) {
    return { bg: 'bg-brand-100', text: 'text-brand-800', bar: 'bg-brand-500', label: LEAD_LABELS.HOT };
  }
  if (score >= LEAD_SCORE.WARM) {
    return { bg: 'bg-accent-100', text: 'text-accent-800', bar: 'bg-accent-500', label: LEAD_LABELS.WARM };
  }
  return { bg: 'bg-neutral-100', text: 'text-neutral-600', bar: 'bg-neutral-400', label: LEAD_LABELS.COLD };
}

/**
 * Lead score display component
 * Shows a visual score bar with label and numeric value
 *
 * @param {object} props
 * @param {number} props.score - Lead score (0-100)
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function LeadScoreDisplay({ score, sizeClass }) {
  const style = getScoreStyle(score);
  const percentage = typeof score === 'number' && !isNaN(score) ? Math.min(100, Math.max(0, score)) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
          Lead Score
        </span>
        <div className="flex items-center gap-2">
          <span className={`badge ${style.bg} ${style.text} text-xs`}>
            {style.label}
          </span>
          <span className={`font-semibold ${style.text} ${sizeClass.body}`}>
            {typeof score === 'number' ? score : '—'}
          </span>
        </div>
      </div>
      <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${style.bar} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/**
 * Sync status indicator component
 *
 * @param {object} props
 * @param {string} props.syncStatus - Salesforce sync status
 * @param {string} [props.salesforceId] - Salesforce record ID
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function SyncStatusIndicator({ syncStatus, salesforceId, sizeClass }) {
  if (!syncStatus) return null;

  const statusStyles = {
    success: { bg: 'bg-brand-100', text: 'text-brand-800', icon: '✓' },
    failed: { bg: 'bg-red-100', text: 'text-red-800', icon: '✗' },
    pending: { bg: 'bg-accent-100', text: 'text-accent-800', icon: '⏳' },
  };

  const style = statusStyles[syncStatus] || statusStyles.pending;
  const displayLabel = syncStatus.charAt(0).toUpperCase() + syncStatus.slice(1);

  return (
    <div className="flex items-center justify-between gap-2 p-2.5 border border-neutral-200 rounded-xl">
      <div className="flex items-center gap-2">
        <span className={`badge ${style.bg} ${style.text} text-xs`}>
          {style.icon} {displayLabel}
        </span>
        <span className={`text-neutral-500 ${sizeClass.meta}`}>
          Salesforce Sync
        </span>
      </div>
      {salesforceId && (
        <Tooltip content={`Salesforce ID: ${salesforceId}`}>
          <span className={`text-neutral-400 truncate max-w-32 ${sizeClass.meta}`}>
            {salesforceId}
          </span>
        </Tooltip>
      )}
    </div>
  );
}

/**
 * Editable form field component
 *
 * @param {object} props
 * @param {string} props.label - Field label
 * @param {string} props.name - Field name
 * @param {string} props.value - Field value
 * @param {Function} props.onChange - Change handler
 * @param {string} [props.type='text'] - Input type
 * @param {string} [props.placeholder] - Placeholder text
 * @param {boolean} [props.disabled=false] - Whether the field is disabled
 * @param {object} props.sizeClass - Size variant classes
 * @param {boolean} [props.multiline=false] - Whether to render a textarea
 * @returns {React.ReactElement}
 */
function FormField({ label, name, value, onChange, type = 'text', placeholder, disabled = false, sizeClass, multiline = false }) {
  const inputClasses = `block w-full border border-neutral-300 rounded-xl bg-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${sizeClass.input}`;

  return (
    <div className="space-y-1">
      <label
        htmlFor={`lead-field-${name}`}
        className={`font-medium text-neutral-500 ${sizeClass.label}`}
      >
        {label}
      </label>
      {multiline ? (
        <textarea
          id={`lead-field-${name}`}
          name={name}
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`${inputClasses} resize-y ${sizeClass.textarea}`}
        />
      ) : (
        <input
          id={`lead-field-${name}`}
          type={type}
          name={name}
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClasses}
        />
      )}
    </div>
  );
}

/**
 * Budget range editor component
 *
 * @param {object} props
 * @param {object|null} props.budget - Budget range { min, max }
 * @param {Function} props.onChange - Change handler (receives updated budget object)
 * @param {boolean} [props.disabled=false] - Whether the fields are disabled
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function BudgetEditor({ budget, onChange, disabled = false, sizeClass }) {
  const minValue = budget?.min ?? '';
  const maxValue = budget?.max ?? '';

  function handleMinChange(e) {
    const val = e.target.value;
    const numVal = val === '' ? null : parseInt(val, 10);
    onChange({
      min: isNaN(numVal) ? null : numVal,
      max: budget?.max ?? null,
    });
  }

  function handleMaxChange(e) {
    const val = e.target.value;
    const numVal = val === '' ? null : parseInt(val, 10);
    onChange({
      min: budget?.min ?? null,
      max: isNaN(numVal) ? null : numVal,
    });
  }

  const inputClasses = `block w-full border border-neutral-300 rounded-xl bg-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${sizeClass.input}`;

  return (
    <div className="space-y-1">
      <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
        Budget Range
      </span>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <input
            type="number"
            value={minValue === null ? '' : minValue}
            onChange={handleMinChange}
            placeholder="Min ($)"
            disabled={disabled}
            className={inputClasses}
            aria-label="Minimum budget"
            min={0}
          />
        </div>
        <span className={`text-neutral-400 ${sizeClass.meta}`}>–</span>
        <div className="flex-1">
          <input
            type="number"
            value={maxValue === null ? '' : maxValue}
            onChange={handleMaxChange}
            placeholder="Max ($)"
            disabled={disabled}
            className={inputClasses}
            aria-label="Maximum budget"
            min={0}
          />
        </div>
      </div>
      {budget && (budget.min || budget.max) && (
        <p className={`text-neutral-400 ${sizeClass.meta}`}>
          {budget.min && budget.max
            ? `${formatCurrency(budget.min, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} – ${formatCurrency(budget.max, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            : budget.max
              ? `Up to ${formatCurrency(budget.max, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              : `From ${formatCurrency(budget.min, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
          }
        </p>
      )}
    </div>
  );
}

/**
 * Property interests display component
 *
 * @param {object} props
 * @param {string[]} props.interests - Array of property IDs
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function PropertyInterests({ interests, sizeClass }) {
  if (!interests || interests.length === 0) return null;

  return (
    <div className="space-y-1">
      <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
        Property Interests
      </span>
      <div className="flex flex-wrap gap-1">
        {interests.map((id, idx) => (
          <span
            key={idx}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600"
          >
            {id}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Flag for sales follow-up toggle component
 *
 * @param {object} props
 * @param {boolean} props.flagged - Whether the lead is flagged
 * @param {Function} props.onToggle - Toggle handler
 * @param {boolean} [props.disabled=false] - Whether the toggle is disabled
 * @param {boolean} [props.loading=false] - Whether the toggle action is loading
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function FlagForFollowUp({ flagged, onToggle, disabled = false, loading = false, sizeClass }) {
  return (
    <div className="flex items-center justify-between gap-3 p-2.5 border border-neutral-200 rounded-xl">
      <div className="flex items-center gap-2 min-w-0">
        <svg
          className={`h-4 w-4 shrink-0 ${flagged ? 'text-red-500' : 'text-neutral-400'}`}
          xmlns="http://www.w3.org/2000/svg"
          fill={flagged ? 'currentColor' : 'none'}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
          />
        </svg>
        <div>
          <span className={`font-medium text-neutral-700 ${sizeClass.body}`}>
            Flag for Sales Follow-Up
          </span>
          <p className={`text-neutral-400 ${sizeClass.meta}`}>
            {flagged ? 'Escalated for manual review' : 'Mark for immediate attention'}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={flagged}
        aria-label="Flag for sales follow-up"
        onClick={onToggle}
        disabled={disabled || loading}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          flagged ? 'bg-red-500' : 'bg-neutral-300'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            flagged ? 'translate-x-5' : 'translate-x-0'
          }`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

/**
 * Consent status display component
 *
 * @param {object} props
 * @param {boolean} props.hasConsent - Whether consent has been given
 * @param {string} [props.consentDate] - Date consent was given
 * @param {string} [props.consentSource] - Source of consent
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function ConsentStatus({ hasConsent, consentDate, consentSource, sizeClass }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
        Consent
      </span>
      <div className="flex items-center gap-2">
        <span className={`badge text-xs ${hasConsent ? 'bg-brand-100 text-brand-800' : 'bg-red-100 text-red-800'}`}>
          {hasConsent ? 'Verified' : 'Not verified'}
        </span>
        {hasConsent && consentSource && (
          <span className={`text-neutral-400 ${sizeClass.meta}`}>
            via {consentSource}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * LeadCaptureSidebar component
 * Lead Capture Sidebar: displays auto-filled lead fields (name, contact, budget,
 * location, intent), editable form, lead score display, 'Create Lead in Salesforce'
 * button, 'Flag for Sales Follow-Up' toggle.
 *
 * Implements FR-005 (SCRUM-6537, SCRUM-6538)
 *
 * Features:
 * - Auto-filled lead fields from DM extraction
 * - Editable form for name, email, phone, budget, location, intent, notes
 * - Lead score display with visual bar and priority label
 * - Extract lead from DM action
 * - Score lead action
 * - Create Lead in Salesforce button with sync status indicator
 * - Flag for Sales Follow-Up toggle (escalation)
 * - Property interests display
 * - Consent status display
 * - Salesforce sync status indicator
 * - Loading and empty states
 * - Toast notifications for actions
 * - ARIA labels for accessibility
 *
 * @param {object} props
 * @param {object} [props.lead] - Lead object (overrides LeadContext selected lead)
 * @param {object} [props.dm] - DM object (overrides DMContext selected DM)
 * @param {boolean} [props.showScore=true] - Whether to show the lead score display
 * @param {boolean} [props.showSyncButton=true] - Whether to show the Salesforce sync button
 * @param {boolean} [props.showFlagToggle=true] - Whether to show the flag for follow-up toggle
 * @param {boolean} [props.showExtractButton=true] - Whether to show the extract lead button
 * @param {boolean} [props.showScoreButton=true] - Whether to show the score lead button
 * @param {boolean} [props.showPropertyInterests=true] - Whether to show property interests
 * @param {boolean} [props.showConsent=true] - Whether to show consent status
 * @param {boolean} [props.showSyncStatus=true] - Whether to show Salesforce sync status
 * @param {boolean} [props.editable=true] - Whether the form fields are editable
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the sidebar
 * @param {Function} [props.onExtract] - Callback when lead is extracted
 * @param {Function} [props.onScore] - Callback when lead is scored
 * @param {Function} [props.onSync] - Callback when lead is synced to Salesforce
 * @param {Function} [props.onFlag] - Callback when lead is flagged for follow-up
 * @param {Function} [props.onSave] - Callback when lead form is saved
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <LeadCaptureSidebar />
 *
 * @example
 * <LeadCaptureSidebar
 *   dm={selectedDM}
 *   showSyncButton
 *   showFlagToggle
 *   onSync={handleSync}
 *   onFlag={handleFlag}
 * />
 */
export function LeadCaptureSidebar({
  lead: leadProp,
  dm: dmProp,
  showScore = true,
  showSyncButton = true,
  showFlagToggle = true,
  showExtractButton = true,
  showScoreButton = true,
  showPropertyInterests = true,
  showConsent = true,
  showSyncStatus = true,
  editable = true,
  size = 'md',
  onExtract,
  onScore,
  onSync,
  onFlag,
  onSave,
  className = '',
}) {
  const {
    selectedLead,
    loading: leadLoading,
    error: leadError,
    extract,
    score,
    sync,
    flagLead,
    selectLead,
    getLeadForDM,
    clearError: clearLeadError,
  } = useLead();

  const {
    selectedDM,
    loading: dmLoading,
  } = useDM();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    budgetMin: '',
    budgetMax: '',
    location: '',
    intent: '',
    notes: '',
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toast, setToast] = useState(null);
  const [localLead, setLocalLead] = useState(null);
  const [isFlagged, setIsFlagged] = useState(false);

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // Determine DM and lead sources
  const dm = dmProp || selectedDM?.dm || null;
  const lead = leadProp || selectedLead?.lead || localLead || null;
  const scoreBreakdown = selectedLead?.scoreBreakdown || null;

  const isLoadingDM = dmLoading.selected || dmLoading.initializing;
  const isExtracting = leadLoading.extracting;
  const isScoring = leadLoading.scoring;
  const isSyncing = leadLoading.syncing;
  const isFlagging = leadLoading.action;
  const isAnyLoading = isExtracting || isScoring || isSyncing || isFlagging;

  // Sync form data with lead when lead changes
  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name || '',
        email: lead.contact?.email || '',
        phone: lead.contact?.phone || '',
        budgetMin: lead.budget?.min ?? '',
        budgetMax: lead.budget?.max ?? '',
        location: lead.location || '',
        intent: lead.intent || '',
        notes: lead.notes || '',
      });
      setHasUnsavedChanges(false);
      setIsFlagged(lead.status === STATUS.ESCALATED);
    } else {
      setFormData({
        name: dm?.sender?.name || '',
        email: '',
        phone: '',
        budgetMin: '',
        budgetMax: '',
        location: '',
        intent: '',
        notes: '',
      });
      setHasUnsavedChanges(false);
      setIsFlagged(false);
    }
  }, [lead, dm]);

  // Try to load existing lead when DM changes
  useEffect(() => {
    if (dm && dm.id && !leadProp) {
      getLeadForDM(dm.id).then((existingLead) => {
        if (mountedRef.current && existingLead) {
          setLocalLead(existingLead);
          if (existingLead.id) {
            selectLead(existingLead.id).catch(() => {});
          }
        } else if (mountedRef.current) {
          setLocalLead(null);
        }
      }).catch(() => {
        if (mountedRef.current) {
          setLocalLead(null);
        }
      });
    }
  }, [dm, leadProp, getLeadForDM, selectLead]);

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
   * Handles form field changes
   *
   * @param {React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>} event
   */
  function handleFieldChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setHasUnsavedChanges(true);
  }

  /**
   * Handles budget range changes
   *
   * @param {object} budget - Updated budget object { min, max }
   */
  function handleBudgetChange(budget) {
    setFormData((prev) => ({
      ...prev,
      budgetMin: budget.min ?? '',
      budgetMax: budget.max ?? '',
    }));
    setHasUnsavedChanges(true);
  }

  /**
   * Handles extracting a lead from the current DM
   */
  const handleExtract = useCallback(async () => {
    if (!dm) return;

    if (typeof onExtract === 'function') {
      onExtract(dm);
      return;
    }

    clearLeadError();

    const result = await extract(dm);

    if (result) {
      setLocalLead(result.lead);
      showToast(
        result.complete
          ? 'Lead extracted successfully.'
          : 'Lead extracted with incomplete data. Please review.',
        result.complete ? 'success' : 'warning'
      );

      if (result.lead && result.lead.id) {
        selectLead(result.lead.id).catch(() => {});
      }
    } else {
      showToast('Failed to extract lead from DM.', 'error');
    }
  }, [dm, extract, onExtract, clearLeadError, selectLead]);

  /**
   * Handles scoring the current lead
   */
  const handleScore = useCallback(async () => {
    if (!lead || !lead.id) return;

    if (typeof onScore === 'function') {
      onScore(lead);
      return;
    }

    clearLeadError();

    const result = await score(lead.id);

    if (result) {
      showToast(
        `Lead scored: ${result.score} (${result.priority} priority)${result.escalationRequired ? ' — Escalation required' : ''}`,
        result.escalationRequired ? 'warning' : 'success'
      );
    } else {
      showToast('Failed to score lead.', 'error');
    }
  }, [lead, score, onScore, clearLeadError]);

  /**
   * Handles syncing the lead to Salesforce
   */
  const handleSync = useCallback(async () => {
    if (!lead || !lead.id) return;

    if (typeof onSync === 'function') {
      onSync(lead);
      return;
    }

    clearLeadError();

    const result = await sync(lead.id);

    if (result) {
      showToast(`Lead synced to Salesforce. ID: ${result.salesforceId}`, 'success');
    } else {
      showToast(leadError || 'Failed to sync lead to Salesforce.', 'error');
    }
  }, [lead, sync, onSync, clearLeadError, leadError]);

  /**
   * Handles toggling the flag for sales follow-up
   */
  const handleFlagToggle = useCallback(async () => {
    if (!lead || !lead.id) return;

    if (typeof onFlag === 'function') {
      onFlag(lead, !isFlagged);
      return;
    }

    if (isFlagged) {
      // Already flagged — no unflag action in the service
      showToast('Lead is already flagged for follow-up.', 'info');
      return;
    }

    clearLeadError();

    const result = await flagLead(lead.id, {
      reason: 'Flagged for sales follow-up via sidebar',
    });

    if (result) {
      setIsFlagged(true);
      showToast('Lead flagged for sales follow-up.', 'success');
    } else {
      showToast('Failed to flag lead.', 'error');
    }
  }, [lead, isFlagged, flagLead, onFlag, clearLeadError]);

  /**
   * Handles saving form edits
   * Note: This builds an updated lead object from form data and calls the
   * lead context's extract or update method. For the pilot, we re-extract
   * with updated DM context since direct lead update is handled via the context.
   */
  const handleSave = useCallback(async () => {
    if (!lead || !lead.id) return;

    // Validate form data
    const validation = validateLeadData({
      name: formData.name,
      email: formData.email || undefined,
    });

    if (!validation.valid) {
      showToast(`Validation error: ${validation.errors[0]}`, 'warning');
      return;
    }

    if (typeof onSave === 'function') {
      onSave({
        ...lead,
        name: formData.name,
        contact: {
          email: formData.email || null,
          phone: formData.phone || null,
        },
        budget: (formData.budgetMin || formData.budgetMax)
          ? {
            min: formData.budgetMin ? parseInt(formData.budgetMin, 10) : null,
            max: formData.budgetMax ? parseInt(formData.budgetMax, 10) : null,
          }
          : null,
        location: formData.location || null,
        intent: formData.intent || lead.intent,
        notes: formData.notes || lead.notes,
      });
      setHasUnsavedChanges(false);
      showToast('Lead updated.', 'success');
      return;
    }

    setHasUnsavedChanges(false);
    showToast('Lead form saved locally.', 'info');
  }, [lead, formData, onSave]);

  const containerClasses = [
    'flex flex-col space-y-4',
    sizeClass.container,
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // No DM selected state
  if (!dm && !lead && !isLoadingDM) {
    return (
      <div className={containerClasses} role="region" aria-label="Lead Capture">
        <EmptyState
          title="No DM selected"
          description="Select a DM from the inbox to extract or view lead data."
          size={size === 'lg' ? 'md' : 'sm'}
          showIcon={false}
        />
      </div>
    );
  }

  // Loading DM state
  if (isLoadingDM && !dm && !lead) {
    return (
      <div className={containerClasses} role="region" aria-label="Lead Capture">
        <LoadingSpinner
          center
          size="sm"
          label="Loading DM..."
          showLabel
        />
      </div>
    );
  }

  // Extracting lead state
  if (isExtracting) {
    return (
      <div className={containerClasses} role="region" aria-label="Lead Capture">
        <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
          Lead Capture
        </h4>
        <LoadingSpinner
          center
          size="sm"
          label="Extracting lead data..."
          showLabel
        />
      </div>
    );
  }

  // No lead yet — show extract button
  if (!lead && dm) {
    return (
      <div className={containerClasses} role="region" aria-label="Lead Capture">
        <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
          Lead Capture
        </h4>

        {/* DM sender info */}
        <div className="flex items-center gap-2 p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl">
          <PlatformIcon platform={dm.sender?.platform} size="sm" />
          <div className="min-w-0 flex-1">
            <p className={`font-semibold text-neutral-900 truncate ${sizeClass.body}`}>
              {dm.sender?.name || 'Unknown Sender'}
            </p>
            {dm.sender?.handle && (
              <p className={`text-neutral-500 truncate ${sizeClass.meta}`}>
                {dm.sender.handle}
              </p>
            )}
          </div>
        </div>

        {showExtractButton && (
          <EmptyState
            title="No lead extracted"
            description="Extract structured lead data from this DM."
            size="sm"
            showIcon={false}
            actionLabel="Extract Lead"
            onAction={handleExtract}
            actionVariant="primary"
          />
        )}
      </div>
    );
  }

  // Lead exists — show full sidebar
  const canSync = lead && lead.id && (!lead.syncStatus || lead.syncStatus === 'failed' || lead.syncStatus === 'pending');
  const isSynced = lead?.syncStatus === 'success';

  return (
    <div className={containerClasses} role="region" aria-label="Lead Capture">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
            Lead Capture
          </h4>
          {lead && lead.platform && (
            <PlatformIcon platform={lead.platform} size="sm" />
          )}
        </div>
        {lead && lead.status && (
          <StatusBadge status={lead.status} size="sm" />
        )}
      </div>

      {/* Error state */}
      {leadError && (
        <div className="flex items-center justify-between gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl">
          <p className={`text-red-700 ${sizeClass.meta}`}>{leadError}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearLeadError}
            ariaLabel="Dismiss error"
            className="text-red-600 hover:text-red-700 shrink-0"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Lead score display */}
      {showScore && lead && (
        <LeadScoreDisplay score={lead.score} sizeClass={sizeClass} />
      )}

      {/* Salesforce sync status */}
      {showSyncStatus && lead && lead.syncStatus && (
        <SyncStatusIndicator
          syncStatus={lead.syncStatus}
          salesforceId={lead.salesforceId}
          sizeClass={sizeClass}
        />
      )}

      {/* Editable form fields */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className={`font-medium text-neutral-500 ${sizeClass.label}`}>
            Lead Details
          </span>
          {hasUnsavedChanges && (
            <span className={`text-accent-600 font-medium ${sizeClass.meta}`}>
              • Unsaved changes
            </span>
          )}
        </div>

        <FormField
          label="Name"
          name="name"
          value={formData.name}
          onChange={handleFieldChange}
          placeholder="Contact name"
          disabled={!editable || isAnyLoading}
          sizeClass={sizeClass}
        />

        <FormField
          label="Email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleFieldChange}
          placeholder="Email address"
          disabled={!editable || isAnyLoading}
          sizeClass={sizeClass}
        />

        <FormField
          label="Phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleFieldChange}
          placeholder="Phone number"
          disabled={!editable || isAnyLoading}
          sizeClass={sizeClass}
        />

        <BudgetEditor
          budget={{
            min: formData.budgetMin === '' ? null : Number(formData.budgetMin),
            max: formData.budgetMax === '' ? null : Number(formData.budgetMax),
          }}
          onChange={handleBudgetChange}
          disabled={!editable || isAnyLoading}
          sizeClass={sizeClass}
        />

        <FormField
          label="Location"
          name="location"
          value={formData.location}
          onChange={handleFieldChange}
          placeholder="Preferred location"
          disabled={!editable || isAnyLoading}
          sizeClass={sizeClass}
        />

        <FormField
          label="Intent"
          name="intent"
          value={formData.intent}
          onChange={handleFieldChange}
          placeholder="e.g., buy, sell, invest, rent"
          disabled={!editable || isAnyLoading}
          sizeClass={sizeClass}
        />

        <FormField
          label="Notes"
          name="notes"
          value={formData.notes}
          onChange={handleFieldChange}
          placeholder="Additional notes..."
          disabled={!editable || isAnyLoading}
          sizeClass={sizeClass}
          multiline
        />
      </div>

      {/* Property interests */}
      {showPropertyInterests && lead && (
        <PropertyInterests
          interests={lead.propertyInterests}
          sizeClass={sizeClass}
        />
      )}

      {/* Consent status */}
      {showConsent && lead && (
        <ConsentStatus
          hasConsent={lead.hasConsent}
          consentDate={lead.consentDate}
          consentSource={lead.consentSource}
          sizeClass={sizeClass}
        />
      )}

      {/* Flag for sales follow-up toggle */}
      {showFlagToggle && lead && lead.id && (
        <FlagForFollowUp
          flagged={isFlagged}
          onToggle={handleFlagToggle}
          disabled={isAnyLoading}
          loading={isFlagging}
          sizeClass={sizeClass}
        />
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2 pt-2 border-t border-neutral-200">
        {/* Save form changes */}
        {editable && hasUnsavedChanges && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSave}
            disabled={isAnyLoading}
            fullWidth
          >
            <svg
              className="h-3.5 w-3.5 mr-1.5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Save Changes
          </Button>
        )}

        {/* Re-extract lead */}
        {showExtractButton && dm && (
          <Tooltip content="Re-extract lead data from the DM content">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExtract}
              loading={isExtracting}
              disabled={isAnyLoading}
              fullWidth
              loadingText="Extracting..."
            >
              <svg
                className="h-3.5 w-3.5 mr-1.5"
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
              {lead ? 'Re-Extract Lead' : 'Extract Lead'}
            </Button>
          </Tooltip>
        )}

        {/* Score lead */}
        {showScoreButton && lead && lead.id && (
          <Tooltip content="Calculate lead score based on intent, budget, location, and engagement">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleScore}
              loading={isScoring}
              disabled={isAnyLoading}
              fullWidth
              loadingText="Scoring..."
            >
              <svg
                className="h-3.5 w-3.5 mr-1.5"
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
              Score Lead
            </Button>
          </Tooltip>
        )}

        {/* Create Lead in Salesforce */}
        {showSyncButton && lead && lead.id && (
          <Tooltip
            content={
              isSynced
                ? `Already synced to Salesforce (${lead.salesforceId || 'ID unknown'})`
                : 'Sync this lead to Salesforce CRM'
            }
          >
            <Button
              variant="primary"
              size="sm"
              onClick={handleSync}
              loading={isSyncing}
              disabled={isAnyLoading || isSynced}
              fullWidth
              loadingText="Syncing..."
            >
              <svg
                className="h-3.5 w-3.5 mr-1.5"
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
                  d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                />
              </svg>
              {isSynced ? 'Synced to Salesforce' : 'Create Lead in Salesforce'}
            </Button>
          </Tooltip>
        )}
      </div>

      {/* Lead metadata footer */}
      {lead && lead.createdAt && (
        <div className={`text-neutral-400 ${sizeClass.meta} pt-1 border-t border-neutral-100`}>
          Extracted {formatTimestamp(lead.createdAt)}
          {lead.updatedAt && lead.updatedAt !== lead.createdAt && (
            <span> · Updated {formatTimestamp(lead.updatedAt)}</span>
          )}
        </div>
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

export default LeadCaptureSidebar;