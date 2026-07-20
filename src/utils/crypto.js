import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function resolveKey(key) {
  if (typeof key !== 'string') throw new Error('Encryption key must be a string');
  if (/^[0-9a-f]{64}$/i.test(key)) {
    return Buffer.from(key, 'hex');
  }
  // Pad or truncate to 32 bytes
  const buf = Buffer.alloc(32);
  Buffer.from(key, 'utf8').copy(buf);
  return buf;
}

/**
 * Encrypt `plaintext` (string) → base64-encoded `iv:ciphertext:tag`.
 * @param {string} plaintext
 * @param {string} keyRaw
 * @returns {string}
 */
export function encrypt(plaintext, keyRaw) {
  const key = resolveKey(keyRaw);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Pack: iv(12) + tag(16) + ciphertext → base64
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/**
 * Decrypt a base64 blob produced by `encrypt`.
 * @param {string} blob  base64 string
 * @param {string} keyRaw
 * @returns {string}  plaintext
 */
export function decrypt(blob, keyRaw) {
  const key = resolveKey(keyRaw);
  const buf = Buffer.from(blob, 'base64');

  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext) + decipher.final('utf8');
}
