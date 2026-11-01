import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

/**
 * Hash a password using bcrypt (new standard).
 * All new passwords will be hashed with bcrypt.
 */
export function hashPassword(password: string): string {
    return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

/**
 * Legacy SHA-256 hash — used only for backward-compatible verification.
 */
function sha256Hash(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Verify a password against a stored hash.
 * Supports both bcrypt (new) and SHA-256 (legacy) hashes.
 * 
 * Detection: bcrypt hashes start with "$2a$" or "$2b$" and are 60 chars.
 * SHA-256 hashes are exactly 64 hex characters.
 */
export function verifyPassword(plainPassword: string, storedHash: string): boolean {
    if (!storedHash || !plainPassword) return false;
    
    // Check if stored hash is bcrypt format
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
        return bcrypt.compareSync(plainPassword, storedHash);
    }
    
    // Legacy: SHA-256 comparison
    return sha256Hash(plainPassword) === storedHash;
}
