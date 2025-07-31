export {};

/**
 * Portfolio template for CG-3
 * Optimized for showcasing creative work and portfolios
 */

import { getThemeColors, getFontFamily, sanitizeText, getTemplateEmoji } from './utils';

export function PortfolioTemplate({
  title = 'Creative Portfolio',
  description = 'Showcasing exceptional design and innovation',
  name = 'Artist Name',
  role = 'Designer',
  theme = 'light',
  font = 'playfair',
}: {
  title?: string;
  description?: string;
  name?: string;
  role?: string;
  theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
  font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
}) {
  const themeColors = getThemeColors(theme);
  const fontFamily = getFontFamily(font);
  const templateEmoji = getTemplateEmoji('portfolio'); // CG-5: Add emoji support

  const safeTitle = sanitizeText(title).substring(0, 60);
  const safeDescription = sanitizeText(description).substring(0, 100);
  const safeName = sanitizeText(name).substring(0, 30);
  const safeRole = sanitizeText(role).substring(0, 25);

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
        padding: '70px',
      },
      children: [
        // Header with artist info
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '50px',
            },
            children: [
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
                          fontSize: '24px',
                          fontWeight: '600',
                          color: themeColors.textColor,
                        },
                        children: safeName,
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '16px',
                          color: themeColors.accentColor,
                          fontWeight: '500',
                        },
                        children: safeRole,
                      },
                    },
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    width: '60px',
                    height: '2px',
                    backgroundColor: themeColors.accentColor,
                  },
                },
              },
            ],
          },
        },
        // Main content area
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '60px',
            },
            children: [
              // Left - Text content
              {
                type: 'div',
                props: {
                  style: {
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '52px',
                          fontWeight: font === 'playfair' ? '400' : '700',
                          color: themeColors.textColor,
                          lineHeight: '1.1',
                          marginBottom: '24px',
                          fontStyle: font === 'playfair' ? 'italic' : 'normal',
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
                          fontSize: '20px',
                          color: themeColors.textColor,
                          opacity: 0.7,
                          lineHeight: '1.5',
                          marginBottom: '40px',
                        },
                        children: safeDescription,
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          border: `2px solid ${themeColors.accentColor}`,
                          color: themeColors.accentColor,
                          padding: '12px 24px',
                          borderRadius: '4px',
                          fontSize: '16px',
                          fontWeight: '600',
                          display: 'block',
                        },
                        children: 'View Portfolio',
                      },
                    },
                  ],
                },
              },
              // Right - Portfolio grid mockup
              {
                type: 'div',
                props: {
                  style: {
                    width: '280px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: '130px',
                          height: '100px',
                          backgroundColor: themeColors.cardColor,
                          borderRadius: '8px',
                          border: `2px solid ${themeColors.accentColor}`,
                          opacity: 0.8,
                        },
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: '130px',
                          height: '100px',
                          backgroundColor: themeColors.accentColor,
                          borderRadius: '8px',
                          opacity: 0.9,
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
                              children: templateEmoji.icon, // CG-5: Add emoji to portfolio grid
                            },
                          },
                        ],
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: '130px',
                          height: '100px',
                          backgroundColor: themeColors.accentColor,
                          borderRadius: '8px',
                          opacity: 0.7,
                        },
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: '130px',
                          height: '100px',
                          backgroundColor: themeColors.cardColor,
                          borderRadius: '8px',
                          border: `2px solid ${themeColors.accentColor}`,
                          opacity: 0.6,
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
