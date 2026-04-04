import { getLeadById, updateLead } from '@/repositories/lead-repository';
import { addLog } from '@/repositories/audit-log-repository';
import { sanitizeInput } from '@/utils/validators';
import { stripPII } from '@/utils/pii-filter';

/**
 * Salesforce Sync Service
 * Simulated Salesforce CRM integration for lead synchronization
 * Implements SalesforceSyncService from LLD (SCRUM-6538)
 *
 * Provides:
 * - syncLeadToSalesforce(leadId, options): Validate lead, simulate API call, return success/failure with SF record ID
 * - syncLeadsInBatch(leadIds, options): Batch sync multiple leads
 * - getSyncStatus(leadId): Check current sync status for a lead
 * - retrySyncFailed(options): Retry all previously failed syncs
 *
 * Simulates Salesforce API with async delay and configurable failure rate
 * Implements circuit breaker pattern: disables sync after consecutive failures, auto-resumes after cooldown
 * All sync actions are logged via audit log for compliance and traceability
 *
 * Simulates async latency to mimic real Salesforce API behavior
 */

/**
 * Simulates network/API latency for realistic async behavior
 * @param {number} [minMs=200] - Minimum delay in milliseconds
 * @param {number} [maxMs=800] - Maximum delay in milliseconds
 * @returns {Promise<void>}
 */
function simulateLatency(minMs = 200, maxMs = 800) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Sync status constants
 */
const SYNC_STATUS = Object.freeze({
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
});

/**
 * Circuit breaker state
 * Tracks consecutive failures and cooldown period
 */
const _circuitBreaker = {
  failureCount: 0,
  maxFailures: 5,
  isOpen: false,
  openedAt: null,
  cooldownMs: 5 * 60 * 1000, // 5 minutes
};

/**
 * Simulated failure rate for Salesforce API calls (0-1)
 * Set to a low value to simulate occasional failures
 */
const SIMULATED_FAILURE_RATE = 0.05;

/**
 * Maximum retry attempts for a single sync operation
 */
const MAX_RETRIES = 3;

/**
 * Base delay for exponential backoff in milliseconds
 */
const RETRY_BASE_DELAY_MS = 500;

/**
 * Generates a simulated Salesforce record ID
 *
 * @returns {string} Simulated Salesforce ID (e.g., "SF-00A1B2C3D4E5")
 */
function generateSalesforceId() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let id = 'SF-';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Checks if the circuit breaker is open (sync disabled)
 * Auto-resets after cooldown period
 *
 * @returns {boolean} True if circuit breaker is open (sync disabled)
 */
function isCircuitBreakerOpen() {
  if (!_circuitBreaker.isOpen) return false;

  // Check if cooldown has elapsed
  if (_circuitBreaker.openedAt) {
    const elapsed = Date.now() - _circuitBreaker.openedAt;
    if (elapsed >= _circuitBreaker.cooldownMs) {
      // Reset circuit breaker (half-open state → allow retry)
      _circuitBreaker.isOpen = false;
      _circuitBreaker.failureCount = 0;
      _circuitBreaker.openedAt = null;
      return false;
    }
  }

  return true;
}

/**
 * Records a failure in the circuit breaker
 * Opens the circuit if max failures exceeded
 */
function recordCircuitBreakerFailure() {
  _circuitBreaker.failureCount++;

  if (_circuitBreaker.failureCount >= _circuitBreaker.maxFailures) {
    _circuitBreaker.isOpen = true;
    _circuitBreaker.openedAt = Date.now();
    console.warn(
      `[salesforce-sync-service] Circuit breaker opened after ${_circuitBreaker.failureCount} consecutive failures. Will retry after ${_circuitBreaker.cooldownMs / 1000}s cooldown.`
    );
  }
}

/**
 * Records a success in the circuit breaker, resetting the failure count
 */
function recordCircuitBreakerSuccess() {
  _circuitBreaker.failureCount = 0;
  _circuitBreaker.isOpen = false;
  _circuitBreaker.openedAt = null;
}

/**
 * Validates that a lead has the minimum required data for Salesforce sync
 *
 * @param {object} lead - Lead object to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLeadForSync(lead) {
  const errors = [];

  if (!lead || typeof lead !== 'object') {
    return { valid: false, errors: ['Lead must be a non-null object'] };
  }

  if (!lead.id) {
    errors.push('Lead must have an id');
  }

  if (!lead.name || typeof lead.name !== 'string' || lead.name.trim().length === 0) {
    errors.push('Lead must have a non-empty name');
  }

  if (!lead.platform) {
    errors.push('Lead must have a platform');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Simulates a Salesforce API call to create a lead record
 * Returns success with a generated Salesforce ID or throws on simulated failure
 *
 * @param {object} lead - Lead data to sync
 * @returns {Promise<{ salesforceId: string }>} Simulated Salesforce response
 * @throws {Error} On simulated API failure
 */
async function simulateSalesforceAPICall(lead) {
  // Simulate API latency
  await simulateLatency(300, 1200);

  // Simulate occasional failures
  if (Math.random() < SIMULATED_FAILURE_RATE) {
    throw new Error('Salesforce API unavailable. Retry later.');
  }

  // Generate a simulated Salesforce record ID
  const salesforceId = generateSalesforceId();

  return { salesforceId };
}

/**
 * Performs a single sync attempt with retry logic and exponential backoff
 *
 * @param {object} lead - Lead data to sync
 * @param {number} [maxRetries=MAX_RETRIES] - Maximum retry attempts
 * @returns {Promise<{ salesforceId: string }>} Salesforce response
 * @throws {Error} If all retries are exhausted
 */
async function syncWithRetry(lead, maxRetries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await simulateSalesforceAPICall(lead);
      return result;
    } catch (err) {
      lastError = err;

      if (attempt < maxRetries) {
        // Exponential backoff
        const backoffDelay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }
  }

  throw lastError;
}

/**
 * Syncs a lead to Salesforce CRM
 * Validates lead data, checks circuit breaker, simulates API call with retries,
 * updates lead record with Salesforce ID and sync status, and logs the action
 *
 * @param {string} leadId - Lead identifier
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @returns {Promise<{ leadId: string, salesforceId: string, syncStatus: string }>}
 * @throws {Error} If lead not found, validation fails, or circuit breaker is open
 */
export async function syncLeadToSalesforce(leadId, options = {}) {
  if (!leadId || typeof leadId !== 'string') {
    throw new Error('Lead id is required and must be a string');
  }

  const { performedBy = 'system' } = options;

  // Check circuit breaker
  if (isCircuitBreakerOpen()) {
    throw new Error(
      'Salesforce sync is temporarily disabled due to repeated failures. Will auto-resume after cooldown period.'
    );
  }

  await simulateLatency(50, 150);

  // Fetch the lead
  const lead = await getLeadById(leadId);

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  // Validate lead data for sync
  const validation = validateLeadForSync(lead);

  if (!validation.valid) {
    throw new Error(`Lead validation failed for Salesforce sync: ${validation.errors.join(', ')}`);
  }

  // Attempt sync with retry
  try {
    const { salesforceId } = await syncWithRetry(lead);

    // Update lead with Salesforce ID and sync status
    const updatedLead = await updateLead({
      id: leadId,
      salesforceId,
      syncStatus: SYNC_STATUS.SUCCESS,
    });

    // Record success in circuit breaker
    recordCircuitBreakerSuccess();

    // Log the successful sync action
    try {
      await addLog({
        entityType: 'salesforce_sync',
        entityId: leadId,
        action: 'sync',
        performedBy: sanitizeInput(performedBy),
        details: {
          salesforceId,
          syncStatus: SYNC_STATUS.SUCCESS,
          leadName: stripPII(lead.name || ''),
          platform: lead.platform,
        },
        timestamp: new Date().toISOString(),
      });
    } catch {
      console.warn('[salesforce-sync-service] Failed to write audit log for successful sync');
    }

    return {
      leadId,
      salesforceId,
      syncStatus: SYNC_STATUS.SUCCESS,
    };
  } catch (err) {
    // Record failure in circuit breaker
    recordCircuitBreakerFailure();

    // Update lead with failed sync status
    try {
      await updateLead({
        id: leadId,
        syncStatus: SYNC_STATUS.FAILED,
      });
    } catch {
      console.warn('[salesforce-sync-service] Failed to update lead sync status to failed');
    }

    // Log the failed sync action
    try {
      await addLog({
        entityType: 'salesforce_sync',
        entityId: leadId,
        action: 'sync_failed',
        performedBy: sanitizeInput(performedBy),
        details: {
          syncStatus: SYNC_STATUS.FAILED,
          error: err.message,
          circuitBreakerFailureCount: _circuitBreaker.failureCount,
          circuitBreakerOpen: _circuitBreaker.isOpen,
        },
        timestamp: new Date().toISOString(),
      });
    } catch {
      console.warn('[salesforce-sync-service] Failed to write audit log for failed sync');
    }

    throw new Error(`Salesforce API unavailable. Retry later. (${err.message})`);
  }
}

/**
 * Syncs multiple leads to Salesforce in batch
 *
 * @param {string[]} leadIds - Array of lead identifiers
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @returns {Promise<{ synced: Array<{ leadId: string, salesforceId: string }>, errors: Array<{ leadId: string, error: string }> }>}
 */
export async function syncLeadsInBatch(leadIds, options = {}) {
  if (!Array.isArray(leadIds)) {
    throw new Error('Lead IDs must be an array');
  }

  if (leadIds.length === 0) {
    return { synced: [], errors: [] };
  }

  const { performedBy = 'system' } = options;

  const synced = [];
  const errors = [];

  for (const leadId of leadIds) {
    try {
      if (!leadId || typeof leadId !== 'string') {
        errors.push({ leadId: leadId || 'unknown', error: 'Invalid lead ID' });
        continue;
      }

      const result = await syncLeadToSalesforce(leadId, { performedBy });
      synced.push({
        leadId: result.leadId,
        salesforceId: result.salesforceId,
      });
    } catch (err) {
      errors.push({ leadId, error: err.message });

      // If circuit breaker is open, skip remaining leads
      if (isCircuitBreakerOpen()) {
        const remaining = leadIds.slice(leadIds.indexOf(leadId) + 1);
        for (const remainingId of remaining) {
          errors.push({
            leadId: remainingId,
            error: 'Salesforce sync disabled due to circuit breaker',
          });
        }
        break;
      }
    }
  }

  // Log batch sync
  try {
    await addLog({
      entityType: 'salesforce_sync',
      entityId: 'batch-sync',
      action: 'sync',
      performedBy: sanitizeInput(performedBy),
      details: {
        totalLeads: leadIds.length,
        synced: synced.length,
        errors: errors.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[salesforce-sync-service] Failed to write audit log for batch sync');
  }

  return { synced, errors };
}

/**
 * Retrieves the current Salesforce sync status for a lead
 *
 * @param {string} leadId - Lead identifier
 * @returns {Promise<{ leadId: string, salesforceId: string|null, syncStatus: string }>}
 * @throws {Error} If lead not found
 */
export async function getSyncStatus(leadId) {
  if (!leadId || typeof leadId !== 'string') {
    throw new Error('Lead id is required and must be a string');
  }

  await simulateLatency(30, 80);

  const lead = await getLeadById(leadId);

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  return {
    leadId,
    salesforceId: lead.salesforceId || null,
    syncStatus: lead.syncStatus || SYNC_STATUS.PENDING,
  };
}

/**
 * Retries sync for all leads with a failed sync status
 *
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @returns {Promise<{ retried: Array<{ leadId: string, salesforceId: string }>, errors: Array<{ leadId: string, error: string }> }>}
 */
export async function retrySyncFailed(options = {}) {
  const { performedBy = 'system' } = options;

  await simulateLatency(50, 150);

  // Import getAllLeads to find failed syncs
  const { getAllLeads } = await import('@/repositories/lead-repository');

  const { leads } = await getAllLeads({ pageSize: 100 });

  // Filter leads with failed sync status
  const failedLeads = leads.filter(
    (lead) => lead.syncStatus === SYNC_STATUS.FAILED
  );

  if (failedLeads.length === 0) {
    return { retried: [], errors: [] };
  }

  const failedLeadIds = failedLeads.map((lead) => lead.id);

  return syncLeadsInBatch(failedLeadIds, { performedBy });
}

/**
 * Returns the current circuit breaker state
 * Useful for monitoring and health checks
 *
 * @returns {{ isOpen: boolean, failureCount: number, maxFailures: number, cooldownMs: number, openedAt: number|null }}
 */
export function getCircuitBreakerState() {
  // Check if cooldown has elapsed (may auto-reset)
  isCircuitBreakerOpen();

  return {
    isOpen: _circuitBreaker.isOpen,
    failureCount: _circuitBreaker.failureCount,
    maxFailures: _circuitBreaker.maxFailures,
    cooldownMs: _circuitBreaker.cooldownMs,
    openedAt: _circuitBreaker.openedAt,
  };
}

/**
 * Resets the circuit breaker state
 * Useful for testing or manual recovery
 */
export function resetCircuitBreaker() {
  _circuitBreaker.failureCount = 0;
  _circuitBreaker.isOpen = false;
  _circuitBreaker.openedAt = null;
}