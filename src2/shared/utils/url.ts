/**
 * Normalizes a URL for comparison by removing protocols, 'www.', trailing slashes,
 * and converting to lowercase.
 * 
 * @param url - The URL string to normalize
 * @returns The normalized URL string
 */
export function normalizeUrl(url: string | null | undefined): string {
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
    console.error('[URL Utility] Error normalizing URL:', e);
    return url || '';
  }
} 