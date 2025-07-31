export {};

/**
 * Product showcase template for CG-3
 * Optimized for e-commerce and product presentations
 * Updated for CG-5: Added emoji support for more attractive templates
 */

import { getThemeColors, getFontFamily, sanitizeText, getTemplateEmoji } from './utils';

export function ProductTemplate({
  title = 'Amazing Product',
  description = 'Discover our latest innovation',
  price = '99 USD',
  theme = 'light',
  font = 'inter',
  emoji, // CG-5: Custom emoji parameter
}: {
  title?: string;
  description?: string;
  price?: string;
  theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
  font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
  emoji?: string; // CG-5: Custom emoji parameter type
}) {
  const themeColors = getThemeColors(theme);
  const fontFamily = getFontFamily(font);
  const templateEmoji = getTemplateEmoji('product'); // CG-5: Default emoji support
  
  // CG-5: Use custom emoji if provided, otherwise fall back to template emoji
  // Try direct emoji rendering first (testing without text fallbacks)
  const displayEmoji = emoji || templateEmoji.icon;
  const accentEmoji = emoji || templateEmoji.accent || templateEmoji.icon;

  const safeTitle = sanitizeText(title).substring(0, 60);
  const safeDescription = sanitizeText(description).substring(0, 100);
  const safePrice = sanitizeText(price).substring(0, 20);

  return {
    type: 'div',
    props: {
      style: {
        height: '100%',
        width: '100%',
        display: 'flex',
        backgroundColor: themeColors.backgroundColor,
        fontFamily: fontFamily,
        padding: '80px',
      },
      children: [
        // Left side - Product info
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingRight: '60px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '48px',
                    fontWeight: '800',
                    color: themeColors.textColor,
                    lineHeight: '1.1',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
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
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '20px',
                    color: themeColors.textColor,
                    opacity: 0.7,
                    lineHeight: '1.5',
                    marginBottom: '32px',
                  },
                  children: safeDescription,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '36px',
                          fontWeight: '700',
                          color: themeColors.accentColor,
                        },
                        children: safePrice,
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          backgroundColor: themeColors.accentColor,
                          color: 'white',
                          padding: '12px 24px',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600',
                        },
                        children: 'Buy Now',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        // Right side - Product visual placeholder
        {
          type: 'div',
          props: {
            style: {
              width: '300px',
              height: '300px',
              backgroundColor: themeColors.cardColor,
              borderRadius: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px solid ${themeColors.accentColor}`,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: '80px',
                    height: '80px',
                    backgroundColor: themeColors.accentColor,
                    borderRadius: '12px',
                    marginBottom: '16px',
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
                          fontWeight: '600',
                        },
                        children: displayEmoji, // CG-5: Use custom or default emoji
                      },
                    },
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '18px',
                    fontWeight: '600',
                    color: themeColors.textColor,
                    opacity: 0.6,
                  },
                  children: 'Product Image',
                },
              },
            ],
          },
        },
      ],
    },
  };
}
