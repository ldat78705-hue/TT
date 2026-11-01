/**
 * Local VietQR Code Generator
 * 
 * Generates QR code images entirely on the client using:
 * - @viet-qr/core: generates EMVCo QR payload string
 * - qrcode: renders the payload into a PNG data URL
 * 
 * This replaces the old approach of using img.vietqr.io CDN URLs,
 * which broke after VietQR's SVG-first update on 14/10/2026.
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

/**
 * Generate a QR code as a PNG data URL string.
 */
export async function generateQRDataUrl(params: VietQRParams): Promise<string | null> {
    const { bankBin, accountNo, accountName, amount, content } = params;
    if (!bankBin || !accountNo) return null;

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
        return dataUrl;
    } catch (error) {
        console.error('[VietQR] Error generating QR code:', error);
        return null;
    }
}
