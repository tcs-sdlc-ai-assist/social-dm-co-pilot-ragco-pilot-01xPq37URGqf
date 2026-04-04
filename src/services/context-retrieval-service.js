import knowledgeBase from '@/data/knowledge-base.json';
import { sanitizeInput } from '@/utils/validators';

/**
 * Context Retrieval Service
 * Business logic layer for retrieving relevant context from the knowledge base
 * Implements ContextRetrievalService from LLD (SCRUM-6531)
 *
 * Provides:
 * - retrieveContext(dmContent): Keyword matching against knowledge-base.json
 * - getPropertyContext(propertyId): Direct property lookup
 * - getFAQContext(category): Category-based FAQ retrieval
 * - rankContextItems(items, query): Relevance scoring and ranking
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
 * In-memory cache for context retrieval results
 * Keyed by normalized query string, with TTL tracking
 * @type {Map<string, { result: object, timestamp: number }>}
 */
const _contextCache = new Map();

/**
 * Cache TTL in milliseconds (10 minutes as specified in LLD)
 */
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Maximum number of cached entries to prevent unbounded memory growth
 */
const MAX_CACHE_SIZE = 100;

/**
 * Stop words to exclude from keyword extraction
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up',
  'that', 'this', 'these', 'those', 'am', 'it', 'its', 'my', 'your',
  'we', 'they', 'them', 'their', 'what', 'which', 'who', 'whom',
  'i', 'me', 'he', 'she', 'him', 'her', 'his', 'our', 'you',
  'hi', 'hello', 'hey', 'thanks', 'thank', 'please', 'yes', 'no',
  'also', 'any', 'still', 'like', 'looking', 'want', 'know', 'get',
  'see', 'saw', 'wondering', 'interested', 'noticed',
]);

/**
 * Extracts meaningful keywords from a text string
 * Removes stop words, punctuation, and normalizes to lowercase
 *
 * @param {string} text - Input text to extract keywords from
 * @returns {string[]} Array of unique keywords
 */
function extractKeywords(text) {
  if (!text || typeof text !== 'string') return [];

  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length === 0) return [];

  const words = normalized.split(' ');

  const keywords = [];
  const seen = new Set();

  for (const word of words) {
    const cleaned = word.replace(/^[.-]+|[.-]+$/g, '');
    if (cleaned.length < 2) continue;
    if (STOP_WORDS.has(cleaned)) continue;
    if (seen.has(cleaned)) continue;

    seen.add(cleaned);
    keywords.push(cleaned);
  }

  return keywords;
}

/**
 * Extracts multi-word phrases from text for better matching
 * Captures common real estate terms and address patterns
 *
 * @param {string} text - Input text
 * @returns {string[]} Array of extracted phrases
 */
function extractPhrases(text) {
  if (!text || typeof text !== 'string') return [];

  const normalized = text.toLowerCase();
  const phrases = [];

  // Extract address-like patterns (number + street name)
  const addressPattern = /\d+\s+[a-z]+(?:\s+[a-z]+)*(?:\s+(?:street|st|drive|dr|avenue|ave|road|rd|lane|ln|boulevard|blvd|court|ct|way|place|pl|circle|cir|path))/gi;
  const addressMatches = normalized.match(addressPattern);
  if (addressMatches) {
    for (const match of addressMatches) {
      phrases.push(match.trim());
    }
  }

  // Extract property name patterns (capitalized multi-word names from original text)
  const namePattern = /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g;
  const nameMatches = text.match(namePattern);
  if (nameMatches) {
    for (const match of nameMatches) {
      phrases.push(match.toLowerCase().trim());
    }
  }

  return phrases;
}

/**
 * Calculates a relevance score for a property against a set of keywords and phrases
 *
 * @param {object} property - Property object from knowledge base
 * @param {string[]} keywords - Extracted keywords from the query
 * @param {string[]} phrases - Extracted phrases from the query
 * @returns {number} Relevance score (0-1)
 */
function scoreProperty(property, keywords, phrases) {
  if (!property || keywords.length === 0) return 0;

  let score = 0;
  let maxPossibleScore = 0;

  // Build searchable text from property fields
  const propertyName = (property.name || '').toLowerCase();
  const propertyAddress = (property.address || '').toLowerCase();
  const propertyLocation = (property.location || '').toLowerCase();
  const propertyType = (property.type || '').toLowerCase();
  const propertyDescription = (property.description || '').toLowerCase();
  const propertyFeatures = (property.features || []).map((f) => f.toLowerCase()).join(' ');

  const allPropertyText = `${propertyName} ${propertyAddress} ${propertyLocation} ${propertyType} ${propertyDescription} ${propertyFeatures}`;

  // Score keyword matches with field-specific weights
  for (const keyword of keywords) {
    maxPossibleScore += 10;

    // Name match (highest weight)
    if (propertyName.includes(keyword)) {
      score += 10;
      continue;
    }

    // Address match (high weight)
    if (propertyAddress.includes(keyword)) {
      score += 9;
      continue;
    }

    // Location match (high weight)
    if (propertyLocation.includes(keyword)) {
      score += 8;
      continue;
    }

    // Type match (medium weight)
    if (propertyType.includes(keyword)) {
      score += 6;
      continue;
    }

    // Features match (medium weight)
    if (propertyFeatures.includes(keyword)) {
      score += 5;
      continue;
    }

    // Description match (lower weight)
    if (propertyDescription.includes(keyword)) {
      score += 3;
      continue;
    }
  }

  // Bonus for phrase matches (address or property name)
  for (const phrase of phrases) {
    if (propertyAddress.includes(phrase)) {
      score += 15;
      maxPossibleScore += 15;
    } else if (propertyName.includes(phrase)) {
      score += 12;
      maxPossibleScore += 12;
    } else if (allPropertyText.includes(phrase)) {
      score += 5;
      maxPossibleScore += 5;
    } else {
      maxPossibleScore += 5;
    }
  }

  // Bonus for numeric matches (prices, bedrooms, sq ft)
  const numbers = keywords.filter((k) => /^\d+$/.test(k));
  for (const num of numbers) {
    const numVal = parseInt(num, 10);

    if (property.bedrooms === numVal) {
      score += 5;
    }
    if (property.bathrooms === numVal) {
      score += 3;
    }
    if (property.squareFeet === numVal) {
      score += 5;
    }
    if (property.listPrice === numVal) {
      score += 8;
    }
    if (property.units === numVal) {
      score += 5;
    }
    maxPossibleScore += 5;
  }

  if (maxPossibleScore === 0) return 0;

  return Math.min(1, score / maxPossibleScore);
}

/**
 * Calculates a relevance score for a FAQ against a set of keywords
 *
 * @param {object} faq - FAQ object from knowledge base
 * @param {string[]} keywords - Extracted keywords from the query
 * @returns {number} Relevance score (0-1)
 */
function scoreFAQ(faq, keywords) {
  if (!faq || keywords.length === 0) return 0;

  let score = 0;
  let maxPossibleScore = 0;

  const question = (faq.question || '').toLowerCase();
  const answer = (faq.answer || '').toLowerCase();
  const category = (faq.category || '').toLowerCase();

  for (const keyword of keywords) {
    maxPossibleScore += 10;

    // Question match (highest weight)
    if (question.includes(keyword)) {
      score += 10;
      continue;
    }

    // Category match (high weight)
    if (category.includes(keyword)) {
      score += 7;
      continue;
    }

    // Answer match (medium weight)
    if (answer.includes(keyword)) {
      score += 4;
      continue;
    }
  }

  if (maxPossibleScore === 0) return 0;

  return Math.min(1, score / maxPossibleScore);
}

/**
 * Evicts expired entries from the context cache
 */
function evictExpiredCache() {
  const now = Date.now();

  for (const [key, entry] of _contextCache) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      _contextCache.delete(key);
    }
  }

  // If still over max size, remove oldest entries
  if (_contextCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(_contextCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
      _contextCache.delete(key);
    }
  }
}

/**
 * Generates a cache key from DM content
 *
 * @param {string} content - DM content string
 * @returns {string} Normalized cache key
 */
function getCacheKey(content) {
  return content.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Retrieves relevant context from the knowledge base for a given DM content
 * Performs keyword matching against properties and FAQs
 * Returns ranked context items with relevance scores
 *
 * @param {string} dmContent - The DM message content to find context for
 * @param {object} [options]
 * @param {number} [options.maxProperties=5] - Maximum number of properties to return
 * @param {number} [options.maxFAQs=5] - Maximum number of FAQs to return
 * @param {number} [options.minRelevance=0.1] - Minimum relevance score threshold
 * @param {boolean} [options.useCache=true] - Whether to use cached results
 * @returns {Promise<{ properties: object[], faqs: object[], keywords: string[] }>}
 */
export async function retrieveContext(dmContent, options = {}) {
  const {
    maxProperties = 5,
    maxFAQs = 5,
    minRelevance = 0.1,
    useCache = true,
  } = options;

  if (!dmContent || typeof dmContent !== 'string' || dmContent.trim().length === 0) {
    return { properties: [], faqs: [], keywords: [] };
  }

  await simulateLatency();

  // Sanitize input
  const sanitizedContent = sanitizeInput(dmContent);

  // Check cache
  if (useCache) {
    const cacheKey = getCacheKey(sanitizedContent);
    const cached = _contextCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return cached.result;
    }
  }

  // Extract keywords and phrases
  const keywords = extractKeywords(sanitizedContent);
  const phrases = extractPhrases(dmContent);

  if (keywords.length === 0 && phrases.length === 0) {
    return { properties: [], faqs: [], keywords: [] };
  }

  // Score and rank properties
  const scoredProperties = (knowledgeBase.properties || []).map((property) => {
    const relevance = scoreProperty(property, keywords, phrases);
    return { ...property, relevance };
  });

  const rankedProperties = scoredProperties
    .filter((p) => p.relevance >= minRelevance)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, maxProperties);

  // Score and rank FAQs
  const scoredFAQs = (knowledgeBase.faqs || []).map((faq) => {
    const relevance = scoreFAQ(faq, keywords);
    return { ...faq, relevance };
  });

  const rankedFAQs = scoredFAQs
    .filter((f) => f.relevance >= minRelevance)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, maxFAQs);

  const result = {
    properties: rankedProperties,
    faqs: rankedFAQs,
    keywords,
  };

  // Cache the result
  if (useCache) {
    evictExpiredCache();
    const cacheKey = getCacheKey(sanitizedContent);
    _contextCache.set(cacheKey, { result, timestamp: Date.now() });
  }

  return result;
}

/**
 * Retrieves context for a DM object (convenience wrapper)
 * Extracts content from the DM and calls retrieveContext
 *
 * @param {object} dm - DM object with content field
 * @param {string} dm.content - DM message content
 * @param {object} [dm.metadata] - DM metadata for additional context hints
 * @param {object} [options] - Options passed to retrieveContext
 * @returns {Promise<{ properties: object[], faqs: object[], keywords: string[] }>}
 */
export async function getContextForDM(dm, options = {}) {
  if (!dm || typeof dm !== 'object') {
    throw new Error('DM must be a non-null object');
  }

  if (!dm.content || typeof dm.content !== 'string') {
    throw new Error('DM must have string content');
  }

  // Use inquiry type from metadata to boost relevant FAQ categories
  const context = await retrieveContext(dm.content, options);

  // If metadata includes inquiry type, boost FAQs matching that category
  if (dm.metadata && dm.metadata.inquiryType) {
    const inquiryType = dm.metadata.inquiryType.toLowerCase();

    context.faqs = context.faqs.map((faq) => {
      if (faq.category && faq.category.toLowerCase() === inquiryType) {
        return { ...faq, relevance: Math.min(1, faq.relevance * 1.3) };
      }
      return faq;
    });

    // Re-sort after boosting
    context.faqs.sort((a, b) => b.relevance - a.relevance);
  }

  return context;
}

/**
 * Retrieves a specific property by its ID from the knowledge base
 *
 * @param {string} propertyId - Property identifier
 * @returns {Promise<object|null>} Property object or null if not found
 */
export async function getPropertyContext(propertyId) {
  if (!propertyId || typeof propertyId !== 'string') {
    return null;
  }

  await simulateLatency(20, 60);

  const property = (knowledgeBase.properties || []).find(
    (p) => p.id === propertyId
  );

  return property || null;
}

/**
 * Retrieves multiple properties by their IDs
 *
 * @param {string[]} propertyIds - Array of property identifiers
 * @returns {Promise<object[]>} Array of matching property objects
 */
export async function getPropertiesByIds(propertyIds) {
  if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
    return [];
  }

  await simulateLatency(20, 60);

  const idSet = new Set(propertyIds);

  return (knowledgeBase.properties || []).filter(
    (p) => idSet.has(p.id)
  );
}

/**
 * Retrieves FAQs filtered by category
 *
 * @param {string} category - FAQ category to filter by
 * @returns {Promise<object[]>} Array of FAQ objects matching the category
 */
export async function getFAQContext(category) {
  if (!category || typeof category !== 'string') {
    return [];
  }

  await simulateLatency(20, 60);

  const normalizedCategory = category.toLowerCase();

  return (knowledgeBase.faqs || []).filter(
    (faq) => faq.category && faq.category.toLowerCase() === normalizedCategory
  );
}

/**
 * Retrieves all available FAQ categories
 *
 * @returns {Promise<string[]>} Array of unique FAQ category strings
 */
export async function getFAQCategories() {
  await simulateLatency(10, 30);

  const categories = new Set();

  for (const faq of (knowledgeBase.faqs || [])) {
    if (faq.category) {
      categories.add(faq.category);
    }
  }

  return Array.from(categories);
}

/**
 * Retrieves all properties filtered by availability status
 *
 * @param {string} [availability] - Availability status filter (e.g., 'active', 'pending', 'withdrawn')
 * @returns {Promise<object[]>} Array of property objects
 */
export async function getPropertiesByAvailability(availability) {
  await simulateLatency(20, 60);

  if (!availability || typeof availability !== 'string') {
    return knowledgeBase.properties || [];
  }

  const normalizedAvailability = availability.toLowerCase();

  return (knowledgeBase.properties || []).filter(
    (p) => p.availability && p.availability.toLowerCase() === normalizedAvailability
  );
}

/**
 * Retrieves properties filtered by location
 *
 * @param {string} location - Location to filter by
 * @returns {Promise<object[]>} Array of property objects in the specified location
 */
export async function getPropertiesByLocation(location) {
  if (!location || typeof location !== 'string') {
    return [];
  }

  await simulateLatency(20, 60);

  const normalizedLocation = location.toLowerCase();

  return (knowledgeBase.properties || []).filter(
    (p) => p.location && p.location.toLowerCase() === normalizedLocation
  );
}

/**
 * Retrieves properties matching a budget range
 *
 * @param {number} minBudget - Minimum budget
 * @param {number} maxBudget - Maximum budget
 * @returns {Promise<object[]>} Array of property objects within the budget range
 */
export async function getPropertiesByBudget(minBudget, maxBudget) {
  if (typeof minBudget !== 'number' || typeof maxBudget !== 'number') {
    return [];
  }

  await simulateLatency(20, 60);

  return (knowledgeBase.properties || []).filter((p) => {
    if (!p.listPrice) return false;
    return p.listPrice >= minBudget && p.listPrice <= maxBudget;
  });
}

/**
 * Ranks an array of context items by relevance to a query
 * Generic ranking function that can be used for any item type
 *
 * @param {object[]} items - Array of items to rank
 * @param {string} query - Query string to rank against
 * @param {Function} textExtractor - Function that extracts searchable text from an item
 * @returns {object[]} Items sorted by relevance with relevance scores attached
 */
export function rankContextItems(items, query, textExtractor) {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (!query || typeof query !== 'string') return items;
  if (typeof textExtractor !== 'function') return items;

  const keywords = extractKeywords(query);

  if (keywords.length === 0) return items;

  const scored = items.map((item) => {
    const text = textExtractor(item).toLowerCase();
    let matchCount = 0;

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        matchCount++;
      }
    }

    const relevance = keywords.length > 0 ? matchCount / keywords.length : 0;

    return { ...item, relevance };
  });

  return scored.sort((a, b) => b.relevance - a.relevance);
}

/**
 * Clears the context retrieval cache
 * Useful for testing or when the knowledge base is updated
 */
export function clearContextCache() {
  _contextCache.clear();
}

/**
 * Returns the current cache size
 *
 * @returns {number} Number of cached entries
 */
export function getContextCacheSize() {
  return _contextCache.size;
}