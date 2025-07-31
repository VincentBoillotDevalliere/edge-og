export {};

/**
 * Course/Education template for CG-3
 * Optimized for online courses and educational content
 */

import { getThemeColors, getFontFamily, sanitizeText } from './utils';

export function CourseTemplate({
  title = 'Master the Fundamentals',
  description = 'Learn essential skills with expert guidance',
  instructor = 'Expert Teacher',
  duration = '8 weeks',
  level = 'Beginner',
  theme = 'blue',
  font = 'opensans',
}: {
  title?: string;
  description?: string;
  instructor?: string;
  duration?: string;
  level?: string;
  theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
  font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
}) {
  const themeColors = getThemeColors(theme);
  const fontFamily = getFontFamily(font);

  const safeTitle = sanitizeText(title).substring(0, 70);
  const safeDescription = sanitizeText(description).substring(0, 100);
  const safeInstructor = sanitizeText(instructor).substring(0, 30);
  const safeDuration = sanitizeText(duration).substring(0, 15);
  const safeLevel = sanitizeText(level).substring(0, 15);

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
        // Header with course info badges
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              gap: '16px',
              marginBottom: '40px',
            },
            children: [
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
                  },
                  children: safeLevel,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    backgroundColor: themeColors.cardColor,
                    color: themeColors.textColor,
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    border: `1px solid ${themeColors.accentColor}`,
                  },
                  children: safeDuration,
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
              alignItems: 'center',
              gap: '60px',
            },
            children: [
              // Left side - Course details
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
                          fontWeight: '700',
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
                          opacity: 0.7,
                          lineHeight: '1.5',
                          marginBottom: '32px',
                        },
                        children: safeDescription,
                      },
                    },
                    // Instructor info
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          marginBottom: '32px',
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                width: '50px',
                                height: '50px',
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
                                      fontSize: '20px',
                                      fontWeight: '600',
                                    },
                                    children: safeInstructor.charAt(0).toUpperCase(),
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
                                    children: safeInstructor,
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
                                    children: 'Instructor',
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                    // Enroll button
                    {
                      type: 'div',
                      props: {
                        style: {
                          backgroundColor: themeColors.accentColor,
                          color: 'white',
                          padding: '16px 32px',
                          borderRadius: '8px',
                          fontSize: '18px',
                          fontWeight: '600',
                          display: 'block',
                          textAlign: 'center',
                          width: 'fit-content',
                        },
                        children: 'Enroll Now',
                      },
                    },
                  ],
                },
              },
              // Right side - Course structure visualization
              {
                type: 'div',
                props: {
                  style: {
                    width: '250px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '18px',
                          fontWeight: '600',
                          color: themeColors.textColor,
                          marginBottom: '16px',
                        },
                        children: 'Course Modules',
                      },
                    },
                    // Module items
                    ...Array.from({ length: 4 }, (_, i) => ({
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px',
                          backgroundColor: themeColors.cardColor,
                          borderRadius: '8px',
                          border: i === 0 ? `2px solid ${themeColors.accentColor}` : 'none',
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                width: '24px',
                                height: '24px',
                                backgroundColor: i === 0 ? themeColors.accentColor : themeColors.textColor,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: i === 0 ? 1 : 0.3,
                              },
                              children: [
                                {
                                  type: 'div',
                                  props: {
                                    style: {
                                      color: 'white',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                    },
                                    children: (i + 1).toString(),
                                  },
                                },
                              ],
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '14px',
                                color: themeColors.textColor,
                                opacity: i === 0 ? 1 : 0.6,
                              },
                              children: `Module ${i + 1}`,
                            },
                          },
                        ],
                      },
                    })),
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
