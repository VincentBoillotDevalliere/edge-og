export {};

/**
 * Event announcement template for CG-3
 * Optimized for conferences, webinar                  style: {
                    fontSize: '64px',
                    fontWeight: '800',
                    color: themeColors.textColor,
                    lineHeight: '1.1',
                    marginBottom: '20px',
                    maxWidth: '800px',
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
                          fontSize: '48px',
                        },
                        children: templateEmoji.accent, // CG-5: Add accent emoji
                      },
                    },
                  ],ents
 * Updated for CG-5: Added emoji support for more attractive templates
 */

import { getThemeColors, getFontFamily, sanitizeText, getTemplateEmoji } from './utils';

export function EventTemplate({
  title = 'Join Our Event',
  description = 'Connect, learn, and grow together',
  date = 'Coming Soon',
  location = 'Online',
  theme = 'light',
  font = 'inter',
}: {
  title?: string;
  description?: string;
  date?: string;
  location?: string;
  theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
  font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
}) {
  const themeColors = getThemeColors(theme);
  const fontFamily = getFontFamily(font);
  const templateEmoji = getTemplateEmoji('event'); // CG-5: Add emoji support

  const safeTitle = sanitizeText(title).substring(0, 70);
  const safeDescription = sanitizeText(description).substring(0, 100);
  const safeDate = sanitizeText(date).substring(0, 30);
  const safeLocation = sanitizeText(location).substring(0, 30);

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
        position: 'relative',
      },
      children: [
        // Header badge
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '40px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    backgroundColor: themeColors.accentColor,
                    color: 'white',
                    padding: '8px 24px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                  },
                  children: [templateEmoji.icon, ' EVENT'].join(' '), // CG-5: Add emoji to EVENT label
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
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '56px',
                    fontWeight: '800',
                    color: themeColors.textColor,
                    lineHeight: '1.1',
                    marginBottom: '24px',
                    maxWidth: '800px',
                  },
                  children: safeTitle,
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
                    marginBottom: '48px',
                    maxWidth: '600px',
                  },
                  children: safeDescription,
                },
              },
              // Event details
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    gap: '60px',
                    alignItems: 'center',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '14px',
                                color: themeColors.textColor,
                                opacity: 0.6,
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                marginBottom: '8px',
                              },
                              children: 'Date',
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '20px',
                                fontWeight: '700',
                                color: themeColors.textColor,
                              },
                              children: safeDate,
                            },
                          },
                        ],
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: '2px',
                          height: '40px',
                          backgroundColor: themeColors.accentColor,
                          opacity: 0.3,
                        },
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '14px',
                                color: themeColors.textColor,
                                opacity: 0.6,
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                marginBottom: '8px',
                              },
                              children: 'Location',
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '20px',
                                fontWeight: '700',
                                color: themeColors.textColor,
                              },
                              children: safeLocation,
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
        },
      ],
    },
  };
}
