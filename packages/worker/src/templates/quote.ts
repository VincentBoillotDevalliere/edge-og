export {};

/**
 * Quote/testimonial template for CG-3
 * Optimized for showcasing testimonials and quotes
 */

import { getThemeColors, getFontFamily, sanitizeText } from './utils';

export function QuoteTemplate({
  title = 'Customer Success Story',
  quote = 'This product has transformed our business completely!',
  author = 'Happy Customer',
  role = 'CEO',
  theme = 'light',
  font = 'playfair',
}: {
  title?: string;
  quote?: string;
  author?: string;
  role?: string;
  theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
  font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
}) {
  const themeColors = getThemeColors(theme);
  const fontFamily = getFontFamily(font);

  const safeTitle = sanitizeText(title).substring(0, 60);
  const safeQuote = sanitizeText(quote).substring(0, 140);
  const safeAuthor = sanitizeText(author).substring(0, 30);
  const safeRole = sanitizeText(role).substring(0, 30);

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
        textAlign: 'center',
      },
      children: [
        // Title
        {
          type: 'div',
          props: {
            style: {
              fontSize: '24px',
              fontWeight: '600',
              color: themeColors.textColor,
              opacity: 0.8,
              marginBottom: '40px',
              textTransform: 'uppercase',
              letterSpacing: '2px',
            },
            children: safeTitle,
          },
        },
        // Quote mark
        {
          type: 'div',
          props: {
            style: {
              fontSize: '80px',
              color: themeColors.accentColor,
              opacity: 0.3,
              lineHeight: '1',
              marginBottom: '20px',
            },
            children: '"',
          },
        },
        // Quote text
        {
          type: 'div',
          props: {
            style: {
              fontSize: '40px',
              fontWeight: font === 'playfair' ? '400' : '600',
              color: themeColors.textColor,
              lineHeight: '1.3',
              marginBottom: '48px',
              maxWidth: '800px',
              fontStyle: font === 'playfair' ? 'italic' : 'normal',
            },
            children: safeQuote,
          },
        },
        // Attribution
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
                    width: '60px',
                    height: '2px',
                    backgroundColor: themeColors.accentColor,
                    marginBottom: '24px',
                  },
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '24px',
                    fontWeight: '700',
                    color: themeColors.textColor,
                    marginBottom: '8px',
                  },
                  children: safeAuthor,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '18px',
                    color: themeColors.textColor,
                    opacity: 0.6,
                  },
                  children: safeRole,
                },
              },
            ],
          },
        },
      ],
    },
  };
}
