export {};

import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { log } from '../utils/logger';

// Initialize WASM once globally
let wasmInitialized = false;
let wasmInitializationPromise: Promise<void> | null = null;
let wasmUnavailable = false;

async function ensureWasmInitialized() {
  if (wasmInitialized) {
    return;
  }

  if (wasmUnavailable) {
    throw new Error('WASM is not available in this environment. PNG conversion requires deployment to Cloudflare Workers production environment.');
  }

  if (wasmInitializationPromise) {
    return wasmInitializationPromise;
  }

  wasmInitializationPromise = (async () => {
    try {
  log({ event: 'wasm_init_start' });
      
      // Try to load WASM from unpkg CDN
  const wasmUrl = 'https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm';
  log({ event: 'wasm_fetch', url: wasmUrl });
      
      const wasmResponse = await fetch(wasmUrl);
      if (!wasmResponse.ok) {
        throw new Error(`Failed to fetch WASM: ${wasmResponse.status}`);
      }
      
      const wasmBuffer = await wasmResponse.arrayBuffer();
  log({ event: 'wasm_loaded', bytes: wasmBuffer.byteLength });
      
      // Initialize resvg with the WASM buffer
      await initWasm(wasmBuffer);
      wasmInitialized = true;
  log({ event: 'wasm_initialized' });
    } catch (error) {
  log({ event: 'wasm_init_failed', error: error instanceof Error ? error.message : String(error) });
      wasmUnavailable = true;
      wasmInitializationPromise = null;
      
      // Check if this is a WebAssembly compilation error (common in local dev)
      if (error instanceof Error && (
        error.message.includes('CompileError') || 
        error.message.includes('Wasm code generation disallowed') ||
        error.name === 'CompileError'
      )) {
        throw new Error('PNG conversion is not available in local development due to WASM restrictions. Use format=svg for testing, or deploy to Cloudflare Workers for full PNG functionality.');
      }
      
      // Always provide a helpful error message for other WASM errors
  throw new Error(`PNG conversion failed to initialize: ${error instanceof Error ? error.message : 'Unknown WASM error'}. Use format=svg for testing, or deploy to Cloudflare Workers for full PNG functionality.`);
    }
  })();

  return wasmInitializationPromise;
}

/**
 * Convert SVG to PNG using resvg-wasm
 * Outputs PNG optimized for Open Graph (1200x630)
 */
export async function svgToPng(svgString: string): Promise<Uint8Array> {
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
