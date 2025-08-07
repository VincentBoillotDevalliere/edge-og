import { vi } from 'vitest';

// Mock the render function to avoid Satori dependency issues in tests
export const mockRenderOpenGraphImage = vi.fn().mockImplementation(async (params) => {
	// Simulate some processing time
	await new Promise(resolve => setTimeout(resolve, 5));
	
	// Return a fake PNG buffer for testing
	const fakeImage = new ArrayBuffer(1000);
	const view = new Uint8Array(fakeImage);
	// Add PNG signature
	view[0] = 137; view[1] = 80; view[2] = 78; view[3] = 71;
	view[4] = 13; view[5] = 10; view[6] = 26; view[7] = 10;
	return fakeImage;
});

// Mock the entire render module before any imports
vi.doMock('../src/render', () => ({
	renderOpenGraphImage: mockRenderOpenGraphImage,
}));

// Also mock satori and resvg to prevent loading issues
vi.doMock('satori', () => ({
	default: vi.fn(),
}));

vi.doMock('@resvg/resvg-wasm', () => ({
	Resvg: vi.fn(),
	initWasm: vi.fn(),
}));
