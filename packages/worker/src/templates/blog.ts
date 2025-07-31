/**
 * Blog post template for CG-3
 * Optimized for blog articles and content posts
 * Updated for CG-5: Added emoji support for more attractive templates
 */

import { getThemeColors, getFontFamily, sanitizeText, getTemplateEmoji } from './utils'

export function BlogTemplate({
  title = 'Blog Post',
  description = 'Read our latest insights and thoughts',
  author = 'Edge-OG',
  theme = 'light',
  font = 'inter',
}: {
  title?: string;
  description?: string;
  author?: string;
  theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
  font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
}) {
  const themeColors = getThemeColors(theme);
  const fontFamily = getFontFamily(font);
  const templateEmoji = getTemplateEmoji('blog'); // CG-5: Add emoji support

  const safeTitle = sanitizeText(title).substring(0, 80);
  const safeDescription = sanitizeText(description).substring(0, 120);
  const safeAuthor = sanitizeText(author).substring(0, 30);

  return {
    type: 'div',
    props: {
      style: {
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: themeColors.backgroundColor,
        fontFamily: fontFamily,
        padding: '60px',
      },
      children: [
        // Header with author
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              marginBottom: '40px',
            },
            children: [
              // Author avatar with emoji
              {
                type: 'div',
                props: {
                  style: {
                    width: '60px',
                    height: '60px',
                    backgroundColor: themeColors.accentColor,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '20px',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          color: 'white',
                          fontSize: '24px',
                          fontWeight: '600',
                        },
                        children: templateEmoji.icon, // CG-5: Use emoji instead of initial
                      },
                    },
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '18px',
                          fontWeight: '600',
                          color: themeColors.textColor,
                        },
                        children: safeAuthor,
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '14px',
                          color: themeColors.textColor,
                          opacity: 0.6,
                        },
                        children: 'Author',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        // Main content
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            },
            children: [
              // Title with emoji accent
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '56px',
                    fontWeight: '800',
                    color: themeColors.textColor,
                    lineHeight: '1.1',
                    marginBottom: '24px',
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
                          fontSize: '42px',
                        },
                        children: templateEmoji.accent, // CG-5: Add accent emoji
                      },
                    },
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '22px',
                    color: themeColors.textColor,
                    opacity: 0.7,
                    lineHeight: '1.4',
                    marginBottom: '40px',
                  },
                  children: safeDescription,
                },
              },
              // Decorative element
              {
                type: 'div',
                props: {
                  style: {
                    width: '80px',
                    height: '4px',
                    backgroundColor: themeColors.accentColor,
                    borderRadius: '2px',
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };
}
