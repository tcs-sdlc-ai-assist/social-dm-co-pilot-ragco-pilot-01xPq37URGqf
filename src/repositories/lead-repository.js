import { openDB, STORES } from '@/repositories/db';
import { STATUS, STATUS_LIST, PAGINATION, LEAD_SCORE } from '@/utils/constants';
import { encrypt, decrypt } from '@/utils/encryption';
import { sanitizeInput } from '@/utils/validators';
import { stripPII } from '@/utils/pii-filter';

/**
 * Lead data access layer
 * Provides CRUD operations for leads in IndexedDB
 * Handles encryption of PII fields before storage
 */

/**
 * Fields that contain PII and should be encrypted at rest
 */
const SENSITIVE_FIELDS = ['name', 'handle'];

/**
 * Fields nested within the contact object that should be encrypted
 */
const SENSITIVE_CONTACT_FIELDS = ['email', 'phone'];

/**
 * Encrypts sensitive PII fields on a lead object before storage
 * @param {object} lead - Lead object to encrypt
 * @returns {Promise<object>} Lead with sensitive fields encrypted
 */
async function encryptSensitiveFields(lead) {
  if (!lead) return lead;

  const encrypted = { ...lead };

  for (const field of SENSITIVE_FIELDS) {
    if (encrypted[field] !== undefined && encrypted[field] !== null) {
      try {
        encrypted[field] = await encrypt(encrypted[field]);
        encrypted[`_${field}_encrypted`] = true;
      } catch {
        console.warn(`[lead-repository] Failed to encrypt field: ${field}`);
        encrypted[`_${field}_encrypted`] = false;
      }
    }
  }

  // Encrypt nested contact fields
  if (encrypted.contact && typeof encrypted.contact === 'object') {
    encrypted.contact = { ...encrypted.contact };

    for (const field of SENSITIVE_CONTACT_FIELDS) {
      if (encrypted.contact[field] !== undefined && encrypted.contact[field] !== null) {
        try {
          encrypted.contact[field] = await encrypt(encrypted.contact[field]);
          encrypted.contact[`_${field}_encrypted`] = true;
        } catch {
          console.warn(`[lead-repository] Failed to encrypt contact field: ${field}`);
          encrypted.contact[`_${field}_encrypted`] = false;
        }
      }
    }
  }

  return encrypted;
}

/**
 * Decrypts sensitive PII fields on a lead object after retrieval
 * @param {object} lead - Lead object with potentially encrypted fields
 * @returns {Promise<object>} Lead with sensitive fields decrypted
 */
async function decryptSensitiveFields(lead) {
  if (!lead) return lead;

  const decrypted = { ...lead };

  for (const field of SENSITIVE_FIELDS) {
    if (decrypted[`_${field}_encrypted`] === true && decrypted[field]) {
      try {
        decrypted[field] = await decrypt(decrypted[field]);
      } catch {
        console.warn(`[lead-repository] Failed to decrypt field: ${field}`);
      }
    }
    delete decrypted[`_${field}_encrypted`];
  }

  // Decrypt nested contact fields
  if (decrypted.contact && typeof decrypted.contact === 'object') {
    decrypted.contact = { ...decrypted.contact };

    for (const field of SENSITIVE_CONTACT_FIELDS) {
      if (decrypted.contact[`_${field}_encrypted`] === true && decrypted.contact[field]) {
        try {
          decrypted.contact[field] = await decrypt(decrypted.contact[field]);
        } catch {
          console.warn(`[lead-repository] Failed to decrypt contact field: ${field}`);
        }
      }
      delete decrypted.contact[`_${field}_encrypted`];
    }
  }

  return decrypted;
}

/**
 * Retrieves all leads from IndexedDB with optional filtering and pagination
 *
 * @param {object} [options]
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @param {string[]} [options.status] - Filter by status values
 * @param {string} [options.platform] - Filter by platform
 * @param {string} [options.intent] - Filter by intent
 * @param {string} [options.assignedTo] - Filter by assigned agent
 * @param {string} [options.sortBy='createdAt'] - Field to sort by
 * @param {string} [options.sortOrder='desc'] - Sort order ('asc' or 'desc')
 * @returns {Promise<{ leads: object[], total: number, page: number, pageSize: number }>}
 */
export async function getAllLeads(options = {}) {
  const {
    page = 1,
    pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
    status,
    platform,
    intent,
    assignedTo,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const db = await openDB();
  const tx = db.transaction(STORES.LEADS, 'readonly');
  const store = tx.objectStore(STORES.LEADS);

  let allLeads = await store.getAll();

  await tx.done;

  // Apply status filter
  if (status && Array.isArray(status) && status.length > 0) {
    allLeads = allLeads.filter((lead) => status.includes(lead.status));
  }

  // Apply platform filter
  if (platform) {
    allLeads = allLeads.filter((lead) => lead.platform === platform);
  }

  // Apply intent filter
  if (intent) {
    allLeads = allLeads.filter((lead) => lead.intent === intent);
  }

  // Apply assignedTo filter
  if (assignedTo) {
    allLeads = allLeads.filter((lead) => lead.assignedTo === assignedTo);
  }

  // Sort results
  allLeads.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    // Handle timestamp comparison
    if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    }

    // Handle numeric comparison for score
    if (sortBy === 'score') {
      aVal = typeof aVal === 'number' ? aVal : 0;
      bVal = typeof bVal === 'number' ? bVal : 0;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const total = allLeads.length;

  // Apply pagination
  const clampedPageSize = Math.min(
    Math.max(1, pageSize),
    PAGINATION.MAX_PAGE_SIZE
  );
  const clampedPage = Math.max(1, page);
  const startIndex = (clampedPage - 1) * clampedPageSize;
  const paginatedLeads = allLeads.slice(startIndex, startIndex + clampedPageSize);

  // Decrypt sensitive fields for each lead
  const decryptedLeads = await Promise.all(
    paginatedLeads.map((lead) => decryptSensitiveFields(lead))
  );

  return {
    leads: decryptedLeads,
    total,
    page: clampedPage,
    pageSize: clampedPageSize,
  };
}

/**
 * Retrieves a single lead by its ID
 *
 * @param {string} id - Lead identifier
 * @returns {Promise<object|null>} Lead object or null if not found
 */
export async function getLeadById(id) {
  if (!id) return null;

  const db = await openDB();
  const tx = db.transaction(STORES.LEADS, 'readonly');
  const store = tx.objectStore(STORES.LEADS);

  const lead = await store.get(id);

  await tx.done;

  if (!lead) return null;

  return decryptSensitiveFields(lead);
}

/**
 * Saves a lead to IndexedDB (insert or update)
 * Encrypts PII fields before storage
 *
 * @param {object} lead - Lead object to save
 * @param {string} lead.id - Unique lead identifier
 * @param {string} lead.name - Contact name
 * @param {string} [lead.handle] - Social media handle
 * @param {string} [lead.platform] - Platform identifier
 * @param {object} [lead.contact] - Contact information
 * @param {string} [lead.contact.email] - Contact email
 * @param {string} [lead.contact.phone] - Contact phone
 * @param {object} [lead.budget] - Budget range
 * @param {number} [lead.budget.min] - Minimum budget
 * @param {number} [lead.budget.max] - Maximum budget
 * @param {string} [lead.location] - Preferred location
 * @param {string} [lead.intent] - Lead intent
 * @param {string} [lead.inquiryType] - Type of inquiry
 * @param {number} [lead.score] - Lead score (0-100)
 * @param {string} [lead.sentiment] - Sentiment label
 * @param {string} [lead.status] - Lead status
 * @param {string} [lead.assignedTo] - Assigned agent ID
 * @param {string[]} [lead.propertyInterests] - Property IDs of interest
 * @param {string} [lead.notes] - Additional notes
 * @param {boolean} [lead.hasConsent] - Consent status
 * @param {string} [lead.consentDate] - Date consent was given
 * @param {string} [lead.consentSource] - Source of consent
 * @returns {Promise<object>} Saved lead object (decrypted)
 */
export async function saveLead(lead) {
  if (!lead || typeof lead !== 'object') {
    throw new Error('Lead data must be a non-null object');
  }

  if (!lead.id) {
    throw new Error('Lead must have an id');
  }

  // Validate status if provided
  if (lead.status && !STATUS_LIST.includes(lead.status)) {
    throw new Error(`Invalid lead status: ${lead.status}. Must be one of: ${STATUS_LIST.join(', ')}`);
  }

  // Validate score if provided
  if (lead.score !== undefined && lead.score !== null) {
    if (typeof lead.score !== 'number' || lead.score < 0 || lead.score > 100) {
      throw new Error('Lead score must be a number between 0 and 100');
    }
  }

  // Sanitize text fields before encryption
  const sanitizedLead = { ...lead };
  if (sanitizedLead.name && typeof sanitizedLead.name === 'string') {
    sanitizedLead.name = sanitizeInput(sanitizedLead.name);
  }
  if (sanitizedLead.notes && typeof sanitizedLead.notes === 'string') {
    sanitizedLead.notes = sanitizeInput(sanitizedLead.notes);
  }

  // Set timestamps
  const now = new Date().toISOString();
  sanitizedLead.createdAt = sanitizedLead.createdAt || now;
  sanitizedLead.updatedAt = now;

  // Encrypt PII fields
  const encryptedLead = await encryptSensitiveFields(sanitizedLead);

  const db = await openDB();
  const tx = db.transaction(STORES.LEADS, 'readwrite');
  const store = tx.objectStore(STORES.LEADS);

  await store.put(encryptedLead);
  await tx.done;

  // Return the decrypted version
  return decryptSensitiveFields(encryptedLead);
}

/**
 * Saves multiple leads to IndexedDB in a single transaction
 *
 * @param {object[]} leads - Array of lead objects to save
 * @returns {Promise<object[]>} Array of saved lead objects (decrypted)
 */
export async function saveLeads(leads) {
  if (!Array.isArray(leads)) {
    throw new Error('Leads must be an array');
  }

  if (leads.length === 0) return [];

  // Validate and encrypt all leads
  const encryptedLeads = await Promise.all(
    leads.map(async (lead) => {
      if (!lead || !lead.id) {
        throw new Error('Each lead must have an id');
      }

      if (lead.status && !STATUS_LIST.includes(lead.status)) {
        throw new Error(
          `Invalid lead status: ${lead.status}. Must be one of: ${STATUS_LIST.join(', ')}`
        );
      }

      if (lead.score !== undefined && lead.score !== null) {
        if (typeof lead.score !== 'number' || lead.score < 0 || lead.score > 100) {
          throw new Error('Lead score must be a number between 0 and 100');
        }
      }

      const sanitizedLead = { ...lead };
      if (sanitizedLead.name && typeof sanitizedLead.name === 'string') {
        sanitizedLead.name = sanitizeInput(sanitizedLead.name);
      }
      if (sanitizedLead.notes && typeof sanitizedLead.notes === 'string') {
        sanitizedLead.notes = sanitizeInput(sanitizedLead.notes);
      }

      const now = new Date().toISOString();
      sanitizedLead.createdAt = sanitizedLead.createdAt || now;
      sanitizedLead.updatedAt = now;

      return encryptSensitiveFields(sanitizedLead);
    })
  );

  const db = await openDB();
  const tx = db.transaction(STORES.LEADS, 'readwrite');
  const store = tx.objectStore(STORES.LEADS);

  for (const encryptedLead of encryptedLeads) {
    await store.put(encryptedLead);
  }

  await tx.done;

  // Return decrypted versions
  return Promise.all(encryptedLeads.map((lead) => decryptSensitiveFields(lead)));
}

/**
 * Updates an existing lead in IndexedDB
 * Merges provided fields into the existing lead record
 *
 * @param {object} lead - Lead object with updates
 * @param {string} lead.id - Lead identifier (required for update)
 * @param {string} [lead.name] - Updated name
 * @param {number} [lead.score] - Updated score
 * @param {string} [lead.status] - Updated status
 * @param {string} [lead.sentiment] - Updated sentiment
 * @param {string} [lead.assignedTo] - Updated assigned agent
 * @param {string[]} [lead.propertyInterests] - Updated property interests
 * @param {string} [lead.notes] - Updated notes
 * @param {string} [lead.salesforceId] - Salesforce record ID
 * @param {string} [lead.syncStatus] - Salesforce sync status
 * @returns {Promise<object>} Updated lead object (decrypted)
 * @throws {Error} If lead not found or validation fails
 */
export async function updateLead(lead) {
  if (!lead || typeof lead !== 'object') {
    throw new Error('Lead data must be a non-null object');
  }

  if (!lead.id) {
    throw new Error('Lead must have an id for update');
  }

  if (lead.status && !STATUS_LIST.includes(lead.status)) {
    throw new Error(`Invalid lead status: ${lead.status}. Must be one of: ${STATUS_LIST.join(', ')}`);
  }

  if (lead.score !== undefined && lead.score !== null) {
    if (typeof lead.score !== 'number' || lead.score < 0 || lead.score > 100) {
      throw new Error('Lead score must be a number between 0 and 100');
    }
  }

  const db = await openDB();
  const tx = db.transaction(STORES.LEADS, 'readwrite');
  const store = tx.objectStore(STORES.LEADS);

  const existing = await store.get(lead.id);

  if (!existing) {
    await tx.done;
    throw new Error(`Lead not found: ${lead.id}`);
  }

  // Merge updates into existing lead
  const updatedLead = { ...existing };

  if (lead.name !== undefined) {
    updatedLead.name = typeof lead.name === 'string'
      ? sanitizeInput(lead.name)
      : lead.name;
    updatedLead._name_encrypted = false;
  }

  if (lead.handle !== undefined) {
    updatedLead.handle = lead.handle;
    updatedLead._handle_encrypted = false;
  }

  if (lead.platform !== undefined) {
    updatedLead.platform = lead.platform;
  }

  if (lead.contact !== undefined) {
    updatedLead.contact = lead.contact;
  }

  if (lead.budget !== undefined) {
    updatedLead.budget = lead.budget;
  }

  if (lead.location !== undefined) {
    updatedLead.location = lead.location;
  }

  if (lead.intent !== undefined) {
    updatedLead.intent = lead.intent;
  }

  if (lead.inquiryType !== undefined) {
    updatedLead.inquiryType = lead.inquiryType;
  }

  if (lead.score !== undefined) {
    updatedLead.score = lead.score;
  }

  if (lead.sentiment !== undefined) {
    updatedLead.sentiment = lead.sentiment;
  }

  if (lead.status !== undefined) {
    updatedLead.status = lead.status;
  }

  if (lead.assignedTo !== undefined) {
    updatedLead.assignedTo = lead.assignedTo;
  }

  if (lead.propertyInterests !== undefined) {
    updatedLead.propertyInterests = lead.propertyInterests;
  }

  if (lead.notes !== undefined) {
    updatedLead.notes = typeof lead.notes === 'string'
      ? sanitizeInput(lead.notes)
      : lead.notes;
  }

  if (lead.hasConsent !== undefined) {
    updatedLead.hasConsent = lead.hasConsent;
  }

  if (lead.consentDate !== undefined) {
    updatedLead.consentDate = lead.consentDate;
  }

  if (lead.consentSource !== undefined) {
    updatedLead.consentSource = lead.consentSource;
  }

  if (lead.salesforceId !== undefined) {
    updatedLead.salesforceId = lead.salesforceId;
  }

  if (lead.syncStatus !== undefined) {
    updatedLead.syncStatus = lead.syncStatus;
  }

  updatedLead.updatedAt = new Date().toISOString();

  // Encrypt PII fields
  const encryptedLead = await encryptSensitiveFields(updatedLead);

  await store.put(encryptedLead);
  await tx.done;

  return decryptSensitiveFields(encryptedLead);
}

/**
 * Updates the status of a lead
 *
 * @param {string} id - Lead identifier
 * @param {string} status - New status value (must be a valid STATUS)
 * @returns {Promise<object>} Updated lead object (decrypted)
 * @throws {Error} If lead not found or status is invalid
 */
export async function updateLeadStatus(id, status) {
  if (!id) {
    throw new Error('Lead id is required');
  }

  if (!STATUS_LIST.includes(status)) {
    throw new Error(
      `Invalid lead status: ${status}. Must be one of: ${STATUS_LIST.join(', ')}`
    );
  }

  const db = await openDB();
  const tx = db.transaction(STORES.LEADS, 'readwrite');
  const store = tx.objectStore(STORES.LEADS);

  const existing = await store.get(id);

  if (!existing) {
    await tx.done;
    throw new Error(`Lead not found: ${id}`);
  }

  existing.status = status;
  existing.updatedAt = new Date().toISOString();

  await store.put(existing);
  await tx.done;

  return decryptSensitiveFields(existing);
}

/**
 * Retrieves leads by status using the IndexedDB index
 *
 * @param {string} status - Status to filter by
 * @returns {Promise<object[]>} Array of lead objects matching the status
 */
export async function getLeadsByStatus(status) {
  if (!status || !STATUS_LIST.includes(status)) {
    throw new Error(
      `Invalid lead status: ${status}. Must be one of: ${STATUS_LIST.join(', ')}`
    );
  }

  const db = await openDB();
  const tx = db.transaction(STORES.LEADS, 'readonly');
  const store = tx.objectStore(STORES.LEADS);
  const index = store.index('by-status');

  const leads = await index.getAll(status);

  await tx.done;

  return Promise.all(leads.map((lead) => decryptSensitiveFields(lead)));
}

/**
 * Retrieves high-priority leads (score >= LEAD_SCORE.HOT threshold)
 * Sorted by score descending
 *
 * @param {object} [options]
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @returns {Promise<{ leads: object[], total: number, page: number, pageSize: number }>}
 */
export async function getHighPriorityLeads(options = {}) {
  const {
    page = 1,
    pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
  } = options;

  const db = await openDB();
  const tx = db.transaction(STORES.LEADS, 'readonly');
  const store = tx.objectStore(STORES.LEADS);

  const allLeads = await store.getAll();

  await tx.done;

  // Filter leads with score >= HOT threshold
  let highPriorityLeads = allLeads.filter(
    (lead) => typeof lead.score === 'number' && lead.score >= LEAD_SCORE.HOT
  );

  // Sort by score descending
  highPriorityLeads.sort((a, b) => {
    const aScore = typeof a.score === 'number' ? a.score : 0;
    const bScore = typeof b.score === 'number' ? b.score : 0;
    return bScore - aScore;
  });

  const total = highPriorityLeads.length;

  // Apply pagination
  const clampedPageSize = Math.min(
    Math.max(1, pageSize),
    PAGINATION.MAX_PAGE_SIZE
  );
  const clampedPage = Math.max(1, page);
  const startIndex = (clampedPage - 1) * clampedPageSize;
  const paginatedLeads = highPriorityLeads.slice(startIndex, startIndex + clampedPageSize);

  // Decrypt sensitive fields for each lead
  const decryptedLeads = await Promise.all(
    paginatedLeads.map((lead) => decryptSensitiveFields(lead))
  );

  return {
    leads: decryptedLeads,
    total,
    page: clampedPage,
    pageSize: clampedPageSize,
  };
}

/**
 * Retrieves leads by assigned agent using the IndexedDB index
 *
 * @param {string} agentId - Agent identifier
 * @returns {Promise<object[]>} Array of lead objects assigned to the agent
 */
export async function getLeadsByAssignedAgent(agentId) {
  if (!agentId) return [];

  const db = await openDB();
  const tx = db.transaction(STORES.LEADS, 'readonly');
  const store = tx.objectStore(STORES.LEADS);
  const index = store.index('by-assignedTo');

  const leads = await index.getAll(agentId);

  await tx.done;

  return Promise.all(leads.map((lead) => decryptSensitiveFields(lead)));
}

/**
 * Retrieves leads by sender handle using the IndexedDB index
 *
 * @param {string} handle - Sender handle to filter by
 * @returns {Promise<object[]>} Array of lead objects from the sender
 */
export async function getLeadsByHandle(handle) {
  if (!handle) return [];

  const db = await openDB();
  const tx = db.transaction(STORES.LEADS, 'readonly');
  const store = tx.objectStore(STORES.LEADS);
  const index = store.index('by-handle');

  const leads = await index.getAll(handle);

  await tx.done;

  return Promise.all(leads.map((lead) => decryptSensitiveFields(lead)));
}

/**
 * Searches leads by matching query text against name, handle, location, and notes
 * PII fields are decrypted before matching
 *
 * @param {string} query - Search query string
 * @param {object} [options]
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @param {string[]} [options.status] - Filter by status values
 * @param {string} [options.platform] - Filter by platform
 * @returns {Promise<{ leads: object[], total: number, page: number, pageSize: number }>}
 */
export async function searchLeads(query, options = {}) {
  const {
    page = 1,
    pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
    status,
    platform,
  } = options;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return getAllLeads(options);
  }

  const sanitizedQuery = sanitizeInput(query.trim()).toLowerCase();

  const db = await openDB();
  const tx = db.transaction(STORES.LEADS, 'readonly');
  const store = tx.objectStore(STORES.LEADS);

  const allLeads = await store.getAll();

  await tx.done;

  // Decrypt all leads for search matching
  const decryptedLeads = await Promise.all(
    allLeads.map((lead) => decryptSensitiveFields(lead))
  );

  // Filter by search query
  let matchedLeads = decryptedLeads.filter((lead) => {
    const name = (lead.name || '').toLowerCase();
    const handle = (lead.handle || '').toLowerCase();
    const location = (lead.location || '').toLowerCase();
    const notes = (lead.notes || '').toLowerCase();
    const intent = (lead.intent || '').toLowerCase();
    const inquiryType = (lead.inquiryType || '').toLowerCase();

    return (
      name.includes(sanitizedQuery) ||
      handle.includes(sanitizedQuery) ||
      location.includes(sanitizedQuery) ||
      notes.includes(sanitizedQuery) ||
      intent.includes(sanitizedQuery) ||
      inquiryType.includes(sanitizedQuery)
    );
  });

  // Apply status filter
  if (status && Array.isArray(status) && status.length > 0) {
    matchedLeads = matchedLeads.filter((lead) => status.includes(lead.status));
  }

  // Apply platform filter
  if (platform) {
    matchedLeads = matchedLeads.filter((lead) => lead.platform === platform);
  }

  // Sort by score descending (highest priority first)
  matchedLeads.sort((a, b) => {
    const aScore = typeof a.score === 'number' ? a.score : 0;
    const bScore = typeof b.score === 'number' ? b.score : 0;
    return bScore - aScore;
  });

  const total = matchedLeads.length;

  // Apply pagination
  const clampedPageSize = Math.min(
    Math.max(1, pageSize),
    PAGINATION.MAX_PAGE_SIZE
  );
  const clampedPage = Math.max(1, page);
  const startIndex = (clampedPage - 1) * clampedPageSize;
  const paginatedLeads = matchedLeads.slice(startIndex, startIndex + clampedPageSize);

  return {
    leads: paginatedLeads,
    total,
    page: clampedPage,
    pageSize: clampedPageSize,
  };
}

/**
 * Deletes a lead by its ID
 *
 * @param {string} id - Lead identifier
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function deleteLead(id) {
  if (!id) return false;

  const db = await openDB();
  const tx = db.transaction(STORES.LEADS, 'readwrite');
  const store = tx.objectStore(STORES.LEADS);

  const existing = await store.get(id);

  if (!existing) {
    await tx.done;
    return false;
  }

  await store.delete(id);
  await tx.done;

  return true;
}

/**
 * Returns the total count of leads, optionally filtered by status
 *
 * @param {string} [status] - Optional status filter
 * @returns {Promise<number>} Count of leads
 */
export async function getLeadCount(status) {
  const db = await openDB();
  const tx = db.transaction(STORES.LEADS, 'readonly');
  const store = tx.objectStore(STORES.LEADS);

  let count;

  if (status && STATUS_LIST.includes(status)) {
    const index = store.index('by-status');
    count = await index.count(status);
  } else {
    count = await store.count();
  }

  await tx.done;

  return count;
}

/**
 * Retrieves leads by intent using the IndexedDB index
 *
 * @param {string} intent - Intent to filter by
 * @returns {Promise<object[]>} Array of lead objects matching the intent
 */
export async function getLeadsByIntent(intent) {
  if (!intent) return [];

  const db = await openDB();
  const tx = db.transaction(STORES.LEADS, 'readonly');
  const store = tx.objectStore(STORES.LEADS);
  const index = store.index('by-intent');

  const leads = await index.getAll(intent);

  await tx.done;

  return Promise.all(leads.map((lead) => decryptSensitiveFields(lead)));
}

/**
 * Retrieves leads by platform using the IndexedDB index
 *
 * @param {string} platform - Platform to filter by
 * @returns {Promise<object[]>} Array of lead objects matching the platform
 */
export async function getLeadsByPlatform(platform) {
  if (!platform) return [];

  const db = await openDB();
  const tx = db.transaction(STORES.LEADS, 'readonly');
  const store = tx.objectStore(STORES.LEADS);
  const index = store.index('by-platform');

  const leads = await index.getAll(platform);

  await tx.done;

  return Promise.all(leads.map((lead) => decryptSensitiveFields(lead)));
}