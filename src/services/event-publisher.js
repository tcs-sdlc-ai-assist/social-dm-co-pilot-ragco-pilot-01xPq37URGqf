import { sanitizeInput } from '@/utils/validators';
import { EVENT_TYPE } from '@/utils/constants';

/**
 * Event Publisher
 * Client-side event bus for cross-cluster integration
 * Implements EventPublisher from LLD (SCRUM-6528, SCRUM-6533, SCRUM-6534)
 *
 * Provides:
 * - publish(eventType, payload): Dispatches events to all registered listeners
 * - subscribe(eventType, handler): Registers a listener for an event type
 * - unsubscribe(eventType, handler): Removes a listener for an event type
 * - subscribeOnce(eventType, handler): Registers a one-time listener
 * - clearAll(): Removes all listeners
 * - getSubscriberCount(eventType): Returns the number of subscribers for an event type
 *
 * Supports event types: dm_sent, sla_breach, lead_created, lead_scored,
 * and all EVENT_TYPE constants from the application
 */

/**
 * Custom event types for cross-cluster communication
 * Extends the application EVENT_TYPE constants with additional publisher-specific types
 */
const PUBLISHER_EVENT_TYPE = Object.freeze({
  DM_SENT: 'dm_sent',
  DM_ESCALATED: 'dm_escalated',
  SLA_BREACH: 'sla_breach',
  LEAD_CREATED: 'lead_created',
  LEAD_SCORED: 'lead_scored',
  DRAFT_APPROVED: 'draft_approved',
  DRAFT_REJECTED: 'draft_rejected',
});

/**
 * All valid event types (union of application EVENT_TYPE and publisher-specific types)
 * @type {Set<string>}
 */
const VALID_EVENT_TYPES = new Set([
  ...Object.values(EVENT_TYPE),
  ...Object.values(PUBLISHER_EVENT_TYPE),
]);

/**
 * Internal registry of event listeners
 * Keyed by event type, each value is a Set of handler functions
 * @type {Map<string, Set<Function>>}
 */
const _listeners = new Map();

/**
 * Internal registry of one-time event listeners
 * Keyed by the original handler, value is the wrapped handler
 * Used to properly unsubscribe one-time listeners
 * @type {Map<Function, Function>}
 */
const _onceWrappers = new Map();

/**
 * Event history for debugging and audit purposes
 * Stores the last N published events
 * @type {Array<{ eventType: string, payload: object, timestamp: string }>}
 */
const _eventHistory = [];

/**
 * Maximum number of events to retain in history
 */
const MAX_HISTORY_SIZE = 100;

/**
 * Validates that an event type is a non-empty string
 *
 * @param {string} eventType - Event type to validate
 * @throws {Error} If eventType is not a valid string
 */
function validateEventType(eventType) {
  if (!eventType || typeof eventType !== 'string') {
    throw new Error('Event type is required and must be a non-empty string');
  }
}

/**
 * Validates that a handler is a function
 *
 * @param {Function} handler - Handler to validate
 * @throws {Error} If handler is not a function
 */
function validateHandler(handler) {
  if (!handler || typeof handler !== 'function') {
    throw new Error('Handler is required and must be a function');
  }
}

/**
 * Returns the listener set for a given event type, creating it if necessary
 *
 * @param {string} eventType - Event type
 * @returns {Set<Function>} Set of handler functions
 */
function getListenerSet(eventType) {
  if (!_listeners.has(eventType)) {
    _listeners.set(eventType, new Set());
  }
  return _listeners.get(eventType);
}

/**
 * Records an event in the history buffer
 *
 * @param {string} eventType - Event type
 * @param {*} payload - Event payload
 */
function recordEvent(eventType, payload) {
  _eventHistory.push({
    eventType,
    payload,
    timestamp: new Date().toISOString(),
  });

  // Trim history if it exceeds max size
  if (_eventHistory.length > MAX_HISTORY_SIZE) {
    _eventHistory.splice(0, _eventHistory.length - MAX_HISTORY_SIZE);
  }
}

/**
 * Publishes an event to all registered listeners for the given event type
 * Listeners are invoked asynchronously to prevent blocking the publisher
 * Errors in individual listeners are caught and logged without affecting other listeners
 *
 * @param {string} eventType - Event type to publish (e.g., 'dm_sent', 'sla_breach')
 * @param {object} [payload={}] - Event payload data
 * @returns {Promise<{ eventType: string, listenerCount: number, errors: string[] }>} Publish result
 * @throws {Error} If eventType is not a valid string
 */
export async function publish(eventType, payload = {}) {
  validateEventType(eventType);

  const sanitizedEventType = sanitizeInput(eventType);

  // Record the event in history
  recordEvent(sanitizedEventType, payload);

  const listeners = _listeners.get(sanitizedEventType);

  if (!listeners || listeners.size === 0) {
    return {
      eventType: sanitizedEventType,
      listenerCount: 0,
      errors: [],
    };
  }

  const errors = [];
  const listenerCount = listeners.size;

  // Create a snapshot of listeners to avoid mutation during iteration
  const listenerSnapshot = Array.from(listeners);

  const promises = listenerSnapshot.map(async (handler) => {
    try {
      await handler({
        eventType: sanitizedEventType,
        payload,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const errorMessage = err && err.message ? err.message : 'Unknown listener error';
      console.warn(
        `[event-publisher] Error in listener for event "${sanitizedEventType}": ${errorMessage}`
      );
      errors.push(errorMessage);
    }
  });

  await Promise.allSettled(promises);

  return {
    eventType: sanitizedEventType,
    listenerCount,
    errors,
  };
}

/**
 * Registers a listener for a specific event type
 * The handler will be called each time the event is published
 *
 * @param {string} eventType - Event type to subscribe to
 * @param {Function} handler - Callback function invoked with event data ({ eventType, payload, timestamp })
 * @returns {Function} Unsubscribe function for convenience
 * @throws {Error} If eventType or handler is invalid
 */
export function subscribe(eventType, handler) {
  validateEventType(eventType);
  validateHandler(handler);

  const sanitizedEventType = sanitizeInput(eventType);
  const listenerSet = getListenerSet(sanitizedEventType);

  listenerSet.add(handler);

  // Return an unsubscribe function for convenience
  return () => {
    unsubscribe(sanitizedEventType, handler);
  };
}

/**
 * Removes a listener for a specific event type
 * If the handler was registered via subscribeOnce, the wrapper is also cleaned up
 *
 * @param {string} eventType - Event type to unsubscribe from
 * @param {Function} handler - Handler function to remove
 * @returns {boolean} True if the handler was found and removed, false otherwise
 * @throws {Error} If eventType or handler is invalid
 */
export function unsubscribe(eventType, handler) {
  validateEventType(eventType);
  validateHandler(handler);

  const sanitizedEventType = sanitizeInput(eventType);
  const listenerSet = _listeners.get(sanitizedEventType);

  if (!listenerSet) {
    return false;
  }

  // Check if this handler has a once-wrapper registered
  const onceWrapper = _onceWrappers.get(handler);
  if (onceWrapper) {
    listenerSet.delete(onceWrapper);
    _onceWrappers.delete(handler);
  }

  const removed = listenerSet.delete(handler);

  // Clean up empty listener sets
  if (listenerSet.size === 0) {
    _listeners.delete(sanitizedEventType);
  }

  return removed || !!onceWrapper;
}

/**
 * Registers a one-time listener for a specific event type
 * The handler will be called only once and then automatically unsubscribed
 *
 * @param {string} eventType - Event type to subscribe to
 * @param {Function} handler - Callback function invoked once with event data
 * @returns {Function} Unsubscribe function for convenience (can cancel before event fires)
 * @throws {Error} If eventType or handler is invalid
 */
export function subscribeOnce(eventType, handler) {
  validateEventType(eventType);
  validateHandler(handler);

  const sanitizedEventType = sanitizeInput(eventType);

  // Create a wrapper that unsubscribes after first invocation
  const onceWrapper = async (event) => {
    // Remove the wrapper from the listener set
    const listenerSet = _listeners.get(sanitizedEventType);
    if (listenerSet) {
      listenerSet.delete(onceWrapper);
      if (listenerSet.size === 0) {
        _listeners.delete(sanitizedEventType);
      }
    }

    // Clean up the once-wrapper mapping
    _onceWrappers.delete(handler);

    // Invoke the original handler
    await handler(event);
  };

  // Store the mapping so unsubscribe can find the wrapper
  _onceWrappers.set(handler, onceWrapper);

  const listenerSet = getListenerSet(sanitizedEventType);
  listenerSet.add(onceWrapper);

  // Return an unsubscribe function
  return () => {
    unsubscribe(sanitizedEventType, handler);
    const ls = _listeners.get(sanitizedEventType);
    if (ls) {
      ls.delete(onceWrapper);
      if (ls.size === 0) {
        _listeners.delete(sanitizedEventType);
      }
    }
    _onceWrappers.delete(handler);
  };
}

/**
 * Removes all listeners for all event types
 * Useful for testing or application teardown
 */
export function clearAll() {
  _listeners.clear();
  _onceWrappers.clear();
}

/**
 * Removes all listeners for a specific event type
 *
 * @param {string} eventType - Event type to clear listeners for
 * @throws {Error} If eventType is not a valid string
 */
export function clearListeners(eventType) {
  validateEventType(eventType);

  const sanitizedEventType = sanitizeInput(eventType);

  // Clean up any once-wrappers associated with this event type
  const listenerSet = _listeners.get(sanitizedEventType);
  if (listenerSet) {
    for (const [originalHandler, wrapper] of _onceWrappers) {
      if (listenerSet.has(wrapper)) {
        _onceWrappers.delete(originalHandler);
      }
    }
  }

  _listeners.delete(sanitizedEventType);
}

/**
 * Returns the number of subscribers for a given event type
 *
 * @param {string} eventType - Event type to check
 * @returns {number} Number of registered listeners
 */
export function getSubscriberCount(eventType) {
  if (!eventType || typeof eventType !== 'string') {
    return 0;
  }

  const sanitizedEventType = sanitizeInput(eventType);
  const listenerSet = _listeners.get(sanitizedEventType);

  return listenerSet ? listenerSet.size : 0;
}

/**
 * Returns all event types that currently have registered listeners
 *
 * @returns {string[]} Array of event type strings with active listeners
 */
export function getActiveEventTypes() {
  return Array.from(_listeners.keys()).filter(
    (key) => _listeners.get(key).size > 0
  );
}

/**
 * Returns the event history buffer
 * Useful for debugging and audit purposes
 *
 * @param {object} [options]
 * @param {string} [options.eventType] - Filter by event type
 * @param {number} [options.limit=50] - Maximum number of events to return
 * @returns {Array<{ eventType: string, payload: object, timestamp: string }>}
 */
export function getEventHistory(options = {}) {
  const { eventType, limit = 50 } = options;

  let history = [..._eventHistory];

  if (eventType) {
    history = history.filter((e) => e.eventType === eventType);
  }

  // Return most recent events first
  return history.slice(-limit).reverse();
}

/**
 * Clears the event history buffer
 */
export function clearEventHistory() {
  _eventHistory.length = 0;
}

/**
 * Convenience method to publish a DM sent event
 *
 * @param {object} payload - Event payload
 * @param {string} payload.dmId - DM identifier
 * @param {string} [payload.draftId] - Draft identifier
 * @param {string} [payload.platform] - Platform identifier
 * @param {string} [payload.senderHandle] - Sender handle
 * @returns {Promise<object>} Publish result
 */
export async function publishDMSent(payload) {
  return publish(PUBLISHER_EVENT_TYPE.DM_SENT, payload);
}

/**
 * Convenience method to publish a DM escalated event
 *
 * @param {object} payload - Event payload
 * @param {string} payload.dmId - DM identifier
 * @param {string} [payload.reason] - Escalation reason
 * @returns {Promise<object>} Publish result
 */
export async function publishDMEscalated(payload) {
  return publish(PUBLISHER_EVENT_TYPE.DM_ESCALATED, payload);
}

/**
 * Convenience method to publish an SLA breach event
 *
 * @param {object} payload - Event payload
 * @param {string} payload.dmId - DM identifier
 * @param {number} [payload.elapsedMinutes] - Minutes elapsed since DM received
 * @param {number} [payload.slaMinutes] - SLA target in minutes
 * @returns {Promise<object>} Publish result
 */
export async function publishSLABreach(payload) {
  return publish(PUBLISHER_EVENT_TYPE.SLA_BREACH, payload);
}

/**
 * Convenience method to publish a lead created event
 *
 * @param {object} payload - Event payload
 * @param {string} payload.leadId - Lead identifier
 * @param {string} [payload.dmId] - Associated DM identifier
 * @param {string} [payload.source] - Lead source
 * @returns {Promise<object>} Publish result
 */
export async function publishLeadCreated(payload) {
  return publish(PUBLISHER_EVENT_TYPE.LEAD_CREATED, payload);
}

/**
 * Convenience method to publish a lead scored event
 *
 * @param {object} payload - Event payload
 * @param {string} payload.leadId - Lead identifier
 * @param {number} [payload.score] - Lead score
 * @param {string} [payload.label] - Lead label (Hot, Warm, Cold)
 * @returns {Promise<object>} Publish result
 */
export async function publishLeadScored(payload) {
  return publish(PUBLISHER_EVENT_TYPE.LEAD_SCORED, payload);
}

/**
 * Convenience method to publish a draft approved event
 *
 * @param {object} payload - Event payload
 * @param {string} payload.draftId - Draft identifier
 * @param {string} [payload.dmId] - Associated DM identifier
 * @param {string} [payload.approvedBy] - User who approved
 * @returns {Promise<object>} Publish result
 */
export async function publishDraftApproved(payload) {
  return publish(PUBLISHER_EVENT_TYPE.DRAFT_APPROVED, payload);
}

/**
 * Convenience method to publish a draft rejected event
 *
 * @param {object} payload - Event payload
 * @param {string} payload.draftId - Draft identifier
 * @param {string} [payload.dmId] - Associated DM identifier
 * @param {string} [payload.rejectedBy] - User who rejected
 * @param {string} [payload.reason] - Rejection reason
 * @returns {Promise<object>} Publish result
 */
export async function publishDraftRejected(payload) {
  return publish(PUBLISHER_EVENT_TYPE.DRAFT_REJECTED, payload);
}

/**
 * Exported event type constants for consumers
 */
export { PUBLISHER_EVENT_TYPE };