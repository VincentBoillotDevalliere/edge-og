export {};

import { generateSVG, getFontsByName, getFontsByUrl } from './svg';
import { svgToPng } from './png';
import {
  DefaultTemplate,
  BlogTemplate,
  ProductTemplate,
  EventTemplate,
  QuoteTemplate,
  MinimalTemplate,
  NewsTemplate,
  TechTemplate,
  PodcastTemplate,
  PortfolioTemplate,
  CourseTemplate,
  TEMPLATE_REGISTRY,
  type TemplateType,
} from '../templates';

/**
 * Main render pipeline: JSX → Satori → SVG → resvg → PNG
 * Implements the exact pipeline specified in instructions
 * Updated for CG-2: Support theme and font parameters with fallbacks
 * Updated for CG-3: Support all 10 templates
 */
export async function renderOpenGraphImage(params: {
  title?: string;
  description?: string;
  theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
  font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
  fontUrl?: string; // CG-4: Custom font URL support
  template?: TemplateType;
  format?: 'png' | 'svg'; // Development flag for testing
  fallbackToSvg?: boolean; // Auto-fallback when PNG fails
  // Template-specific parameters
  author?: string;
  price?: string;
  date?: string;
  location?: string;
  quote?: string;
  role?: string;
  subtitle?: string;
  category?: string;
  version?: string;
  status?: string;
  episode?: string;
  duration?: string;
  name?: string;
  instructor?: string;
  level?: string;
  emoji?: string; // CG-5: Custom emoji support
}): Promise<ArrayBuffer | string> {
  const { 
    title, 
    description, 
    theme = 'light', 
    font = 'inter', 
    fontUrl, // CG-4: Custom font URL
    template = 'default', 
    format = 'png', 
    fallbackToSvg = true,
    emoji, // CG-5: Custom emoji support
    // Template-specific params
    ...templateSpecificParams
  } = params;

  // Generate the React element based on selected template
  let element;
  
  switch (template) {
    case 'blog':
      element = BlogTemplate({ title, description, theme, font, author: templateSpecificParams.author });
      break;
    case 'product':
      element = ProductTemplate({ title, description, theme, font, emoji, price: templateSpecificParams.price });
      break;
    case 'event':
      element = EventTemplate({ 
        title, 
        description, 
        theme, 
        font, 
        date: templateSpecificParams.date,
        location: templateSpecificParams.location 
      });
      break;
    case 'quote':
      element = QuoteTemplate({ 
        title, 
        quote: templateSpecificParams.quote || description, 
        theme, 
        font, 
        author: templateSpecificParams.author,
        role: templateSpecificParams.role 
      });
      break;
    case 'minimal':
      element = MinimalTemplate({ 
        title, 
        subtitle: templateSpecificParams.subtitle || description, 
        theme, 
        font 
      });
      break;
    case 'news':
      element = NewsTemplate({ 
        title, 
        description, 
        theme, 
        font, 
        category: templateSpecificParams.category,
        date: templateSpecificParams.date 
      });
      break;
    case 'tech':
      element = TechTemplate({ 
        title, 
        description, 
        theme, 
        font, 
        version: templateSpecificParams.version,
        status: templateSpecificParams.status 
      });
      break;
    case 'podcast':
      element = PodcastTemplate({ 
        title, 
        description, 
        theme, 
        font, 
        episode: templateSpecificParams.episode,
        duration: templateSpecificParams.duration 
      });
      break;
    case 'portfolio':
      element = PortfolioTemplate({ 
        title, 
        description, 
        theme, 
        font, 
        name: templateSpecificParams.name,
        role: templateSpecificParams.role 
      });
      break;
    case 'course':
      element = CourseTemplate({ 
        title, 
        description, 
        theme, 
        font, 
        instructor: templateSpecificParams.instructor,
        duration: templateSpecificParams.duration,
        level: templateSpecificParams.level 
      });
      break;
    case 'default':
    default:
      element = DefaultTemplate({ title, description, theme, font });
      break;
  }

  // Step 1: Generate SVG using Satori with the selected font
  const svg = await generateSVG(element, {
    width: 1200,
    height: 630,
    fonts: fontUrl 
      ? await getFontsByUrl(fontUrl) // CG-4: Load custom font from URL
      : await getFontsByName(font), // Load fonts based on selection
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
    
    // Check if this is a WASM-related error that should trigger fallback
    const isWasmError = error instanceof Error && (
      error.message.includes('WASM') ||
      error.message.includes('WebAssembly') ||
      error.message.includes('CompileError') ||
      error.message.includes('code generation disallowed') ||
      error.message.includes('PNG conversion is not available in local development')
    );
    
    if (fallbackToSvg || isWasmError) {
      console.log('Falling back to SVG format due to PNG conversion failure');
      return svg;
    } else {
      // Re-throw the error if fallback is disabled and it's not a WASM issue
      throw error;
    }
  }
}
