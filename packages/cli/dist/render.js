import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
// Minimal logger
function log(data) {
    try {
        console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...data }));
    }
    catch { }
}
// WASM init state
let wasmInitialized = false;
let wasmInitializationPromise = null;
let wasmUnavailable = false;
async function ensureWasmInitialized() {
    if (wasmInitialized)
        return;
    if (wasmUnavailable)
        throw new Error('WASM unavailable');
    if (wasmInitializationPromise)
        return wasmInitializationPromise;
    wasmInitializationPromise = (async () => {
        try {
            // Try unpkg CDN similar to worker
            const wasmUrl = 'https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm';
            log({ event: 'wasm_fetch', url: wasmUrl });
            const resp = await fetch(wasmUrl);
            if (!resp.ok)
                throw new Error(`HTTP ${resp.status}`);
            const buf = await resp.arrayBuffer();
            await initWasm(buf);
            wasmInitialized = true;
            log({ event: 'wasm_initialized' });
        }
        catch (err) {
            wasmUnavailable = true;
            wasmInitializationPromise = null;
            const msg = err instanceof Error ? err.message : String(err);
            log({ event: 'wasm_init_failed', error: msg });
            throw new Error('PNG conversion is not available in this environment. Use format=svg or deploy to a WASM-enabled runtime.');
        }
    })();
    return wasmInitializationPromise;
}
// Template helpers
function getThemeColors(theme) {
    const themes = {
        light: { backgroundColor: '#ffffff', textColor: '#1a1a1a', accentColor: '#2563eb', cardColor: '#f9fafb' },
        dark: { backgroundColor: '#1a1a1a', textColor: '#ffffff', accentColor: '#3b82f6', cardColor: '#374151' },
        blue: { backgroundColor: '#dbeafe', textColor: '#1e3a8a', accentColor: '#1d4ed8', cardColor: '#bfdbfe' },
        green: { backgroundColor: '#dcfce7', textColor: '#14532d', accentColor: '#16a34a', cardColor: '#bbf7d0' },
        purple: { backgroundColor: '#f3e8ff', textColor: '#581c87', accentColor: '#9333ea', cardColor: '#ddd6fe' },
    };
    return themes[theme] || themes.light;
}
function getFontFamily(font, customFontUrl) {
    if (customFontUrl) {
        try {
            const fileName = new URL(customFontUrl).pathname.split('/').pop() || 'CustomFont';
            const family = fileName.split('.')[0] || 'CustomFont';
            return `${family}, sans-serif`;
        }
        catch { }
    }
    const fonts = {
        inter: 'Inter, sans-serif',
        roboto: 'Roboto, sans-serif',
        playfair: 'Playfair Display, serif',
        opensans: 'Open Sans, sans-serif',
    };
    return fonts[font] || fonts.inter;
}
function sanitizeText(text) {
    if (!text)
        return '';
    return text
        .replace(/<\/?([^>]*)>/g, ' $1 ')
        .replace(/[<>"']/g, ' ')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function getEmojiGraphemes() {
    return {
        '🔥': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f525.svg',
        '🚀': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f680.svg',
        '⭐': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/2b50.svg',
        '✨': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/2728.svg',
    };
}
function getEmojiHex(emoji) {
    try {
        const cps = [];
        for (let i = 0; i < emoji.length; i++) {
            const code = emoji.codePointAt(i);
            if (code) {
                cps.push(code.toString(16).toLowerCase());
                if (code >= 0x10000)
                    i++;
            }
        }
        return cps.join('-');
    }
    catch {
        return null;
    }
}
async function getFontsByName(fontName = 'inter') {
    const FONT_CONFIGS = {
        inter: { family: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700' },
        roboto: { family: 'Roboto', url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700' },
        playfair: { family: 'Playfair Display', url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700' },
        opensans: { family: 'Open Sans', url: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700' },
    };
    const config = FONT_CONFIGS[fontName] ?? FONT_CONFIGS.inter;
    const characters = encodeURIComponent('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?()-:;');
    const cssUrl = `${config.url}&text=${characters}`;
    const css = await fetch(cssUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } });
    if (!css.ok)
        throw new Error(`Failed to fetch CSS for ${config.family}: ${css.status}`);
    const cssText = await css.text();
    const m = cssText.match(/src: url\(([^)]+)\) format\('\w+'\)/);
    if (!m || !m[1])
        throw new Error(`No TTF/OTF URL in CSS for ${config.family}`);
    const fontResp = await fetch(m[1]);
    if (!fontResp.ok)
        throw new Error(`Font fetch failed ${config.family}: ${fontResp.status}`);
    const buf = await fontResp.arrayBuffer();
    return [
        { name: config.family, data: buf, weight: 400, style: 'normal' },
        { name: config.family, data: buf, weight: 700, style: 'normal' },
    ];
}
async function getFontsByUrl(fontUrl) {
    const resp = await fetch(fontUrl);
    if (!resp.ok)
        throw new Error(`Font fetch failed: ${resp.status}`);
    const buf = await resp.arrayBuffer();
    return [
        { name: 'CustomFont', data: buf, weight: 400, style: 'normal' },
        { name: 'CustomFont', data: buf, weight: 700, style: 'normal' },
    ];
}
async function generateSVG(element, opts = {}) {
    const { width = 1200, height = 630, fonts = [] } = opts;
    const defaultFonts = fonts.length > 0 ? fonts : await getFontsByName('inter');
    const svg = await satori(element, {
        width, height, fonts: defaultFonts,
        graphemeImages: getEmojiGraphemes(),
        loadAdditionalAsset: async (code, seg) => {
            if (code === 'emoji') {
                const hex = getEmojiHex(seg);
                if (hex)
                    return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${hex}.svg`;
            }
            return '';
        },
    });
    return svg;
}
async function svgToPng(svgString) {
    await ensureWasmInitialized();
    const resvg = new Resvg(svgString, { background: 'white', fitTo: { mode: 'width', value: 1200 } });
    const png = resvg.render().asPng();
    return png;
}
// Default template roughly matching worker default
function DefaultTemplate({ title, description, theme, font, emoji = '🌟' }) {
    const themeColors = getThemeColors(theme);
    const fontFamily = getFontFamily(font);
    const safeTitle = sanitizeText(title || 'Edge-OG').slice(0, 60);
    const safeDesc = sanitizeText(description || 'Open Graph Generator at the Edge').slice(0, 100);
    return {
        type: 'div',
        props: {
            style: { height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.backgroundColor, fontFamily, padding: '80px' },
            children: [{
                    type: 'div',
                    props: {
                        style: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', backgroundColor: themeColors.cardColor, padding: '60px', borderRadius: '24px', boxShadow: theme === 'dark' ? '0 25px 50px rgba(0,0,0,0.5)' : '0 25px 50px rgba(0,0,0,0.1)', maxWidth: '800px' },
                        children: [
                            { type: 'div', props: { style: { width: '80px', height: '80px', backgroundColor: themeColors.accentColor, borderRadius: '16px', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: [{ type: 'div', props: { style: { color: 'white', fontSize: '32px', fontWeight: '700' }, children: emoji } }] } },
                            { type: 'div', props: { style: { fontSize: '48px', fontWeight: '700', color: themeColors.textColor, lineHeight: '1.2', marginBottom: '16px', wordWrap: 'break-word' }, children: safeTitle } },
                            { type: 'div', props: { style: { fontSize: '20px', color: themeColors.textColor, opacity: 0.7, lineHeight: '1.5', maxWidth: '500px' }, children: safeDesc } },
                        ],
                    },
                }],
        },
    };
}
export async function renderOpenGraphImage(params) {
    const { title, description, theme = 'light', font = 'inter', fontUrl, template = 'default', format = 'png', fallbackToSvg = true } = params;
    // Build props without explicitly setting undefined optional fields (exactOptionalPropertyTypes)
    const props = { theme, font };
    if (typeof title !== 'undefined')
        props.title = title;
    if (typeof description !== 'undefined')
        props.description = description;
    const element = DefaultTemplate(props);
    const svg = await generateSVG(element, { width: 1200, height: 630, fonts: fontUrl ? await getFontsByUrl(fontUrl) : await getFontsByName(font) });
    if (format === 'svg')
        return svg;
    try {
        const png = await svgToPng(svg);
        return png;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log({ event: 'png_conversion_failed', message: msg });
        if (fallbackToSvg) {
            log({ event: 'fallback_to_svg' });
            return svg;
        }
        throw error;
    }
}
