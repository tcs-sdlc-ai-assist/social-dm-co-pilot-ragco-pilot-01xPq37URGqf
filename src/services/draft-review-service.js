import { getDraftById, updateDraft, updateDraftStatus } from '@/repositories/draft-repository';
import { getDMById, updateDMStatus } from '@/repositories/dm-repository';
import { addLog } from '@/repositories/audit-log-repository';
import { sanitizeInput } from '@/utils/validators';
import { validateDraftContent, validateConsentStatus } from '@/utils/validators';
import { stripPII, detectPII } from '@/utils/pii-filter';
import { STATUS, CONFIDENCE_THRESHOLD } from '@/utils/constants';

/**
 * Draft Review Service
 * Business logic layer for human review workflow
 * Implements DraftReviewService from LLD (SCRUM-6532, SCRUM-6536)
 *
 * Provides:
 * - reviewDraft(draftId): Load a draft for human review
 * - editDraft(draftId, newContent, options): Save edits with history tracking
 * - approveDraft(draftId, options): Approve and mark draft for sending (blocks low-confidence without review)
 * - rejectDraft(draftId, options): Reject a draft with reason
 *
 * All actions are logged via AuditLogService for compliance and traceability
 * Enforces privacy guardrails per SCRUM-6536
 *
 * Simulates async latency to mimic real API behavior
 */

/**
 * Simulates network/API latency for realistic async behavior
 * @param {number} [minMs=50] - Minimum delay in milliseconds
 * @param {number} [maxMs=150] - Maximum delay in milliseconds
 * @returns {Promise<void>}
 */
function simulateLatency(minMs = 50, maxMs = 150) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Valid draft statuses for the review workflow
 */
const DRAFT_STATUS = Object.freeze({
  GENERATED: 'generated',
  EDITED: 'edited',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SENT: 'sent',
});

/**
 * Statuses from which a draft can be edited
 */
const EDITABLE_STATUSES = [DRAFT_STATUS.GENERATED, DRAFT_STATUS.EDITED];

/**
 * Statuses from which a draft can be approved
 */
const APPROVABLE_STATUSES = [DRAFT_STATUS.GENERATED, DRAFT_STATUS.EDITED];

/**
 * Statuses from which a draft can be rejected
 */
const REJECTABLE_STATUSES = [DRAFT_STATUS.GENERATED, DRAFT_STATUS.EDITED];

/**
 * Loads a draft for human review
 * Returns the draft along with its associated DM for context
 *
 * @param {number|string} draftId - Draft identifier
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @returns {Promise<{ draft: object, dm: object|null, requiresReview: boolean, piiDetected: object }>}
 * @throws {Error} If draftId is not provided or draft not found
 */
export async function reviewDraft(draftId, options = {}) {
  if (draftId === undefined || draftId === null) {
    throw new Error('Draft id is required');
  }

  const { performedBy = 'system' } = options;

  await simulateLatency();

  const draft = await getDraftById(draftId);

  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  // Fetch associated DM for context
  let dm = null;
  if (draft.dmId) {
    try {
      dm = await getDMById(draft.dmId);
    } catch {
      console.warn('[draft-review-service] Failed to fetch associated DM for draft review');
    }
  }

  // Determine if human review is required
  const requiresReview = typeof draft.confidence === 'number' && draft.confidence < CONFIDENCE_THRESHOLD;

  // Detect PII in draft content for privacy guardrails
  const piiDetected = detectPII(draft.content || '');

  // Log the review action
  try {
    await addLog({
      entityType: 'draft',
      entityId: String(draftId),
      action: 'update',
      performedBy: sanitizeInput(performedBy),
      details: {
        action: 'review',
        draftStatus: draft.status,
        confidence: draft.confidence,
        requiresReview,
        piiDetected: piiDetected.hasPII,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[draft-review-service] Failed to write audit log for draft review');
  }

  return {
    draft,
    dm,
    requiresReview,
    piiDetected,
  };
}

/**
 * Saves edits to a draft with history tracking
 * Validates content, checks for PII, and records the edit in the draft's edit history
 *
 * @param {number|string} draftId - Draft identifier
 * @param {string} newContent - Updated draft content
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier performing the edit
 * @returns {Promise<object>} Updated draft object
 * @throws {Error} If draft not found, content is invalid, or draft is not in an editable state
 */
export async function editDraft(draftId, newContent, options = {}) {
  if (draftId === undefined || draftId === null) {
    throw new Error('Draft id is required');
  }

  if (newContent === undefined || newContent === null) {
    throw new Error('New content is required');
  }

  if (typeof newContent !== 'string') {
    throw new Error('New content must be a string');
  }

  const { performedBy = 'system' } = options;

  // Validate draft content
  const validation = validateDraftContent(newContent);
  if (!validation.valid) {
    throw new Error(`Invalid draft content: ${validation.errors.join(', ')}`);
  }

  await simulateLatency();

  const draft = await getDraftById(draftId);

  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  // Verify draft is in an editable state
  if (!EDITABLE_STATUSES.includes(draft.status)) {
    throw new Error(
      `Draft cannot be edited in status: ${draft.status}. Must be one of: ${EDITABLE_STATUSES.join(', ')}`
    );
  }

  // Check for PII in new content (privacy guardrail)
  const piiCheck = detectPII(newContent);
  if (piiCheck.hasPII) {
    // Check consent if DM is available
    if (draft.dmId) {
      try {
        const dm = await getDMById(draft.dmId);
        if (dm && dm.metadata && !dm.metadata.hasConsent) {
          throw new Error(
            'Draft content contains PII but sender has not provided consent. Please remove PII before saving.'
          );
        }
      } catch (err) {
        if (err.message.includes('PII')) {
          throw err;
        }
        // If DM fetch fails, log warning but allow edit
        console.warn('[draft-review-service] Failed to verify consent for PII check');
      }
    }
  }

  // Update the draft with new content and status
  const updatedDraft = await updateDraft({
    id: draftId,
    content: newContent,
    status: DRAFT_STATUS.EDITED,
    editedBy: performedBy,
  });

  // Log the edit action
  try {
    await addLog({
      entityType: 'draft',
      entityId: String(draftId),
      action: 'update',
      performedBy: sanitizeInput(performedBy),
      details: {
        action: 'edit',
        previousStatus: draft.status,
        newStatus: DRAFT_STATUS.EDITED,
        piiDetected: piiCheck.hasPII,
        piiTypes: piiCheck.types,
        contentLength: newContent.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[draft-review-service] Failed to write audit log for draft edit');
  }

  return updatedDraft;
}

/**
 * Approves a draft for sending
 * Blocks approval if the draft has low confidence and has not been reviewed/edited
 * Updates the associated DM status to Sent
 *
 * @param {number|string} draftId - Draft identifier
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier performing the approval
 * @returns {Promise<{ draft: object, dm: object|null }>} Approved draft and updated DM
 * @throws {Error} If draft not found, not in approvable state, or low-confidence without review
 */
export async function approveDraft(draftId, options = {}) {
  if (draftId === undefined || draftId === null) {
    throw new Error('Draft id is required');
  }

  const { performedBy = 'system' } = options;

  await simulateLatency();

  const draft = await getDraftById(draftId);

  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  // Verify draft is in an approvable state
  if (!APPROVABLE_STATUSES.includes(draft.status)) {
    throw new Error(
      `Draft cannot be approved in status: ${draft.status}. Must be one of: ${APPROVABLE_STATUSES.join(', ')}`
    );
  }

  // Enforce human review for low-confidence drafts
  // Low-confidence drafts must be edited before approval
  if (
    typeof draft.confidence === 'number' &&
    draft.confidence < CONFIDENCE_THRESHOLD &&
    draft.status !== DRAFT_STATUS.EDITED
  ) {
    throw new Error(
      `Low-confidence draft (${Math.round(draft.confidence * 100)}%) requires human review and editing before approval. Confidence threshold is ${Math.round(CONFIDENCE_THRESHOLD * 100)}%.`
    );
  }

  // Privacy guardrail: check for PII in content before sending
  const piiCheck = detectPII(draft.content || '');
  if (piiCheck.hasPII && draft.dmId) {
    try {
      const dm = await getDMById(draft.dmId);
      if (dm && dm.metadata && !dm.metadata.hasConsent) {
        throw new Error(
          'Cannot approve draft containing PII without sender consent. Please edit the draft to remove PII.'
        );
      }
    } catch (err) {
      if (err.message.includes('PII') || err.message.includes('consent')) {
        throw err;
      }
      console.warn('[draft-review-service] Failed to verify consent during approval');
    }
  }

  // Update draft status to approved
  const updatedDraft = await updateDraftStatus(draftId, DRAFT_STATUS.APPROVED, performedBy);

  // Update associated DM status to Sent
  let updatedDM = null;
  if (draft.dmId) {
    try {
      updatedDM = await updateDMStatus(draft.dmId, STATUS.SENT);
    } catch {
      console.warn('[draft-review-service] Failed to update DM status to Sent after approval');
    }
  }

  // Log the approval action
  try {
    await addLog({
      entityType: 'draft',
      entityId: String(draftId),
      action: 'approve',
      performedBy: sanitizeInput(performedBy),
      details: {
        dmId: draft.dmId,
        confidence: draft.confidence,
        previousStatus: draft.status,
        newStatus: DRAFT_STATUS.APPROVED,
        dmStatusUpdated: updatedDM !== null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[draft-review-service] Failed to write audit log for draft approval');
  }

  return {
    draft: updatedDraft,
    dm: updatedDM,
  };
}

/**
 * Rejects a draft with an optional reason
 * Marks the draft as rejected and logs the action
 *
 * @param {number|string} draftId - Draft identifier
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier performing the rejection
 * @param {string} [options.reason] - Reason for rejection
 * @returns {Promise<object>} Rejected draft object
 * @throws {Error} If draft not found or not in a rejectable state
 */
export async function rejectDraft(draftId, options = {}) {
  if (draftId === undefined || draftId === null) {
    throw new Error('Draft id is required');
  }

  const { performedBy = 'system', reason } = options;

  await simulateLatency();

  const draft = await getDraftById(draftId);

  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  // Verify draft is in a rejectable state
  if (!REJECTABLE_STATUSES.includes(draft.status)) {
    throw new Error(
      `Draft cannot be rejected in status: ${draft.status}. Must be one of: ${REJECTABLE_STATUSES.join(', ')}`
    );
  }

  // Update draft status to rejected
  const updatedDraft = await updateDraftStatus(draftId, DRAFT_STATUS.REJECTED, performedBy);

  // Log the rejection action
  try {
    await addLog({
      entityType: 'draft',
      entityId: String(draftId),
      action: 'reject',
      performedBy: sanitizeInput(performedBy),
      details: {
        dmId: draft.dmId,
        confidence: draft.confidence,
        previousStatus: draft.status,
        newStatus: DRAFT_STATUS.REJECTED,
        reason: reason ? stripPII(sanitizeInput(reason)) : undefined,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[draft-review-service] Failed to write audit log for draft rejection');
  }

  return updatedDraft;
}

/**
 * Checks whether a draft requires human review based on confidence threshold
 *
 * @param {number|string} draftId - Draft identifier
 * @returns {Promise<{ requiresReview: boolean, confidence: number|null, threshold: number }>}
 * @throws {Error} If draft not found
 */
export async function checkReviewRequired(draftId) {
  if (draftId === undefined || draftId === null) {
    throw new Error('Draft id is required');
  }

  await simulateLatency(30, 80);

  const draft = await getDraftById(draftId);

  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  const confidence = typeof draft.confidence === 'number' ? draft.confidence : null;
  const requiresReview = confidence === null || confidence < CONFIDENCE_THRESHOLD;

  return {
    requiresReview,
    confidence,
    threshold: CONFIDENCE_THRESHOLD,
  };
}

/**
 * Retrieves the review history for a draft
 * Returns the edit history entries from the draft record
 *
 * @param {number|string} draftId - Draft identifier
 * @returns {Promise<object[]>} Array of edit history entries
 * @throws {Error} If draft not found
 */
export async function getReviewHistory(draftId) {
  if (draftId === undefined || draftId === null) {
    throw new Error('Draft id is required');
  }

  await simulateLatency(30, 80);

  const draft = await getDraftById(draftId);

  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  return Array.isArray(draft.editHistory) ? draft.editHistory : [];
}

/**
 * Validates that a draft's content meets privacy compliance requirements
 * Checks for PII and verifies consent status
 *
 * @param {number|string} draftId - Draft identifier
 * @returns {Promise<{ compliant: boolean, issues: string[] }>}
 * @throws {Error} If draft not found
 */
export async function validatePrivacyCompliance(draftId) {
  if (draftId === undefined || draftId === null) {
    throw new Error('Draft id is required');
  }

  await simulateLatency(30, 80);

  const draft = await getDraftById(draftId);

  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  const issues = [];

  // Check for PII in draft content
  const piiCheck = detectPII(draft.content || '');

  if (piiCheck.hasPII) {
    // Verify consent
    if (draft.dmId) {
      try {
        const dm = await getDMById(draft.dmId);
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

  return {
    compliant: issues.length === 0,
    issues,
  };
}