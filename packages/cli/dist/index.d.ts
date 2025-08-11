export {};
export interface PreviewOptions {
    title?: string;
    description?: string;
    template?: 'default';
    theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
    font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
    fontUrl?: string;
    format?: 'png' | 'svg';
    outPath?: string;
    open?: boolean;
}
export declare function preview(opts: PreviewOptions): Promise<{
    readonly ok: true;
    readonly path: string;
    readonly ms: number;
    readonly message: `Saved to ${string} in ${number}ms`;
}>;
