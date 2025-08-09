import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Ensure isolated modules
export {};

import { generateAPIKey } from '../src/utils/auth';

// Minimal env mock for hashing
const envMock = {
  JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
} as any;

describe('AQ-5.2: API Key Entropy ≥ 256 bits', () => {
  let getRandomValuesSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
  getRandomValuesSpy = vi.spyOn((globalThis as any).crypto, 'getRandomValues');
  });

  afterEach(() => {
    getRandomValuesSpy.mockRestore();
  });

  it('uses crypto.getRandomValues for 8-byte prefix and 32-byte secret', async () => {
    const { fullKey } = await generateAPIKey('acc-1', 'Test Key', envMock);

    // Verify format
    expect(fullKey).toMatch(/^eog_[A-Za-z0-9]+_[A-Za-z0-9]+$/);

    // Verify getRandomValues was called with Uint8Array(8) and Uint8Array(32)
    const lengths = getRandomValuesSpy.mock.calls.map((args) => {
      const arg = args[0] as Uint8Array;
      return arg?.length;
    });

    expect(lengths).toContain(8);
    expect(lengths).toContain(32);

    // Verify secret encodes >= 256 bits (Base62 length for 32 bytes is >= 43)
    const parts = fullKey.split('_');
    const secretPart = parts[2];
    expect(secretPart.length).toBeGreaterThanOrEqual(43);
  });
});
