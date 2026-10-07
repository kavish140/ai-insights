import type { SupabaseClient } from '@supabase/supabase-js';

// Persist useful arguments for exact retries without storing image bytes or credentials.
export function activityArguments(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return {};
  const safe = JSON.stringify(args, (key, value) =>
    /base64|password|token|secret|authorization/i.test(key) ? '[omitted]' : value);
  return safe.length <= 250000 ? JSON.parse(safe) : { payload_omitted: 'Arguments exceeded the logging limit.' };
}

export async function recordOperation(database: SupabaseClient, tool: string, args: unknown, response: Response, started: number) {
  try {
    const text = await response.clone().text();
    const payload = JSON.parse(text.startsWith('event:') || text.startsWith('data:') ? text.split('\n').find(line => line.startsWith('data:'))!.slice(5).trim() : text);
    const result = payload.result;
    const failed = !!payload.error || !response.ok || !!result?.isError;
    const structured = result?.structuredContent ?? {};
    const post = structured.post;
    const image = structured.image;
    const summary = post ? { post: { id: post.id, title: post.title, slug: post.slug, category: post.category, status: post.status, revision: post.revision, cover_image_url: post.cover_image_url }, replayed: structured.replayed } : image ? { image: { path: image.path, url: image.url, alt: image.alt }, reused: structured.reused } : { valid: structured.valid, errors: structured.errors, warnings: structured.warnings };
    const error = failed ? String(payload.error?.message ?? result?.content?.find((block: {type: string}) => block.type === 'text')?.text ?? `HTTP ${response.status}`).slice(0, 2000) : null;
    const { error: logError } = await database.from('mcp_operations').insert({
      tool: tool.slice(0,100), arguments: activityArguments(args), result: summary,
      outcome: failed ? 'failed' : 'success', error, duration_ms: Math.max(0,Date.now()-started),
    }).abortSignal(AbortSignal.timeout(5000));
    if (logError) console.error('MCP operation logging failed:', logError.code);
  } catch { console.error('MCP operation could not be logged.'); }
}
