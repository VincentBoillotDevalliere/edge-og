export {};
export declare function renderOpenGraphImage(params: {
    title?: string;
    description?: string;
    theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
    font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
    fontUrl?: string;
    template?: 'default';
    format?: 'png' | 'svg';
    fallbackToSvg?: boolean;
}): Promise<Uint8Array | string>;
