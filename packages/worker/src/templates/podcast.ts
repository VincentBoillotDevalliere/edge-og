export {};

/**
 * Podcast template for CG-3
 * Optimized for podcast episodes and audio content
 */

import { getThemeColors, getFontFamily, sanitizeText } from './utils';

export function PodcastTemplate({
  title = 'Podcast Episode',
  description = 'Join us for an insightful conversation',
  episode = 'Episode 42',
  duration = '45 min',
  theme = 'purple',
  font = 'opensans',
}: {
  title?: string;
  description?: string;
  episode?: string;
  duration?: string;
  theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
  font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
}) {
  const themeColors = getThemeColors(theme);
  const fontFamily = getFontFamily(font);

  const safeTitle = sanitizeText(title).substring(0, 70);
  const safeDescription = sanitizeText(description).substring(0, 110);
  const safeEpisode = sanitizeText(episode).substring(0, 20);
  const safeDuration = sanitizeText(duration).substring(0, 15);

  return {
    type: 'div',
    props: {
      style: {
        height: '100%',
        width: '100%',
        display: 'flex',
        backgroundColor: themeColors.backgroundColor,
        fontFamily: fontFamily,
        padding: '70px',
      },
      children: [
        // Left side - Podcast info
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingRight: '50px',
            },
            children: [
              // Episode badge
              {
                type: 'div',
                props: {
                  style: {
                    backgroundColor: themeColors.accentColor,
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'inline-block',
                    marginBottom: '24px',
                    width: 'fit-content',
                  },
                  children: safeEpisode,
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
                    marginBottom: '20px',
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
                    marginBottom: '32px',
                  },
                  children: safeDescription,
                },
              },
              // Duration and play button
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '24px',
                  },
                  children: [
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
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                color: 'white',
                                fontSize: '24px',
                                marginLeft: '4px',
                              },
                              children: '▶',
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
                                fontSize: '16px',
                                fontWeight: '600',
                                color: themeColors.textColor,
                              },
                              children: 'Listen Now',
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
                              children: safeDuration,
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
        // Right side - Audio waveform visualization
        {
          type: 'div',
          props: {
            style: {
              width: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'end',
                    gap: '4px',
                    height: '120px',
                  },
                  children: Array.from({ length: 20 }, (_, i) => ({
                    type: 'div',
                    props: {
                      style: {
                        width: '8px',
                        height: `${Math.random() * 80 + 20}px`,
                        backgroundColor: themeColors.accentColor,
                        borderRadius: '2px',
                        opacity: 0.3 + (Math.random() * 0.7),
                      },
                    },
                  })),
                },
              },
            ],
          },
        },
      ],
    },
  };
}
