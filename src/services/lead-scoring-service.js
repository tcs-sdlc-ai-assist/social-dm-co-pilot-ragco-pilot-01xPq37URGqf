import { getLeadById, updateLead } from '@/repositories/lead-repository';
import { addLog } from '@/repositories/audit-log-repository';
import { saveNotification } from '@/repositories/notification-repository';
import { sanitizeInput } from '@/utils/validators';
import { stripPII } from '@/utils/pii-filter';
import { STATUS, LEAD_SCORE, LEAD_LABELS, getLeadLabel } from '@/utils/constants';
import knowledgeBase from '@/data/knowledge-base.json';

/**
 * Lead Scoring Service
 * Business logic layer for rule-based lead scoring
 * Implements LeadScoringService from LLD (SCRUM-6539)
 *
 * Provides:
 * - scoreLead(leadId, options): Evaluate a lead and assign a numeric score (0-100) and priority flag
 * - scoreLeadData(lead): Score a lead object directly without persistence
 * - getScoreBreakdown(leadId): Retrieve detailed scoring breakdown for a lead
 * - scoreLeadsInBatch(leadIds, options): Score multiple leads in batch
 * - getPriorityLabel(score): Get priority label from score
 *
 * Scoring is rule-based per NFR-004: No demographic-based scoring.
 * Evaluates: declared intent, engagement signals, budget, location match,
 * extraction confidence, sentiment, urgency, and property interest specificity.
 *
 * High-priority leads (score >= 80) trigger notification creation.
 * All scoring actions are logged via audit log for compliance and traceability.
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
 * Priority labels mapped from score thresholds
 */
const PRIORITY = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
});

/**
 * Known high-value locations from the knowledge base
 * @type {Set<string>}
 */
const KNOWN_LOCATIONS = new Set(
  (knowledgeBase.properties || [])
    .map((p) => p.location)
    .filter(Boolean)
    .map((loc) => loc.toLowerCase())
);

/**
 * Known property IDs from the knowledge base for validation
 * @type {Set<string>}
 */
const KNOWN_PROPERTY_IDS = new Set(
  (knowledgeBase.properties || []).map((p) => p.id)
);

/**
 * Intent weights for scoring
 * Higher weights indicate stronger purchase/engagement intent
 */
const INTENT_WEIGHTS = Object.freeze({
  'buy': 15,
  'buy-sell': 18,
  'invest': 16,
  'sell': 14,
  'rent-then-buy': 12,
  'lease-commercial': 13,
  'rent': 8,
  'research': 3,
});

/**
 * Sentiment weights for scoring
 */
const SENTIMENT_WEIGHTS = Object.freeze({
  'positive': 8,
  'neutral': 4,
  'negative': 2,
});

/**
 * Inquiry type weights for scoring
 */
const INQUIRY_TYPE_WEIGHTS = Object.freeze({
  'availability': 8,
  'showings': 10,
  'pricing': 7,
  'property': 6,
  'process': 5,
  'general': 3,
});

/**
 * Returns the priority label based on a numeric score
 *
 * @param {number} score - Lead score (0-100)
 * @returns {string} Priority label ('high', 'medium', 'low')
 */
export function getPriorityLabel(score) {
  if (typeof score !== 'number' || isNaN(score)) return PRIORITY.LOW;

  if (score >= LEAD_SCORE.HOT) return PRIORITY.HIGH;
  if (score >= LEAD_SCORE.WARM) return PRIORITY.MEDIUM;
  return PRIORITY.LOW;
}

/**
 * Calculates the intent score component
 * Based on declared intent from lead extraction
 *
 * @param {string} intent - Lead intent value
 * @returns {{ score: number, factor: string }}
 */
function scoreIntent(intent) {
  if (!intent || typeof intent !== 'string') {
    return { score: 3, factor: 'No declared intent detected' };
  }

  const normalizedIntent = intent.toLowerCase();
  const weight = INTENT_WEIGHTS[normalizedIntent];

  if (weight !== undefined) {
    return {
      score: weight,
      factor: `Declared intent: ${intent} (+${weight})`,
    };
  }

  return { score: 3, factor: `Unknown intent: ${intent} (+3)` };
}

/**
 * Calculates the budget score component
 * Higher budgets indicate more serious buyers
 * No demographic-based scoring per NFR-004 — only evaluates declared budget
 *
 * @param {object|null} budget - Budget range { min, max }
 * @returns {{ score: number, factor: string }}
 */
function scoreBudget(budget) {
  if (!budget || typeof budget !== 'object') {
    return { score: 0, factor: 'No budget information provided' };
  }

  const maxBudget = budget.max || budget.min || 0;

  if (maxBudget <= 0) {
    return { score: 0, factor: 'No budget information provided' };
  }

  // Score based on budget presence and range
  // Higher budgets get slightly more points, but we cap to avoid demographic bias
  if (maxBudget >= 700000) {
    return { score: 15, factor: `Budget declared: high range (+15)` };
  }
  if (maxBudget >= 400000) {
    return { score: 12, factor: `Budget declared: mid range (+12)` };
  }
  if (maxBudget >= 200000) {
    return { score: 10, factor: `Budget declared: entry range (+10)` };
  }

  return { score: 7, factor: `Budget declared (+7)` };
}

/**
 * Calculates the location match score component
 * Rewards leads whose preferred location matches known service areas
 *
 * @param {string|null} location - Lead's preferred location
 * @returns {{ score: number, factor: string }}
 */
function scoreLocation(location) {
  if (!location || typeof location !== 'string') {
    return { score: 0, factor: 'No location preference specified' };
  }

  const normalizedLocation = location.toLowerCase().trim();

  if (KNOWN_LOCATIONS.has(normalizedLocation)) {
    return { score: 12, factor: `Location matches service area: ${location} (+12)` };
  }

  // Partial match — location mentioned but not in our primary areas
  return { score: 4, factor: `Location specified but outside primary service area: ${location} (+4)` };
}

/**
 * Calculates the engagement signals score component
 * Based on property interests, inquiry type, and interaction quality
 *
 * @param {object} lead - Lead object
 * @returns {{ score: number, factor: string }}
 */
function scoreEngagement(lead) {
  let score = 0;
  const factors = [];

  // Property interest specificity
  const propertyInterests = lead.propertyInterests || [];
  if (propertyInterests.length > 0) {
    const validInterests = propertyInterests.filter((id) => KNOWN_PROPERTY_IDS.has(id));

    if (validInterests.length >= 3) {
      score += 10;
      factors.push(`Multiple property interests (${validInterests.length}) (+10)`);
    } else if (validInterests.length >= 1) {
      score += 7;
      factors.push(`Specific property interest(s) (${validInterests.length}) (+7)`);
    }
  }

  // Inquiry type engagement signal
  const inquiryType = lead.inquiryType || '';
  const inquiryWeight = INQUIRY_TYPE_WEIGHTS[inquiryType.toLowerCase()];
  if (inquiryWeight) {
    score += inquiryWeight;
    factors.push(`Inquiry type: ${inquiryType} (+${inquiryWeight})`);
  }

  // Consent provided (engagement signal — they opted in)
  if (lead.hasConsent === true) {
    score += 3;
    factors.push('Consent provided (+3)');
  }

  const factor = factors.length > 0
    ? factors.join('. ')
    : 'No engagement signals detected';

  return { score, factor };
}

/**
 * Calculates the sentiment score component
 *
 * @param {string|null} sentiment - Detected sentiment
 * @returns {{ score: number, factor: string }}
 */
function scoreSentiment(sentiment) {
  if (!sentiment || typeof sentiment !== 'string') {
    return { score: 4, factor: 'No sentiment data available (+4)' };
  }

  const normalizedSentiment = sentiment.toLowerCase();
  const weight = SENTIMENT_WEIGHTS[normalizedSentiment];

  if (weight !== undefined) {
    return {
      score: weight,
      factor: `Sentiment: ${sentiment} (+${weight})`,
    };
  }

  return { score: 4, factor: `Unknown sentiment: ${sentiment} (+4)` };
}

/**
 * Calculates the extraction confidence score component
 * Higher extraction confidence indicates clearer, more actionable DM content
 *
 * @param {number|null} extractionConfidence - Extraction confidence (0-1)
 * @returns {{ score: number, factor: string }}
 */
function scoreExtractionConfidence(extractionConfidence) {
  if (extractionConfidence === null || extractionConfidence === undefined || typeof extractionConfidence !== 'number') {
    return { score: 2, factor: 'No extraction confidence data (+2)' };
  }

  if (extractionConfidence >= 0.9) {
    return { score: 10, factor: `High extraction confidence: ${Math.round(extractionConfidence * 100)}% (+10)` };
  }
  if (extractionConfidence >= 0.7) {
    return { score: 7, factor: `Good extraction confidence: ${Math.round(extractionConfidence * 100)}% (+7)` };
  }
  if (extractionConfidence >= 0.5) {
    return { score: 4, factor: `Moderate extraction confidence: ${Math.round(extractionConfidence * 100)}% (+4)` };
  }

  return { score: 2, factor: `Low extraction confidence: ${Math.round(extractionConfidence * 100)}% (+2)` };
}

/**
 * Calculates the urgency score component
 * Detects urgency from notes or other lead fields
 *
 * @param {object} lead - Lead object
 * @returns {{ score: number, factor: string }}
 */
function scoreUrgency(lead) {
  const notes = (lead.notes || '').toLowerCase();

  const urgencyKeywords = [
    'asap', 'urgent', 'immediately', 'right away',
    'as soon as possible', 'move in by', 'need to move',
    'relocat', 'closing soon', 'urgency detected',
  ];

  for (const keyword of urgencyKeywords) {
    if (notes.includes(keyword)) {
      return { score: 8, factor: 'Urgency indicators detected in lead notes (+8)' };
    }
  }

  return { score: 0, factor: 'No urgency indicators detected' };
}

/**
 * Scores a lead object directly without persistence
 * Returns a detailed breakdown of the scoring components
 *
 * @param {object} lead - Lead object to score
 * @returns {{ score: number, priority: string, escalationRequired: boolean, breakdown: object[] }}
 */
export function scoreLeadData(lead) {
  if (!lead || typeof lead !== 'object') {
    return {
      score: 0,
      priority: PRIORITY.LOW,
      escalationRequired: false,
      breakdown: [{ component: 'error', score: 0, factor: 'Invalid lead data' }],
    };
  }

  const breakdown = [];

  // Component 1: Intent (0-18 points)
  const intentResult = scoreIntent(lead.intent);
  breakdown.push({ component: 'intent', ...intentResult });

  // Component 2: Budget (0-15 points)
  const budgetResult = scoreBudget(lead.budget);
  breakdown.push({ component: 'budget', ...budgetResult });

  // Component 3: Location match (0-12 points)
  const locationResult = scoreLocation(lead.location);
  breakdown.push({ component: 'location', ...locationResult });

  // Component 4: Engagement signals (0-23 points)
  const engagementResult = scoreEngagement(lead);
  breakdown.push({ component: 'engagement', ...engagementResult });

  // Component 5: Sentiment (0-8 points)
  const sentimentResult = scoreSentiment(lead.sentiment);
  breakdown.push({ component: 'sentiment', ...sentimentResult });

  // Component 6: Extraction confidence (0-10 points)
  const confidenceResult = scoreExtractionConfidence(lead.extractionConfidence);
  breakdown.push({ component: 'extractionConfidence', ...confidenceResult });

  // Component 7: Urgency (0-8 points)
  const urgencyResult = scoreUrgency(lead);
  breakdown.push({ component: 'urgency', ...urgencyResult });

  // Calculate total score (max theoretical ~94, clamped to 0-100)
  const rawScore = breakdown.reduce((sum, item) => sum + item.score, 0);
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  const priority = getPriorityLabel(score);
  const escalationRequired = priority === PRIORITY.HIGH;

  return {
    score,
    priority,
    escalationRequired,
    breakdown,
  };
}

/**
 * Scores a lead by its ID, persists the score, and triggers notifications if high-priority
 * Evaluates lead based on declared intent, engagement signals, budget, and location match
 * No demographic-based scoring per NFR-004
 *
 * @param {string} leadId - Lead identifier
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @param {string} [options.assignedTo] - Agent to notify for high-priority leads
 * @returns {Promise<{ lead: object, score: number, priority: string, escalationRequired: boolean, breakdown: object[] }>}
 * @throws {Error} If lead not found or leadId is invalid
 */
export async function scoreLead(leadId, options = {}) {
  if (!leadId || typeof leadId !== 'string') {
    throw new Error('Lead id is required and must be a string');
  }

  const { performedBy = 'system', assignedTo } = options;

  await simulateLatency(50, 150);

  const lead = await getLeadById(leadId);

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  // Calculate score
  const { score, priority, escalationRequired, breakdown } = scoreLeadData(lead);

  const previousScore = lead.score;

  // Persist the score to the lead record
  const updatedLead = await updateLead({
    id: leadId,
    score,
  });

  // If high-priority, create a notification
  if (escalationRequired) {
    try {
      const targetAgent = assignedTo || lead.assignedTo || 'agent-001';

      await saveNotification({
        type: 'high_priority_lead',
        message: `High-priority lead detected: ${getLeadLabel(score)} (score: ${score}). Lead requires immediate attention.`,
        leadId,
        dmId: lead.dmId || null,
        userId: targetAgent,
        read: false,
      });
    } catch {
      console.warn('[lead-scoring-service] Failed to create high-priority lead notification');
    }
  }

  // Log the scoring action
  try {
    await addLog({
      entityType: 'lead',
      entityId: leadId,
      action: 'score',
      performedBy: sanitizeInput(performedBy),
      details: {
        previousScore,
        newScore: score,
        priority,
        escalationRequired,
        breakdownSummary: breakdown.map((b) => ({
          component: b.component,
          score: b.score,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[lead-scoring-service] Failed to write audit log for lead scoring');
  }

  return {
    lead: updatedLead,
    score,
    priority,
    escalationRequired,
    breakdown,
  };
}

/**
 * Retrieves a detailed scoring breakdown for a lead
 * Does not persist or modify the lead — read-only analysis
 *
 * @param {string} leadId - Lead identifier
 * @returns {Promise<{ score: number, priority: string, escalationRequired: boolean, breakdown: object[] }>}
 * @throws {Error} If lead not found
 */
export async function getScoreBreakdown(leadId) {
  if (!leadId || typeof leadId !== 'string') {
    throw new Error('Lead id is required and must be a string');
  }

  await simulateLatency(20, 60);

  const lead = await getLeadById(leadId);

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  return scoreLeadData(lead);
}

/**
 * Scores multiple leads in batch
 * Useful for re-scoring all leads after rule changes or bulk ingestion
 *
 * @param {string[]} leadIds - Array of lead identifiers
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @returns {Promise<{ scored: Array<{ leadId: string, score: number, priority: string }>, errors: Array<{ leadId: string, error: string }> }>}
 */
export async function scoreLeadsInBatch(leadIds, options = {}) {
  if (!Array.isArray(leadIds)) {
    throw new Error('Lead IDs must be an array');
  }

  if (leadIds.length === 0) {
    return { scored: [], errors: [] };
  }

  const { performedBy = 'system' } = options;

  const scored = [];
  const errors = [];

  for (const leadId of leadIds) {
    try {
      if (!leadId || typeof leadId !== 'string') {
        errors.push({ leadId: leadId || 'unknown', error: 'Invalid lead ID' });
        continue;
      }

      const result = await scoreLead(leadId, { performedBy });
      scored.push({
        leadId,
        score: result.score,
        priority: result.priority,
        escalationRequired: result.escalationRequired,
      });
    } catch (err) {
      errors.push({ leadId, error: err.message });
    }
  }

  // Log batch scoring
  try {
    await addLog({
      entityType: 'lead',
      entityId: 'batch-score',
      action: 'score',
      performedBy: sanitizeInput(performedBy),
      details: {
        totalLeads: leadIds.length,
        scored: scored.length,
        errors: errors.length,
        highPriority: scored.filter((s) => s.priority === PRIORITY.HIGH).length,
        mediumPriority: scored.filter((s) => s.priority === PRIORITY.MEDIUM).length,
        lowPriority: scored.filter((s) => s.priority === PRIORITY.LOW).length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[lead-scoring-service] Failed to write audit log for batch scoring');
  }

  return { scored, errors };
}

/**
 * Determines whether a lead requires escalation based on its current score
 *
 * @param {string} leadId - Lead identifier
 * @returns {Promise<{ escalationRequired: boolean, score: number, priority: string }>}
 * @throws {Error} If lead not found
 */
export async function checkEscalation(leadId) {
  if (!leadId || typeof leadId !== 'string') {
    throw new Error('Lead id is required and must be a string');
  }

  await simulateLatency(20, 60);

  const lead = await getLeadById(leadId);

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const score = typeof lead.score === 'number' ? lead.score : 0;
  const priority = getPriorityLabel(score);
  const escalationRequired = priority === PRIORITY.HIGH;

  return {
    escalationRequired,
    score,
    priority,
  };
}

/**
 * Re-scores a lead using the latest scoring rules
 * Useful when scoring rules have been updated and existing leads need re-evaluation
 *
 * @param {string} leadId - Lead identifier
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @returns {Promise<{ lead: object, score: number, priority: string, previousScore: number, scoreChanged: boolean }>}
 * @throws {Error} If lead not found
 */
export async function rescoreLead(leadId, options = {}) {
  if (!leadId || typeof leadId !== 'string') {
    throw new Error('Lead id is required and must be a string');
  }

  const { performedBy = 'system' } = options;

  await simulateLatency(30, 80);

  const lead = await getLeadById(leadId);

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const previousScore = typeof lead.score === 'number' ? lead.score : 0;

  const result = await scoreLead(leadId, { performedBy });

  return {
    lead: result.lead,
    score: result.score,
    priority: result.priority,
    previousScore,
    scoreChanged: previousScore !== result.score,
  };
}