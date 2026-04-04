import { openDB, STORES } from '@/repositories/db';
import { STATUS, STATUS_LIST, PAGINATION } from '@/utils/constants';
import { encrypt, decrypt } from '@/utils/encryption';
import { sanitizeInput } from '@/utils/validators';

/**
 * Draft data access layer
 * Provides CRUD operations for drafts in IndexedDB
 * Handles encryption of sensitive draft content
 * Stores draft content, confidence score, context references, and edit history
 */

/**
 * Fields that contain sensitive content and should be encrypted at rest
 */
const SENSITIVE_FIELDS = ['content'];

/**
 * Valid draft statuses for state machine transitions
 */
const DRAFT_STATUS = Object.freeze({
  GENERATED: 'generated',
  EDITED: 'edited',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SENT: 'sent',
});

const DRAFT_STATUS_LIST = Object.freeze(Object.values(DRAFT_STATUS));

/**
 * Encrypts sensitive fields on a draft object before storage
 * @param {object} draft - Draft object to encrypt
 * @returns {Promise<object>} Draft with sensitive fields encrypted
 */
async function encryptSensitiveFields(draft) {
  if (!draft) return draft;

  const encrypted = { ...draft };

  for (const field of SENSITIVE_FIELDS) {
    if (encrypted[field] !== undefined && encrypted[field] !== null) {
      try {
        encrypted[field] = await encrypt(encrypted[field]);
        encrypted[`_${field}_encrypted`] = true;
      } catch {
        // If encryption fails, store as-is but log warning
        console.warn(`[draft-repository] Failed to encrypt field: ${field}`);
        encrypted[`_${field}_encrypted`] = false;
      }
    }
  }

  // Encrypt edit history content entries
  if (Array.isArray(encrypted.editHistory)) {
    encrypted.editHistory = await Promise.all(
      encrypted.editHistory.map(async (entry) => {
        if (entry.content) {
          try {
            return {
              ...entry,
              content: await encrypt(entry.content),
              _content_encrypted: true,
            };
          } catch {
            console.warn('[draft-repository] Failed to encrypt edit history entry');
            return { ...entry, _content_encrypted: false };
          }
        }
        return entry;
      })
    );
  }

  return encrypted;
}

/**
 * Decrypts sensitive fields on a draft object after retrieval
 * @param {object} draft - Draft object with potentially encrypted fields
 * @returns {Promise<object>} Draft with sensitive fields decrypted
 */
async function decryptSensitiveFields(draft) {
  if (!draft) return draft;

  const decrypted = { ...draft };

  for (const field of SENSITIVE_FIELDS) {
    if (decrypted[`_${field}_encrypted`] === true && decrypted[field]) {
      try {
        decrypted[field] = await decrypt(decrypted[field]);
      } catch {
        console.warn(`[draft-repository] Failed to decrypt field: ${field}`);
      }
    }
    // Clean up encryption metadata from returned object
    delete decrypted[`_${field}_encrypted`];
  }

  // Decrypt edit history content entries
  if (Array.isArray(decrypted.editHistory)) {
    decrypted.editHistory = await Promise.all(
      decrypted.editHistory.map(async (entry) => {
        if (entry._content_encrypted === true && entry.content) {
          try {
            const decryptedEntry = { ...entry };
            decryptedEntry.content = await decrypt(entry.content);
            delete decryptedEntry._content_encrypted;
            return decryptedEntry;
          } catch {
            console.warn('[draft-repository] Failed to decrypt edit history entry');
            const cleaned = { ...entry };
            delete cleaned._content_encrypted;
            return cleaned;
          }
        }
        const cleaned = { ...entry };
        delete cleaned._content_encrypted;
        return cleaned;
      })
    );
  }

  return decrypted;
}

/**
 * Retrieves all drafts from IndexedDB with optional filtering and pagination
 *
 * @param {object} [options]
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @param {string} [options.status] - Filter by draft status
 * @param {string} [options.sortBy='createdAt'] - Field to sort by
 * @param {string} [options.sortOrder='desc'] - Sort order ('asc' or 'desc')
 * @returns {Promise<{ drafts: object[], total: number, page: number, pageSize: number }>}
 */
export async function getAllDrafts(options = {}) {
  const {
    page = 1,
    pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const db = await openDB();
  const tx = db.transaction(STORES.DRAFTS, 'readonly');
  const store = tx.objectStore(STORES.DRAFTS);

  let allDrafts = await store.getAll();

  await tx.done;

  // Apply status filter
  if (status) {
    if (Array.isArray(status)) {
      allDrafts = allDrafts.filter((draft) => status.includes(draft.status));
    } else {
      allDrafts = allDrafts.filter((draft) => draft.status === status);
    }
  }

  // Sort results
  allDrafts.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    // Handle timestamp comparison
    if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    }

    // Handle numeric comparison for confidence
    if (sortBy === 'confidence') {
      aVal = typeof aVal === 'number' ? aVal : 0;
      bVal = typeof bVal === 'number' ? bVal : 0;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const total = allDrafts.length;

  // Apply pagination
  const clampedPageSize = Math.min(
    Math.max(1, pageSize),
    PAGINATION.MAX_PAGE_SIZE
  );
  const clampedPage = Math.max(1, page);
  const startIndex = (clampedPage - 1) * clampedPageSize;
  const paginatedDrafts = allDrafts.slice(startIndex, startIndex + clampedPageSize);

  // Decrypt sensitive fields for each draft
  const decryptedDrafts = await Promise.all(
    paginatedDrafts.map((draft) => decryptSensitiveFields(draft))
  );

  return {
    drafts: decryptedDrafts,
    total,
    page: clampedPage,
    pageSize: clampedPageSize,
  };
}

/**
 * Retrieves a single draft by its ID
 *
 * @param {number|string} id - Draft identifier
 * @returns {Promise<object|null>} Draft object or null if not found
 */
export async function getDraftById(id) {
  if (id === undefined || id === null) return null;

  const db = await openDB();
  const tx = db.transaction(STORES.DRAFTS, 'readonly');
  const store = tx.objectStore(STORES.DRAFTS);

  const draft = await store.get(id);

  await tx.done;

  if (!draft) return null;

  return decryptSensitiveFields(draft);
}

/**
 * Retrieves the most recent draft associated with a DM ID
 *
 * @param {string} dmId - DM identifier
 * @returns {Promise<object|null>} Most recent draft for the DM, or null if none found
 */
export async function getDraftByDMId(dmId) {
  if (!dmId) return null;

  const db = await openDB();
  const tx = db.transaction(STORES.DRAFTS, 'readonly');
  const store = tx.objectStore(STORES.DRAFTS);
  const index = store.index('by-dmId');

  const drafts = await index.getAll(dmId);

  await tx.done;

  if (!drafts || drafts.length === 0) return null;

  // Sort by createdAt descending to get the most recent draft
  drafts.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  return decryptSensitiveFields(drafts[0]);
}

/**
 * Retrieves all drafts associated with a DM ID
 *
 * @param {string} dmId - DM identifier
 * @returns {Promise<object[]>} Array of draft objects for the DM
 */
export async function getDraftsByDMId(dmId) {
  if (!dmId) return [];

  const db = await openDB();
  const tx = db.transaction(STORES.DRAFTS, 'readonly');
  const store = tx.objectStore(STORES.DRAFTS);
  const index = store.index('by-dmId');

  const drafts = await index.getAll(dmId);

  await tx.done;

  if (!drafts || drafts.length === 0) return [];

  // Sort by createdAt descending
  drafts.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  return Promise.all(drafts.map((draft) => decryptSensitiveFields(draft)));
}

/**
 * Saves a new draft to IndexedDB
 * Encrypts sensitive content before storage
 *
 * @param {object} draft - Draft object to save
 * @param {string} draft.dmId - Associated DM identifier
 * @param {string} draft.content - Draft reply content
 * @param {number} draft.confidence - Confidence score (0-1)
 * @param {string} [draft.confidenceExplanation] - Explanation for confidence score
 * @param {string} [draft.status='generated'] - Draft status
 * @param {string} [draft.templateId] - Template ID used for generation
 * @param {object} [draft.contextReferences] - References to knowledge base items used
 * @param {string} [draft.createdBy] - User who created the draft
 * @returns {Promise<object>} Saved draft object (decrypted) with auto-generated ID
 */
export async function saveDraft(draft) {
  if (!draft || typeof draft !== 'object') {
    throw new Error('Draft data must be a non-null object');
  }

  if (!draft.dmId) {
    throw new Error('Draft must have a dmId');
  }

  if (draft.content === undefined || draft.content === null) {
    throw new Error('Draft must have content');
  }

  if (draft.confidence !== undefined && draft.confidence !== null) {
    if (typeof draft.confidence !== 'number' || draft.confidence < 0 || draft.confidence > 1) {
      throw new Error('Draft confidence must be a number between 0 and 1');
    }
  }

  if (draft.status && !DRAFT_STATUS_LIST.includes(draft.status)) {
    throw new Error(
      `Invalid draft status: ${draft.status}. Must be one of: ${DRAFT_STATUS_LIST.join(', ')}`
    );
  }

  // Sanitize content before encryption
  const sanitizedDraft = { ...draft };
  if (typeof sanitizedDraft.content === 'string') {
    sanitizedDraft.content = sanitizeInput(sanitizedDraft.content);
  }

  // Set timestamps
  const now = new Date().toISOString();
  sanitizedDraft.createdAt = sanitizedDraft.createdAt || now;
  sanitizedDraft.updatedAt = now;

  // Set default status
  sanitizedDraft.status = sanitizedDraft.status || DRAFT_STATUS.GENERATED;

  // Initialize edit history
  if (!Array.isArray(sanitizedDraft.editHistory)) {
    sanitizedDraft.editHistory = [];
  }

  // Encrypt sensitive fields
  const encryptedDraft = await encryptSensitiveFields(sanitizedDraft);

  const db = await openDB();
  const tx = db.transaction(STORES.DRAFTS, 'readwrite');
  const store = tx.objectStore(STORES.DRAFTS);

  // Auto-increment ID is handled by IndexedDB
  const id = await store.add(encryptedDraft);
  await tx.done;

  // Retrieve the saved draft with its generated ID
  const savedDraft = await getDraftById(id);
  return savedDraft;
}

/**
 * Updates an existing draft in IndexedDB
 * Appends previous content to edit history before updating
 *
 * @param {object} draft - Draft object with updates
 * @param {number|string} draft.id - Draft identifier (required for update)
 * @param {string} [draft.content] - Updated draft content
 * @param {string} [draft.status] - Updated draft status
 * @param {number} [draft.confidence] - Updated confidence score
 * @param {string} [draft.confidenceExplanation] - Updated confidence explanation
 * @param {object} [draft.contextReferences] - Updated context references
 * @returns {Promise<object>} Updated draft object (decrypted)
 * @throws {Error} If draft not found or validation fails
 */
export async function updateDraft(draft) {
  if (!draft || typeof draft !== 'object') {
    throw new Error('Draft data must be a non-null object');
  }

  if (draft.id === undefined || draft.id === null) {
    throw new Error('Draft must have an id for update');
  }

  if (draft.confidence !== undefined && draft.confidence !== null) {
    if (typeof draft.confidence !== 'number' || draft.confidence < 0 || draft.confidence > 1) {
      throw new Error('Draft confidence must be a number between 0 and 1');
    }
  }

  if (draft.status && !DRAFT_STATUS_LIST.includes(draft.status)) {
    throw new Error(
      `Invalid draft status: ${draft.status}. Must be one of: ${DRAFT_STATUS_LIST.join(', ')}`
    );
  }

  const db = await openDB();
  const tx = db.transaction(STORES.DRAFTS, 'readwrite');
  const store = tx.objectStore(STORES.DRAFTS);

  const existing = await store.get(draft.id);

  if (!existing) {
    await tx.done;
    throw new Error(`Draft not found: ${draft.id}`);
  }

  // If content is being changed, record the previous content in edit history
  if (draft.content !== undefined && draft.content !== existing.content) {
    // Decrypt existing content for history entry
    let previousContent = existing.content;
    if (existing._content_encrypted === true && existing.content) {
      try {
        previousContent = await decrypt(existing.content);
      } catch {
        console.warn('[draft-repository] Failed to decrypt previous content for edit history');
      }
    }

    if (!Array.isArray(existing.editHistory)) {
      existing.editHistory = [];
    }

    existing.editHistory.push({
      content: previousContent,
      status: existing.status,
      editedAt: new Date().toISOString(),
      editedBy: draft.editedBy || null,
    });
  }

  // Merge updates into existing draft
  const updatedDraft = { ...existing };

  if (draft.content !== undefined) {
    updatedDraft.content = typeof draft.content === 'string'
      ? sanitizeInput(draft.content)
      : draft.content;
    // Reset encryption flag since we have new plaintext content
    updatedDraft._content_encrypted = false;
  }

  if (draft.status !== undefined) {
    updatedDraft.status = draft.status;
  }

  if (draft.confidence !== undefined) {
    updatedDraft.confidence = draft.confidence;
  }

  if (draft.confidenceExplanation !== undefined) {
    updatedDraft.confidenceExplanation = draft.confidenceExplanation;
  }

  if (draft.contextReferences !== undefined) {
    updatedDraft.contextReferences = draft.contextReferences;
  }

  if (draft.templateId !== undefined) {
    updatedDraft.templateId = draft.templateId;
  }

  updatedDraft.updatedAt = new Date().toISOString();

  // Encrypt sensitive fields
  const encryptedDraft = await encryptSensitiveFields(updatedDraft);

  await store.put(encryptedDraft);
  await tx.done;

  return decryptSensitiveFields(encryptedDraft);
}

/**
 * Updates the status of a draft
 *
 * @param {number|string} id - Draft identifier
 * @param {string} status - New status value
 * @param {string} [userId] - User performing the status change
 * @returns {Promise<object>} Updated draft object (decrypted)
 * @throws {Error} If draft not found or status is invalid
 */
export async function updateDraftStatus(id, status, userId) {
  if (id === undefined || id === null) {
    throw new Error('Draft id is required');
  }

  if (!DRAFT_STATUS_LIST.includes(status)) {
    throw new Error(
      `Invalid draft status: ${status}. Must be one of: ${DRAFT_STATUS_LIST.join(', ')}`
    );
  }

  const db = await openDB();
  const tx = db.transaction(STORES.DRAFTS, 'readwrite');
  const store = tx.objectStore(STORES.DRAFTS);

  const existing = await store.get(id);

  if (!existing) {
    await tx.done;
    throw new Error(`Draft not found: ${id}`);
  }

  existing.status = status;
  existing.updatedAt = new Date().toISOString();

  if (userId) {
    if (!Array.isArray(existing.editHistory)) {
      existing.editHistory = [];
    }

    existing.editHistory.push({
      status,
      editedAt: existing.updatedAt,
      editedBy: userId,
    });
  }

  await store.put(existing);
  await tx.done;

  return decryptSensitiveFields(existing);
}

/**
 * Deletes a draft by its ID
 *
 * @param {number|string} id - Draft identifier
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function deleteDraft(id) {
  if (id === undefined || id === null) return false;

  const db = await openDB();
  const tx = db.transaction(STORES.DRAFTS, 'readwrite');
  const store = tx.objectStore(STORES.DRAFTS);

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
 * Deletes all drafts associated with a DM ID
 *
 * @param {string} dmId - DM identifier
 * @returns {Promise<number>} Number of drafts deleted
 */
export async function deleteDraftsByDMId(dmId) {
  if (!dmId) return 0;

  const db = await openDB();
  const tx = db.transaction(STORES.DRAFTS, 'readwrite');
  const store = tx.objectStore(STORES.DRAFTS);
  const index = store.index('by-dmId');

  const drafts = await index.getAll(dmId);

  if (!drafts || drafts.length === 0) {
    await tx.done;
    return 0;
  }

  for (const draft of drafts) {
    await store.delete(draft.id);
  }

  await tx.done;

  return drafts.length;
}

/**
 * Retrieves drafts by status using the IndexedDB index
 *
 * @param {string} status - Status to filter by
 * @returns {Promise<object[]>} Array of draft objects matching the status
 */
export async function getDraftsByStatus(status) {
  if (!status || !DRAFT_STATUS_LIST.includes(status)) {
    throw new Error(
      `Invalid draft status: ${status}. Must be one of: ${DRAFT_STATUS_LIST.join(', ')}`
    );
  }

  const db = await openDB();
  const tx = db.transaction(STORES.DRAFTS, 'readonly');
  const store = tx.objectStore(STORES.DRAFTS);
  const index = store.index('by-status');

  const drafts = await index.getAll(status);

  await tx.done;

  return Promise.all(drafts.map((draft) => decryptSensitiveFields(draft)));
}

/**
 * Retrieves drafts by template ID using the IndexedDB index
 *
 * @param {string} templateId - Template identifier
 * @returns {Promise<object[]>} Array of draft objects using the template
 */
export async function getDraftsByTemplateId(templateId) {
  if (!templateId) return [];

  const db = await openDB();
  const tx = db.transaction(STORES.DRAFTS, 'readonly');
  const store = tx.objectStore(STORES.DRAFTS);
  const index = store.index('by-templateId');

  const drafts = await index.getAll(templateId);

  await tx.done;

  return Promise.all(drafts.map((draft) => decryptSensitiveFields(draft)));
}

/**
 * Returns the total count of drafts, optionally filtered by status
 *
 * @param {string} [status] - Optional status filter
 * @returns {Promise<number>} Count of drafts
 */
export async function getDraftCount(status) {
  const db = await openDB();
  const tx = db.transaction(STORES.DRAFTS, 'readonly');
  const store = tx.objectStore(STORES.DRAFTS);

  let count;

  if (status && DRAFT_STATUS_LIST.includes(status)) {
    const index = store.index('by-status');
    count = await index.count(status);
  } else {
    count = await store.count();
  }

  await tx.done;

  return count;
}

/**
 * Saves multiple drafts to IndexedDB in a single transaction
 *
 * @param {object[]} drafts - Array of draft objects to save
 * @returns {Promise<object[]>} Array of saved draft objects (decrypted)
 */
export async function saveDrafts(drafts) {
  if (!Array.isArray(drafts)) {
    throw new Error('Drafts must be an array');
  }

  if (drafts.length === 0) return [];

  // Validate and encrypt all drafts
  const encryptedDrafts = await Promise.all(
    drafts.map(async (draft) => {
      if (!draft || !draft.dmId) {
        throw new Error('Each draft must have a dmId');
      }

      if (draft.content === undefined || draft.content === null) {
        throw new Error('Each draft must have content');
      }

      if (draft.confidence !== undefined && draft.confidence !== null) {
        if (typeof draft.confidence !== 'number' || draft.confidence < 0 || draft.confidence > 1) {
          throw new Error('Draft confidence must be a number between 0 and 1');
        }
      }

      if (draft.status && !DRAFT_STATUS_LIST.includes(draft.status)) {
        throw new Error(
          `Invalid draft status: ${draft.status}. Must be one of: ${DRAFT_STATUS_LIST.join(', ')}`
        );
      }

      const sanitizedDraft = { ...draft };
      if (typeof sanitizedDraft.content === 'string') {
        sanitizedDraft.content = sanitizeInput(sanitizedDraft.content);
      }

      const now = new Date().toISOString();
      sanitizedDraft.createdAt = sanitizedDraft.createdAt || now;
      sanitizedDraft.updatedAt = now;
      sanitizedDraft.status = sanitizedDraft.status || DRAFT_STATUS.GENERATED;

      if (!Array.isArray(sanitizedDraft.editHistory)) {
        sanitizedDraft.editHistory = [];
      }

      return encryptSensitiveFields(sanitizedDraft);
    })
  );

  const db = await openDB();
  const tx = db.transaction(STORES.DRAFTS, 'readwrite');
  const store = tx.objectStore(STORES.DRAFTS);

  const ids = [];
  for (const encryptedDraft of encryptedDrafts) {
    const id = await store.add(encryptedDraft);
    ids.push(id);
  }

  await tx.done;

  // Retrieve saved drafts with their generated IDs
  const savedDrafts = await Promise.all(
    ids.map((id) => getDraftById(id))
  );

  return savedDrafts;
}