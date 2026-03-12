import DOMPurify from 'dompurify';

// Dummy comment to trigger recompile
interface SanitizedHTMLProps {
  html: string;
  className?: string;
  'data-testid'?: string;
}

/**
 * A secure component for rendering HTML content that has been sanitized to prevent XSS attacks.
 * Uses DOMPurify to remove potentially dangerous elements while preserving safe formatting.
 */
export function SanitizedHTML({ html, className, 'data-testid': testId }: SanitizedHTMLProps) {
  // Configure DOMPurify to allow basic formatting while removing dangerous elements
  const sanitizeConfig = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div', 
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 
      'blockquote', 'code', 'pre',
      'a'
    ],
    ALLOWED_ATTR: ['href', 'target', 'class', 'style'],
    ALLOW_DATA_ATTR: false,
    // Remove any scripts, event handlers, and other dangerous attributes
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'],
    // Only allow safe protocols for links
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i
  };

  const sanitizedHTML = DOMPurify.sanitize(html, sanitizeConfig);

  return (
    <div 
      className={className}
      data-testid={testId}
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  );
}