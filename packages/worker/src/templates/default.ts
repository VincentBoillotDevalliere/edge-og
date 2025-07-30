export {};

/**
 * Default Open Graph template for CG-1
 * Updated for CG-2: Support theme and font parameters with fallbacks
 */

import { getThemeColors, getFontFamily, sanitizeText } from './utils';

export function DefaultTemplate({
  title = 'Edge-OG',
  description = 'Open Graph Generator at the Edge',
  theme = 'light',
  font = 'inter',
}: {
  title?: string;
  description?: string;
  theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
  font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
}) {
  // Theme color configurations - extended for CG-2
  const themeColors = getThemeColors(theme);
  const fontFamily = getFontFamily(font);

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
        backgroundColor: themeColors.backgroundColor,
        fontFamily: fontFamily,
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
              backgroundColor: themeColors.cardColor,
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
                    backgroundColor: themeColors.accentColor,
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
                    color: themeColors.textColor,
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
                    color: themeColors.textColor,
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
