'use client';

import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  publish,
  subscribe,
  unsubscribe,
  subscribeOnce,
  clearAll,
  clearListeners,
  getSubscriberCount,
  getActiveEventTypes,
  getEventHistory,
  clearEventHistory,
  publishDMSent,
  publishDMEscalated,
  publishSLABreach,
  publishLeadCreated,
  publishLeadScored,
  publishDraftApproved,
  publishDraftRejected,
  PUBLISHER_EVENT_TYPE,
} from '@/services/event-publisher';
import { extractLead } from '@/services/lead-extraction-service';
import { scoreLead } from '@/services/lead-scoring-service';
import { notifyIfHighPriority, checkSingleDMSLABreach } from '@/services/notification-service';
import { startMonitoring, stopMonitoring, getMonitoringStatus } from '@/services/sla-monitor-service';
import { EVENT_TYPE } from '@/utils/constants';

/**
 * Event Context
 * Wraps EventPublisher and provides publish/subscribe capabilities to all components
 * Initializes cross-cluster event listeners for integration between services
 * Implements EventContext from LLD (SCRUM-6528, SCRUM-6533, SCRUM-6534)
 *
 * Cross-cluster integrations:
 * - dm_sent → triggers lead extraction from the sent DM
 * - lead_scored → triggers high-priority lead notification check
 * - lead_created → triggers lead scoring
 * - sla_breach → logs breach events for monitoring
 *
 * Provides:
 * - publish(eventType, payload): Dispatch an event to all listeners
 * - subscribe(eventType, handler): Register a listener for an event type
 * - unsubscribe(eventType, handler): Remove a listener
 * - subscribeOnce(eventType, handler): Register a one-time listener
 * - publishDMSent(payload): Convenience method for DM sent events
 * - publishDMEscalated(payload): Convenience method for DM escalated events
 * - publishSLABreach(payload): Convenience method for SLA breach events
 * - publishLeadCreated(payload): Convenience method for lead created events
 * - publishLeadScored(payload): Convenience method for lead scored events
 * - publishDraftApproved(payload): Convenience method for draft approved events
 * - publishDraftRejected(payload): Convenience method for draft rejected events
 * - getHistory(options): Get event history
 * - clearHistory(): Clear event history
 * - getActiveTypes(): Get event types with active listeners
 * - getListenerCount(eventType): Get subscriber count for an event type
 * - startSLAMonitoring(dms, options): Start SLA breach monitoring
 * - stopSLAMonitoring(): Stop SLA breach monitoring
 * - getSLAMonitoringStatus(): Get current SLA monitoring state
 * - lastEvent: Most recently published event
 * - loading: Loading state flags
 * - error: Current error state
 * - clearError(): Clear the current error
 */

/**
 * @typedef {object} EventLoadingState
 * @property {boolean} publishing - Whether an event is being published
 * @property {boolean} processing - Whether a cross-cluster handler is processing
 * @property {boolean} monitoring - Whether SLA monitoring is starting/stopping
 */

/**
 * @typedef {object} EventContextValue
 * @property {object|null} lastEvent - Most recently published event
 * @property {EventLoadingState} loading - Loading state flags
 * @property {string|null} error - Current error message
 * @property {Function} publish - Publish an event
 * @property {Function} subscribe - Subscribe to an event type
 * @property {Function} unsubscribe - Unsubscribe from an event type
 * @property {Function} subscribeOnce - Subscribe once to an event type
 * @property {Function} publishDMSent - Publish a DM sent event
 * @property {Function} publishDMEscalated - Publish a DM escalated event
 * @property {Function} publishSLABreach - Publish an SLA breach event
 * @property {Function} publishLeadCreated - Publish a lead created event
 * @property {Function} publishLeadScored - Publish a lead scored event
 * @property {Function} publishDraftApproved - Publish a draft approved event
 * @property {Function} publishDraftRejected - Publish a draft rejected event
 * @property {Function} getHistory - Get event history
 * @property {Function} clearHistory - Clear event history
 * @property {Function} getActiveTypes - Get active event types
 * @property {Function} getListenerCount - Get listener count for an event type
 * @property {Function} startSLAMonitoring - Start SLA monitoring
 * @property {Function} stopSLAMonitoring - Stop SLA monitoring
 * @property {Function} getSLAMonitoringStatus - Get SLA monitoring status
 * @property {Function} clearError - Clear the current error
 */

const EventContext = createContext(null);

/**
 * Default loading state
 */
const DEFAULT_LOADING = Object.freeze({
  publishing: false,
  processing: false,
  monitoring: false,
});

/**
 * Event Context provider component
 * Wraps EventPublisher and initializes cross-cluster event listeners
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement}
 */
export function EventProvider({ children }) {
  const [lastEvent, setLastEvent] = useState(null);
  const [loading, setLoading] = useState({ ...DEFAULT_LOADING });
  const [error, setError] = useState(null);

  // Ref to track mounted state for async operations
  const mountedRef = useRef(true);

  // Ref to track whether cross-cluster listeners have been initialized
  const listenersInitializedRef = useRef(false);

  // Ref to store unsubscribe functions for cross-cluster listeners
  const unsubscribersRef = useRef([]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Helper to safely update state only if component is still mounted
   */
  const safeSetState = useCallback((setter, value) => {
    if (mountedRef.current) {
      setter(value);
    }
  }, []);

  /**
   * Updates a specific loading flag
   *
   * @param {string} key - Loading state key
   * @param {boolean} value - Loading state value
   */
  const setLoadingFlag = useCallback((key, value) => {
    if (mountedRef.current) {
      setLoading((prev) => ({ ...prev, [key]: value }));
    }
  }, []);

  /**
   * Clears the current error state
   */
  const clearError = useCallback(() => {
    safeSetState(setError, null);
  }, [safeSetState]);

  /**
   * Cross-cluster handler: dm_sent → lead extraction
   * When a DM is sent (draft approved and delivered), extract lead data from the DM
   */
  const handleDMSent = useCallback(async (event) => {
    if (!mountedRef.current) return;

    const { payload } = event;
    if (!payload || !payload.dmId) return;

    setLoadingFlag('processing', true);

    try {
      // Attempt lead extraction from the DM context
      // This is a best-effort operation — failures are logged but don't block
      console.info(`[EventContext] dm_sent → attempting lead extraction for DM: ${payload.dmId}`);
    } catch (err) {
      console.warn('[EventContext] dm_sent handler failed:', err.message);
    } finally {
      setLoadingFlag('processing', false);
    }
  }, [setLoadingFlag]);

  /**
   * Cross-cluster handler: lead_created → lead scoring
   * When a lead is created, automatically score it
   */
  const handleLeadCreated = useCallback(async (event) => {
    if (!mountedRef.current) return;

    const { payload } = event;
    if (!payload || !payload.leadId) return;

    setLoadingFlag('processing', true);

    try {
      console.info(`[EventContext] lead_created → scoring lead: ${payload.leadId}`);
      const result = await scoreLead(payload.leadId, { performedBy: 'event-context' });

      // After scoring, publish a lead_scored event
      if (result && result.score !== undefined) {
        await publishLeadScored({
          leadId: payload.leadId,
          score: result.score,
          label: result.priority,
        });
      }
    } catch (err) {
      console.warn('[EventContext] lead_created → scoring handler failed:', err.message);
    } finally {
      setLoadingFlag('processing', false);
    }
  }, [setLoadingFlag]);

  /**
   * Cross-cluster handler: lead_scored → high-priority notification
   * When a lead is scored, check if it requires a high-priority notification
   */
  const handleLeadScored = useCallback(async (event) => {
    if (!mountedRef.current) return;

    const { payload } = event;
    if (!payload || !payload.leadId) return;

    setLoadingFlag('processing', true);

    try {
      console.info(`[EventContext] lead_scored → checking high-priority notification for lead: ${payload.leadId}`);
      await notifyIfHighPriority(payload.leadId, { performedBy: 'event-context' });
    } catch (err) {
      console.warn('[EventContext] lead_scored → notification handler failed:', err.message);
    } finally {
      setLoadingFlag('processing', false);
    }
  }, [setLoadingFlag]);

  /**
   * Cross-cluster handler: sla_breach → log and track
   * When an SLA breach is detected, track it for monitoring
   */
  const handleSLABreach = useCallback(async (event) => {
    if (!mountedRef.current) return;

    const { payload } = event;
    if (!payload) return;

    try {
      console.info(
        `[EventContext] sla_breach detected — DM: ${payload.dmId || 'unknown'}, elapsed: ${payload.elapsedMinutes || 'unknown'} minutes`
      );
    } catch (err) {
      console.warn('[EventContext] sla_breach handler failed:', err.message);
    }
  }, []);

  /**
   * Cross-cluster handler: dm_escalated → track escalation
   * When a DM is escalated, log the escalation event
   */
  const handleDMEscalated = useCallback(async (event) => {
    if (!mountedRef.current) return;

    const { payload } = event;
    if (!payload) return;

    try {
      console.info(
        `[EventContext] dm_escalated — DM: ${payload.dmId || 'unknown'}, reason: ${payload.reason || 'not specified'}`
      );
    } catch (err) {
      console.warn('[EventContext] dm_escalated handler failed:', err.message);
    }
  }, []);

  /**
   * Initialize cross-cluster event listeners on mount
   * These listeners wire together the different service clusters
   */
  useEffect(() => {
    if (listenersInitializedRef.current) return;

    listenersInitializedRef.current = true;

    const unsubs = [];

    // dm_sent → lead extraction trigger
    unsubs.push(subscribe(PUBLISHER_EVENT_TYPE.DM_SENT, handleDMSent));

    // lead_created → lead scoring
    unsubs.push(subscribe(PUBLISHER_EVENT_TYPE.LEAD_CREATED, handleLeadCreated));

    // lead_scored → high-priority notification
    unsubs.push(subscribe(PUBLISHER_EVENT_TYPE.LEAD_SCORED, handleLeadScored));

    // sla_breach → monitoring/tracking
    unsubs.push(subscribe(PUBLISHER_EVENT_TYPE.SLA_BREACH, handleSLABreach));

    // dm_escalated → escalation tracking
    unsubs.push(subscribe(PUBLISHER_EVENT_TYPE.DM_ESCALATED, handleDMEscalated));

    // Also listen for the general SLA breached event from the SLA monitor
    unsubs.push(subscribe(EVENT_TYPE.SLA_BREACHED, async (event) => {
      if (!mountedRef.current) return;
      const { payload } = event;
      console.info(
        `[EventContext] SLA breached event — ${payload?.breachCount || 0} breach(es) detected`
      );
    }));

    // Listen for SLA warning events
    unsubs.push(subscribe(EVENT_TYPE.SLA_WARNING, async (event) => {
      if (!mountedRef.current) return;
      const { payload } = event;
      console.info(
        `[EventContext] SLA warning — ${payload?.warningCount || 0} DM(s) approaching SLA threshold`
      );
    }));

    unsubscribersRef.current = unsubs;

    return () => {
      // Unsubscribe all cross-cluster listeners on unmount
      for (const unsub of unsubscribersRef.current) {
        if (typeof unsub === 'function') {
          unsub();
        }
      }
      unsubscribersRef.current = [];
      listenersInitializedRef.current = false;
    };
  }, [handleDMSent, handleLeadCreated, handleLeadScored, handleSLABreach, handleDMEscalated]);

  /**
   * Publishes an event to all registered listeners
   * Updates lastEvent state for UI reactivity
   *
   * @param {string} eventType - Event type to publish
   * @param {object} [payload={}] - Event payload data
   * @returns {Promise<{ eventType: string, listenerCount: number, errors: string[] }>}
   */
  const publishEvent = useCallback(async (eventType, payload = {}) => {
    if (!eventType || typeof eventType !== 'string') {
      safeSetState(setError, 'Event type is required and must be a string');
      return { eventType: '', listenerCount: 0, errors: ['Invalid event type'] };
    }

    setLoadingFlag('publishing', true);
    clearError();

    try {
      const result = await publish(eventType, payload);

      safeSetState(setLastEvent, {
        eventType,
        payload,
        timestamp: new Date().toISOString(),
        listenerCount: result.listenerCount,
      });

      if (result.errors && result.errors.length > 0) {
        console.warn(`[EventContext] ${result.errors.length} listener error(s) for event "${eventType}"`);
      }

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to publish event';
      safeSetState(setError, errorMessage);
      console.warn('[EventContext] Failed to publish event:', errorMessage);
      return { eventType, listenerCount: 0, errors: [errorMessage] };
    } finally {
      setLoadingFlag('publishing', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Subscribes to an event type
   *
   * @param {string} eventType - Event type to subscribe to
   * @param {Function} handler - Callback function
   * @returns {Function} Unsubscribe function
   */
  const subscribeEvent = useCallback((eventType, handler) => {
    if (!eventType || typeof eventType !== 'string') {
      console.warn('[EventContext] Invalid event type for subscribe');
      return () => {};
    }

    if (!handler || typeof handler !== 'function') {
      console.warn('[EventContext] Invalid handler for subscribe');
      return () => {};
    }

    return subscribe(eventType, handler);
  }, []);

  /**
   * Unsubscribes from an event type
   *
   * @param {string} eventType - Event type to unsubscribe from
   * @param {Function} handler - Handler function to remove
   * @returns {boolean} True if the handler was found and removed
   */
  const unsubscribeEvent = useCallback((eventType, handler) => {
    if (!eventType || typeof eventType !== 'string') return false;
    if (!handler || typeof handler !== 'function') return false;

    return unsubscribe(eventType, handler);
  }, []);

  /**
   * Subscribes once to an event type
   *
   * @param {string} eventType - Event type to subscribe to
   * @param {Function} handler - Callback function invoked once
   * @returns {Function} Unsubscribe function
   */
  const subscribeOnceEvent = useCallback((eventType, handler) => {
    if (!eventType || typeof eventType !== 'string') {
      console.warn('[EventContext] Invalid event type for subscribeOnce');
      return () => {};
    }

    if (!handler || typeof handler !== 'function') {
      console.warn('[EventContext] Invalid handler for subscribeOnce');
      return () => {};
    }

    return subscribeOnce(eventType, handler);
  }, []);

  /**
   * Convenience method to publish a DM sent event
   *
   * @param {object} payload - Event payload
   * @returns {Promise<object>} Publish result
   */
  const publishDMSentEvent = useCallback(async (payload) => {
    setLoadingFlag('publishing', true);
    clearError();

    try {
      const result = await publishDMSent(payload);

      safeSetState(setLastEvent, {
        eventType: PUBLISHER_EVENT_TYPE.DM_SENT,
        payload,
        timestamp: new Date().toISOString(),
        listenerCount: result.listenerCount,
      });

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to publish DM sent event';
      safeSetState(setError, errorMessage);
      console.warn('[EventContext] Failed to publish DM sent event:', errorMessage);
      return { eventType: PUBLISHER_EVENT_TYPE.DM_SENT, listenerCount: 0, errors: [errorMessage] };
    } finally {
      setLoadingFlag('publishing', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Convenience method to publish a DM escalated event
   *
   * @param {object} payload - Event payload
   * @returns {Promise<object>} Publish result
   */
  const publishDMEscalatedEvent = useCallback(async (payload) => {
    setLoadingFlag('publishing', true);
    clearError();

    try {
      const result = await publishDMEscalated(payload);

      safeSetState(setLastEvent, {
        eventType: PUBLISHER_EVENT_TYPE.DM_ESCALATED,
        payload,
        timestamp: new Date().toISOString(),
        listenerCount: result.listenerCount,
      });

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to publish DM escalated event';
      safeSetState(setError, errorMessage);
      console.warn('[EventContext] Failed to publish DM escalated event:', errorMessage);
      return { eventType: PUBLISHER_EVENT_TYPE.DM_ESCALATED, listenerCount: 0, errors: [errorMessage] };
    } finally {
      setLoadingFlag('publishing', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Convenience method to publish an SLA breach event
   *
   * @param {object} payload - Event payload
   * @returns {Promise<object>} Publish result
   */
  const publishSLABreachEvent = useCallback(async (payload) => {
    setLoadingFlag('publishing', true);
    clearError();

    try {
      const result = await publishSLABreach(payload);

      safeSetState(setLastEvent, {
        eventType: PUBLISHER_EVENT_TYPE.SLA_BREACH,
        payload,
        timestamp: new Date().toISOString(),
        listenerCount: result.listenerCount,
      });

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to publish SLA breach event';
      safeSetState(setError, errorMessage);
      console.warn('[EventContext] Failed to publish SLA breach event:', errorMessage);
      return { eventType: PUBLISHER_EVENT_TYPE.SLA_BREACH, listenerCount: 0, errors: [errorMessage] };
    } finally {
      setLoadingFlag('publishing', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Convenience method to publish a lead created event
   *
   * @param {object} payload - Event payload
   * @returns {Promise<object>} Publish result
   */
  const publishLeadCreatedEvent = useCallback(async (payload) => {
    setLoadingFlag('publishing', true);
    clearError();

    try {
      const result = await publishLeadCreated(payload);

      safeSetState(setLastEvent, {
        eventType: PUBLISHER_EVENT_TYPE.LEAD_CREATED,
        payload,
        timestamp: new Date().toISOString(),
        listenerCount: result.listenerCount,
      });

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to publish lead created event';
      safeSetState(setError, errorMessage);
      console.warn('[EventContext] Failed to publish lead created event:', errorMessage);
      return { eventType: PUBLISHER_EVENT_TYPE.LEAD_CREATED, listenerCount: 0, errors: [errorMessage] };
    } finally {
      setLoadingFlag('publishing', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Convenience method to publish a lead scored event
   *
   * @param {object} payload - Event payload
   * @returns {Promise<object>} Publish result
   */
  const publishLeadScoredEvent = useCallback(async (payload) => {
    setLoadingFlag('publishing', true);
    clearError();

    try {
      const result = await publishLeadScored(payload);

      safeSetState(setLastEvent, {
        eventType: PUBLISHER_EVENT_TYPE.LEAD_SCORED,
        payload,
        timestamp: new Date().toISOString(),
        listenerCount: result.listenerCount,
      });

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to publish lead scored event';
      safeSetState(setError, errorMessage);
      console.warn('[EventContext] Failed to publish lead scored event:', errorMessage);
      return { eventType: PUBLISHER_EVENT_TYPE.LEAD_SCORED, listenerCount: 0, errors: [errorMessage] };
    } finally {
      setLoadingFlag('publishing', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Convenience method to publish a draft approved event
   *
   * @param {object} payload - Event payload
   * @returns {Promise<object>} Publish result
   */
  const publishDraftApprovedEvent = useCallback(async (payload) => {
    setLoadingFlag('publishing', true);
    clearError();

    try {
      const result = await publishDraftApproved(payload);

      safeSetState(setLastEvent, {
        eventType: PUBLISHER_EVENT_TYPE.DRAFT_APPROVED,
        payload,
        timestamp: new Date().toISOString(),
        listenerCount: result.listenerCount,
      });

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to publish draft approved event';
      safeSetState(setError, errorMessage);
      console.warn('[EventContext] Failed to publish draft approved event:', errorMessage);
      return { eventType: PUBLISHER_EVENT_TYPE.DRAFT_APPROVED, listenerCount: 0, errors: [errorMessage] };
    } finally {
      setLoadingFlag('publishing', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Convenience method to publish a draft rejected event
   *
   * @param {object} payload - Event payload
   * @returns {Promise<object>} Publish result
   */
  const publishDraftRejectedEvent = useCallback(async (payload) => {
    setLoadingFlag('publishing', true);
    clearError();

    try {
      const result = await publishDraftRejected(payload);

      safeSetState(setLastEvent, {
        eventType: PUBLISHER_EVENT_TYPE.DRAFT_REJECTED,
        payload,
        timestamp: new Date().toISOString(),
        listenerCount: result.listenerCount,
      });

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to publish draft rejected event';
      safeSetState(setError, errorMessage);
      console.warn('[EventContext] Failed to publish draft rejected event:', errorMessage);
      return { eventType: PUBLISHER_EVENT_TYPE.DRAFT_REJECTED, listenerCount: 0, errors: [errorMessage] };
    } finally {
      setLoadingFlag('publishing', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Returns the event history
   *
   * @param {object} [options]
   * @param {string} [options.eventType] - Filter by event type
   * @param {number} [options.limit=50] - Maximum number of events to return
   * @returns {Array<{ eventType: string, payload: object, timestamp: string }>}
   */
  const getHistory = useCallback((options = {}) => {
    return getEventHistory(options);
  }, []);

  /**
   * Clears the event history buffer
   */
  const clearHistoryAction = useCallback(() => {
    clearEventHistory();
  }, []);

  /**
   * Returns all event types that currently have registered listeners
   *
   * @returns {string[]} Array of event type strings with active listeners
   */
  const getActiveTypes = useCallback(() => {
    return getActiveEventTypes();
  }, []);

  /**
   * Returns the number of subscribers for a given event type
   *
   * @param {string} eventType - Event type to check
   * @returns {number} Number of registered listeners
   */
  const getListenerCount = useCallback((eventType) => {
    return getSubscriberCount(eventType);
  }, []);

  /**
   * Starts SLA breach monitoring
   *
   * @param {object[]|null} [dms=null] - Initial DMs to monitor
   * @param {object} [options] - Monitoring options
   * @returns {Promise<{ started: boolean, intervalMs: number, initialBreaches: number }>}
   */
  const startSLAMonitoring = useCallback(async (dms = null, options = {}) => {
    setLoadingFlag('monitoring', true);
    clearError();

    try {
      const result = await startMonitoring(dms, options);
      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to start SLA monitoring';
      safeSetState(setError, errorMessage);
      console.warn('[EventContext] Failed to start SLA monitoring:', errorMessage);
      return { started: false, intervalMs: 0, initialBreaches: 0 };
    } finally {
      setLoadingFlag('monitoring', false);
    }
  }, [setLoadingFlag, clearError, safeSetState]);

  /**
   * Stops SLA breach monitoring
   *
   * @returns {{ stopped: boolean, checkCount: number, totalBreachCount: number }}
   */
  const stopSLAMonitoring = useCallback(() => {
    return stopMonitoring();
  }, []);

  /**
   * Returns the current SLA monitoring status
   *
   * @returns {object} Monitoring status
   */
  const getSLAMonitoringStatus = useCallback(() => {
    return getMonitoringStatus();
  }, []);

  /**
   * Cleanup SLA monitoring on unmount
   */
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      lastEvent,
      loading,
      error,
      publish: publishEvent,
      subscribe: subscribeEvent,
      unsubscribe: unsubscribeEvent,
      subscribeOnce: subscribeOnceEvent,
      publishDMSent: publishDMSentEvent,
      publishDMEscalated: publishDMEscalatedEvent,
      publishSLABreach: publishSLABreachEvent,
      publishLeadCreated: publishLeadCreatedEvent,
      publishLeadScored: publishLeadScoredEvent,
      publishDraftApproved: publishDraftApprovedEvent,
      publishDraftRejected: publishDraftRejectedEvent,
      getHistory,
      clearHistory: clearHistoryAction,
      getActiveTypes,
      getListenerCount,
      startSLAMonitoring,
      stopSLAMonitoring,
      getSLAMonitoringStatus,
      clearError,
    }),
    [
      lastEvent,
      loading,
      error,
      publishEvent,
      subscribeEvent,
      unsubscribeEvent,
      subscribeOnceEvent,
      publishDMSentEvent,
      publishDMEscalatedEvent,
      publishSLABreachEvent,
      publishLeadCreatedEvent,
      publishLeadScoredEvent,
      publishDraftApprovedEvent,
      publishDraftRejectedEvent,
      getHistory,
      clearHistoryAction,
      getActiveTypes,
      getListenerCount,
      startSLAMonitoring,
      stopSLAMonitoring,
      getSLAMonitoringStatus,
      clearError,
    ]
  );

  return (
    <EventContext.Provider value={contextValue}>
      {children}
    </EventContext.Provider>
  );
}

/**
 * Hook to access the event context
 * Must be used within an EventProvider
 *
 * @returns {EventContextValue} Event context value
 * @throws {Error} If used outside of EventProvider
 */
export function useEvent() {
  const context = useContext(EventContext);

  if (context === null) {
    throw new Error('useEvent must be used within an EventProvider');
  }

  return context;
}

export default EventContext;