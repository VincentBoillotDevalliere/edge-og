import { describe, expect, it } from 'vitest';
import { preview } from '../src/index';
import { promises as fs } from 'node:fs';
describe('CLI preview()', () => {
    it('writes output file and reports timing', async () => {
        const res = await preview({ title: 'Hello', description: 'World', format: 'svg', outPath: 'tmp-preview.svg', open: false });
        expect(res.ok).toBe(true);
        expect(res.path).toMatch(/tmp-preview\.svg$/);
        const content = await fs.readFile(res.path, 'utf8');
        expect(content).toContain('<svg');
    }, 20000);
});
