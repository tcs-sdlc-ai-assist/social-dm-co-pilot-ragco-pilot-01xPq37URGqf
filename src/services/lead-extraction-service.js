import { saveLead, getLeadById, updateLead } from '@/repositories/lead-repository';
import { addLog } from '@/repositories/audit-log-repository';
import { sanitizeInput } from '@/utils/validators';
import { stripPII } from '@/utils/pii-filter';
import { STATUS, LEAD_SCORE, PAGINATION } from '@/utils/constants';
import knowledgeBase from '@/data/knowledge-base.json';

/**
 * Lead Extraction Service
 * Business logic layer for extracting structured lead data from DM content
 * Implements LeadExtractionService from LLD (SCRUM-6537, SCRUM-6538)
 *
 * Provides:
 * - extractLead(dm): Parse DM content to extract structured lead data (name, contact, budget, location, intent)
 * - extractLeadFields(content): Extract individual fields from raw text
 * - validateExtraction(fields): Validate extracted fields and flag incomplete leads
 * - calculateExtractionConfidence(fields): Score extraction quality
 * - enrichLeadFromContext(lead, dm): Enrich lead with metadata from DM context
 *
 * Uses pattern matching and keyword extraction to identify lead fields
 * Flags incomplete leads for manual entry
 * All actions are logged via audit log for compliance and traceability
 *
 * Simulates async latency to mimic real API/NLP behavior
 */

/**
 * Simulates network/API latency for realistic async behavior
 * @param {number} [minMs=50] - Minimum delay in milliseconds
 * @param {number} [maxMs=200] - Maximum delay in milliseconds
 * @returns {Promise<void>}
 */
function simulateLatency(minMs = 50, maxMs = 200) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

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
 * Regex patterns for extracting lead fields from DM content
 */
const EXTRACTION_PATTERNS = Object.freeze({
  // Email: user@domain.tld
  EMAIL: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/gi,

  // Phone: various formats
  PHONE: /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}\b/g,

  // Budget: $450k, $450,000, 450k, up to $700k, budget of $350,000, under $300k
  BUDGET: /(?:budget\s+(?:is|of|around|about|up\s+to|under)?\s*)?(?:up\s+to\s+)?\$?\s*([\d,]+)\s*k?\b/gi,

  // Bedrooms: 3-bedroom, 3BR, 3 bed, at least 4 bedrooms, 3+ bedrooms
  BEDROOMS: /(\d+)\s*(?:\+\s*)?(?:br|bed(?:room)?s?)\b/gi,

  // Square footage: 2000 sq ft, 2,000 sqft, 2000sf
  SQFT: /([\d,]+)\s*(?:sq\.?\s*(?:ft|feet)|sqft|sf)\b/gi,

  // Property type keywords
  PROPERTY_TYPE: /\b(condo|townhouse|townhome|single[- ]family|multi[- ]family|duplex|ranch|colonial|victorian|loft|commercial|investment)\b/gi,

  // Intent keywords
  INTENT_BUY: /\b(buy|purchase|looking\s+to\s+buy|interested\s+in\s+buying|want\s+to\s+buy|pre[- ]?approved)\b/gi,
  INTENT_SELL: /\b(sell|selling|list(?:ing)?|want\s+to\s+sell|looking\s+to\s+sell)\b/gi,
  INTENT_RENT: /\b(rent|rental|lease|leasing|looking\s+to\s+rent)\b/gi,
  INTENT_INVEST: /\b(invest|investment|cap\s+rate|roi|income\s+property|multi[- ]?family)\b/gi,

  // Urgency indicators
  URGENCY: /\b(asap|urgent|immediately|right\s+away|as\s+soon\s+as\s+possible|move\s+in\s+by|need\s+to\s+move|relocat(?:e|ing)|closing\s+soon)\b/gi,

  // Timeline: by February, within 6 months, this month
  TIMELINE: /\b(?:by|within|before|in)\s+(\w+(?:\s+\w+)?)\b/gi,
});

/**
 * Maps inquiry type strings to lead intent values
 */
const INQUIRY_TO_INTENT_MAP = Object.freeze({
  availability: 'buy',
  pricing: 'buy',
  property: 'buy',
  general: 'buy',
  showings: 'buy',
  process: 'buy',
});

/**
 * Extracts email addresses from text
 *
 * @param {string} text - Input text
 * @returns {string|null} First email found or null
 */
function extractEmail(text) {
  if (!text) return null;
  EXTRACTION_PATTERNS.EMAIL.lastIndex = 0;
  const matches = text.match(EXTRACTION_PATTERNS.EMAIL);
  return matches && matches.length > 0 ? matches[0].toLowerCase() : null;
}

/**
 * Extracts phone numbers from text
 *
 * @param {string} text - Input text
 * @returns {string|null} First phone number found or null
 */
function extractPhone(text) {
  if (!text) return null;
  EXTRACTION_PATTERNS.PHONE.lastIndex = 0;
  const matches = text.match(EXTRACTION_PATTERNS.PHONE);
  if (!matches || matches.length === 0) return null;

  // Filter out matches that are likely not phone numbers (too short or just a year)
  for (const match of matches) {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return match.trim();
    }
  }

  return null;
}

/**
 * Extracts budget amount from text
 * Handles formats like $450k, $450,000, 450k, up to $700k, under $300k
 *
 * @param {string} text - Input text
 * @returns {{ min: number|null, max: number|null }|null} Budget range or null
 */
function extractBudget(text) {
  if (!text) return null;

  const normalizedText = text.toLowerCase();
  let budgetMax = null;
  let budgetMin = null;

  // Look for explicit budget mentions
  const budgetPatterns = [
    /(?:budget\s+(?:is|of|around|about)?\s*(?:up\s+to\s+)?)\$?\s*([\d,]+)\s*k?\b/gi,
    /(?:pre[- ]?approved\s+(?:for\s+)?(?:up\s+to\s+)?)\$?\s*([\d,]+)\s*k?\b/gi,
    /(?:up\s+to\s+)\$?\s*([\d,]+)\s*k?\b/gi,
    /(?:under\s+)\$?\s*([\d,]+)\s*k?\b/gi,
    /(?:around\s+)\$?\s*([\d,]+)\s*k?\b/gi,
    /\$\s*([\d,]+)\s*k?\b/gi,
  ];

  for (const pattern of budgetPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(normalizedText);
    if (match) {
      let value = match[1].replace(/,/g, '');
      let numValue = parseInt(value, 10);

      // Check if the original match context includes 'k'
      const fullMatch = match[0].toLowerCase();
      if (fullMatch.includes('k') || (numValue > 0 && numValue < 10000)) {
        numValue = numValue * 1000;
      }

      // Only consider values that look like property prices
      if (numValue >= 50000 && numValue <= 50000000) {
        if (normalizedText.includes('under') || normalizedText.includes('up to')) {
          budgetMax = numValue;
          budgetMin = Math.round(numValue * 0.7);
        } else {
          budgetMax = Math.round(numValue * 1.1);
          budgetMin = Math.round(numValue * 0.85);
        }
        break;
      }
    }
  }

  if (budgetMax === null && budgetMin === null) return null;

  return { min: budgetMin, max: budgetMax };
}

/**
 * Extracts bedroom count from text
 *
 * @param {string} text - Input text
 * @returns {number|null} Number of bedrooms or null
 */
function extractBedrooms(text) {
  if (!text) return null;
  EXTRACTION_PATTERNS.BEDROOMS.lastIndex = 0;
  const match = EXTRACTION_PATTERNS.BEDROOMS.exec(text);
  if (match) {
    const count = parseInt(match[1], 10);
    if (count >= 1 && count <= 20) return count;
  }
  return null;
}

/**
 * Extracts location from text by matching against known locations
 *
 * @param {string} text - Input text
 * @returns {string|null} Matched location or null
 */
function extractLocation(text) {
  if (!text) return null;

  const normalizedText = text.toLowerCase();

  // Check for known locations from the knowledge base
  for (const location of KNOWN_LOCATIONS) {
    if (normalizedText.includes(location)) {
      // Return properly capitalized version
      const property = (knowledgeBase.properties || []).find(
        (p) => p.location && p.location.toLowerCase() === location
      );
      return property ? property.location : location;
    }
  }

  // Check for location-related phrases
  const locationPhrases = [
    /(?:in\s+(?:the\s+)?)([\w\s]+?)(?:\s+area|\s+neighborhood|\s+district)/gi,
    /(?:near\s+(?:the\s+)?)([\w\s]+?)(?:\s+station|\s+school|\s+metro)/gi,
  ];

  for (const pattern of locationPhrases) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      const candidate = match[1].trim();
      // Check if the extracted phrase matches a known location
      if (KNOWN_LOCATIONS.has(candidate.toLowerCase())) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * Extracts intent from text based on keyword matching
 *
 * @param {string} text - Input text
 * @param {string} [inquiryType] - Inquiry type from DM metadata
 * @returns {string} Intent string (buy, sell, rent, invest, research)
 */
function extractIntent(text, inquiryType) {
  if (!text) return inquiryType ? (INQUIRY_TO_INTENT_MAP[inquiryType] || 'buy') : 'buy';

  const normalizedText = text.toLowerCase();

  // Check for investment intent first (more specific)
  EXTRACTION_PATTERNS.INTENT_INVEST.lastIndex = 0;
  if (EXTRACTION_PATTERNS.INTENT_INVEST.test(normalizedText)) {
    return 'invest';
  }

  // Check for sell intent
  EXTRACTION_PATTERNS.INTENT_SELL.lastIndex = 0;
  if (EXTRACTION_PATTERNS.INTENT_SELL.test(normalizedText)) {
    // Check if they also want to buy (buy-sell coordination)
    EXTRACTION_PATTERNS.INTENT_BUY.lastIndex = 0;
    if (EXTRACTION_PATTERNS.INTENT_BUY.test(normalizedText)) {
      return 'buy-sell';
    }
    return 'sell';
  }

  // Check for rent intent
  EXTRACTION_PATTERNS.INTENT_RENT.lastIndex = 0;
  if (EXTRACTION_PATTERNS.INTENT_RENT.test(normalizedText)) {
    // Check if they plan to buy later
    EXTRACTION_PATTERNS.INTENT_BUY.lastIndex = 0;
    if (EXTRACTION_PATTERNS.INTENT_BUY.test(normalizedText)) {
      return 'rent-then-buy';
    }
    return 'rent';
  }

  // Check for buy intent
  EXTRACTION_PATTERNS.INTENT_BUY.lastIndex = 0;
  if (EXTRACTION_PATTERNS.INTENT_BUY.test(normalizedText)) {
    return 'buy';
  }

  // Fall back to inquiry type mapping
  if (inquiryType && INQUIRY_TO_INTENT_MAP[inquiryType]) {
    return INQUIRY_TO_INTENT_MAP[inquiryType];
  }

  return 'research';
}

/**
 * Detects urgency indicators in text
 *
 * @param {string} text - Input text
 * @returns {boolean} True if urgency indicators are found
 */
function detectUrgency(text) {
  if (!text) return false;
  EXTRACTION_PATTERNS.URGENCY.lastIndex = 0;
  return EXTRACTION_PATTERNS.URGENCY.test(text.toLowerCase());
}

/**
 * Extracts property IDs from DM content by matching against knowledge base
 *
 * @param {string} text - Input text
 * @returns {string[]} Array of matched property IDs
 */
function extractPropertyInterests(text) {
  if (!text) return [];

  const normalizedText = text.toLowerCase();
  const matchedIds = [];

  for (const property of (knowledgeBase.properties || [])) {
    // Match by property name
    if (property.name && normalizedText.includes(property.name.toLowerCase())) {
      matchedIds.push(property.id);
      continue;
    }

    // Match by address
    if (property.address && normalizedText.includes(property.address.toLowerCase())) {
      matchedIds.push(property.id);
      continue;
    }

    // Match by partial address (street name)
    if (property.address) {
      const streetParts = property.address.toLowerCase().split(',')[0].trim();
      // Extract just the street name portion (e.g., "Oak Street" from "247 Oak Street")
      const streetName = streetParts.replace(/^\d+\s+/, '');
      if (streetName.length > 3 && normalizedText.includes(streetName)) {
        matchedIds.push(property.id);
      }
    }
  }

  return [...new Set(matchedIds)];
}

/**
 * Generates a lead ID from a DM ID
 *
 * @param {string} dmId - DM identifier
 * @returns {string} Lead identifier
 */
function generateLeadId(dmId) {
  // Replace dm- prefix with lead- prefix
  if (dmId.startsWith('dm-')) {
    return dmId.replace('dm-', 'lead-');
  }
  return `lead-${dmId}`;
}

/**
 * Extracts all structured fields from DM content
 * Uses pattern matching and keyword extraction
 *
 * @param {string} content - DM message content
 * @param {object} [metadata] - DM metadata for additional context
 * @param {string} [metadata.inquiryType] - Type of inquiry
 * @param {number} [metadata.leadScore] - Pre-computed lead score
 * @param {string} [metadata.sentiment] - Detected sentiment
 * @returns {object} Extracted fields
 */
export function extractLeadFields(content, metadata = {}) {
  if (!content || typeof content !== 'string') {
    return {
      email: null,
      phone: null,
      budget: null,
      location: null,
      intent: 'research',
      bedrooms: null,
      propertyInterests: [],
      urgency: false,
      inquiryType: metadata.inquiryType || null,
    };
  }

  const email = extractEmail(content);
  const phone = extractPhone(content);
  const budget = extractBudget(content);
  const location = extractLocation(content);
  const intent = extractIntent(content, metadata.inquiryType);
  const bedrooms = extractBedrooms(content);
  const propertyInterests = extractPropertyInterests(content);
  const urgency = detectUrgency(content);

  return {
    email,
    phone,
    budget,
    location,
    intent,
    bedrooms,
    propertyInterests,
    urgency,
    inquiryType: metadata.inquiryType || null,
  };
}

/**
 * Validates extracted lead fields and identifies missing or incomplete data
 *
 * @param {object} fields - Extracted fields from extractLeadFields
 * @param {object} dm - Original DM object for additional context
 * @returns {{ valid: boolean, complete: boolean, errors: string[], warnings: string[] }}
 */
export function validateExtraction(fields, dm) {
  const errors = [];
  const warnings = [];

  if (!fields || typeof fields !== 'object') {
    return { valid: false, complete: false, errors: ['Extraction fields must be a non-null object'], warnings: [] };
  }

  // A lead must have at least a sender name from the DM
  if (!dm || !dm.sender || !dm.sender.name) {
    errors.push('DM must have sender information with a name');
  }

  // Check for completeness
  if (!fields.email && !fields.phone) {
    warnings.push('No contact information (email or phone) extracted');
  }

  if (!fields.budget) {
    warnings.push('No budget information extracted');
  }

  if (!fields.location) {
    warnings.push('No location preference extracted');
  }

  if (fields.intent === 'research') {
    warnings.push('Intent unclear — classified as research');
  }

  if (fields.propertyInterests.length === 0) {
    warnings.push('No specific property interests identified');
  }

  const complete = warnings.length === 0;
  const valid = errors.length === 0;

  return { valid, complete, errors, warnings };
}

/**
 * Calculates a confidence score for the extraction quality
 * Based on how many fields were successfully extracted
 *
 * @param {object} fields - Extracted fields
 * @param {object} validation - Validation result from validateExtraction
 * @returns {{ confidence: number, explanation: string }}
 */
export function calculateExtractionConfidence(fields, validation) {
  if (!fields) {
    return { confidence: 0.2, explanation: 'No fields extracted.' };
  }

  let score = 0;
  const factors = [];

  // Contact information (0-0.2)
  if (fields.email) {
    score += 0.15;
    factors.push('Email address extracted');
  }
  if (fields.phone) {
    score += 0.1;
    factors.push('Phone number extracted');
  }
  if (!fields.email && !fields.phone) {
    factors.push('No direct contact information found');
  }

  // Budget (0-0.2)
  if (fields.budget && (fields.budget.min || fields.budget.max)) {
    score += 0.2;
    factors.push('Budget range identified');
  }

  // Location (0-0.15)
  if (fields.location) {
    score += 0.15;
    factors.push('Location preference identified');
  }

  // Intent clarity (0-0.15)
  if (fields.intent && fields.intent !== 'research') {
    score += 0.15;
    factors.push(`Clear intent detected: ${fields.intent}`);
  } else {
    score += 0.05;
    factors.push('Intent unclear');
  }

  // Property interests (0-0.15)
  if (fields.propertyInterests && fields.propertyInterests.length > 0) {
    score += 0.15;
    factors.push(`${fields.propertyInterests.length} property interest(s) identified`);
  }

  // Urgency bonus (0-0.05)
  if (fields.urgency) {
    score += 0.05;
    factors.push('Urgency indicators detected');
  }

  // Bedrooms (0-0.05)
  if (fields.bedrooms) {
    score += 0.05;
    factors.push(`Bedroom requirement: ${fields.bedrooms}+`);
  }

  // Base confidence for having any content at all
  score += 0.1;

  const confidence = Math.min(1, Math.max(0, Math.round(score * 100) / 100));
  const explanation = factors.length > 0
    ? factors.join('. ') + '.'
    : 'Minimal data extracted from DM content.';

  return { confidence, explanation };
}

/**
 * Builds a structured notes string from extracted fields and DM content
 *
 * @param {object} fields - Extracted fields
 * @param {object} dm - Original DM object
 * @returns {string} Notes string
 */
function buildNotes(fields, dm) {
  const parts = [];

  if (dm.content) {
    // Truncate content for notes
    const truncated = dm.content.length > 200
      ? dm.content.slice(0, 200) + '...'
      : dm.content;
    parts.push(truncated);
  }

  if (fields.urgency) {
    parts.push('Urgency detected.');
  }

  if (fields.bedrooms) {
    parts.push(`Looking for ${fields.bedrooms}+ bedrooms.`);
  }

  return parts.join(' ');
}

/**
 * Extracts a structured lead from a DM object
 * Parses DM content to identify name, contact info, budget, location, and intent
 * Validates extracted data and flags incomplete leads for manual entry
 * Persists the lead to IndexedDB and logs the extraction action
 *
 * @param {object} dm - DM object
 * @param {string} dm.id - DM identifier
 * @param {string} dm.content - DM message content
 * @param {object} dm.sender - Sender information
 * @param {string} dm.sender.name - Sender display name
 * @param {string} dm.sender.handle - Sender handle
 * @param {string} dm.sender.platform - Platform identifier
 * @param {string} dm.timestamp - ISO timestamp
 * @param {object} [dm.metadata] - DM metadata
 * @param {string} [dm.metadata.inquiryType] - Type of inquiry
 * @param {number} [dm.metadata.leadScore] - Pre-computed lead score
 * @param {string} [dm.metadata.sentiment] - Detected sentiment
 * @param {boolean} [dm.metadata.hasConsent] - Consent status
 * @param {string} [dm.metadata.consentDate] - Consent date
 * @param {string} [dm.metadata.consentSource] - Consent source
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @param {string} [options.assignedTo] - Agent to assign the lead to
 * @returns {Promise<{ lead: object, extractionConfidence: number, complete: boolean, warnings: string[] }>}
 * @throws {Error} If DM data is invalid
 */
export async function extractLead(dm, options = {}) {
  if (!dm || typeof dm !== 'object') {
    throw new Error('DM must be a non-null object');
  }

  if (!dm.id || typeof dm.id !== 'string') {
    throw new Error('DM must have a string id');
  }

  if (!dm.content || typeof dm.content !== 'string' || dm.content.trim().length === 0) {
    throw new Error('DM must have non-empty content');
  }

  if (!dm.sender || !dm.sender.name || !dm.sender.handle || !dm.sender.platform) {
    throw new Error('DM must have sender with name, handle, and platform');
  }

  const { performedBy = 'system', assignedTo } = options;

  // Simulate NLP/extraction processing latency
  await simulateLatency(100, 300);

  // Step 1: Extract fields from DM content
  const fields = extractLeadFields(dm.content, dm.metadata || {});

  // Step 2: Validate extraction
  const validation = validateExtraction(fields, dm);

  if (!validation.valid) {
    throw new Error(`Lead extraction failed: ${validation.errors.join(', ')}`);
  }

  // Step 3: Calculate extraction confidence
  const { confidence, explanation } = calculateExtractionConfidence(fields, validation);

  // Step 4: Build lead object
  const leadId = generateLeadId(dm.id);

  const leadData = {
    id: leadId,
    name: dm.sender.name,
    handle: dm.sender.handle,
    platform: dm.sender.platform,
    contact: {
      email: fields.email || null,
      phone: fields.phone || null,
    },
    budget: fields.budget,
    location: fields.location || null,
    intent: fields.intent,
    inquiryType: fields.inquiryType || dm.metadata?.inquiryType || null,
    score: dm.metadata?.leadScore || 50,
    sentiment: dm.metadata?.sentiment || 'neutral',
    status: STATUS.NEW,
    assignedTo: assignedTo || null,
    propertyInterests: fields.propertyInterests,
    notes: buildNotes(fields, dm),
    hasConsent: dm.metadata?.hasConsent || false,
    consentDate: dm.metadata?.consentDate || null,
    consentSource: dm.metadata?.consentSource || null,
    extractionConfidence: confidence,
    extractionComplete: validation.complete,
    dmId: dm.id,
  };

  // Step 5: Check if lead already exists (idempotency)
  const existingLead = await getLeadById(leadId);

  let savedLead;
  if (existingLead) {
    // Update existing lead with new extraction data
    savedLead = await updateLead({
      id: leadId,
      contact: leadData.contact,
      budget: leadData.budget,
      location: leadData.location,
      intent: leadData.intent,
      inquiryType: leadData.inquiryType,
      score: Math.max(existingLead.score || 0, leadData.score),
      sentiment: leadData.sentiment,
      propertyInterests: [
        ...new Set([
          ...(existingLead.propertyInterests || []),
          ...leadData.propertyInterests,
        ]),
      ],
      notes: leadData.notes,
      hasConsent: leadData.hasConsent || existingLead.hasConsent,
      consentDate: leadData.consentDate || existingLead.consentDate,
      consentSource: leadData.consentSource || existingLead.consentSource,
    });
  } else {
    // Create new lead
    savedLead = await saveLead(leadData);
  }

  // Step 6: Log the extraction action
  try {
    await addLog({
      entityType: 'lead',
      entityId: leadId,
      action: 'extract',
      performedBy: sanitizeInput(performedBy),
      details: {
        dmId: dm.id,
        extractionConfidence: confidence,
        extractionComplete: validation.complete,
        fieldsExtracted: {
          hasEmail: !!fields.email,
          hasPhone: !!fields.phone,
          hasBudget: !!fields.budget,
          hasLocation: !!fields.location,
          intent: fields.intent,
          propertyInterestCount: fields.propertyInterests.length,
          urgency: fields.urgency,
        },
        warnings: validation.warnings,
        isUpdate: !!existingLead,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[lead-extraction-service] Failed to write audit log for lead extraction');
  }

  return {
    lead: savedLead,
    extractionConfidence: confidence,
    complete: validation.complete,
    warnings: validation.warnings,
  };
}

/**
 * Extracts leads from multiple DMs in batch
 *
 * @param {object[]} dms - Array of DM objects
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @param {string} [options.assignedTo] - Default agent to assign leads to
 * @returns {Promise<{ extracted: object[], errors: Array<{ dmId: string, error: string }> }>}
 */
export async function extractLeadsFromBatch(dms, options = {}) {
  if (!Array.isArray(dms)) {
    throw new Error('DMs must be an array');
  }

  const { performedBy = 'system', assignedTo } = options;

  const extracted = [];
  const errors = [];

  for (const dm of dms) {
    try {
      if (!dm || !dm.id || !dm.content || !dm.sender) {
        errors.push({ dmId: dm?.id || 'unknown', error: 'Invalid DM data' });
        continue;
      }

      const result = await extractLead(dm, { performedBy, assignedTo });
      extracted.push(result);
    } catch (err) {
      errors.push({ dmId: dm?.id || 'unknown', error: err.message });
    }
  }

  // Log batch extraction
  try {
    await addLog({
      entityType: 'lead',
      entityId: 'batch-extract',
      action: 'extract',
      performedBy: sanitizeInput(performedBy),
      details: {
        totalDMs: dms.length,
        extracted: extracted.length,
        errors: errors.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[lead-extraction-service] Failed to write audit log for batch extraction');
  }

  return { extracted, errors };
}

/**
 * Checks whether a DM has already been processed for lead extraction
 *
 * @param {string} dmId - DM identifier
 * @returns {Promise<boolean>} True if a lead already exists for this DM
 */
export async function isLeadExtracted(dmId) {
  if (!dmId || typeof dmId !== 'string') return false;

  await simulateLatency(20, 60);

  const leadId = generateLeadId(dmId);
  const existing = await getLeadById(leadId);

  return existing !== null;
}

/**
 * Retrieves the lead extracted from a specific DM
 *
 * @param {string} dmId - DM identifier
 * @returns {Promise<object|null>} Lead object or null if not extracted
 */
export async function getLeadForDM(dmId) {
  if (!dmId || typeof dmId !== 'string') return null;

  await simulateLatency(20, 60);

  const leadId = generateLeadId(dmId);
  return getLeadById(leadId);
}

/**
 * Flags a lead as requiring manual review/entry
 * Updates the lead status and logs the action
 *
 * @param {string} leadId - Lead identifier
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @param {string} [options.reason] - Reason for flagging
 * @returns {Promise<object>} Updated lead object
 * @throws {Error} If lead not found
 */
export async function flagForManualEntry(leadId, options = {}) {
  if (!leadId || typeof leadId !== 'string') {
    throw new Error('Lead id is required and must be a string');
  }

  const { performedBy = 'system', reason } = options;

  await simulateLatency();

  const lead = await getLeadById(leadId);

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const updatedLead = await updateLead({
    id: leadId,
    status: STATUS.ESCALATED,
    notes: lead.notes
      ? `${lead.notes} [FLAGGED FOR MANUAL ENTRY${reason ? ': ' + reason : ''}]`
      : `[FLAGGED FOR MANUAL ENTRY${reason ? ': ' + reason : ''}]`,
  });

  // Log the flagging action
  try {
    await addLog({
      entityType: 'lead',
      entityId: leadId,
      action: 'escalate',
      performedBy: sanitizeInput(performedBy),
      details: {
        reason: reason ? stripPII(sanitizeInput(reason)) : 'Incomplete extraction',
        previousStatus: lead.status,
        newStatus: STATUS.ESCALATED,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[lead-extraction-service] Failed to write audit log for manual entry flag');
  }

  return updatedLead;
}

/**
 * Enriches a lead with additional context from the DM and knowledge base
 * Updates property interests and location based on deeper analysis
 *
 * @param {string} leadId - Lead identifier
 * @param {object} dm - Original DM object for context
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @returns {Promise<object>} Enriched lead object
 * @throws {Error} If lead not found
 */
export async function enrichLead(leadId, dm, options = {}) {
  if (!leadId || typeof leadId !== 'string') {
    throw new Error('Lead id is required and must be a string');
  }

  if (!dm || typeof dm !== 'object') {
    throw new Error('DM must be a non-null object');
  }

  const { performedBy = 'system' } = options;

  await simulateLatency(50, 150);

  const lead = await getLeadById(leadId);

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const updates = { id: leadId };
  let enriched = false;

  // Enrich location from property interests if not already set
  if (!lead.location && lead.propertyInterests && lead.propertyInterests.length > 0) {
    const firstPropertyId = lead.propertyInterests[0];
    const property = (knowledgeBase.properties || []).find((p) => p.id === firstPropertyId);
    if (property && property.location) {
      updates.location = property.location;
      enriched = true;
    }
  }

  // Enrich budget from property interests if not already set
  if (!lead.budget && lead.propertyInterests && lead.propertyInterests.length > 0) {
    const properties = (knowledgeBase.properties || []).filter(
      (p) => lead.propertyInterests.includes(p.id) && p.listPrice
    );
    if (properties.length > 0) {
      const prices = properties.map((p) => p.listPrice);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      updates.budget = {
        min: Math.round(minPrice * 0.85),
        max: Math.round(maxPrice * 1.15),
      };
      enriched = true;
    }
  }

  // Update score based on metadata if available
  if (dm.metadata?.leadScore && (!lead.score || dm.metadata.leadScore > lead.score)) {
    updates.score = dm.metadata.leadScore;
    enriched = true;
  }

  if (!enriched) {
    return lead;
  }

  const updatedLead = await updateLead(updates);

  // Log the enrichment action
  try {
    await addLog({
      entityType: 'lead',
      entityId: leadId,
      action: 'update',
      performedBy: sanitizeInput(performedBy),
      details: {
        action: 'enrich',
        dmId: dm.id,
        fieldsEnriched: Object.keys(updates).filter((k) => k !== 'id'),
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[lead-extraction-service] Failed to write audit log for lead enrichment');
  }

  return updatedLead;
}