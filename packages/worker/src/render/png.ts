export {};

import { Resvg, initWasm } from '@resvg/resvg-wasm';

// Initialize WASM once globally
let wasmInitialized = false;

async function ensureWasmInitialized() {
  if (!wasmInitialized) {
    try {
      // For Cloudflare Workers, we need to load the WASM from a URL
      // The WASM file should be available at a CDN or bundled
      const wasmUrl = 'https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm';
      const wasmResponse = await fetch(wasmUrl);
      
      if (!wasmResponse.ok) {
        throw new Error(`Failed to fetch WASM: ${wasmResponse.status}`);
      }
      
      const wasmBuffer = await wasmResponse.arrayBuffer();
      await initWasm(wasmBuffer);
      wasmInitialized = true;
      console.log('WASM initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WASM:', error);
      throw error;
    }
  }
}

/**
 * Convert SVG to PNG using resvg-wasm
 * Outputs PNG optimized for Open Graph (1200x630)
 */
export async function svgToPng(svgString: string): Promise<ArrayBuffer> {
  try {
    // Ensure WASM is initialized before using Resvg
    await ensureWasmInitialized();
    
    const resvg = new Resvg(svgString, {
      background: 'white', // Fallback background for transparency
      fitTo: {
        mode: 'width',
        value: 1200,
      },
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    
    return pngBuffer;
  } catch (error) {
    throw new Error(`PNG conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
