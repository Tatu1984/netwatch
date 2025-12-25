import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }

  // Derive a proper 32-byte key using PBKDF2
  return crypto.pbkdf2Sync(key, "netwatch-salt", 100000, 32, "sha256");
}

/**
 * Encrypt sensitive data
 * @param plaintext - The data to encrypt
 * @returns Encrypted string in format: iv:authTag:encryptedData (all base64)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // Combine iv, authTag, and encrypted data
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypt encrypted data
 * @param encryptedData - The encrypted string from encrypt()
 * @returns The original plaintext
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();

  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Hash a password using bcrypt-compatible method
 * @param password - The password to hash
 * @returns Hashed password
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a hash
 * @param password - The password to verify
 * @param storedHash - The stored hash from hashPassword()
 * @returns True if password matches
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) {
    return false;
  }

  const salt = parts[0];
  const hash = parts[1];
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
}

/**
 * Generate a secure random token
 * @param length - Token length in bytes
 * @returns Hex-encoded token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Hash data using SHA-256
 * @param data - Data to hash
 * @returns Hex-encoded hash
 */
export function sha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Mask sensitive data (show first and last few characters)
 * @param data - Data to mask
 * @param visibleChars - Number of visible characters at start and end
 * @returns Masked string
 */
export function maskSensitiveData(data: string, visibleChars: number = 3): string {
  if (data.length <= visibleChars * 2) {
    return "*".repeat(data.length);
  }

  const start = data.slice(0, visibleChars);
  const end = data.slice(-visibleChars);
  const maskedLength = data.length - visibleChars * 2;

  return `${start}${"*".repeat(Math.min(maskedLength, 20))}${end}`;
}

/**
 * Check if data appears to be encrypted
 * @param data - Data to check
 * @returns True if data appears to be encrypted
 */
export function isEncrypted(data: string): boolean {
  const parts = data.split(":");
  if (parts.length !== 3) return false;

  try {
    // Check if parts are valid base64
    Buffer.from(parts[0], "base64");
    Buffer.from(parts[1], "base64");
    Buffer.from(parts[2], "base64");
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypt if not already encrypted
 * @param data - Data to encrypt
 * @returns Encrypted data
 */
export function ensureEncrypted(data: string): string {
  if (isEncrypted(data)) {
    return data;
  }
  return encrypt(data);
}

/**
 * Decrypt if encrypted, otherwise return as-is
 * @param data - Data that may be encrypted
 * @returns Decrypted or original data
 */
export function safeDecrypt(data: string): string {
  if (!isEncrypted(data)) {
    return data;
  }
  try {
    return decrypt(data);
  } catch {
    return data;
  }
}
