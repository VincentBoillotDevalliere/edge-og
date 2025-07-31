/**
 * Shared utilities for all templates (CG-3)
 * Contains common theme, font, and text sanitization functions
 */

/**
 * Get theme color configuration
 * Implements CG-2: Extended theme support with fallbacks
 */
export function getThemeColors(theme: 'light' | 'dark' | 'blue' | 'green' | 'purple') {
  const themes = {
    light: {
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      accentColor: '#2563eb',
      cardColor: '#f9fafb',
    },
    dark: {
      backgroundColor: '#1a1a1a',
      textColor: '#ffffff',
      accentColor: '#3b82f6',
      cardColor: '#374151',
    },
    blue: {
      backgroundColor: '#dbeafe',
      textColor: '#1e3a8a',
      accentColor: '#1d4ed8',
      cardColor: '#bfdbfe',
    },
    green: {
      backgroundColor: '#dcfce7',
      textColor: '#14532d',
      accentColor: '#16a34a',
      cardColor: '#bbf7d0',
    },
    purple: {
      backgroundColor: '#f3e8ff',
      textColor: '#581c87',
      accentColor: '#9333ea',
      cardColor: '#ddd6fe',
    },
  };

  return themes[theme] || themes.light;
}

/**
 * Get font family name for CSS
 * Implements CG-2: Font selection with fallbacks
 * Updated for CG-4: Support custom font URLs
 */
export function getFontFamily(font: 'inter' | 'roboto' | 'playfair' | 'opensans', customFontUrl?: string) {
  // CG-4: If custom font URL is provided, extract font name from it
  if (customFontUrl) {
    try {
      const url = new URL(customFontUrl);
      const fileName = url.pathname.split('/').pop() || 'CustomFont';
      const fontFamily = fileName.split('.')[0] || 'CustomFont';
      return `${fontFamily}, sans-serif`; // Add fallback
    } catch {
      // If URL parsing fails, fall back to selected font
      console.warn('Invalid custom font URL, falling back to selected font');
    }
  }

  const fonts = {
    inter: 'Inter, sans-serif',
    roboto: 'Roboto, sans-serif',
    playfair: 'Playfair Display, serif',
    opensans: 'Open Sans, sans-serif',
  };

  return fonts[font] || fonts.inter;
}

/**
 * Sanitize text for Satori rendering - remove problematic characters
 * Inter font from Google Fonts has good coverage, but we should be safe
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/<\/([^>]*)>/g, ' $1 ') // Replace closing tags like </script> with " script "
    .replace(/<([^>]*)>/g, ' $1 ') // Replace opening tags like <script> with " script "
    .replace(/[<>&"']/g, ' ') // Remove remaining HTML characters
    .replace(/[\u0000-\u001F\u007F]/g, '') // Remove control characters and DEL
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}
