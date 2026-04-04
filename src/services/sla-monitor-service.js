import { getDMsByStatus } from '@/repositories/dm-repository';
import { checkSLABreaches, createSLABreachNotification } from '@/services/notification-service';
import { publish, publishSLABreach } from '@/services/event-publisher';
import { addLog } from '@/repositories/audit-log-repository';
import { sanitizeInput } from '@/utils/validators';
import { STATUS, SLA_MINUTES, SLA_TIMEOUT_MS, EVENT_TYPE } from '@/utils/constants';

/**
 * SLA Monitor Service
 * Monitors DM response times and triggers SLA breach notifications
 * Implements SLAMonitorService from LLD (SCRUM-6534, SCRUM-6541)
 *
 * Provides:
 * - startMonitoring(dms, options): Begins periodic SLA breach checks against provided DMs
 * - stopMonitoring(): Stops the periodic monitoring interval
 * - checkBreaches(options): Identifies DMs exceeding the SLA threshold and creates alerts
 * - checkSingleDM(dm, options): Checks a single DM for SLA breach
 * - getMonitoringStatus(): Returns current monitoring state
 * - getSLAConfig(): Returns current SLA configuration
 *
 * Integrates with NotificationService for breach alert creation
 * Integrates with EventPublisher to dispatch sla_breach events
 * All actions are logged via audit log for compliance and traceability
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
 * Default monitoring interval in milliseconds (60 seconds)
 */
const DEFAULT_MONITOR_INTERVAL_MS = 60 * 1000;

/**
 * Minimum monitoring interval in milliseconds (10 seconds)
 */
const MIN_MONITOR_INTERVAL_MS = 10 * 1000;

/**
 * Internal monitoring state
 */
const _monitorState = {
  /** @type {number|null} */
  intervalId: null,
  /** Whether monitoring is currently active */
  active: false,
  /** Timestamp of last check */
  lastCheckAt: null,
  /** Number of breaches found in last check */
  lastBreachCount: 0,
  /** Total breaches found since monitoring started */
  totalBreachCount: 0,
  /** Number of checks performed since monitoring started */
  checkCount: 0,
  /** Timestamp when monitoring was started */
  startedAt: null,
  /** Interval in milliseconds */
  intervalMs: DEFAULT_MONITOR_INTERVAL_MS,
  /** Cached DMs for monitoring (optional, can fetch fresh) */
  cachedDMs: null,
  /** Target user/agent for notifications */
  userId: null,
};

/**
 * Calculates the elapsed time in minutes since a DM was received
 *
 * @param {string} timestamp - ISO timestamp of the DM
 * @returns {number} Elapsed minutes, or -1 if timestamp is invalid
 */
function getElapsedMinutes(timestamp) {
  if (!timestamp) return -1;

  const dmTime = new Date(timestamp).getTime();
  if (isNaN(dmTime)) return -1;

  const now = Date.now();
  return (now - dmTime) / (60 * 1000);
}

/**
 * Determines whether a DM is in SLA breach
 * A DM is in breach if it has status 'New' and its timestamp exceeds the SLA threshold
 *
 * @param {object} dm - DM object
 * @returns {{ breach: boolean, elapsedMinutes: number }}
 */
function isDMInBreach(dm) {
  if (!dm || !dm.timestamp) {
    return { breach: false, elapsedMinutes: 0 };
  }

  // Only check DMs with status 'New' (not yet responded to)
  if (dm.status !== STATUS.NEW) {
    return { breach: false, elapsedMinutes: 0 };
  }

  const elapsedMinutes = getElapsedMinutes(dm.timestamp);

  if (elapsedMinutes < 0) {
    return { breach: false, elapsedMinutes: 0 };
  }

  const elapsedMs = elapsedMinutes * 60 * 1000;
  const breach = elapsedMs > SLA_TIMEOUT_MS;

  return { breach, elapsedMinutes: Math.round(elapsedMinutes) };
}

/**
 * Starts periodic SLA breach monitoring
 * Begins checking DMs at a regular interval for SLA breaches
 * Creates notifications and publishes events for any breaches found
 *
 * @param {object[]|null} [dms=null] - Initial DMs to monitor (if null, fetches from repository)
 * @param {object} [options]
 * @param {number} [options.intervalMs=DEFAULT_MONITOR_INTERVAL_MS] - Check interval in milliseconds
 * @param {string} [options.userId] - Target user/agent for notifications
 * @param {string} [options.performedBy='sla-monitor'] - User or system identifier
 * @param {boolean} [options.checkImmediately=true] - Whether to run an immediate check on start
 * @returns {Promise<{ started: boolean, intervalMs: number, initialBreaches: number }>}
 */
export async function startMonitoring(dms = null, options = {}) {
  const {
    intervalMs = DEFAULT_MONITOR_INTERVAL_MS,
    userId,
    performedBy = 'sla-monitor',
    checkImmediately = true,
  } = options;

  // Stop any existing monitoring
  if (_monitorState.active) {
    stopMonitoring();
  }

  await simulateLatency(30, 80);

  // Validate and clamp interval
  const clampedInterval = Math.max(MIN_MONITOR_INTERVAL_MS, intervalMs);

  // Update state
  _monitorState.active = true;
  _monitorState.startedAt = new Date().toISOString();
  _monitorState.intervalMs = clampedInterval;
  _monitorState.cachedDMs = dms;
  _monitorState.userId = userId || null;
  _monitorState.totalBreachCount = 0;
  _monitorState.checkCount = 0;
  _monitorState.lastBreachCount = 0;
  _monitorState.lastCheckAt = null;

  let initialBreaches = 0;

  // Run an immediate check if requested
  if (checkImmediately) {
    try {
      const result = await checkBreaches({ userId, performedBy });
      initialBreaches = result.breaches.length;
    } catch {
      console.warn('[sla-monitor-service] Initial breach check failed');
    }
  }

  // Start periodic monitoring
  _monitorState.intervalId = setInterval(async () => {
    try {
      await checkBreaches({
        userId: _monitorState.userId,
        performedBy: 'sla-monitor',
      });
    } catch {
      console.warn('[sla-monitor-service] Periodic breach check failed');
    }
  }, clampedInterval);

  // Log the monitoring start
  try {
    await addLog({
      entityType: 'dm',
      entityId: 'sla-monitor',
      action: 'update',
      performedBy: sanitizeInput(performedBy),
      details: {
        action: 'start_monitoring',
        intervalMs: clampedInterval,
        slaMinutes: SLA_MINUTES,
        initialDMCount: dms ? dms.length : 'fetch-on-check',
        initialBreaches,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[sla-monitor-service] Failed to write audit log for monitoring start');
  }

  return {
    started: true,
    intervalMs: clampedInterval,
    initialBreaches,
  };
}

/**
 * Stops the periodic SLA breach monitoring
 *
 * @returns {{ stopped: boolean, checkCount: number, totalBreachCount: number }}
 */
export function stopMonitoring() {
  if (_monitorState.intervalId !== null) {
    clearInterval(_monitorState.intervalId);
    _monitorState.intervalId = null;
  }

  const result = {
    stopped: _monitorState.active,
    checkCount: _monitorState.checkCount,
    totalBreachCount: _monitorState.totalBreachCount,
  };

  _monitorState.active = false;
  _monitorState.cachedDMs = null;

  return result;
}

/**
 * Checks for SLA breaches across all New DMs
 * Identifies DMs exceeding the SLA threshold and creates breach notifications
 * Publishes SLA breach events via EventPublisher
 *
 * @param {object} [options]
 * @param {object[]} [options.dms] - DMs to check (if not provided, fetches New DMs from repository)
 * @param {string} [options.userId] - Target user/agent for notifications
 * @param {string} [options.performedBy='sla-monitor'] - User or system identifier
 * @returns {Promise<{ breaches: object[], checked: number, alreadyNotified: number }>}
 */
export async function checkBreaches(options = {}) {
  const {
    dms: providedDMs,
    userId,
    performedBy = 'sla-monitor',
  } = options;

  await simulateLatency(30, 100);

  // Get DMs to check
  let dmsToCheck;

  if (providedDMs && Array.isArray(providedDMs)) {
    dmsToCheck = providedDMs;
  } else if (_monitorState.cachedDMs && Array.isArray(_monitorState.cachedDMs)) {
    dmsToCheck = _monitorState.cachedDMs;
  } else {
    // Fetch New DMs from the repository
    try {
      dmsToCheck = await getDMsByStatus(STATUS.NEW);
    } catch {
      console.warn('[sla-monitor-service] Failed to fetch New DMs from repository');
      dmsToCheck = [];
    }
  }

  if (!dmsToCheck || dmsToCheck.length === 0) {
    _monitorState.lastCheckAt = new Date().toISOString();
    _monitorState.lastBreachCount = 0;
    _monitorState.checkCount++;
    return { breaches: [], checked: 0, alreadyNotified: 0 };
  }

  // Use NotificationService to check breaches and create notifications
  const result = await checkSLABreaches(dmsToCheck, {
    performedBy,
    userId: userId || _monitorState.userId || null,
  });

  // Publish SLA breach events for each new breach
  for (const breach of result.breaches) {
    try {
      const dm = dmsToCheck.find((d) => d.id === breach.dmId);
      const elapsedMinutes = dm ? getElapsedMinutes(dm.timestamp) : null;

      await publishSLABreach({
        dmId: breach.dmId,
        elapsedMinutes: elapsedMinutes !== null ? Math.round(elapsedMinutes) : null,
        slaMinutes: SLA_MINUTES,
        notificationId: breach.id,
      });
    } catch {
      console.warn(`[sla-monitor-service] Failed to publish SLA breach event for DM: ${breach.dmId}`);
    }
  }

  // Also publish a general SLA warning event if breaches were found
  if (result.breaches.length > 0) {
    try {
      await publish(EVENT_TYPE.SLA_BREACHED, {
        breachCount: result.breaches.length,
        checked: result.checked,
        alreadyNotified: result.alreadyNotified,
        slaMinutes: SLA_MINUTES,
        timestamp: new Date().toISOString(),
      });
    } catch {
      console.warn('[sla-monitor-service] Failed to publish SLA breached event');
    }
  }

  // Update monitoring state
  _monitorState.lastCheckAt = new Date().toISOString();
  _monitorState.lastBreachCount = result.breaches.length;
  _monitorState.totalBreachCount += result.breaches.length;
  _monitorState.checkCount++;

  return result;
}

/**
 * Checks a single DM for SLA breach and creates a notification if needed
 * Publishes an SLA breach event if the DM is in breach
 *
 * @param {object} dm - DM object to check
 * @param {string} dm.id - DM identifier
 * @param {string} dm.timestamp - ISO timestamp
 * @param {string} dm.status - DM status
 * @param {object} [dm.sender] - Sender information
 * @param {string} [dm.sender.name] - Sender display name
 * @param {object} [options]
 * @param {string} [options.userId] - Target user/agent for notification
 * @param {string} [options.performedBy='sla-monitor'] - User or system identifier
 * @returns {Promise<{ breach: boolean, elapsedMinutes: number, notification: object|null }>}
 * @throws {Error} If DM is not provided or missing required fields
 */
export async function checkSingleDM(dm, options = {}) {
  if (!dm || typeof dm !== 'object') {
    throw new Error('DM must be a non-null object');
  }

  if (!dm.id || typeof dm.id !== 'string') {
    throw new Error('DM must have a string id');
  }

  if (!dm.timestamp) {
    throw new Error('DM must have a timestamp');
  }

  const { userId, performedBy = 'sla-monitor' } = options;

  await simulateLatency(20, 60);

  const { breach, elapsedMinutes } = isDMInBreach(dm);

  if (!breach) {
    return { breach: false, elapsedMinutes, notification: null };
  }

  // Create SLA breach notification
  let notification = null;
  try {
    notification = await createSLABreachNotification(dm.id, {
      elapsedMinutes,
      userId: userId || _monitorState.userId || null,
      senderName: dm.sender?.name || null,
      performedBy,
    });
  } catch {
    console.warn(`[sla-monitor-service] Failed to create SLA breach notification for DM: ${dm.id}`);
  }

  // Publish SLA breach event
  try {
    await publishSLABreach({
      dmId: dm.id,
      elapsedMinutes,
      slaMinutes: SLA_MINUTES,
      notificationId: notification ? notification.id : null,
    });
  } catch {
    console.warn(`[sla-monitor-service] Failed to publish SLA breach event for DM: ${dm.id}`);
  }

  return { breach: true, elapsedMinutes, notification };
}

/**
 * Identifies DMs that are approaching the SLA threshold (warning zone)
 * Returns DMs that have exceeded a percentage of the SLA time but are not yet in breach
 *
 * @param {object[]} dms - Array of DM objects to check
 * @param {object} [options]
 * @param {number} [options.warningThreshold=0.75] - Percentage of SLA time to trigger warning (0-1)
 * @returns {Promise<{ warnings: Array<{ dm: object, elapsedMinutes: number, percentElapsed: number }>, checked: number }>}
 */
export async function checkSLAWarnings(dms, options = {}) {
  const { warningThreshold = 0.75 } = options;

  if (!Array.isArray(dms)) {
    throw new Error('DMs must be an array');
  }

  if (dms.length === 0) {
    return { warnings: [], checked: 0 };
  }

  await simulateLatency(20, 60);

  const warningThresholdMs = SLA_TIMEOUT_MS * warningThreshold;
  const warnings = [];

  for (const dm of dms) {
    if (!dm || !dm.id || !dm.timestamp) continue;

    // Only check DMs with status 'New'
    if (dm.status !== STATUS.NEW) continue;

    const elapsedMinutes = getElapsedMinutes(dm.timestamp);
    if (elapsedMinutes < 0) continue;

    const elapsedMs = elapsedMinutes * 60 * 1000;

    // In warning zone but not yet in breach
    if (elapsedMs >= warningThresholdMs && elapsedMs <= SLA_TIMEOUT_MS) {
      const percentElapsed = Math.round((elapsedMs / SLA_TIMEOUT_MS) * 100);

      warnings.push({
        dm,
        elapsedMinutes: Math.round(elapsedMinutes),
        percentElapsed,
      });
    }
  }

  // Publish SLA warning event if warnings found
  if (warnings.length > 0) {
    try {
      await publish(EVENT_TYPE.SLA_WARNING, {
        warningCount: warnings.length,
        warningThreshold,
        slaMinutes: SLA_MINUTES,
        timestamp: new Date().toISOString(),
      });
    } catch {
      console.warn('[sla-monitor-service] Failed to publish SLA warning event');
    }
  }

  return { warnings, checked: dms.length };
}

/**
 * Updates the cached DMs for monitoring
 * Useful when new DMs are ingested and need to be included in monitoring
 *
 * @param {object[]} dms - Updated array of DM objects
 */
export function updateMonitoredDMs(dms) {
  if (!Array.isArray(dms)) {
    throw new Error('DMs must be an array');
  }

  _monitorState.cachedDMs = dms;
}

/**
 * Returns the current monitoring state
 *
 * @returns {{ active: boolean, startedAt: string|null, lastCheckAt: string|null, lastBreachCount: number, totalBreachCount: number, checkCount: number, intervalMs: number, slaMinutes: number }}
 */
export function getMonitoringStatus() {
  return {
    active: _monitorState.active,
    startedAt: _monitorState.startedAt,
    lastCheckAt: _monitorState.lastCheckAt,
    lastBreachCount: _monitorState.lastBreachCount,
    totalBreachCount: _monitorState.totalBreachCount,
    checkCount: _monitorState.checkCount,
    intervalMs: _monitorState.intervalMs,
    slaMinutes: SLA_MINUTES,
  };
}

/**
 * Returns the current SLA configuration
 *
 * @returns {{ slaMinutes: number, slaTimeoutMs: number, monitorIntervalMs: number }}
 */
export function getSLAConfig() {
  return {
    slaMinutes: SLA_MINUTES,
    slaTimeoutMs: SLA_TIMEOUT_MS,
    monitorIntervalMs: _monitorState.intervalMs,
  };
}

/**
 * Resets the monitoring state
 * Useful for testing or when the application needs to be re-initialized
 */
export function resetMonitoring() {
  stopMonitoring();

  _monitorState.lastCheckAt = null;
  _monitorState.lastBreachCount = 0;
  _monitorState.totalBreachCount = 0;
  _monitorState.checkCount = 0;
  _monitorState.startedAt = null;
  _monitorState.intervalMs = DEFAULT_MONITOR_INTERVAL_MS;
  _monitorState.cachedDMs = null;
  _monitorState.userId = null;
}