import { getDMById } from '@/repositories/dm-repository';
import { getDraftById } from '@/repositories/draft-repository';
import { getLeadById } from '@/repositories/lead-repository';
import { addLog } from '@/repositories/audit-log-repository';
import { sanitizeInput, validateConsentStatus, validateDraftContent } from '@/utils/validators';
import { detectPII, stripPII } from '@/utils/pii-filter';
import { STATUS, CONFIDENCE_THRESHOLD } from '@/utils/constants';

/**
 * Compliance Service
 * Privacy and compliance enforcement service
 * Implements privacy guardrails per LLD (SCRUM-6533, SCRUM-6536)
 *
 * Provides:
 * - checkConsentBeforeSend(dm, draft): Verifies consent status before message send
 * - validatePrivacyCompliance(data): Checks data handling rules for PII and consent
 * - getComplianceStatus(): Returns current compliance state summary
 * - blockNonCompliantAction(action): Prevents and logs non-compliant actions
 * - auditComplianceCheck(entityType, entityId, result, options): Logs compliance check results
 * - validateDraftPrivacy(draftId): Validates a draft meets privacy requirements
 * - checkPIIInContent(content): Checks content for PII and returns detection results
 *
 * Enforces Australian Privacy Act and Spam Act compliance:
 * - No PII in outbound messages without explicit consent
 * - All compliance checks are logged to the audit trail
 * - Low-confidence drafts require human review before sending
 * - PII detection and consent verification on all outbound content
 *
 * Simulates async latency to mimic real API behavior
 */

/**
 * Simulates network/API latency for realistic async behavior
 * @param {number} [minMs=30] - Minimum delay in milliseconds
 * @param {number} [maxMs=100] - Maximum delay in milliseconds
 * @returns {Promise<void>}
 */
function simulateLatency(minMs = 30, maxMs = 100) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Compliance status constants
 */
const COMPLIANCE_STATUS = Object.freeze({
  COMPLIANT: 'compliant',
  NON_COMPLIANT: 'non_compliant',
  REQUIRES_REVIEW: 'requires_review',
  BLOCKED: 'blocked',
});

/**
 * Compliance rule identifiers
 */
const COMPLIANCE_RULE = Object.freeze({
  CONSENT_REQUIRED: 'consent_required',
  PII_WITHOUT_CONSENT: 'pii_without_consent',
  LOW_CONFIDENCE_UNREVIEWED: 'low_confidence_unreviewed',
  INVALID_DRAFT_CONTENT: 'invalid_draft_content',
  MISSING_CONSENT_DATE: 'missing_consent_date',
  MISSING_CONSENT_SOURCE: 'missing_consent_source',
});

/**
 * Tracks blocked actions for compliance reporting
 * @type {Array<{ action: string, reason: string, timestamp: string }>}
 */
const _blockedActions = [];

/**
 * Maximum number of blocked actions to retain in memory
 */
const MAX_BLOCKED_ACTIONS = 200;

/**
 * Verifies consent status before allowing a message to be sent
 * Checks that the DM sender has provided consent and that the draft
 * does not contain PII without consent
 *
 * @param {object} dm - DM object
 * @param {string} dm.id - DM identifier
 * @param {object} [dm.metadata] - DM metadata
 * @param {boolean} [dm.metadata.hasConsent] - Whether sender has given consent
 * @param {string} [dm.metadata.consentDate] - Date consent was given
 * @param {string} [dm.metadata.consentSource] - Source of consent
 * @param {object} draft - Draft object
 * @param {number|string} draft.id - Draft identifier
 * @param {string} draft.content - Draft content
 * @param {number} [draft.confidence] - Confidence score (0-1)
 * @param {string} [draft.status] - Draft status
 * @returns {Promise<{ allowed: boolean, status: string, issues: string[], consentVerified: boolean }>}
 * @throws {Error} If dm or draft is not provided
 */
export async function checkConsentBeforeSend(dm, draft) {
  if (!dm || typeof dm !== 'object') {
    throw new Error('DM must be a non-null object');
  }

  if (!draft || typeof draft !== 'object') {
    throw new Error('Draft must be a non-null object');
  }

  await simulateLatency();

  const issues = [];
  let consentVerified = false;

  // Check consent status from DM metadata
  const hasConsent = dm.metadata?.hasConsent === true;
  const consentDate = dm.metadata?.consentDate || null;
  const consentSource = dm.metadata?.consentSource || null;

  if (hasConsent) {
    consentVerified = true;

    // Validate consent data completeness
    if (!consentDate) {
      issues.push('Consent date is missing');
    }

    if (!consentSource) {
      issues.push('Consent source is missing');
    }
  }

  // Detect PII in draft content
  const piiCheck = detectPII(draft.content || '');

  if (piiCheck.hasPII && !hasConsent) {
    issues.push(
      `Draft contains PII (${piiCheck.types.join(', ')}) but sender has not provided consent`
    );
  }

  // Check confidence threshold for unreviewed drafts
  if (
    typeof draft.confidence === 'number' &&
    draft.confidence < CONFIDENCE_THRESHOLD &&
    draft.status !== 'edited' &&
    draft.status !== 'approved'
  ) {
    issues.push(
      `Low-confidence draft (${Math.round(draft.confidence * 100)}%) has not been reviewed. Threshold is ${Math.round(CONFIDENCE_THRESHOLD * 100)}%.`
    );
  }

  // Validate draft content
  const contentValidation = validateDraftContent(draft.content || '');
  if (!contentValidation.valid) {
    for (const error of contentValidation.errors) {
      issues.push(`Draft content validation: ${error}`);
    }
  }

  const allowed = issues.length === 0;
  const status = allowed
    ? COMPLIANCE_STATUS.COMPLIANT
    : COMPLIANCE_STATUS.NON_COMPLIANT;

  // Log the compliance check
  try {
    await addLog({
      entityType: 'draft',
      entityId: String(draft.id || 'unknown'),
      action: 'update',
      performedBy: 'compliance-service',
      details: {
        action: 'consent_check',
        dmId: dm.id || null,
        allowed,
        status,
        consentVerified,
        piiDetected: piiCheck.hasPII,
        piiTypes: piiCheck.types,
        issueCount: issues.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[compliance-service] Failed to write audit log for consent check');
  }

  return {
    allowed,
    status,
    issues,
    consentVerified,
  };
}

/**
 * Validates privacy compliance for a data object
 * Checks for PII presence, consent status, and data handling rules
 *
 * @param {object} data - Data object to validate
 * @param {string} [data.content] - Text content to check for PII
 * @param {boolean} [data.hasConsent] - Whether consent has been given
 * @param {string} [data.consentDate] - Date consent was given
 * @param {string} [data.consentSource] - Source of consent
 * @param {string} [data.entityType] - Type of entity being validated
 * @param {string} [data.entityId] - Entity identifier
 * @returns {Promise<{ compliant: boolean, status: string, issues: string[], piiDetected: object }>}
 * @throws {Error} If data is not provided
 */
export async function validatePrivacyCompliance(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Data must be a non-null object');
  }

  await simulateLatency();

  const issues = [];

  // Check for PII in content
  let piiDetected = { hasPII: false, types: [] };

  if (data.content && typeof data.content === 'string') {
    piiDetected = detectPII(data.content);

    if (piiDetected.hasPII) {
      // Verify consent if PII is present
      if (data.hasConsent !== true) {
        issues.push(
          `Content contains PII (${piiDetected.types.join(', ')}) without verified consent`
        );
      } else {
        // Validate consent data
        const consentValidation = validateConsentStatus({
          hasConsent: data.hasConsent,
          consentDate: data.consentDate,
          consentSource: data.consentSource,
        });

        if (!consentValidation.valid) {
          for (const error of consentValidation.errors) {
            issues.push(error);
          }
        }
      }
    }
  }

  // Validate consent data if consent is claimed
  if (data.hasConsent === true) {
    if (!data.consentDate) {
      issues.push('Consent claimed but consent date is missing');
    }

    if (!data.consentSource) {
      issues.push('Consent claimed but consent source is missing');
    }
  }

  const compliant = issues.length === 0;
  const status = compliant
    ? COMPLIANCE_STATUS.COMPLIANT
    : COMPLIANCE_STATUS.NON_COMPLIANT;

  // Log the compliance validation
  try {
    await addLog({
      entityType: data.entityType || 'system',
      entityId: data.entityId || 'system',
      action: 'update',
      performedBy: 'compliance-service',
      details: {
        action: 'privacy_compliance_check',
        compliant,
        status,
        piiDetected: piiDetected.hasPII,
        piiTypes: piiDetected.types,
        issueCount: issues.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[compliance-service] Failed to write audit log for privacy compliance check');
  }

  return {
    compliant,
    status,
    issues,
    piiDetected,
  };
}

/**
 * Returns the current compliance state summary
 * Aggregates blocked actions, recent compliance checks, and overall status
 *
 * @returns {Promise<{ status: string, blockedActionCount: number, recentBlocked: object[], rules: object[] }>}
 */
export async function getComplianceStatus() {
  await simulateLatency(20, 60);

  const recentBlocked = _blockedActions.slice(-10).reverse();

  const rules = [
    {
      id: COMPLIANCE_RULE.CONSENT_REQUIRED,
      name: 'Consent Required for Outbound Messages',
      description: 'Sender must provide consent before messages containing PII can be sent',
      active: true,
    },
    {
      id: COMPLIANCE_RULE.PII_WITHOUT_CONSENT,
      name: 'PII Without Consent Blocked',
      description: 'Messages containing PII are blocked if sender has not provided consent',
      active: true,
    },
    {
      id: COMPLIANCE_RULE.LOW_CONFIDENCE_UNREVIEWED,
      name: 'Low-Confidence Draft Review Required',
      description: `Drafts with confidence below ${Math.round(CONFIDENCE_THRESHOLD * 100)}% must be reviewed before sending`,
      active: true,
    },
    {
      id: COMPLIANCE_RULE.INVALID_DRAFT_CONTENT,
      name: 'Draft Content Validation',
      description: 'Draft content must pass validation checks before sending',
      active: true,
    },
    {
      id: COMPLIANCE_RULE.MISSING_CONSENT_DATE,
      name: 'Consent Date Required',
      description: 'Consent date must be recorded when consent is given',
      active: true,
    },
    {
      id: COMPLIANCE_RULE.MISSING_CONSENT_SOURCE,
      name: 'Consent Source Required',
      description: 'Consent source must be recorded when consent is given',
      active: true,
    },
  ];

  const status = _blockedActions.length === 0
    ? COMPLIANCE_STATUS.COMPLIANT
    : COMPLIANCE_STATUS.REQUIRES_REVIEW;

  return {
    status,
    blockedActionCount: _blockedActions.length,
    recentBlocked,
    rules,
  };
}

/**
 * Prevents and logs a non-compliant action
 * Records the blocked action for compliance reporting and audit trail
 *
 * @param {object} action - Action to block
 * @param {string} action.type - Type of action being blocked (e.g., 'send', 'approve', 'export')
 * @param {string} action.entityType - Entity type involved
 * @param {string} action.entityId - Entity identifier
 * @param {string} action.reason - Reason for blocking
 * @param {string} [action.performedBy='system'] - User or system attempting the action
 * @returns {Promise<{ blocked: boolean, status: string, reason: string, timestamp: string }>}
 * @throws {Error} If action is not provided or missing required fields
 */
export async function blockNonCompliantAction(action) {
  if (!action || typeof action !== 'object') {
    throw new Error('Action must be a non-null object');
  }

  if (!action.type || typeof action.type !== 'string') {
    throw new Error('Action must have a type string');
  }

  if (!action.reason || typeof action.reason !== 'string') {
    throw new Error('Action must have a reason string');
  }

  const { type, entityType, entityId, reason, performedBy = 'system' } = action;

  await simulateLatency();

  const timestamp = new Date().toISOString();

  // Record the blocked action
  const blockedRecord = {
    action: sanitizeInput(type),
    entityType: entityType ? sanitizeInput(entityType) : 'unknown',
    entityId: entityId ? sanitizeInput(entityId) : 'unknown',
    reason: sanitizeInput(reason),
    performedBy: sanitizeInput(performedBy),
    timestamp,
  };

  _blockedActions.push(blockedRecord);

  // Trim blocked actions if exceeding max size
  if (_blockedActions.length > MAX_BLOCKED_ACTIONS) {
    _blockedActions.splice(0, _blockedActions.length - MAX_BLOCKED_ACTIONS);
  }

  // Log the blocked action to audit trail
  try {
    await addLog({
      entityType: entityType ? sanitizeInput(entityType) : 'system',
      entityId: entityId ? sanitizeInput(entityId) : 'system',
      action: 'reject',
      performedBy: sanitizeInput(performedBy),
      details: {
        action: 'block_non_compliant',
        blockedActionType: sanitizeInput(type),
        reason: stripPII(sanitizeInput(reason)),
        status: COMPLIANCE_STATUS.BLOCKED,
      },
      timestamp,
    });
  } catch {
    console.warn('[compliance-service] Failed to write audit log for blocked action');
  }

  return {
    blocked: true,
    status: COMPLIANCE_STATUS.BLOCKED,
    reason: sanitizeInput(reason),
    timestamp,
  };
}

/**
 * Logs a compliance check result to the audit trail
 *
 * @param {string} entityType - Entity type being checked
 * @param {string} entityId - Entity identifier
 * @param {object} result - Compliance check result
 * @param {boolean} result.compliant - Whether the check passed
 * @param {string[]} [result.issues] - List of compliance issues
 * @param {object} [options]
 * @param {string} [options.performedBy='compliance-service'] - User or system performing the check
 * @param {string} [options.checkType='general'] - Type of compliance check
 * @returns {Promise<void>}
 */
export async function auditComplianceCheck(entityType, entityId, result, options = {}) {
  if (!entityType || typeof entityType !== 'string') {
    throw new Error('Entity type is required and must be a string');
  }

  if (!entityId || typeof entityId !== 'string') {
    throw new Error('Entity ID is required and must be a string');
  }

  if (!result || typeof result !== 'object') {
    throw new Error('Result must be a non-null object');
  }

  const { performedBy = 'compliance-service', checkType = 'general' } = options;

  await simulateLatency(20, 60);

  try {
    await addLog({
      entityType: sanitizeInput(entityType),
      entityId: sanitizeInput(entityId),
      action: 'update',
      performedBy: sanitizeInput(performedBy),
      details: {
        action: 'compliance_audit',
        checkType,
        compliant: result.compliant === true,
        issueCount: Array.isArray(result.issues) ? result.issues.length : 0,
        issues: Array.isArray(result.issues)
          ? result.issues.map((issue) => stripPII(sanitizeInput(issue)))
          : [],
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[compliance-service] Failed to write audit log for compliance audit');
  }
}

/**
 * Validates that a draft meets privacy requirements before sending
 * Fetches the draft and its associated DM, then runs compliance checks
 *
 * @param {number|string} draftId - Draft identifier
 * @returns {Promise<{ compliant: boolean, status: string, issues: string[], draft: object|null, dm: object|null }>}
 * @throws {Error} If draftId is not provided or draft not found
 */
export async function validateDraftPrivacy(draftId) {
  if (draftId === undefined || draftId === null) {
    throw new Error('Draft id is required');
  }

  await simulateLatency();

  const draft = await getDraftById(draftId);

  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  const issues = [];
  let dm = null;

  // Check for PII in draft content
  const piiCheck = detectPII(draft.content || '');

  if (piiCheck.hasPII) {
    // Fetch associated DM to verify consent
    if (draft.dmId) {
      try {
        dm = await getDMById(draft.dmId);

        if (!dm || !dm.metadata || !dm.metadata.hasConsent) {
          issues.push(
            `Draft contains PII (${piiCheck.types.join(', ')}) but sender consent has not been verified`
          );
        }
      } catch {
        issues.push('Unable to verify sender consent for PII in draft content');
      }
    } else {
      issues.push(
        `Draft contains PII (${piiCheck.types.join(', ')}) but no associated DM for consent verification`
      );
    }
  }

  // Check confidence and review status
  if (
    typeof draft.confidence === 'number' &&
    draft.confidence < CONFIDENCE_THRESHOLD &&
    draft.status !== 'edited' &&
    draft.status !== 'approved'
  ) {
    issues.push(
      `Low-confidence draft (${Math.round(draft.confidence * 100)}%) requires human review before sending`
    );
  }

  // Validate draft content
  const contentValidation = validateDraftContent(draft.content || '');
  if (!contentValidation.valid) {
    for (const error of contentValidation.errors) {
      issues.push(`Content validation: ${error}`);
    }
  }

  const compliant = issues.length === 0;
  const status = compliant
    ? COMPLIANCE_STATUS.COMPLIANT
    : COMPLIANCE_STATUS.NON_COMPLIANT;

  // Log the privacy validation
  try {
    await auditComplianceCheck('draft', String(draftId), { compliant, issues }, {
      checkType: 'draft_privacy',
    });
  } catch {
    console.warn('[compliance-service] Failed to audit draft privacy check');
  }

  return {
    compliant,
    status,
    issues,
    draft,
    dm,
  };
}

/**
 * Checks content for PII and returns detection results
 * Convenience wrapper around detectPII with additional context
 *
 * @param {string} content - Text content to check
 * @returns {Promise<{ hasPII: boolean, types: string[], requiresConsent: boolean }>}
 */
export async function checkPIIInContent(content) {
  if (!content || typeof content !== 'string') {
    return { hasPII: false, types: [], requiresConsent: false };
  }

  await simulateLatency(10, 40);

  const piiResult = detectPII(content);

  return {
    hasPII: piiResult.hasPII,
    types: piiResult.types,
    requiresConsent: piiResult.hasPII,
  };
}

/**
 * Validates a lead's consent status for compliance
 * Checks that the lead has proper consent records if PII is stored
 *
 * @param {string} leadId - Lead identifier
 * @returns {Promise<{ compliant: boolean, issues: string[], lead: object|null }>}
 * @throws {Error} If leadId is not provided or lead not found
 */
export async function validateLeadConsent(leadId) {
  if (!leadId || typeof leadId !== 'string') {
    throw new Error('Lead id is required and must be a string');
  }

  await simulateLatency();

  const lead = await getLeadById(leadId);

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const issues = [];

  // Check if lead has PII stored (name, contact info)
  const hasPII = !!(lead.name || (lead.contact && (lead.contact.email || lead.contact.phone)));

  if (hasPII) {
    if (!lead.hasConsent) {
      issues.push('Lead has PII stored but consent has not been recorded');
    }

    if (lead.hasConsent && !lead.consentDate) {
      issues.push('Lead has consent but consent date is missing');
    }

    if (lead.hasConsent && !lead.consentSource) {
      issues.push('Lead has consent but consent source is missing');
    }
  }

  const compliant = issues.length === 0;

  // Log the consent validation
  try {
    await auditComplianceCheck('lead', leadId, { compliant, issues }, {
      checkType: 'lead_consent',
    });
  } catch {
    console.warn('[compliance-service] Failed to audit lead consent check');
  }

  return {
    compliant,
    issues,
    lead,
  };
}

/**
 * Clears the blocked actions history
 * Useful for testing or after compliance review
 */
export function clearBlockedActions() {
  _blockedActions.length = 0;
}

/**
 * Returns the count of blocked actions
 *
 * @returns {number} Number of blocked actions recorded
 */
export function getBlockedActionCount() {
  return _blockedActions.length;
}

/**
 * Exported compliance status and rule constants for consumers
 */
export { COMPLIANCE_STATUS, COMPLIANCE_RULE };