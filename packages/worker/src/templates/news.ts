export {};

/**
 * News article template for CG-3
 * Optimized for news articles and announcements
 */

import { getThemeColors, getFontFamily, sanitizeText } from './utils';

export function NewsTemplate({
  title = 'Breaking News',
  description = 'Latest updates and important announcements',
  category = 'News',
  date = 'Today',
  theme = 'light',
  font = 'roboto',
}: {
  title?: string;
  description?: string;
  category?: string;
  date?: string;
  theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
  font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
}) {
  const themeColors = getThemeColors(theme);
  const fontFamily = getFontFamily(font);

  const safeTitle = sanitizeText(title).substring(0, 90);
  const safeDescription = sanitizeText(description).substring(0, 120);
  const safeCategory = sanitizeText(category).substring(0, 20);
  const safeDate = sanitizeText(date).substring(0, 20);

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
        // Header with category and date
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '40px',
              paddingBottom: '20px',
              borderBottom: `2px solid ${themeColors.accentColor}`,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    backgroundColor: themeColors.accentColor,
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                  },
                  children: safeCategory,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '16px',
                    color: themeColors.textColor,
                    opacity: 0.7,
                    fontWeight: '500',
                  },
                  children: safeDate,
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
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '52px',
                    fontWeight: '900',
                    color: themeColors.textColor,
                    lineHeight: '1.1',
                    marginBottom: '24px',
                  },
                  children: safeTitle,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '20px',
                    color: themeColors.textColor,
                    opacity: 0.8,
                    lineHeight: '1.5',
                    marginBottom: '40px',
                  },
                  children: safeDescription,
                },
              },
              // Read more indicator
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '16px',
                          fontWeight: '600',
                          color: themeColors.accentColor,
                        },
                        children: 'Read Full Article',
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: '24px',
                          height: '2px',
                          backgroundColor: themeColors.accentColor,
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}
