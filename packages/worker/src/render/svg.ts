export {};

import satori, { type SatoriOptions } from 'satori';

/**
 * Font configuration for CG-2: Support multiple font families with fallbacks
 */
const FONT_CONFIGS = {
  inter: {
    family: 'Inter',
    url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700',
  },
  roboto: {
    family: 'Roboto',
    url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700',
  },
  playfair: {
    family: 'Playfair Display',
    url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700',
  },
  opensans: {
    family: 'Open Sans',
    url: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700',
  },
};

type FontName = keyof typeof FONT_CONFIGS;

/**
 * Generate SVG from JSX using Satori
 * Updated for CG-2: Support custom fonts with fallbacks
 */
export async function generateSVG(
  element: any,
  options: {
    width?: number;
    height?: number;
    fonts?: SatoriOptions['fonts'];
  } = {}
): Promise<string> {
  const { width = 1200, height = 630, fonts = [] } = options;

  try {
    // Use provided fonts or fall back to Inter
    const defaultFonts: SatoriOptions['fonts'] = fonts.length > 0 ? fonts : await getFontsByName('inter');

    const svg = await satori(element, {
      width,
      height,
      fonts: defaultFonts,
      // CG-5: Add comprehensive emoji support
      graphemeImages: getEmojiGraphemes(),
      loadAdditionalAsset: async (code: string, segment: string) => {
        if (code === 'emoji') {
          // Convert emoji to Unicode hex for Twemoji URL
          const emojiHex = getEmojiHex(segment);
          if (emojiHex) {
            return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${emojiHex}.svg`;
          }
        }
        return '';
      },
    });

    return svg;
  } catch (error) {
    throw new Error(`SVG generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get fonts by name with fallback to Inter
 * Implements CG-2: Font parameter with fallback values
 */
export async function getFontsByName(fontName: FontName = 'inter'): Promise<SatoriOptions['fonts']> {
  try {
    const config = FONT_CONFIGS[fontName];
    if (!config) {
      console.warn(`Font "${fontName}" not found, falling back to Inter`);
      return await loadFont(FONT_CONFIGS.inter);
    }
    
    return await loadFont(config);
  } catch (error) {
    console.warn(`Failed to load font "${fontName}", falling back to Inter:`, error);
    try {
      return await loadFont(FONT_CONFIGS.inter);
    } catch (fallbackError) {
      console.error('Even Inter font fallback failed:', fallbackError);
      throw new Error(`Font loading completely failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
    }
  }
}

/**
 * Load font from custom URL (CG-4)
 * Supports TTF, OTF, WOFF, WOFF2 formats with caching
 */
export async function getFontsByUrl(fontUrl: string): Promise<SatoriOptions['fonts']> {
  try {
    // Fetch the font file directly
    const fontResponse = await fetch(fontUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!fontResponse.ok) {
      throw new Error(`Font fetch failed: HTTP ${fontResponse.status}`);
    }

    const contentType = fontResponse.headers.get('content-type');
    
    // Validate content type for security
    const validContentTypes = [
      'font/ttf',
      'font/otf', 
      'font/woff',
      'font/woff2',
      'application/font-ttf',
      'application/font-otf',
      'application/font-woff',
      'application/font-woff2',
      'application/octet-stream', // Some servers serve fonts as octet-stream
    ];

    if (contentType && !validContentTypes.some(type => contentType.includes(type))) {
      console.warn(`Suspicious content type for font: ${contentType}`);
    }

    const fontData = await fontResponse.arrayBuffer();

    // Basic validation: ensure we have some data
    if (fontData.byteLength === 0) {
      throw new Error('Font file is empty');
    }

    // For security: limit font file size to 5MB
    if (fontData.byteLength > 5 * 1024 * 1024) {
      throw new Error('Font file too large (max 5MB)');
    }

    // Extract font family name from URL or use generic name
    const url = new URL(fontUrl);
    const fileName = url.pathname.split('/').pop() || 'CustomFont';
    const fontFamily = fileName.split('.')[0] || 'CustomFont';

    return [
      {
        name: fontFamily,
        data: fontData,
        weight: 400,
        style: 'normal',
      },
      {
        name: fontFamily,
        data: fontData,
        weight: 700,
        style: 'normal',
      },
    ];
  } catch (error) {
    console.warn(`Failed to load custom font from ${fontUrl}:`, error);
    // Fallback to Inter if custom font loading fails
    console.log('Falling back to Inter font');
    return await getFontsByName('inter');
  }
}

/**
 * Load a specific font configuration
 */
async function loadFont(config: { family: string; url: string }): Promise<SatoriOptions['fonts']> {
  // Include common characters and punctuation
  const characters = encodeURIComponent('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?()-:;');
  const fontUrl = `${config.url}&text=${characters}`;
  
  const css = await fetch(fontUrl, {
    headers: {
      // Make sure it returns TTF format - exactly like Satori playground
      'User-Agent': 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
    },
  });

  if (!css.ok) {
    throw new Error(`Failed to fetch CSS for ${config.family}: ${css.status}`);
  }

  const cssText = await css.text();

  // Extract the TTF URL from the CSS
  const resource = cssText.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/);
  
  if (!resource) {
    throw new Error(`No TTF font URL found in CSS for ${config.family}`);
  }

  // Fetch the actual font file
  const fontResponse = await fetch(resource[1]);
  
  if (!fontResponse.ok) {
    throw new Error(`Font fetch failed for ${config.family}: ${fontResponse.status}`);
  }

  const fontData = await fontResponse.arrayBuffer();

  return [
    {
      name: config.family,
      data: fontData,
      weight: 400,
      style: 'normal',
    },
    {
      name: config.family,
      data: fontData,
      weight: 700,
      style: 'normal',
    },
  ];
}

/**
 * Get predefined emoji grapheme mappings for CG-5
 * Maps common emojis to their Twemoji SVG URLs
 */
function getEmojiGraphemes(): Record<string, string> {
  return {
    '🔥': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f525.svg',
    '🚀': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f680.svg',
    '⭐': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/2b50.svg',
    '💫': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f4ab.svg',
    '💬': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f4ac.svg',
    '📰': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f4f0.svg',
    '🎭': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f3ad.svg',
    '📖': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f4d6.svg',
    '🛠️': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f6e0.svg',
    '💡': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f4a1.svg',
    '🎨': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f3a8.svg',
    '⚡': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/26a1.svg',
    '✨': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/2728.svg',
    '❤️': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/2764.svg',
    '🎉': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f389.svg',
    '💯': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f4af.svg',
    '🌟': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f31f.svg',
    '👍': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f44d.svg',
    '🤩': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f929.svg',
    '😍': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f60d.svg',
  };
}

/**
 * Convert emoji to Unicode hex for Twemoji URL (CG-5)
 * Handles most common emojis dynamically
 */
function getEmojiHex(emoji: string): string | null {
  try {
    const codePoints = [];
    for (let i = 0; i < emoji.length; i++) {
      const code = emoji.codePointAt(i);
      if (code) {
        codePoints.push(code.toString(16).toLowerCase());
        // Skip surrogate pairs
        if (code >= 0x10000) i++;
      }
    }
    return codePoints.join('-');
  } catch (error) {
    console.warn(`Failed to convert emoji ${emoji} to hex:`, error);
    return null;
  }
}
