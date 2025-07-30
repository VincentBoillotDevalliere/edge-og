export {};

import satori, { type SatoriOptions } from 'satori';

/**
 * Generate SVG from JSX using Satori
 * For CG-1: Use embedded minimal font to ensure it works
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
    // For CG-1: Use embedded font data to guarantee it works
    const defaultFonts: SatoriOptions['fonts'] = fonts.length > 0 ? fonts : await getDefaultFonts();

    const svg = await satori(element, {
      width,
      height,
      fonts: defaultFonts,
    });

    return svg;
  } catch (error) {
    throw new Error(`SVG generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get embedded font data for CG-1
 * Uses a working approach to load a real font file
 */
// Font handling for Satori - using Google Fonts like the Satori playground
async function getDefaultFonts(): Promise<SatoriOptions['fonts']> {
  try {
    // Use the exact same approach as Satori's playground but with broader character support
    // Include common characters and punctuation
    const API = `https://fonts.googleapis.com/css2?family=Inter:wght@400;700&text=${encodeURIComponent('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?()-:;')}`;
    
    const css = await fetch(API, {
      headers: {
        // Make sure it returns TTF format - exactly like Satori playground
        'User-Agent': 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
      },
    });

    if (!css.ok) {
      throw new Error(`Failed to fetch CSS: ${css.status}`);
    }

    const cssText = await css.text();
    console.log('CSS response:', cssText);

    // Extract the TTF URL from the CSS
    const resource = cssText.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/);
    
    if (!resource) {
      throw new Error('No TTF font URL found in CSS');
    }

    console.log('Font URL found:', resource[1]);

    // Fetch the actual font file
    const fontResponse = await fetch(resource[1]);
    
    if (!fontResponse.ok) {
      throw new Error(`Font fetch failed: ${fontResponse.status}`);
    }

    const fontData = await fontResponse.arrayBuffer();
    console.log(`Successfully loaded font: ${fontData.byteLength} bytes`);

    // For now, we'll use the same font data for both weights
    // This is a simplified approach for CG-1
    return [
      {
        name: 'Inter',
        data: fontData,
        weight: 400,
        style: 'normal',
      },
      {
        name: 'Inter',
        data: fontData,
        weight: 700,
        style: 'normal',
      },
    ];

  } catch (error) {
    console.error('Font loading failed:', error);
    throw new Error(`Failed to load font: ${error instanceof Error ? error.message : String(error)}`);
  }
}
