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
import { validateLeadData } from '@/utils/validators';
import { formatCurrency } from '@/utils/formatters';
import { LEAD_SCORE, LEAD_LABELS, getLeadLabel, STATUS } from '@/utils/constants';

/**
 * Size variant mappings for the lead form
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
 * Intent options for the intent select field
 */
const INTENT_OPTIONS = Object.freeze([
  { value: '', label: 'Select intent...' },
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'buy-sell', label: 'Buy & Sell' },
  { value: 'invest', label: 'Invest' },
  { value: 'rent', label: 'Rent' },
  { value: 'rent-then-buy', label: 'Rent then Buy' },
  { value: 'lease-commercial', label: 'Lease (Commercial)' },
  { value: 'research', label: 'Research' },
]);

/**
 * Validates an email address format
 *
 * @param {string} email - Email string to validate
 * @returns {string|null} Error message or null if valid
 */
function validateEmail(email) {
  if (!email || email.trim().length === 0) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  return null;
}

/**
 * Validates a phone number format
 *
 * @param {string} phone - Phone string to validate
 * @returns {string|null} Error message or null if valid
 */
function validatePhone(phone) {
  if (!phone || phone.trim().length === 0) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return 'Please enter a valid phone number (7-15 digits)';
  }
  return null;
}

/**
 * Validates a budget value
 *
 * @param {string} value - Budget string to validate
 * @returns {string|null} Error message or null if valid
 */
function validateBudgetValue(value) {
  if (!value || value.trim().length === 0) return null;
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0) {
    return 'Budget must be a positive number';
  }
  if (num > 100000000) {
    return 'Budget value seems too high';
  }
  return null;
}

/**
 * Form field component with label, input, and error display
 *
 * @param {object} props
 * @param {string} props.label - Field label
 * @param {string} props.name - Field name
 * @param {string} props.value - Field value
 * @param {Function} props.onChange - Change handler
 * @param {string} [props.type='text'] - Input type
 * @param {string} [props.placeholder] - Placeholder text
 * @param {boolean} [props.disabled=false] - Whether the field is disabled
 * @param {boolean} [props.required=false] - Whether the field is required
 * @param {string} [props.error] - Error message to display
 * @param {object} props.sizeClass - Size variant classes
 * @param {boolean} [props.multiline=false] - Whether to render a textarea
 * @param {string} [props.helpText] - Help text displayed below the input
 * @returns {React.ReactElement}
 */
function FormField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled = false,
  required = false,
  error,
  sizeClass,
  multiline = false,
  helpText,
}) {
  const inputBaseClasses = `block w-full border rounded-xl bg-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${sizeClass.input}`;
  const errorClasses = error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-neutral-300';

  return (
    <div className="space-y-1">
      <label
        htmlFor={`lead-form-${name}`}
        className={`font-medium text-neutral-600 ${sizeClass.label}`}
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {multiline ? (
        <textarea
          id={`lead-form-${name}`}
          name={name}
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`${inputBaseClasses} ${errorClasses} resize-y ${sizeClass.textarea}`}
          aria-invalid={!!error}
          aria-describedby={error ? `lead-form-${name}-error` : undefined}
        />
      ) : (
        <input
          id={`lead-form-${name}`}
          type={type}
          name={name}
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`${inputBaseClasses} ${errorClasses}`}
          aria-invalid={!!error}
          aria-describedby={error ? `lead-form-${name}-error` : undefined}
        />
      )}
      {error && (
        <p
          id={`lead-form-${name}-error`}
          className={`text-red-600 ${sizeClass.meta}`}
          role="alert"
        >
          {error}
        </p>
      )}
      {helpText && !error && (
        <p className={`text-neutral-400 ${sizeClass.meta}`}>
          {helpText}
        </p>
      )}
    </div>
  );
}

/**
 * Select field component with label and error display
 *
 * @param {object} props
 * @param {string} props.label - Field label
 * @param {string} props.name - Field name
 * @param {string} props.value - Field value
 * @param {Function} props.onChange - Change handler
 * @param {Array<{value: string, label: string}>} props.options - Select options
 * @param {boolean} [props.disabled=false] - Whether the field is disabled
 * @param {string} [props.error] - Error message to display
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function SelectField({ label, name, value, onChange, options, disabled = false, error, sizeClass }) {
  const selectClasses = `block w-full border rounded-xl bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${sizeClass.input}`;
  const errorClasses = error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-neutral-300';

  return (
    <div className="space-y-1">
      <label
        htmlFor={`lead-form-${name}`}
        className={`font-medium text-neutral-600 ${sizeClass.label}`}
      >
        {label}
      </label>
      <select
        id={`lead-form-${name}`}
        name={name}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        className={`${selectClasses} ${errorClasses}`}
        aria-invalid={!!error}
        aria-describedby={error ? `lead-form-${name}-error` : undefined}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p
          id={`lead-form-${name}-error`}
          className={`text-red-600 ${sizeClass.meta}`}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Budget range field component with min/max inputs
 *
 * @param {object} props
 * @param {string} props.budgetMin - Minimum budget value
 * @param {string} props.budgetMax - Maximum budget value
 * @param {Function} props.onMinChange - Min change handler
 * @param {Function} props.onMaxChange - Max change handler
 * @param {boolean} [props.disabled=false] - Whether the fields are disabled
 * @param {string} [props.errorMin] - Error message for min field
 * @param {string} [props.errorMax] - Error message for max field
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement}
 */
function BudgetRangeField({ budgetMin, budgetMax, onMinChange, onMaxChange, disabled = false, errorMin, errorMax, sizeClass }) {
  const inputClasses = `block w-full border rounded-xl bg-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed ${sizeClass.input}`;

  const minVal = budgetMin === '' || budgetMin === null || budgetMin === undefined ? '' : budgetMin;
  const maxVal = budgetMax === '' || budgetMax === null || budgetMax === undefined ? '' : budgetMax;

  const hasValues = (minVal !== '' && minVal !== '0') || (maxVal !== '' && maxVal !== '0');

  return (
    <div className="space-y-1">
      <span className={`font-medium text-neutral-600 ${sizeClass.label}`}>
        Budget Range
      </span>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <input
            id="lead-form-budgetMin"
            type="number"
            name="budgetMin"
            value={minVal}
            onChange={onMinChange}
            placeholder="Min ($)"
            disabled={disabled}
            className={`${inputClasses} ${errorMin ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-neutral-300'}`}
            aria-label="Minimum budget"
            min={0}
          />
        </div>
        <span className={`text-neutral-400 ${sizeClass.meta}`}>–</span>
        <div className="flex-1">
          <input
            id="lead-form-budgetMax"
            type="number"
            name="budgetMax"
            value={maxVal}
            onChange={onMaxChange}
            placeholder="Max ($)"
            disabled={disabled}
            className={`${inputClasses} ${errorMax ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-neutral-300'}`}
            aria-label="Maximum budget"
            min={0}
          />
        </div>
      </div>
      {(errorMin || errorMax) && (
        <p className={`text-red-600 ${sizeClass.meta}`} role="alert">
          {errorMin || errorMax}
        </p>
      )}
      {hasValues && !errorMin && !errorMax && (
        <p className={`text-neutral-400 ${sizeClass.meta}`}>
          {minVal && maxVal
            ? `${formatCurrency(parseInt(minVal, 10), { minimumFractionDigits: 0, maximumFractionDigits: 0 })} – ${formatCurrency(parseInt(maxVal, 10), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            : maxVal
              ? `Up to ${formatCurrency(parseInt(maxVal, 10), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              : `From ${formatCurrency(parseInt(minVal, 10), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
          }
        </p>
      )}
    </div>
  );
}

/**
 * Validation summary component
 * Displays a list of validation errors at the top of the form
 *
 * @param {object} props
 * @param {object} props.errors - Field error map
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function ValidationSummary({ errors, sizeClass }) {
  const errorEntries = Object.entries(errors).filter(([, value]) => value !== null && value !== undefined);

  if (errorEntries.length === 0) return null;

  return (
    <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl space-y-1" role="alert">
      <p className={`font-semibold text-red-800 ${sizeClass.body}`}>
        Please fix the following errors:
      </p>
      <ul className="space-y-0.5">
        {errorEntries.map(([field, message]) => (
          <li
            key={field}
            className={`flex items-start gap-1.5 text-red-700 ${sizeClass.meta}`}
          >
            <span className="text-red-400 shrink-0 mt-0.5">•</span>
            <span>{message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Auto-fill indicator component
 * Shows which fields were auto-filled from extraction
 *
 * @param {object} props
 * @param {string[]} props.fields - Array of auto-filled field names
 * @param {object} props.sizeClass - Size variant classes
 * @returns {React.ReactElement|null}
 */
function AutoFillIndicator({ fields, sizeClass }) {
  if (!fields || fields.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 p-2 bg-brand-50 border border-brand-200 rounded-xl">
      <svg
        className="h-3.5 w-3.5 shrink-0 text-brand-600"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className={`text-brand-700 ${sizeClass.meta}`}>
        Auto-filled from extraction: {fields.join(', ')}
      </span>
    </div>
  );
}

/**
 * LeadForm component
 * Lead form component: editable form fields for lead data (name, email, phone,
 * budget, location, intent) with validation, error messages, and auto-fill
 * from extraction.
 *
 * Implements FR-005 (SCRUM-6537)
 *
 * Features:
 * - Editable form fields for name, email, phone, budget range, location, intent, notes
 * - Real-time field-level validation with error messages
 * - Validation summary displayed on submit
 * - Auto-fill from lead extraction with indicator showing which fields were auto-filled
 * - Extract lead from DM action
 * - Save/submit form with validation
 * - Reset form to last saved state
 * - Unsaved changes indicator
 * - Loading and empty states
 * - Toast notifications for actions
 * - ARIA labels and error associations for accessibility
 * - Keyboard support (Enter to submit)
 *
 * @param {object} props
 * @param {object} [props.lead] - Lead object to populate the form (overrides LeadContext)
 * @param {object} [props.dm] - DM object for extraction (overrides DMContext)
 * @param {boolean} [props.editable=true] - Whether the form fields are editable
 * @param {boolean} [props.showExtractButton=true] - Whether to show the extract lead button
 * @param {boolean} [props.showResetButton=true] - Whether to show the reset button
 * @param {boolean} [props.showAutoFillIndicator=true] - Whether to show the auto-fill indicator
 * @param {boolean} [props.showValidationSummary=true] - Whether to show the validation summary on submit
 * @param {boolean} [props.validateOnBlur=true] - Whether to validate fields on blur
 * @param {boolean} [props.validateOnChange=false] - Whether to validate fields on change
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant for the form
 * @param {Function} [props.onSave] - Callback when form is saved (receives form data object)
 * @param {Function} [props.onExtract] - Callback when lead is extracted (receives DM)
 * @param {Function} [props.onChange] - Callback when any field changes (receives form data object)
 * @param {Function} [props.onValidationChange] - Callback when validation state changes (receives { valid, errors })
 * @param {string} [props.className=''] - Additional CSS classes to apply
 * @returns {React.ReactElement}
 *
 * @example
 * <LeadForm />
 *
 * @example
 * <LeadForm
 *   lead={leadObject}
 *   dm={dmObject}
 *   onSave={handleSave}
 *   onExtract={handleExtract}
 * />
 *
 * @example
 * <LeadForm
 *   size="sm"
 *   editable={false}
 *   showExtractButton={false}
 * />
 */
export function LeadForm({
  lead: leadProp,
  dm: dmProp,
  editable = true,
  showExtractButton = true,
  showResetButton = true,
  showAutoFillIndicator = true,
  showValidationSummary = true,
  validateOnBlur = true,
  validateOnChange = false,
  size = 'md',
  onSave,
  onExtract,
  onChange,
  onValidationChange,
  className = '',
}) {
  const {
    selectedLead,
    loading: leadLoading,
    error: leadError,
    extract,
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

  const [fieldErrors, setFieldErrors] = useState({
    name: null,
    email: null,
    phone: null,
    budgetMin: null,
    budgetMax: null,
    location: null,
    intent: null,
    notes: null,
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState([]);
  const [showSubmitErrors, setShowSubmitErrors] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastSavedData, setLastSavedData] = useState(null);

  const mountedRef = useRef(true);
  const formRef = useRef(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // Determine DM and lead sources
  const dm = dmProp || selectedDM?.dm || null;
  const lead = leadProp || selectedLead?.lead || null;

  const isLoadingDM = dmLoading.selected || dmLoading.initializing;
  const isExtracting = leadLoading.extracting;
  const isAnyLoading = isExtracting;

  // Sync form data with lead when lead changes
  useEffect(() => {
    if (lead) {
      const newFormData = {
        name: lead.name || '',
        email: lead.contact?.email || '',
        phone: lead.contact?.phone || '',
        budgetMin: lead.budget?.min ?? '',
        budgetMax: lead.budget?.max ?? '',
        location: lead.location || '',
        intent: lead.intent || '',
        notes: lead.notes || '',
      };

      setFormData(newFormData);
      setLastSavedData(newFormData);
      setHasUnsavedChanges(false);
      setShowSubmitErrors(false);
      setFieldErrors({
        name: null,
        email: null,
        phone: null,
        budgetMin: null,
        budgetMax: null,
        location: null,
        intent: null,
        notes: null,
      });

      // Determine which fields were auto-filled from extraction
      const filled = [];
      if (lead.name) filled.push('name');
      if (lead.contact?.email) filled.push('email');
      if (lead.contact?.phone) filled.push('phone');
      if (lead.budget?.min || lead.budget?.max) filled.push('budget');
      if (lead.location) filled.push('location');
      if (lead.intent && lead.intent !== 'research') filled.push('intent');
      setAutoFilledFields(filled);
    } else if (dm) {
      const newFormData = {
        name: dm.sender?.name || '',
        email: '',
        phone: '',
        budgetMin: '',
        budgetMax: '',
        location: '',
        intent: '',
        notes: '',
      };

      setFormData(newFormData);
      setLastSavedData(newFormData);
      setHasUnsavedChanges(false);
      setShowSubmitErrors(false);
      setAutoFilledFields(dm.sender?.name ? ['name'] : []);
      setFieldErrors({
        name: null,
        email: null,
        phone: null,
        budgetMin: null,
        budgetMax: null,
        location: null,
        intent: null,
        notes: null,
      });
    }
  }, [lead, dm]);

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
   * Validates a single field and returns the error message
   *
   * @param {string} fieldName - Field name
   * @param {string} value - Field value
   * @returns {string|null} Error message or null
   */
  function validateField(fieldName, value) {
    switch (fieldName) {
      case 'name':
        if (!value || value.trim().length === 0) {
          return 'Name is required';
        }
        if (value.trim().length > 200) {
          return 'Name must not exceed 200 characters';
        }
        return null;

      case 'email':
        return validateEmail(value);

      case 'phone':
        return validatePhone(value);

      case 'budgetMin':
        return validateBudgetValue(value);

      case 'budgetMax': {
        const maxError = validateBudgetValue(value);
        if (maxError) return maxError;
        // Cross-field validation: max should be >= min
        if (value && formData.budgetMin) {
          const min = parseInt(formData.budgetMin, 10);
          const max = parseInt(value, 10);
          if (!isNaN(min) && !isNaN(max) && max < min) {
            return 'Maximum budget must be greater than minimum';
          }
        }
        return null;
      }

      case 'location':
        if (value && value.trim().length > 200) {
          return 'Location must not exceed 200 characters';
        }
        return null;

      case 'notes':
        if (value && value.length > 2000) {
          return 'Notes must not exceed 2000 characters';
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Validates all form fields and returns the errors map
   *
   * @returns {object} Field errors map
   */
  function validateAllFields() {
    const errors = {};

    errors.name = validateField('name', formData.name);
    errors.email = validateField('email', formData.email);
    errors.phone = validateField('phone', formData.phone);
    errors.budgetMin = validateField('budgetMin', String(formData.budgetMin));
    errors.budgetMax = validateField('budgetMax', String(formData.budgetMax));
    errors.location = validateField('location', formData.location);
    errors.notes = validateField('notes', formData.notes);

    return errors;
  }

  /**
   * Checks if the form is valid (no errors)
   *
   * @param {object} errors - Field errors map
   * @returns {boolean} True if all fields are valid
   */
  function isFormValid(errors) {
    return Object.values(errors).every((error) => error === null || error === undefined);
  }

  /**
   * Handles form field changes
   *
   * @param {React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>} event
   */
  function handleFieldChange(event) {
    const { name, value } = event.target;

    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);

    // Check for unsaved changes
    if (lastSavedData) {
      const changed = Object.keys(newFormData).some(
        (key) => String(newFormData[key] || '') !== String(lastSavedData[key] || '')
      );
      setHasUnsavedChanges(changed);
    } else {
      setHasUnsavedChanges(true);
    }

    // Validate on change if enabled
    if (validateOnChange) {
      const error = validateField(name, value);
      setFieldErrors((prev) => ({ ...prev, [name]: error }));
    }

    // Clear submit errors when user starts editing
    if (showSubmitErrors) {
      setShowSubmitErrors(false);
    }

    // Notify parent of change
    if (typeof onChange === 'function') {
      onChange(newFormData);
    }
  }

  /**
   * Handles budget min field changes
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  function handleBudgetMinChange(event) {
    const value = event.target.value;
    const newFormData = { ...formData, budgetMin: value };
    setFormData(newFormData);

    if (lastSavedData) {
      const changed = Object.keys(newFormData).some(
        (key) => String(newFormData[key] || '') !== String(lastSavedData[key] || '')
      );
      setHasUnsavedChanges(changed);
    } else {
      setHasUnsavedChanges(true);
    }

    if (validateOnChange) {
      const error = validateField('budgetMin', value);
      setFieldErrors((prev) => ({ ...prev, budgetMin: error }));
    }

    if (showSubmitErrors) {
      setShowSubmitErrors(false);
    }

    if (typeof onChange === 'function') {
      onChange(newFormData);
    }
  }

  /**
   * Handles budget max field changes
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  function handleBudgetMaxChange(event) {
    const value = event.target.value;
    const newFormData = { ...formData, budgetMax: value };
    setFormData(newFormData);

    if (lastSavedData) {
      const changed = Object.keys(newFormData).some(
        (key) => String(newFormData[key] || '') !== String(lastSavedData[key] || '')
      );
      setHasUnsavedChanges(changed);
    } else {
      setHasUnsavedChanges(true);
    }

    if (validateOnChange) {
      const error = validateField('budgetMax', value);
      setFieldErrors((prev) => ({ ...prev, budgetMax: error }));
    }

    if (showSubmitErrors) {
      setShowSubmitErrors(false);
    }

    if (typeof onChange === 'function') {
      onChange(newFormData);
    }
  }

  /**
   * Handles field blur for validation
   *
   * @param {React.FocusEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>} event
   */
  function handleFieldBlur(event) {
    if (!validateOnBlur) return;

    const { name, value } = event.target;
    const error = validateField(name, value);

    setFieldErrors((prev) => {
      const updated = { ...prev, [name]: error };

      // Notify parent of validation change
      if (typeof onValidationChange === 'function') {
        onValidationChange({
          valid: isFormValid(updated),
          errors: updated,
        });
      }

      return updated;
    });
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
      showToast(
        result.complete
          ? 'Lead extracted successfully. Form auto-filled.'
          : 'Lead extracted with incomplete data. Please review and complete.',
        result.complete ? 'success' : 'warning'
      );
    } else {
      showToast('Failed to extract lead from DM.', 'error');
    }
  }, [dm, extract, onExtract, clearLeadError]);

  /**
   * Handles form submission
   *
   * @param {React.FormEvent} event
   */
  const handleSubmit = useCallback(async (event) => {
    if (event) {
      event.preventDefault();
    }

    // Validate all fields
    const errors = validateAllFields();
    setFieldErrors(errors);

    if (!isFormValid(errors)) {
      setShowSubmitErrors(true);
      showToast('Please fix the validation errors before saving.', 'warning');

      // Notify parent of validation change
      if (typeof onValidationChange === 'function') {
        onValidationChange({ valid: false, errors });
      }
      return;
    }

    // Build the lead data object
    const leadData = {
      name: formData.name.trim(),
      contact: {
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
      },
      budget: (formData.budgetMin || formData.budgetMax)
        ? {
          min: formData.budgetMin ? parseInt(formData.budgetMin, 10) : null,
          max: formData.budgetMax ? parseInt(formData.budgetMax, 10) : null,
        }
        : null,
      location: formData.location.trim() || null,
      intent: formData.intent || null,
      notes: formData.notes.trim() || null,
    };

    // If we have an existing lead, include its id
    if (lead && lead.id) {
      leadData.id = lead.id;
    }

    if (typeof onSave === 'function') {
      onSave(leadData);
    }

    setLastSavedData({ ...formData });
    setHasUnsavedChanges(false);
    setShowSubmitErrors(false);
    showToast('Lead data saved successfully.', 'success');
  }, [formData, lead, onSave, onValidationChange]);

  /**
   * Handles resetting the form to the last saved state
   */
  function handleReset() {
    if (lastSavedData) {
      setFormData({ ...lastSavedData });
    } else if (lead) {
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
    }

    setHasUnsavedChanges(false);
    setShowSubmitErrors(false);
    setFieldErrors({
      name: null,
      email: null,
      phone: null,
      budgetMin: null,
      budgetMax: null,
      location: null,
      intent: null,
      notes: null,
    });

    showToast('Form reset to last saved state.', 'info');
  }

  /**
   * Handles keyboard shortcuts on the form
   *
   * @param {React.KeyboardEvent} event
   */
  function handleFormKeyDown(event) {
    // Ctrl/Cmd + S to save
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      if (hasUnsavedChanges && !isAnyLoading) {
        handleSubmit();
      }
    }

    // Escape to reset
    if (event.key === 'Escape') {
      event.preventDefault();
      if (hasUnsavedChanges) {
        handleReset();
      }
    }
  }

  const containerClasses = [
    'flex flex-col space-y-4',
    sizeClass.container,
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // No DM and no lead state
  if (!dm && !lead && !isLoadingDM) {
    return (
      <div className={containerClasses} role="region" aria-label="Lead Form">
        <EmptyState
          title="No DM selected"
          description="Select a DM from the inbox to extract or enter lead data."
          size={size === 'lg' ? 'md' : 'sm'}
          showIcon={false}
        />
      </div>
    );
  }

  // Loading DM state
  if (isLoadingDM && !dm && !lead) {
    return (
      <div className={containerClasses} role="region" aria-label="Lead Form">
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
      <div className={containerClasses} role="region" aria-label="Lead Form">
        <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
          Lead Data
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

  return (
    <div className={containerClasses} role="region" aria-label="Lead Form">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className={`font-semibold text-neutral-700 ${sizeClass.heading}`}>
            Lead Data
          </h4>
          {lead && lead.platform && (
            <PlatformIcon platform={lead.platform} size="sm" />
          )}
          {!lead && dm && dm.sender?.platform && (
            <PlatformIcon platform={dm.sender.platform} size="sm" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className={`text-accent-600 font-medium ${sizeClass.meta}`}>
              • Unsaved changes
            </span>
          )}
        </div>
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

      {/* Auto-fill indicator */}
      {showAutoFillIndicator && autoFilledFields.length > 0 && (
        <AutoFillIndicator fields={autoFilledFields} sizeClass={sizeClass} />
      )}

      {/* Validation summary */}
      {showValidationSummary && showSubmitErrors && (
        <ValidationSummary errors={fieldErrors} sizeClass={sizeClass} />
      )}

      {/* Form */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onKeyDown={handleFormKeyDown}
        noValidate
        className="space-y-3"
      >
        {/* Name field */}
        <FormField
          label="Name"
          name="name"
          value={formData.name}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          placeholder="Contact name"
          disabled={!editable || isAnyLoading}
          required
          error={fieldErrors.name}
          sizeClass={sizeClass}
        />

        {/* Email field */}
        <FormField
          label="Email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          placeholder="Email address"
          disabled={!editable || isAnyLoading}
          error={fieldErrors.email}
          sizeClass={sizeClass}
          helpText="Optional — used for follow-up communication"
        />

        {/* Phone field */}
        <FormField
          label="Phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          placeholder="Phone number"
          disabled={!editable || isAnyLoading}
          error={fieldErrors.phone}
          sizeClass={sizeClass}
        />

        {/* Budget range */}
        <BudgetRangeField
          budgetMin={formData.budgetMin}
          budgetMax={formData.budgetMax}
          onMinChange={handleBudgetMinChange}
          onMaxChange={handleBudgetMaxChange}
          disabled={!editable || isAnyLoading}
          errorMin={fieldErrors.budgetMin}
          errorMax={fieldErrors.budgetMax}
          sizeClass={sizeClass}
        />

        {/* Location field */}
        <FormField
          label="Location"
          name="location"
          value={formData.location}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          placeholder="Preferred location or area"
          disabled={!editable || isAnyLoading}
          error={fieldErrors.location}
          sizeClass={sizeClass}
        />

        {/* Intent select */}
        <SelectField
          label="Intent"
          name="intent"
          value={formData.intent}
          onChange={handleFieldChange}
          options={INTENT_OPTIONS}
          disabled={!editable || isAnyLoading}
          error={fieldErrors.intent}
          sizeClass={sizeClass}
        />

        {/* Notes field */}
        <FormField
          label="Notes"
          name="notes"
          value={formData.notes}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          placeholder="Additional notes about this lead..."
          disabled={!editable || isAnyLoading}
          error={fieldErrors.notes}
          sizeClass={sizeClass}
          multiline
        />

        {/* Action buttons */}
        <div className="flex flex-col gap-2 pt-2 border-t border-neutral-200">
          {/* Save button */}
          {editable && (
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isAnyLoading || (!hasUnsavedChanges && !showSubmitErrors)}
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
              Save Lead Data
            </Button>
          )}

          {/* Reset button */}
          {showResetButton && editable && hasUnsavedChanges && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={handleReset}
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Reset Form
            </Button>
          )}

          {/* Extract lead button */}
          {showExtractButton && dm && editable && (
            <Tooltip content="Extract structured lead data from the DM content using AI">
              <Button
                variant="secondary"
                size="sm"
                type="button"
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
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                  />
                </svg>
                {lead ? 'Re-Extract from DM' : 'Extract from DM'}
              </Button>
            </Tooltip>
          )}
        </div>

        {/* Keyboard shortcuts hint */}
        {editable && (
          <p className={`text-neutral-400 text-center ${sizeClass.meta}`}>
            Ctrl+S to save • Esc to reset
          </p>
        )}
      </form>

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

export default LeadForm;