import { promises as fs } from 'node:fs';
import path from 'node:path';
import open from 'open';
import { renderOpenGraphImage } from './render.js';
export async function preview(opts) {
    const start = Date.now();
    const { title = 'Edge-OG Preview', description = 'Open Graph image generated locally', template = 'default', theme = 'light', font = 'inter', fontUrl, format = 'png', outPath = `edge-og-preview.${format}`, open: shouldOpen = true, } = opts;
    const renderParams = { theme, font, template, format, fallbackToSvg: true };
    if (typeof title !== 'undefined')
        renderParams.title = title;
    if (typeof description !== 'undefined')
        renderParams.description = description;
    if (typeof fontUrl !== 'undefined')
        renderParams.fontUrl = fontUrl;
    const data = await renderOpenGraphImage(renderParams);
    const outputPath = path.resolve(process.cwd(), outPath);
    if (typeof data === 'string') {
        await fs.writeFile(outputPath, data, 'utf8');
    }
    else {
        await fs.writeFile(outputPath, Buffer.from(data));
    }
    if (shouldOpen) {
        try {
            await open(outputPath);
        }
        catch {
            // ignore
        }
    }
    const duration = Date.now() - start;
    return { ok: true, path: outputPath, ms: duration, message: `Saved to ${outputPath} in ${duration}ms` };
}
