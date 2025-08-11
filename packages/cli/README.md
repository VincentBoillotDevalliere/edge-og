# @edge-og/cli

Edge-OG CLI to preview Open Graph images locally without an account.

Usage:

- Build once: pnpm -C packages/cli build
- Quick run (dev): pnpm -C packages/cli dev -- preview --title "Hello"

Examples:

- edge-og preview --title "Hello" --theme dark
- edge-og preview --title "Docs" --format svg --out preview.svg --no-open

Notes:

- PNG rendering uses resvg-wasm. In environments where WASM is restricted, the CLI automatically falls back to SVG output when format=png.
- Expected time to open a PNG locally is under 2 seconds on a typical macOS laptop.
