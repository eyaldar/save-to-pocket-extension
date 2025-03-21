// Helper function to normalize URLs for comparison
export function normalizeUrl(url) {
    if (!url) return '';
    try {
        // Remove protocol
        let normalized = url.replace(/^https?:\/\//, '');
        // Remove www.
        normalized = normalized.replace(/^www\./, '');
        // Remove trailing slash
        normalized = normalized.replace(/\/$/, '');
        // Convert to lowercase
        normalized = normalized.toLowerCase();
        return normalized;
    } catch (e) {
        console.error('[Popup] Error normalizing URL:', e);
        return url;
    }
}