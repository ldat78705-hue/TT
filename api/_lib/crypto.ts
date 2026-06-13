import crypto from 'crypto';

export function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(plainPassword: string, hashedPassword: string): boolean {
    return hashPassword(plainPassword) === hashedPassword;
}
