export {};

interface KVTemplateRecord {
	id: string;
	account: string;
	name: string;
	slug: string;
	source: string;
	version: number;
	createdAt: string;
	updatedAt: string;
	published: boolean;
}

export interface PublicTemplate {
	id: string;
	name: string;
	slug: string;
	version: number;
	createdAt: string;
	updatedAt: string;
	published: boolean;
}

export async function listTemplatesForAccount(accountId: string, env: Env): Promise<PublicTemplate[]> {
	const result = await env.TEMPLATES.list({ prefix: 'template:' });
	const templates: PublicTemplate[] = [];
	for (const key of result.keys) {
		const meta = (key as any).metadata as { account?: string } | undefined;
		if (meta && meta.account !== accountId) continue;
		const rec = await env.TEMPLATES.get(key.name, 'json') as KVTemplateRecord | null;
		if (!rec || rec.account !== accountId) continue;
		templates.push(toPublic(rec));
	}
	templates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	return templates;
}

export async function createTemplateForAccount(
	accountId: string,
	input: { name: string; slug: string; source: string },
	env: Env
): Promise<PublicTemplate> {
	const nowISO = new Date().toISOString();
	const id = crypto.randomUUID();
	const rec: KVTemplateRecord = {
		id,
		account: accountId,
		name: input.name,
		slug: input.slug,
		source: input.source,
		version: 1,
		createdAt: nowISO,
		updatedAt: nowISO,
		published: false,
	};
	const key = `template:${id}`;
	await env.TEMPLATES.put(key, JSON.stringify(rec), {
		metadata: { account: accountId, slug: input.slug, created_at: Date.now() },
	});
	return toPublic(rec);
}

function toPublic(rec: KVTemplateRecord): PublicTemplate {
	const { id, name, slug, version, createdAt, updatedAt, published } = rec;
	return { id, name, slug, version, createdAt, updatedAt, published };
}

