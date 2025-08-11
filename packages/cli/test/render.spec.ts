import { describe, expect, it } from 'vitest';
import { renderOpenGraphImage } from '../src/render';

describe('renderOpenGraphImage', () => {
  it('returns SVG string when format=svg', async () => {
    const svg = await renderOpenGraphImage({ title: 'Test', description: 'Desc', format: 'svg' });
    expect(typeof svg).toBe('string');
    expect(svg).toContain('<svg');
  }, 20000);

  it('returns PNG buffer or SVG fallback when format=png', async () => {
    const out = await renderOpenGraphImage({ title: 'PNG', description: 'Try', format: 'png', fallbackToSvg: true });
    if (typeof out === 'string') {
      expect(out).toContain('<svg');
    } else {
      expect(out).toBeInstanceOf(Uint8Array);
      expect(out.byteLength).toBeGreaterThan(1000);
    }
  }, 20000);
});
