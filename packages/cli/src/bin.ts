#!/usr/bin/env node
export {};

import { preview } from './index.js';

type Options = Record<string, string | boolean>;

function parseArgs(argv: string[]): { cmd?: string; options: Options } {
  const args = argv.slice(2);
  const res: { cmd?: string; options: Options } = { options: {} };
  if (args.length === 0) return res;
  res.cmd = args[0] as string;
  for (let i = 1; i < args.length; i++) {
    const token = args[i] as string | undefined;
    if (!token) continue;
    if (token.startsWith('--no-')) {
      res.options[token.slice(5)] = false;
      continue;
    }
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        res.options[key] = true;
      } else {
        res.options[key] = next;
        i++;
      }
      continue;
    }
  }
  return res;
}

async function main() {
  const { cmd, options } = parseArgs(process.argv);
  if (!cmd || (cmd !== 'preview')) {
    console.log('Usage: edge-og preview [--title "Hello"] [--description "..."] [--theme light|dark|blue|green|purple] [--font inter|roboto|playfair|opensans] [--fontUrl <url>] [--format png|svg] [--out <file>] [--no-open]');
    process.exit(1);
  }

  const opts: any = { template: 'default' };
  if (typeof options.title === 'string') opts.title = options.title;
  if (typeof options.description === 'string') opts.description = options.description;
  if (typeof options.theme === 'string') opts.theme = options.theme;
  if (typeof options.font === 'string') opts.font = options.font;
  if (typeof options.fontUrl === 'string') opts.fontUrl = options.fontUrl;
  if (typeof options.format === 'string') opts.format = options.format;
  if (typeof options.out === 'string') opts.outPath = options.out;
  if (options.open === false || options['no-open'] === true) opts.open = false;

  const result = await preview(opts);

  console.log(result.message);
}

main().catch((err) => {
  console.error(String(err?.message || err));
  process.exit(1);
});
