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
}): Promise<ArrayBuffer | string> {
  const { title, description, theme = 'light', template = 'default', format = 'png' } = params;

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

  // Development mode: return SVG for testing
  if (format === 'svg') {
    return svg;
  }

  // Step 2: Convert SVG to PNG using resvg
  const pngBuffer = await svgToPng(svg);

  return pngBuffer;
}
