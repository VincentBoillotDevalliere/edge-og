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
 */
export function getFontFamily(font: 'inter' | 'roboto' | 'playfair' | 'opensans') {
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
  
  // Replace problematic characters and normalize
  return text
    .normalize('NFD') // Decompose combined characters
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    .replace(/[^\x00-\x7F]/g, '?') // Replace non-ASCII with ?
    .replace(/[^\w\s\-.,!?()]/g, ' ') // Only keep safe characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}
