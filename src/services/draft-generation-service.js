import { getContextForDM, getPropertyContext } from '@/services/context-retrieval-service';
import { saveDraft, getDraftByDMId, updateDraft } from '@/repositories/draft-repository';
import { updateDMStatus, getDMById } from '@/repositories/dm-repository';
import { addLog } from '@/repositories/audit-log-repository';
import { sanitizeInput } from '@/utils/validators';
import { stripPII } from '@/utils/pii-filter';
import { STATUS, CONFIDENCE_THRESHOLD } from '@/utils/constants';
import templates from '@/data/draft-templates.json';

/**
 * Draft Generation Service
 * Business logic layer for generating draft responses using simulated RAG + GPT
 * Implements DraftGenerationService from LLD (SCRUM-6530, SCRUM-6535)
 *
 * Provides:
 * - generateDraft(dm, options): Generate a personalized draft response from templates and context
 * - regenerateDraft(dm, options): Force regeneration of a draft for a DM
 * - calculateConfidence(context, template, dm): Calculate confidence score based on context match quality
 * - selectTemplate(dm, context): Select the best matching template for a DM
 * - fillTemplate(template, context, dm): Fill template placeholders with context data
 * - getDraftForDM(dmId): Retrieve the current draft for a DM
 *
 * Simulates async latency to mimic real LLM/API behavior
 */

/**
 * Simulates network/API latency for realistic async behavior
 * @param {number} [minMs=100] - Minimum delay in milliseconds
 * @param {number} [maxMs=400] - Maximum delay in milliseconds
 * @returns {Promise<void>}
 */
function simulateLatency(minMs = 100, maxMs = 400) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Maps inquiry types to template categories for matching
 */
const INQUIRY_TO_CATEGORY_MAP = Object.freeze({
  availability: 'availability',
  pricing: 'pricing',
  property: 'property',
  general: 'general',
  showings: 'showings',
  process: 'process',
});

/**
 * Extracts the sender's first name from a full name string
 *
 * @param {string} name - Full name string
 * @returns {string} First name or the full name if no space found
 */
function extractFirstName(name) {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  const spaceIndex = trimmed.indexOf(' ');
  return spaceIndex > 0 ? trimmed.slice(0, spaceIndex) : trimmed;
}

/**
 * Formats a number as a currency string without cents
 *
 * @param {number} amount - Numeric amount
 * @returns {string} Formatted currency string (e.g., "$425,000")
 */
function formatPrice(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Selects the best matching template for a DM based on inquiry type and context
 *
 * @param {object} dm - DM object
 * @param {string} dm.content - DM message content
 * @param {object} [dm.metadata] - DM metadata
 * @param {string} [dm.metadata.inquiryType] - Type of inquiry
 * @param {object} context - Retrieved context from knowledge base
 * @param {object[]} context.properties - Matched properties
 * @param {object[]} context.faqs - Matched FAQs
 * @param {string[]} context.keywords - Extracted keywords
 * @returns {object|null} Best matching template or null if none found
 */
export function selectTemplate(dm, context) {
  if (!dm || !templates || templates.length === 0) return null;

  const inquiryType = dm.metadata?.inquiryType || 'general';
  const category = INQUIRY_TO_CATEGORY_MAP[inquiryType] || 'general';

  // Filter templates by matching category
  const categoryTemplates = templates.filter((t) => t.category === category);

  if (categoryTemplates.length === 0) {
    // Fall back to general templates
    const generalTemplates = templates.filter((t) => t.category === 'general');
    if (generalTemplates.length === 0) return templates[0] || null;
    return selectBestFromCandidates(generalTemplates, dm, context);
  }

  return selectBestFromCandidates(categoryTemplates, dm, context);
}

/**
 * Selects the best template from a list of candidates based on keyword overlap
 *
 * @param {object[]} candidates - Array of template candidates
 * @param {object} dm - DM object
 * @param {object} context - Retrieved context
 * @returns {object} Best matching template
 */
function selectBestFromCandidates(candidates, dm, context) {
  if (candidates.length === 1) return candidates[0];

  const content = (dm.content || '').toLowerCase();
  const keywords = context?.keywords || [];
  const hasProperties = context?.properties?.length > 0;
  const topProperty = hasProperties ? context.properties[0] : null;

  let bestTemplate = candidates[0];
  let bestScore = -1;

  for (const template of candidates) {
    let score = 0;

    // Score based on template name keyword overlap with DM content
    const templateNameWords = (template.name || '').toLowerCase().split(/[\s-]+/);
    for (const word of templateNameWords) {
      if (word.length > 2 && content.includes(word)) {
        score += 2;
      }
    }

    // Score based on keyword overlap with template text
    const templateText = (template.templateText || '').toLowerCase();
    for (const keyword of keywords) {
      if (templateText.includes(keyword)) {
        score += 1;
      }
    }

    // Bonus if property availability matches template name
    if (topProperty) {
      const availability = (topProperty.availability || '').toLowerCase();
      const templateNameLower = (template.name || '').toLowerCase();

      if (availability === 'active' && templateNameLower.includes('active')) {
        score += 5;
      }
      if (availability === 'pending' && templateNameLower.includes('pending')) {
        score += 5;
      }
      if (availability === 'withdrawn' && templateNameLower.includes('withdrawn')) {
        score += 5;
      }

      // Bonus for property type match
      if (topProperty.type === 'multi-family' && templateNameLower.includes('multi-family')) {
        score += 4;
      }
      if (topProperty.type === 'commercial' && templateNameLower.includes('commercial')) {
        score += 4;
      }
      if (topProperty.type === 'condo' && (templateNameLower.includes('hoa') || templateNameLower.includes('condo'))) {
        score += 3;
      }
    }

    // Bonus for content-specific keyword matches
    if (content.includes('pet') && (template.name || '').toLowerCase().includes('pet')) {
      score += 6;
    }
    if (content.includes('school') && (template.name || '').toLowerCase().includes('school')) {
      score += 6;
    }
    if (content.includes('showing') && (template.name || '').toLowerCase().includes('showing')) {
      score += 6;
    }
    if (content.includes('open house') && (template.name || '').toLowerCase().includes('open house')) {
      score += 6;
    }
    if (content.includes('cap rate') && (template.name || '').toLowerCase().includes('cap rate')) {
      score += 6;
    }
    if (content.includes('commission') && (template.name || '').toLowerCase().includes('commission')) {
      score += 6;
    }
    if (content.includes('pre-approv') && (template.name || '').toLowerCase().includes('pre-approval')) {
      score += 6;
    }
    if (content.includes('inspection') && (template.name || '').toLowerCase().includes('inspection')) {
      score += 6;
    }
    if (content.includes('offer') && (template.name || '').toLowerCase().includes('offer')) {
      score += 5;
    }
    if (content.includes('downsize') && (template.name || '').toLowerCase().includes('downsize')) {
      score += 6;
    }
    if (content.includes('relocat') && (template.name || '').toLowerCase().includes('relocation')) {
      score += 6;
    }
    if (content.includes('metro') && (template.name || '').toLowerCase().includes('transit')) {
      score += 5;
    }
    if (content.includes('budget') && (template.name || '').toLowerCase().includes('budget')) {
      score += 5;
    }
    if ((content.includes('price per') || content.includes('square foot')) && (template.name || '').toLowerCase().includes('square foot')) {
      score += 6;
    }
    if (content.includes('closing cost') && (template.name || '').toLowerCase().includes('closing')) {
      score += 6;
    }
    if (content.includes('listing process') && (template.name || '').toLowerCase().includes('listing process')) {
      score += 6;
    }

    // Use template's own confidence as a tiebreaker
    score += (template.confidence || 0) * 2;

    if (score > bestScore) {
      bestScore = score;
      bestTemplate = template;
    }
  }

  return bestTemplate;
}

/**
 * Fills template placeholders with data from context and DM
 *
 * @param {object} template - Template object with templateText and placeholders
 * @param {object} context - Retrieved context from knowledge base
 * @param {object} dm - DM object
 * @returns {string} Filled template text
 */
export function fillTemplate(template, context, dm) {
  if (!template || !template.templateText) return '';

  let text = template.templateText;
  const topProperty = context?.properties?.[0] || null;
  const senderName = extractFirstName(dm?.sender?.name || '');

  // Build placeholder values map
  const values = {};

  // Sender name
  values.senderName = senderName || 'there';

  if (topProperty) {
    values.propertyName = topProperty.name || '';
    values.propertyAddress = topProperty.address || '';
    values.location = topProperty.location || '';
    values.listPrice = topProperty.listPrice ? formatPrice(topProperty.listPrice) : '';
    values.bedrooms = topProperty.bedrooms !== undefined ? String(topProperty.bedrooms) : '';
    values.bathrooms = topProperty.bathrooms !== undefined ? String(topProperty.bathrooms) : '';
    values.squareFeet = topProperty.squareFeet ? topProperty.squareFeet.toLocaleString() : '';
    values.lotSize = topProperty.lotSize || '';
    values.features = Array.isArray(topProperty.features) ? topProperty.features.join(', ') : '';
    values.description = topProperty.description || '';
    values.propertyType = topProperty.type || '';
    values.hoaFees = topProperty.hoaFees ? `$${topProperty.hoaFees}` : 'N/A';
    values.monthlyRent = topProperty.monthlyRent ? formatPrice(topProperty.monthlyRent) : '';
    values.monthlyUtilities = topProperty.monthlyUtilities ? `$${topProperty.monthlyUtilities}` : 'approximately $100-$150';
    values.capRate = topProperty.capRate !== undefined ? String(topProperty.capRate) : '';
    values.units = topProperty.units !== undefined ? String(topProperty.units) : '';
    values.schoolDistrict = topProperty.schoolDistrict || '';

    // HOA includes
    if (topProperty.hoaFees) {
      values.hoaIncludes = 'water, trash, common area maintenance, and building amenities';
    } else {
      values.hoaIncludes = '';
    }

    // Parking details
    if (topProperty.parkingIncluded === true) {
      values.parkingDetails = 'Parking is included.';
    } else if (topProperty.parkingCost) {
      values.parkingDetails = `Parking is available for an additional $${topProperty.parkingCost}/month.`;
    } else {
      values.parkingDetails = '';
    }

    // Price range
    if (topProperty.priceRange) {
      values.priceMin = topProperty.priceRange.min ? formatPrice(topProperty.priceRange.min) : '';
      values.priceMax = topProperty.priceRange.max ? formatPrice(topProperty.priceRange.max) : '';
    }
  }

  // Budget from DM content analysis (extract numbers)
  const budgetMatch = (dm?.content || '').match(/\$?([\d,]+)k?\b/i);
  if (budgetMatch) {
    let budgetVal = budgetMatch[1].replace(/,/g, '');
    if ((dm?.content || '').toLowerCase().includes('k')) {
      budgetVal = String(parseInt(budgetVal, 10) * 1000);
    }
    values.budget = formatPrice(parseInt(budgetVal, 10));
  } else {
    values.budget = '';
  }

  // Price per square foot and year over year change (from FAQs or defaults)
  values.pricePerSqFt = '$175-$195';
  values.yearOverYearChange = '8%';

  // Suggested day for showings
  values.suggestedDay = 'this Saturday';

  // Recommended properties list
  if (context?.properties && context.properties.length > 1) {
    const recommendations = context.properties
      .slice(0, 3)
      .map((p) => `${p.name} at ${p.address} (${formatPrice(p.listPrice)})`)
      .join('; ');
    values.recommendedProperties = recommendations;
  } else if (topProperty) {
    values.recommendedProperties = `${topProperty.name} at ${topProperty.address} (${formatPrice(topProperty.listPrice)})`;
  } else {
    values.recommendedProperties = '';
  }

  // Replace all placeholders
  for (const [key, value] of Object.entries(values)) {
    const placeholder = `{{${key}}}`;
    text = text.split(placeholder).join(value || '');
  }

  // Clean up any remaining unreplaced placeholders
  text = text.replace(/\{\{[^}]+\}\}/g, '').replace(/\s{2,}/g, ' ').trim();

  return text;
}

/**
 * Calculates a confidence score based on context match quality
 *
 * @param {object} context - Retrieved context from knowledge base
 * @param {object} template - Selected template
 * @param {object} dm - DM object
 * @returns {{ confidence: number, explanation: string }} Confidence score and explanation
 */
export function calculateConfidence(context, template, dm) {
  if (!context || !template || !dm) {
    return {
      confidence: 0.3,
      explanation: 'Insufficient data to generate a confident response.',
    };
  }

  let score = 0;
  const factors = [];

  // Factor 1: Property match quality (0-0.3)
  if (context.properties && context.properties.length > 0) {
    const topRelevance = context.properties[0].relevance || 0;

    if (topRelevance >= 0.5) {
      score += 0.3;
      factors.push('Strong property match found in knowledge base');
    } else if (topRelevance >= 0.25) {
      score += 0.2;
      factors.push('Moderate property match found in knowledge base');
    } else if (topRelevance > 0) {
      score += 0.1;
      factors.push('Weak property match found in knowledge base');
    }
  } else {
    factors.push('No specific property match found');
  }

  // Factor 2: FAQ match quality (0-0.2)
  if (context.faqs && context.faqs.length > 0) {
    const topFAQRelevance = context.faqs[0].relevance || 0;

    if (topFAQRelevance >= 0.4) {
      score += 0.2;
      factors.push('Relevant FAQ context available');
    } else if (topFAQRelevance > 0) {
      score += 0.1;
      factors.push('Partial FAQ context available');
    }
  }

  // Factor 3: Template match quality (0-0.2)
  if (template.confidence) {
    score += template.confidence * 0.2;
    factors.push(`Template confidence: ${Math.round(template.confidence * 100)}%`);
  }

  // Factor 4: Inquiry type clarity (0-0.15)
  const inquiryType = dm.metadata?.inquiryType;
  if (inquiryType && INQUIRY_TO_CATEGORY_MAP[inquiryType]) {
    score += 0.15;
    factors.push(`Clear inquiry type detected: ${inquiryType}`);
  } else {
    score += 0.05;
    factors.push('Inquiry type unclear');
  }

  // Factor 5: Sentiment and lead score (0-0.15)
  const sentiment = dm.metadata?.sentiment;
  const leadScore = dm.metadata?.leadScore;

  if (sentiment === 'positive') {
    score += 0.08;
    factors.push('Positive sender sentiment detected');
  } else if (sentiment === 'neutral') {
    score += 0.05;
  } else if (sentiment === 'negative') {
    score += 0.02;
    factors.push('Negative sentiment may require careful handling');
  }

  if (leadScore && leadScore >= 80) {
    score += 0.07;
    factors.push('High-priority lead detected');
  } else if (leadScore && leadScore >= 50) {
    score += 0.04;
  }

  // Clamp confidence to [0, 1]
  const confidence = Math.min(1, Math.max(0, Math.round(score * 100) / 100));

  // Build explanation
  const explanation = factors.length > 0
    ? factors.join('. ') + '.'
    : 'Limited context available for response generation.';

  return { confidence, explanation };
}

/**
 * Builds context references object for audit and transparency
 *
 * @param {object} context - Retrieved context
 * @param {object} template - Selected template
 * @returns {object} Context references object
 */
function buildContextReferences(context, template) {
  const refs = {};

  if (context?.properties && context.properties.length > 0) {
    refs.properties = context.properties.map((p) => ({
      id: p.id,
      name: p.name,
      relevance: p.relevance,
    }));
  }

  if (context?.faqs && context.faqs.length > 0) {
    refs.faqs = context.faqs.map((f) => ({
      id: f.id,
      question: f.question,
      relevance: f.relevance,
    }));
  }

  if (template) {
    refs.templateId = template.id;
    refs.templateName = template.name;
    refs.templateCategory = template.category;
  }

  if (context?.keywords && context.keywords.length > 0) {
    refs.keywords = context.keywords;
  }

  return refs;
}

/**
 * Generates a draft response for a DM using simulated RAG + GPT
 * Retrieves context, selects a template, fills placeholders, and calculates confidence
 *
 * @param {object} dm - DM object
 * @param {string} dm.id - DM identifier
 * @param {string} dm.content - DM message content
 * @param {object} dm.sender - Sender information
 * @param {string} dm.sender.name - Sender display name
 * @param {object} [dm.metadata] - DM metadata
 * @param {string} [dm.metadata.inquiryType] - Type of inquiry
 * @param {object} [options]
 * @param {boolean} [options.regenerate=false] - Force regeneration even if a draft exists
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @param {object} [options.context] - Pre-retrieved context (skips context retrieval if provided)
 * @returns {Promise<object>} Generated draft with content, confidence, contextRefs, and suggested next steps
 * @throws {Error} If DM data is invalid
 */
export async function generateDraft(dm, options = {}) {
  if (!dm || typeof dm !== 'object') {
    throw new Error('DM must be a non-null object');
  }

  if (!dm.id || typeof dm.id !== 'string') {
    throw new Error('DM must have a string id');
  }

  if (!dm.content || typeof dm.content !== 'string' || dm.content.trim().length === 0) {
    throw new Error('DM must have non-empty content');
  }

  const { regenerate = false, performedBy = 'system' } = options;

  // Check for existing draft if not regenerating
  if (!regenerate) {
    const existingDraft = await getDraftByDMId(dm.id);
    if (existingDraft) {
      return existingDraft;
    }
  }

  // Simulate LLM processing latency
  await simulateLatency(200, 600);

  // Step 1: Retrieve context
  let context;
  if (options.context) {
    context = options.context;
  } else {
    try {
      context = await getContextForDM(dm);
    } catch {
      console.warn('[draft-generation-service] Failed to retrieve context, using empty context');
      context = { properties: [], faqs: [], keywords: [] };
    }
  }

  // Step 2: Select best matching template
  const template = selectTemplate(dm, context);

  if (!template) {
    throw new Error('No suitable template found for draft generation');
  }

  // Step 3: Fill template with context data
  const draftContent = fillTemplate(template, context, dm);

  if (!draftContent || draftContent.trim().length === 0) {
    throw new Error('Draft generation produced empty content');
  }

  // Step 4: Calculate confidence score
  const { confidence, explanation } = calculateConfidence(context, template, dm);

  // Step 5: Build context references for transparency
  const contextReferences = buildContextReferences(context, template);

  // Step 6: Determine suggested next steps
  const suggestedNextSteps = template.suggestedNextSteps || [];

  // Step 7: Save draft to IndexedDB
  const draftData = {
    dmId: dm.id,
    content: draftContent,
    confidence,
    confidenceExplanation: explanation,
    status: 'generated',
    templateId: template.id,
    contextReferences,
    suggestedNextSteps,
    createdBy: performedBy,
  };

  const savedDraft = await saveDraft(draftData);

  // Step 8: Update DM status to Drafted
  try {
    await updateDMStatus(dm.id, STATUS.DRAFTED);
  } catch {
    console.warn('[draft-generation-service] Failed to update DM status to Drafted');
  }

  // Step 9: Log the generation action
  try {
    await addLog({
      entityType: 'draft',
      entityId: String(savedDraft.id),
      action: 'create',
      performedBy: sanitizeInput(performedBy),
      details: {
        dmId: dm.id,
        templateId: template.id,
        confidence,
        confidenceExplanation: stripPII(explanation),
        contextPropertyCount: context.properties?.length || 0,
        contextFAQCount: context.faqs?.length || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[draft-generation-service] Failed to write audit log for draft generation');
  }

  return savedDraft;
}

/**
 * Regenerates a draft for a DM, replacing the existing draft
 * Forces context re-retrieval and template re-selection
 *
 * @param {object} dm - DM object
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @returns {Promise<object>} Newly generated draft
 */
export async function regenerateDraft(dm, options = {}) {
  return generateDraft(dm, { ...options, regenerate: true });
}

/**
 * Generates a draft for a DM by its ID
 * Fetches the DM from the repository and generates a draft
 *
 * @param {string} dmId - DM identifier
 * @param {object} [options]
 * @param {boolean} [options.regenerate=false] - Force regeneration
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @returns {Promise<object>} Generated draft
 * @throws {Error} If DM not found
 */
export async function generateDraftForDM(dmId, options = {}) {
  if (!dmId || typeof dmId !== 'string') {
    throw new Error('DM id is required and must be a string');
  }

  await simulateLatency(50, 100);

  const dm = await getDMById(dmId);

  if (!dm) {
    throw new Error(`DM not found: ${dmId}`);
  }

  return generateDraft(dm, options);
}

/**
 * Retrieves the current draft for a DM
 *
 * @param {string} dmId - DM identifier
 * @returns {Promise<object|null>} Draft object or null if no draft exists
 */
export async function getDraftForDM(dmId) {
  if (!dmId || typeof dmId !== 'string') {
    return null;
  }

  await simulateLatency(30, 80);

  return getDraftByDMId(dmId);
}

/**
 * Generates drafts for multiple DMs in batch
 * Useful for pre-generating drafts for new DMs in the inbox
 *
 * @param {object[]} dms - Array of DM objects
 * @param {object} [options]
 * @param {string} [options.performedBy='system'] - User or system identifier
 * @param {boolean} [options.skipExisting=true] - Skip DMs that already have drafts
 * @returns {Promise<{ generated: object[], skipped: string[], errors: Array<{ dmId: string, error: string }> }>}
 */
export async function generateDraftsForBatch(dms, options = {}) {
  if (!Array.isArray(dms)) {
    throw new Error('DMs must be an array');
  }

  const { performedBy = 'system', skipExisting = true } = options;

  const generated = [];
  const skipped = [];
  const errors = [];

  for (const dm of dms) {
    try {
      if (!dm || !dm.id || !dm.content) {
        errors.push({ dmId: dm?.id || 'unknown', error: 'Invalid DM data' });
        continue;
      }

      if (skipExisting) {
        const existingDraft = await getDraftByDMId(dm.id);
        if (existingDraft) {
          skipped.push(dm.id);
          continue;
        }
      }

      const draft = await generateDraft(dm, { performedBy, regenerate: !skipExisting });
      generated.push(draft);
    } catch (err) {
      errors.push({ dmId: dm?.id || 'unknown', error: err.message });
    }
  }

  // Log batch generation
  try {
    await addLog({
      entityType: 'draft',
      entityId: 'batch-generate',
      action: 'create',
      performedBy: sanitizeInput(performedBy),
      details: {
        totalDMs: dms.length,
        generated: generated.length,
        skipped: skipped.length,
        errors: errors.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.warn('[draft-generation-service] Failed to write audit log for batch generation');
  }

  return { generated, skipped, errors };
}

/**
 * Checks whether a draft requires human review based on confidence threshold
 *
 * @param {object} draft - Draft object
 * @param {number} draft.confidence - Confidence score (0-1)
 * @returns {boolean} True if human review is required
 */
export function requiresHumanReview(draft) {
  if (!draft || typeof draft.confidence !== 'number') return true;

  return draft.confidence < CONFIDENCE_THRESHOLD;
}

/**
 * Returns the confidence threshold used for human review decisions
 *
 * @returns {number} Confidence threshold value
 */
export function getConfidenceThreshold() {
  return CONFIDENCE_THRESHOLD;
}