/**
 * Local VietQR Code Generator
 * 
 * Generates QR code images entirely on the client using:
 * - @viet-qr/core: generates EMVCo QR payload string
 * - qrcode: renders the payload into a PNG data URL
 * 
 * This replaces the old approach of using img.vietqr.io CDN URLs,
 * which broke after VietQR's SVG-first update on 14/10/2026.
 * 
 * Performance: in-memory cache ensures same params = instant return.
 */

import { generateVietQR } from '@viet-qr/core';
import QRCode from 'qrcode';

export interface VietQRParams {
    bankBin: string;
    accountNo: string;
    accountName?: string;
    amount?: number;
    content?: string;
}

// ── QR Cache ─────────────────────────────────────────────
// Same (bankBin, accountNo, amount, content) → same QR image.
// LRU-style eviction when cache exceeds MAX_CACHE entries.
const qrCache = new Map<string, string>();
const MAX_CACHE = 200;

function getCacheKey(params: VietQRParams): string {
    return `${params.bankBin}|${params.accountNo}|${params.amount || 0}|${params.content || ''}`;
}

/**
 * Generate a QR code as a PNG data URL string.
 * Results are cached — calling with identical params returns instantly.
 */
export async function generateQRDataUrl(params: VietQRParams): Promise<string | null> {
    const { bankBin, accountNo, accountName, amount, content } = params;
    if (!bankBin || !accountNo) return null;

    // Check cache first
    const cacheKey = getCacheKey(params);
    const cached = qrCache.get(cacheKey);
    if (cached) return cached;

    try {
        const qrPayload = generateVietQR({
            bankId: bankBin.replace(/\s+/g, ''),
            accountNo: accountNo.replace(/\s+/g, ''),
            accountName: accountName || undefined,
            amount: amount && amount > 0 ? amount : undefined,
            content: content || undefined,
        });
        if (!qrPayload) return null;

        const dataUrl = await QRCode.toDataURL(qrPayload, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 300,
            color: { dark: '#000000', light: '#ffffff' },
        });

        // Store in cache (evict oldest if full)
        if (qrCache.size >= MAX_CACHE) {
            const firstKey = qrCache.keys().next().value;
            if (firstKey !== undefined) qrCache.delete(firstKey);
        }
        qrCache.set(cacheKey, dataUrl);

        return dataUrl;
    } catch (error) {
        console.error('[VietQR] Error generating QR code:', error);
        return null;
    }
}
