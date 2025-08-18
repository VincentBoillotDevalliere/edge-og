export {};

import { log } from '../utils/logger';

/**
 * Template record persisted in KV under key template:{id}
 * As per ROADMAP DB-2.2 (for creation/update), we expect:
 * { account, name, slug, source, version, createdAt, updatedAt, published, deletedAt? }
 */
export interface TemplateRecord {
  account: string;
  name: string;
  slug: string;
  source?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  published?: boolean;
  deletedAt?: string | null;
}

export interface TemplateListItem {
  id: string;
  name: string;
  slug: string;
  updatedAt: string;
  published: boolean;
}

/**
 * List templates belonging to an account, excluding soft-deleted.
 * Returns a lightweight list suitable for DB-2.1 UI.
 */
export async function listTemplatesForAccount(env: Env, accountId: string): Promise<TemplateListItem[]> {
  const items: TemplateListItem[] = [];
  try {
    const { keys } = await env.TEMPLATES.list({ prefix: 'template:' });
    for (const key of keys) {
      const id = key.name.substring('template:'.length);
      // Load record (no metadata guarantees yet)
      const rec = await env.TEMPLATES.get(key.name, 'json') as TemplateRecord | null;
      if (!rec) continue;
      if (rec.account !== accountId) continue; // enforce ownership
      if ((rec as any).deletedAt) continue; // hide soft-deleted by default
      const updated = rec.updatedAt || rec.createdAt || new Date().toISOString();
      items.push({
        id,
        name: String(rec.name || '').slice(0, 200),
        slug: String(rec.slug || '').slice(0, 200),
        updatedAt: updated,
        published: Boolean(rec.published),
      });
    }
  } catch (error) {
    log({ event: 'templates_list_kv_failed', error: error instanceof Error ? error.message : String(error) });
    // Fail soft with empty list; caller may convert to 500 if desired
  }

  // Default sort: updatedAt desc
  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return items;
}
