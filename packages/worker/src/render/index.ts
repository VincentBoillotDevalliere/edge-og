export {};

import { generateSVG } from './svg';
import { svgToPng } from './png';
import { DefaultTemplate } from '../templates/default';

/**
 * Main render pipeline: JSX → Satori → SVG → resvg → PNG
 * Implements the exact pipeline specified in instructions
 */
export async function renderOpenGraphImage(params: {
  title?: string;
  description?: string;
  theme?: 'light' | 'dark';
  template?: string;
  format?: 'png' | 'svg'; // Development flag for testing
  fallbackToSvg?: boolean; // Auto-fallback when PNG fails
}): Promise<ArrayBuffer | string> {
  const { title, description, theme = 'light', template = 'default', format = 'png', fallbackToSvg = true } = params;

  // For CG-1, we only support the default template
  if (template !== 'default') {
    throw new Error(`Template "${template}" not supported yet`);
  }

  // Generate the React element
  const element = DefaultTemplate({ title, description, theme });

  // Step 1: Generate SVG using Satori
  const svg = await generateSVG(element, {
    width: 1200,
    height: 630,
    fonts: [], // getDefaultFonts() will be called inside generateSVG
  });

  // Return SVG if requested
  if (format === 'svg') {
    return svg;
  }

  // Step 2: Try to convert SVG to PNG using resvg
  try {
    const pngBuffer = await svgToPng(svg);
    return pngBuffer;
  } catch (error) {
    console.warn('PNG conversion failed, details:', error instanceof Error ? error.message : String(error));
    
    if (fallbackToSvg) {
      console.log('Falling back to SVG format due to PNG conversion failure');
      return svg;
    } else {
      // Re-throw the error if fallback is disabled
      throw error;
    }
  }
}
