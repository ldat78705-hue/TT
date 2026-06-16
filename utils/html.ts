/**
 * Escape HTML special characters to prevent XSS injection
 * in dynamically generated HTML templates (PDF, Certificate, etc.)
 */
export const escapeHtml = (str: string | number | null | undefined): string => {
    if (str == null || str === '') return '';
    const s = String(str);
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * Print HTML content via a hidden iframe (popup-blocker safe).
 * Falls back to window.open if iframe printing fails.
 */
export const printHtml = (html: string, delayMs: number = 500): void => {
    // Try iframe first (popup-blocker safe)
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();
        setTimeout(() => {
            try {
                iframe.contentWindow?.print();
            } catch {
                // Fallback: window.open
                const pw = window.open('', '_blank');
                if (pw) { pw.document.write(html); pw.document.close(); setTimeout(() => pw.print(), 300); }
            }
            setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 1000);
        }, delayMs);
    } else {
        // Fallback: window.open
        document.body.removeChild(iframe);
        const pw = window.open('', '_blank');
        if (pw) { pw.document.write(html); pw.document.close(); setTimeout(() => pw.print(), 300); }
    }
};
