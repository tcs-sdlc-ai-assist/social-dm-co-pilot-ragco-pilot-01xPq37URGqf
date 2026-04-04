import { openDB as idbOpenDB } from 'idb';
import { STORAGE_KEY } from '@/utils/constants';

/**
 * IndexedDB initialization and schema management
 * Uses the idb library for a Promise-based API over IndexedDB
 * Provides object stores for dms, drafts, leads, notifications, and audit_logs
 */

const DB_NAME = STORAGE_KEY.DB_NAME;
const DB_VERSION = 2;

/**
 * Cached database instance to avoid repeated open calls
 * @type {Promise<import('idb').IDBPDatabase> | null}
 */
let dbPromise = null;

/**
 * Handles database version upgrades and initial schema creation
 * Each version increment should have a corresponding migration block
 *
 * @param {import('idb').IDBPDatabase} db - Database instance
 * @param {number} oldVersion - Previous database version
 * @param {number} newVersion - Target database version
 * @param {import('idb').IDBPTransaction} transaction - Upgrade transaction
 */
function handleUpgrade(db, oldVersion, newVersion, transaction) {
  if (oldVersion < 1) {
    // Version 1: Initial schema with conversations, messages, contacts, templates, auditLog
    if (!db.objectStoreNames.contains(STORAGE_KEY.STORE_CONVERSATIONS)) {
      const conversationStore = db.createObjectStore(STORAGE_KEY.STORE_CONVERSATIONS, {
        keyPath: 'id',
      });
      conversationStore.createIndex('by-status', 'status', { unique: false });
      conversationStore.createIndex('by-platform', 'platform', { unique: false });
      conversationStore.createIndex('by-timestamp', 'timestamp', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORAGE_KEY.STORE_MESSAGES)) {
      const messageStore = db.createObjectStore(STORAGE_KEY.STORE_MESSAGES, {
        keyPath: 'id',
      });
      messageStore.createIndex('by-conversationId', 'conversationId', { unique: false });
      messageStore.createIndex('by-timestamp', 'timestamp', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORAGE_KEY.STORE_CONTACTS)) {
      const contactStore = db.createObjectStore(STORAGE_KEY.STORE_CONTACTS, {
        keyPath: 'id',
      });
      contactStore.createIndex('by-handle', 'handle', { unique: false });
      contactStore.createIndex('by-platform', 'platform', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORAGE_KEY.STORE_TEMPLATES)) {
      const templateStore = db.createObjectStore(STORAGE_KEY.STORE_TEMPLATES, {
        keyPath: 'id',
      });
      templateStore.createIndex('by-category', 'category', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORAGE_KEY.STORE_AUDIT_LOG)) {
      const auditStore = db.createObjectStore(STORAGE_KEY.STORE_AUDIT_LOG, {
        keyPath: 'id',
        autoIncrement: true,
      });
      auditStore.createIndex('by-eventType', 'eventType', { unique: false });
      auditStore.createIndex('by-timestamp', 'timestamp', { unique: false });
    }
  }

  if (oldVersion < 2) {
    // Version 2: Add dms, drafts, leads, and notifications stores

    if (!db.objectStoreNames.contains('dms')) {
      const dmsStore = db.createObjectStore('dms', {
        keyPath: 'id',
      });
      dmsStore.createIndex('by-status', 'status', { unique: false });
      dmsStore.createIndex('by-platform', 'sender.platform', { unique: false });
      dmsStore.createIndex('by-timestamp', 'timestamp', { unique: false });
      dmsStore.createIndex('by-sender-handle', 'sender.handle', { unique: false });
      dmsStore.createIndex('by-inquiryType', 'metadata.inquiryType', { unique: false });
    }

    if (!db.objectStoreNames.contains('drafts')) {
      const draftsStore = db.createObjectStore('drafts', {
        keyPath: 'id',
        autoIncrement: true,
      });
      draftsStore.createIndex('by-dmId', 'dmId', { unique: false });
      draftsStore.createIndex('by-status', 'status', { unique: false });
      draftsStore.createIndex('by-createdAt', 'createdAt', { unique: false });
      draftsStore.createIndex('by-templateId', 'templateId', { unique: false });
    }

    if (!db.objectStoreNames.contains('leads')) {
      const leadsStore = db.createObjectStore('leads', {
        keyPath: 'id',
      });
      leadsStore.createIndex('by-status', 'status', { unique: false });
      leadsStore.createIndex('by-score', 'score', { unique: false });
      leadsStore.createIndex('by-platform', 'platform', { unique: false });
      leadsStore.createIndex('by-intent', 'intent', { unique: false });
      leadsStore.createIndex('by-assignedTo', 'assignedTo', { unique: false });
      leadsStore.createIndex('by-createdAt', 'createdAt', { unique: false });
      leadsStore.createIndex('by-handle', 'handle', { unique: false });
    }

    if (!db.objectStoreNames.contains('notifications')) {
      const notificationsStore = db.createObjectStore('notifications', {
        keyPath: 'id',
        autoIncrement: true,
      });
      notificationsStore.createIndex('by-type', 'type', { unique: false });
      notificationsStore.createIndex('by-read', 'read', { unique: false });
      notificationsStore.createIndex('by-timestamp', 'timestamp', { unique: false });
      notificationsStore.createIndex('by-dmId', 'dmId', { unique: false });
    }

    // Rename audit_logs alias — the v1 store (STORE_AUDIT_LOG) already exists
    // so we create an additional 'audit_logs' store for the new naming convention
    if (!db.objectStoreNames.contains('audit_logs')) {
      const auditLogsStore = db.createObjectStore('audit_logs', {
        keyPath: 'id',
        autoIncrement: true,
      });
      auditLogsStore.createIndex('by-eventType', 'eventType', { unique: false });
      auditLogsStore.createIndex('by-timestamp', 'timestamp', { unique: false });
      auditLogsStore.createIndex('by-userId', 'userId', { unique: false });
      auditLogsStore.createIndex('by-entityId', 'entityId', { unique: false });
    }
  }
}

/**
 * Opens (or returns the cached) IndexedDB database instance
 * Handles version migrations through the upgrade callback
 *
 * @returns {Promise<import('idb').IDBPDatabase>} Database instance
 */
export function openDB() {
  if (!dbPromise) {
    dbPromise = idbOpenDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        handleUpgrade(db, oldVersion, newVersion, transaction);
      },
      blocked() {
        console.warn(
          `[${DB_NAME}] Database upgrade blocked. Please close other tabs using this application.`
        );
      },
      blocking() {
        console.warn(
          `[${DB_NAME}] This connection is blocking a database upgrade. Closing connection.`
        );
        // Close the current connection to allow the upgrade to proceed
        dbPromise?.then((db) => db.close());
        dbPromise = null;
      },
      terminated() {
        console.error(`[${DB_NAME}] Database connection was unexpectedly terminated.`);
        dbPromise = null;
      },
    });
  }

  return dbPromise;
}

/**
 * Resets the cached database promise
 * Useful for testing or when the database needs to be re-opened
 * after a connection error
 */
export function resetDBConnection() {
  if (dbPromise) {
    dbPromise.then((db) => db.close()).catch(() => {});
    dbPromise = null;
  }
}

/**
 * Deletes the entire database
 * Use with caution — all data will be permanently removed
 *
 * @returns {Promise<void>}
 */
export async function deleteDatabase() {
  resetDBConnection();

  const { deleteDB } = await import('idb');
  await deleteDB(DB_NAME, {
    blocked() {
      console.warn(
        `[${DB_NAME}] Database deletion blocked. Please close other tabs using this application.`
      );
    },
  });
}

/**
 * Store name constants for convenient access throughout the application
 */
export const STORES = Object.freeze({
  CONVERSATIONS: STORAGE_KEY.STORE_CONVERSATIONS,
  MESSAGES: STORAGE_KEY.STORE_MESSAGES,
  CONTACTS: STORAGE_KEY.STORE_CONTACTS,
  TEMPLATES: STORAGE_KEY.STORE_TEMPLATES,
  AUDIT_LOG: STORAGE_KEY.STORE_AUDIT_LOG,
  DMS: 'dms',
  DRAFTS: 'drafts',
  LEADS: 'leads',
  NOTIFICATIONS: 'notifications',
  AUDIT_LOGS: 'audit_logs',
});