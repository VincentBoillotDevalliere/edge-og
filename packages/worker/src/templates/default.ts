export {};

/**
 * Default Open Graph template for CG-1
 * Updated for CG-2: Support theme and font parameters with fallbacks
 * Updated for CG-5: Added emoji support for more attractive templates
 */

import { getThemeColors, getFontFamily, sanitizeText, getTemplateEmoji } from './utils';

export function DefaultTemplate({
  title = 'Edge-OG',
  description = 'Open Graph Generator at the Edge',
  theme = 'light',
  font = 'inter',
  emoji, // CG-5: Custom emoji parameter
}: {
  title?: string;
  description?: string;
  theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
  font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
  emoji?: string; // CG-5: Custom emoji parameter type
}) {
  // Theme color configurations - extended for CG-2
  const themeColors = getThemeColors(theme);
  const fontFamily = getFontFamily(font);
  const templateEmoji = getTemplateEmoji('default'); // CG-5: Add emoji support
  
  // CG-5: Use custom emoji if provided, otherwise fall back to template emoji
  const displayEmoji = emoji || templateEmoji.icon;
  const accentEmoji = emoji || templateEmoji.accent || templateEmoji.icon;

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
              // Logo with emoji
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
                        children: displayEmoji, // CG-5: Use custom or default emoji
                      },
                    },
                  ],
                },
              },
              // Title with emoji accent
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    justifyContent: 'center',
                  },
                  children: [
                    {
                      type: 'span',
                      props: {
                        children: safeTitle,
                      },
                    },
                    {
                      type: 'span',
                      props: {
                        style: {
                          fontSize: '36px',
                        },
                        children: accentEmoji, // CG-5: Use custom or accent emoji
                      },
                    },
                  ],
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
