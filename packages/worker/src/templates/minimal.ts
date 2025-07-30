export {};

/**
 * Minimalist template for CG-3
 * Clean and simple design for elegant presentations
 */

import { getThemeColors, getFontFamily, sanitizeText } from './utils';

export function MinimalTemplate({
  title = 'Simple & Clean',
  subtitle = 'Less is more',
  theme = 'light',
  font = 'inter',
}: {
  title?: string;
  subtitle?: string;
  theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
  font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
}) {
  const themeColors = getThemeColors(theme);
  const fontFamily = getFontFamily(font);

  const safeTitle = sanitizeText(title).substring(0, 50);
  const safeSubtitle = sanitizeText(subtitle).substring(0, 80);

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
        padding: '120px',
        textAlign: 'center',
      },
      children: [
        // Minimal accent
        {
          type: 'div',
          props: {
            style: {
              width: '40px',
              height: '40px',
              backgroundColor: themeColors.accentColor,
              borderRadius: '50%',
              marginBottom: '60px',
            },
          },
        },
        // Title
        {
          type: 'div',
          props: {
            style: {
              fontSize: '64px',
              fontWeight: '300',
              color: themeColors.textColor,
              lineHeight: '1.1',
              marginBottom: '24px',
              letterSpacing: '-1px',
            },
            children: safeTitle,
          },
        },
        // Subtitle
        {
          type: 'div',
          props: {
            style: {
              fontSize: '20px',
              fontWeight: '400',
              color: themeColors.textColor,
              opacity: 0.6,
              lineHeight: '1.4',
              letterSpacing: '0.5px',
            },
            children: safeSubtitle,
          },
        },
      ],
    },
  };
}
