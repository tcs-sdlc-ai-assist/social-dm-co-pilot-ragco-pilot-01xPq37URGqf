import { ENCRYPTION_KEY_SEED, STORAGE_KEY } from '@/utils/constants';

/**
 * Encryption utility using Web Crypto API
 * Secures sensitive data before browser storage
 * Key derived from environment seed via PBKDF2
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

/**
 * Converts a string to an ArrayBuffer
 * @param {string} str
 * @returns {ArrayBuffer}
 */
function stringToBuffer(str) {
  return new TextEncoder().encode(str);
}

/**
 * Converts an ArrayBuffer to a string
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function bufferToString(buffer) {
  return new TextDecoder().decode(buffer);
}

/**
 * Converts an ArrayBuffer to a base64 string
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a base64 string to an ArrayBuffer
 * @param {string} base64
 * @returns {ArrayBuffer}
 */
function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives a CryptoKey from the environment seed using PBKDF2
 * @param {Uint8Array} salt - Salt for key derivation
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(salt) {
  const seed = ENCRYPTION_KEY_SEED || 'default-seed';
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToBuffer(seed),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates a new CryptoKey and stores the salt in localStorage
 * Returns the derived key for immediate use
 * @returns {Promise<{ key: CryptoKey, salt: Uint8Array }>}
 */
export async function generateKey() {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(salt);

  // Persist the salt so the same key can be re-derived later
  try {
    localStorage.setItem(
      STORAGE_KEY.LOCAL_ENCRYPTION_KEY,
      bufferToBase64(salt.buffer)
    );
  } catch {
    // Storage may be unavailable in some contexts
  }

  return { key, salt };
}

/**
 * Retrieves (or generates) the encryption key
 * @returns {Promise<{ key: CryptoKey, salt: Uint8Array }>}
 */
async function getOrCreateKey() {
  try {
    const storedSalt = localStorage.getItem(STORAGE_KEY.LOCAL_ENCRYPTION_KEY);
    if (storedSalt) {
      const salt = new Uint8Array(base64ToBuffer(storedSalt));
      const key = await deriveKey(salt);
      return { key, salt };
    }
  } catch {
    // Fall through to generate a new key
  }

  return generateKey();
}

/**
 * Encrypts data using AES-GCM with a key derived from the environment seed
 * @param {string|object} data - Data to encrypt (objects will be JSON-serialized)
 * @returns {Promise<string>} Base64-encoded encrypted payload (iv + ciphertext)
 */
export async function encrypt(data) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API is not available');
  }

  const plaintext =
    typeof data === 'string' ? data : JSON.stringify(data);

  const { key } = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    stringToBuffer(plaintext)
  );

  // Combine iv + ciphertext into a single buffer
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return bufferToBase64(combined.buffer);
}

/**
 * Decrypts data that was encrypted with encrypt()
 * @param {string} encryptedBase64 - Base64-encoded encrypted payload
 * @returns {Promise<string>} Decrypted plaintext string
 */
export async function decrypt(encryptedBase64) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API is not available');
  }

  const combined = new Uint8Array(base64ToBuffer(encryptedBase64));

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const { key } = await getOrCreateKey();

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return bufferToString(decrypted);
}