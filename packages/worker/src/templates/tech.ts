export {};

/**
 * Tech/SaaS template for CG-3
 * Optimized for software products and technical content
 */

import { getThemeColors, getFontFamily, sanitizeText, getTemplateEmoji } from './utils';

export function TechTemplate({
  title = 'Next-Gen Solution',
  description = 'Built for developers, designed for scale',
  version = 'v2.0',
  status = 'Live',
  theme = 'dark',
  font = 'inter',
}: {
  title?: string;
  description?: string;
  version?: string;
  status?: string;
  theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
  font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
}) {
  const themeColors = getThemeColors(theme);
  const fontFamily = getFontFamily(font);
  const templateEmoji = getTemplateEmoji('tech'); // CG-5: Add emoji support

  const safeTitle = sanitizeText(title).substring(0, 60);
  const safeDescription = sanitizeText(description).substring(0, 100);
  const safeVersion = sanitizeText(version).substring(0, 10);
  const safeStatus = sanitizeText(status).substring(0, 15);

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
        position: 'relative',
      },
      children: [
        // Background pattern
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: '0',
              right: '0',
              width: '400px',
              height: '400px',
              opacity: 0.05,
              background: `repeating-linear-gradient(45deg, ${themeColors.accentColor}, ${themeColors.accentColor} 2px, transparent 2px, transparent 20px)`,
            },
          },
        },
        // Left content
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              zIndex: 1,
            },
            children: [
              // Status badges
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    gap: '16px',
                    marginBottom: '32px',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          backgroundColor: '#10b981',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                        },
                        children: safeStatus,
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          backgroundColor: themeColors.cardColor,
                          color: themeColors.textColor,
                          padding: '6px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: '600',
                        },
                        children: safeVersion,
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
                    fontSize: '56px',
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
                          fontSize: '42px',
                        },
                        children: templateEmoji.accent, // CG-5: Add accent emoji
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
                    fontSize: '22px',
                    color: themeColors.textColor,
                    opacity: 0.7,
                    lineHeight: '1.4',
                    marginBottom: '40px',
                    maxWidth: '500px',
                  },
                  children: safeDescription,
                },
              },
              // CTA
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    gap: '20px',
                    alignItems: 'center',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          backgroundColor: themeColors.accentColor,
                          color: 'white',
                          padding: '16px 32px',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600',
                        },
                        children: 'Get Started',
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          border: `2px solid ${themeColors.accentColor}`,
                          color: themeColors.accentColor,
                          padding: '14px 32px',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600',
                        },
                        children: 'View Docs',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        // Right visual element
        {
          type: 'div',
          props: {
            style: {
              width: '200px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
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
                        children: templateEmoji.icon, // CG-5: Use emoji instead of empty string
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
                    height: '60px',
                    backgroundColor: themeColors.cardColor,
                    borderRadius: '8px',
                  },
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    width: '40px',
                    height: '40px',
                    backgroundColor: themeColors.cardColor,
                    borderRadius: '6px',
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
