export {};

/**
 * Default Open Graph template for CG-1
 * Working design with bundled Inter font
 */
/**
 * Sanitize text for Satori rendering - remove problematic characters
 * Inter font from Google Fonts has good coverage, but we should be safe
 */
function sanitizeText(text: string): string {
  if (!text) return '';
  
  // Replace problematic characters and normalize
  return text
    .normalize('NFD') // Decompose combined characters
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    .replace(/[^\x00-\x7F]/g, '?') // Replace non-ASCII with ?
    .replace(/[^\w\s\-.,!?()]/g, ' ') // Only keep safe characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

export function DefaultTemplate({
  title = 'Edge-OG',
  description = 'Open Graph Generator at the Edge',
  theme = 'light',
}: {
  title?: string;
  description?: string;
  theme?: 'light' | 'dark';
}) {
  const backgroundColor = theme === 'dark' ? '#1a1a1a' : '#ffffff';
  const textColor = theme === 'dark' ? '#ffffff' : '#1a1a1a';
  const accentColor = theme === 'dark' ? '#3b82f6' : '#2563eb';

  // Sanitize and prepare text values
  const safeTitle = sanitizeText(title || 'Edge-OG').substring(0, 60);
  const safeDescription = sanitizeText(description || 'Open Graph Generator at the Edge').substring(0, 100);

  return {
    type: 'div',
    props: {
      style: {
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor,
        fontFamily: 'Inter, sans-serif',
        padding: '80px',
      },
      children: [
        // Main content card
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              backgroundColor: theme === 'dark' ? '#374151' : '#f9fafb',
              padding: '60px',
              borderRadius: '24px',
              boxShadow: theme === 'dark' ? '0 25px 50px rgba(0, 0, 0, 0.5)' : '0 25px 50px rgba(0, 0, 0, 0.1)',
              maxWidth: '800px',
            },
            children: [
              // Logo
              {
                type: 'div',
                props: {
                  style: {
                    width: '80px',
                    height: '80px',
                    backgroundColor: accentColor,
                    borderRadius: '16px',
                    marginBottom: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          color: 'white',
                          fontSize: '32px',
                          fontWeight: '700',
                        },
                        children: 'OG',
                      },
                    },
                  ],
                },
              },
              // Title
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '48px',
                    fontWeight: '700',
                    color: textColor,
                    lineHeight: '1.2',
                    marginBottom: '16px',
                    wordWrap: 'break-word',
                  },
                  children: safeTitle,
                },
              },
              // Description
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '20px',
                    color: textColor,
                    opacity: 0.7,
                    lineHeight: '1.5',
                    maxWidth: '500px',
                  },
                  children: safeDescription,
                },
              },
            ],
          },
        },
      ],
    },
  };
}
