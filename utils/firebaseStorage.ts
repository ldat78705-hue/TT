/**
 * Debt Image Upload utility
 * Uploads debt notice images via /api/debt-image endpoint
 * Images are stored temporarily in Firestore and served as public URLs
 */

/**
 * Upload a canvas as PNG via API and return public URL
 */
export async function uploadDebtNoticeImage(
    canvas: HTMLCanvasElement, 
    centerId: string, 
    studentId: string
): Promise<{ imageUrl: string; imageId: string }> {
    // Convert canvas to base64
    const base64 = canvas.toDataURL('image/png');
    
    const imageId = `${centerId}_${studentId}_${Date.now()}`;
    
    const response = await fetch('/api/debt-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64: base64, imageId }),
    });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || 'Upload ảnh thất bại');
    }
    
    const result = await response.json();
    
    if (!result.success || !result.imageUrl) {
        throw new Error('Không nhận được URL ảnh');
    }
    
    return { imageUrl: result.imageUrl, imageId: result.imageId };
}

/**
 * Delete a previously uploaded image
 */
export async function deleteDebtNoticeImage(imageId: string): Promise<void> {
    try {
        await fetch('/api/debt-image', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageId }),
        });
    } catch {
        // Silent cleanup
    }
}
