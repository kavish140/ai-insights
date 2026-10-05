import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';
import { createHandler } from './server.ts';
import { checkImportUrl, readLimitedImage, MAX_IMAGE_BYTES } from './images.ts';

const db = new PGlite();
const storedImages = new Map<string, Uint8Array>();
const migrations = new URL('../../migrations/', import.meta.url);

before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  await db.exec(await readFile(new URL('202610050001_articles.sql', migrations), 'utf8'));
  await db.exec(await readFile(new URL('20261005115834_mcp_blog_tools.sql', migrations), 'utf8'));
  await db.exec(await readFile(new URL('20261005170811_mcp_images_v2.sql', migrations), 'utf8'));
  await db.exec('set role service_role');
});
after(async () => { await db.close(); });

// A minimal PostgREST boundary runs every write through the real PostgreSQL RPC.
// Read queries implement only the filters exercised by the MCP tools.
const client = createClient('http://database.invalid', 'test-server-credential', {
  auth: { persistSession: false },
  global: { fetch: async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/storage/v1/object/blog-images/')) {
        const path = url.pathname.slice('/storage/v1/object/blog-images/'.length);
        if (storedImages.has(path)) return Response.json({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }, { status: 409 });
        storedImages.set(path, new Uint8Array(await request.arrayBuffer()));
        return Response.json({ Key: `blog-images/${path}` });
      }
      if (url.pathname.endsWith('/blog_images')) {
        if (request.method === 'POST') {
          const payload = await request.json();
          const row = Array.isArray(payload) ? payload[0] : payload;
          const columns = ['path', 'url', 'sha256', 'mime_type', 'byte_size', 'alt', 'source_url', 'credit', 'license_note'];
          const { rows } = await db.query(`insert into public.blog_images (${columns.join(',')}) values (${columns.map((_, i) => `$${i + 1}`).join(',')}) on conflict(path) do nothing returning *`, columns.map(key => row[key]));
          return Response.json(rows);
        }
        let where = ''; const values: string[] = [];
        const path = url.searchParams.get('path');
        if (path) { where = 'where path=$1'; values.push(path.slice(3)); }
        const urls = url.searchParams.get('url');
        if (urls?.startsWith('in.(')) {
          values.push(...urls.slice(4, -1).split(',').map(value => value.replace(/^"|"$/g, '')));
          where = `where url in (${values.map((_, i) => `$${i + 1}`).join(',')})`;
        }
        const { rows } = await db.query(`select * from public.blog_images ${where} order by created_at desc`, values);
        const single = request.headers.get('accept')?.includes('vnd.pgrst.object');
        return Response.json(single ? rows[0] : rows, { headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` } });
      }
      if (url.pathname.endsWith('/rpc/mcp_write_post')) {
        const args = await request.json();
        const { rows } = await db.query<{ result: unknown }>(
          'select public.mcp_write_post($1, $2::uuid, $3::jsonb, $4::uuid, $5::bigint) as result',
          [args.p_tool, args.p_request_id, JSON.stringify(args.p_payload), args.p_post_id, args.p_expected_revision],
        );
        return Response.json(rows[0].result);
      }
      if (!url.pathname.endsWith('/posts')) return new Response('Not found', { status: 404 });
      const conditions: string[] = []; const params: unknown[] = [];
      for (const key of ['id', 'slug', 'status', 'category']) {
        const filter = url.searchParams.get(key); if (!filter) continue;
        const [operator, ...parts] = filter.split('.'); params.push(parts.join('.'));
        conditions.push(`${key} ${operator === 'neq' ? '<>' : '='} $${params.length}`);
      }
      const title = url.searchParams.get('title');
      if (title) { params.push(title.slice('ilike.'.length)); conditions.push(`title ilike $${params.length}`); }
      const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
      const { rows } = await db.query<{ row: unknown }>(`select to_jsonb(p) as row from public.posts p ${where} order by updated_at desc, id desc`, params);
      const single = request.headers.get('accept')?.includes('vnd.pgrst.object');
      const headers = { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` };
      return Response.json(single ? (rows[0]?.row ?? null) : rows.map(item => item.row), { headers });
    } catch (error) {
      const failure = error as { code: string; message: string };
      return Response.json({ code: failure.code, message: failure.message }, { status: 400 });
    }
  } },
});
const handler = createHandler(client);
async function rpc(method: string, params: unknown = {}, id = 1) {
  const response = await handler(new Request('https://project.supabase.co/functions/v1/blog-mcp', {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  }));
  const text = await response.text();
  assert.equal(response.status, 200, text);
  const dataLine = text.split('\n').find(line => line.startsWith('data:'));
  return JSON.parse(dataLine ? dataLine.slice(5).trim() : text);
}
async function call(name: string, args: unknown) {
  const response = await rpc('tools/call', { name, arguments: args });
  if (response.error) return { error: response.error.message };
  if (response.result.isError) return { error: response.result.content[0].text };
  return JSON.parse(response.result.content[0].text);
}
function draft(slug = `test-${randomUUID()}`) {
  return { request_id: randomUUID(), title: 'Test article', slug, description: 'A useful test article about automation.', category: 'Automation', body: '<p>Original article body.</p>' };
}

test('stateless initialization and all eleven tools are available without auth', async () => {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test-client', version: '1' } });
  assert.equal(init.result.serverInfo.name, 'ai-insights-blog');
  const tools = await rpc('tools/list');
  assert.deepEqual(tools.result.tools.map((tool: { name: string }) => tool.name).sort(), ['get_site_context', 'list_posts', 'get_post', 'create_draft', 'update_draft', 'validate_draft', 'publish_post', 'unpublish_post', 'upload_image', 'import_image_url', 'list_images'].sort());
  assert.equal((await call('get_site_context', {})).url, 'https://ai-insights.sitenova.dev');
});

test('drafts sanitize HTML, refuse injected status, and deduplicate exact retries', async () => {
  const input = { ...draft(), body: '<p onclick="evil()">Safe body.</p><script>evil()</script>' };
  const created = await call('create_draft', input);
  assert.equal(created.post.status, 'draft');
  assert.equal(created.post.revision, 1);
  assert.equal(created.post.body, '<p>Safe body.</p>');
  assert.equal(created.markup_removed, true);
  const retry = await call('create_draft', input);
  assert.equal(retry.post.id, created.post.id);
  assert.equal(retry.replayed, true);
  assert.match((await call('create_draft', { ...input, title: 'Different request' })).error, /REQUEST_ID_REUSED/);
  assert.ok((await call('create_draft', { ...draft(), status: 'published' })).error);
  assert.ok((await call('create_draft', { ...draft(), body: '<script>evil()</script>' })).error);
});

test('edits reject stale revisions and publishing requires explicit confirmation', async () => {
  const { post } = await call('create_draft', draft());
  const changes = { post_id: post.id, expected_revision: 1, request_id: randomUUID(), changes: { title: 'Updated article' } };
  const edited = await call('update_draft', changes);
  assert.equal(edited.post.revision, 2);
  assert.match((await call('update_draft', { ...changes, request_id: randomUUID() })).error, /REVISION_CONFLICT/);
  assert.equal((await call('get_post', { post_id: post.id })).revision, 2);
  assert.equal((await call('validate_draft', { post_id: post.id })).valid, true);
  const publish = { post_id: post.id, expected_revision: 2, request_id: randomUUID() };
  assert.ok((await call('publish_post', publish)).error);
  assert.ok((await call('publish_post', { ...publish, confirmed: false })).error);
  const published = await call('publish_post', { ...publish, confirmed: true });
  assert.equal(published.post.status, 'published');
  assert.equal(published.post.revision, 3);
  assert.match(published.url, /\/blog\//);
  const retry = await call('publish_post', { ...publish, confirmed: true });
  assert.equal(retry.replayed, true);
  assert.equal(retry.post.revision, 3);
  assert.match((await call('update_draft', { ...changes, expected_revision: 3, request_id: randomUUID() })).error, /Only drafts/);
  const unpublished = await call('unpublish_post', { post_id: post.id, expected_revision: 3, request_id: randomUUID(), confirmed: true });
  assert.equal(unpublished.post.status, 'draft');
  assert.equal(unpublished.post.revision, 4);
  const audit = await db.query<{ action: string; source: string }>('select action, source from public.post_activity where post_id=$1 order by id', [post.id]);
  assert.deepEqual(audit.rows.map(row => row.action), ['create_draft', 'update_draft', 'publish_post', 'unpublish_post']);
  assert.ok(audit.rows.every(row => row.source === 'mcp-public'));
});

test('validation blocks future dates and updates cannot inject unknown fields', async () => {
  const created = await call('create_draft', { ...draft(), date: '2099-01-01' });
  assert.equal((await call('validate_draft', { post_id: created.post.id })).valid, false);
  assert.match((await call('publish_post', { post_id: created.post.id, expected_revision: 1, request_id: randomUUID(), confirmed: true })).error, /Future dates/);
  assert.ok((await call('update_draft', { post_id: created.post.id, expected_revision: 1, request_id: randomUUID(), changes: { status: 'published' } })).error);
  assert.ok((await call('get_post', { post_id: randomUUID() })).error);
  assert.ok((await call('list_posts', { page_size: 100000 })).error);
  const listed = await call('list_posts', { status: 'draft', search: 'Test' });
  assert.ok(listed.posts.length > 0);
});

test('website roles cannot call privileged RPC or read audit/idempotency data', async () => {
  try {
    await db.exec('set role anon');
    const publicPosts = await db.query('select * from public.posts');
    assert.equal(publicPosts.rows.length, 0, 'All test posts are drafts');
    await assert.rejects(db.query('select * from public.post_activity'), /permission denied/);
    await assert.rejects(db.query('select * from public.blog_images'), /permission denied/);
    await assert.rejects(db.query('select * from private.mcp_requests'), /permission denied/);
    await assert.rejects(db.query('select public.mcp_write_post($1, $2)', ['create_draft', randomUUID()]), /permission denied/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select public.mcp_write_post($1, $2)', ['create_draft', randomUUID()]), /permission denied/);
    const activity = await db.query('select * from public.post_activity');
    assert.equal(activity.rows.length, 0, 'A signed-in non-admin cannot read activity');
  } finally { await db.exec('set role service_role'); }
});

test('rejects hostile browser origins and oversized/malformed requests', async () => {
  const foreign = await handler(new Request('https://example.com/blog-mcp', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' }));
  assert.equal(foreign.status, 403);
  const oversized = await handler(new Request('https://example.com/blog-mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(6 * 1024 * 1024 + 1) }));
  assert.equal(oversized.status, 413);
  const malformed = await handler(new Request('https://example.com/blog-mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{' }));
  assert.ok([400, 200].includes(malformed.status));
  assert.ok(!((await malformed.text()).includes('test-server-credential')));
});

test('v2 uploads reuse content, require permission metadata and validate cover/inline images', async () => {
  const input = {
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDYQAAAAASUVORK5CYII=',
    alt: 'A test pixel', source_url: 'https://example.com/original', credit: 'Test fixture', license_note: 'Original test fixture, permitted for this test.',
  };
  const uploaded = await call('upload_image', input);
  assert.ok(!uploaded.error, JSON.stringify(uploaded));
  assert.match(uploaded.image.url, /blog-images\/articles\/[a-f0-9]{64}\.png$/);
  const retried = await call('upload_image', input);
  assert.equal(retried.image.url, uploaded.image.url);
  assert.equal(retried.reused, true);
  assert.equal(storedImages.size, 1);
  assert.equal((await call('list_images', {})).images.length, 1);
  assert.ok((await call('upload_image', { ...input, license_note: '' })).error);
  assert.ok((await call('upload_image', { ...input, base64: btoa('<svg>invalid</svg>') })).error);
  assert.ok((await call('upload_image', { ...input, base64: 'not base64!' })).error);
  assert.match((await call('import_image_url', { ...input, base64: undefined, image_url: 'http://127.0.0.1/private' })).error, /HTTPS|Validation/);
  assert.match((await call('import_image_url', { alt: input.alt, source_url: input.source_url, credit: input.credit, license_note: input.license_note, image_url: 'https://images.unsplash.com.evil.example/image' })).error, /hosts only/);
  const created = await call('create_draft', {
    ...draft(), cover_image_url: uploaded.image.url, cover_image_alt: 'A cover pixel',
    body: `<p>Image article.</p><figure><img src="${uploaded.image.url}" alt="A test pixel" onerror="evil()"><figcaption>Test fixture credit.</figcaption></figure><img src="https://evil.example/tracker.png" alt="Bad">`,
  });
  assert.ok(!created.error, JSON.stringify(created));
  assert.equal(created.post.cover_image_url, uploaded.image.url);
  assert.ok(created.post.body.includes('figcaption'));
  assert.ok(!created.post.body.includes('onerror') && !created.post.body.includes('evil.example'));
  assert.equal((await call('validate_draft', { post_id: created.post.id })).valid, true);
  const withoutAlt = await call('update_draft', { post_id: created.post.id, expected_revision: 1, request_id: randomUUID(), changes: { cover_image_alt: '' } });
  assert.equal(withoutAlt.post.revision, 2);
  assert.equal((await call('validate_draft', { post_id: created.post.id })).valid, false);
  assert.ok((await call('publish_post', { post_id: created.post.id, expected_revision: 2, request_id: randomUUID(), confirmed: true })).error);
  const removed = await call('update_draft', { post_id: created.post.id, expected_revision: 2, request_id: randomUUID(), changes: { cover_image_url: '', cover_image_alt: '' } });
  assert.equal(removed.post.cover_image_url, '');
  assert.equal((await call('validate_draft', { post_id: created.post.id })).valid, true);
  const fakeImage = uploaded.image.url.replace(/[a-f0-9]{64}/, 'b'.repeat(64));
  const missingImagePost = await call('create_draft', { ...draft(), cover_image_url: fakeImage, cover_image_alt: 'Missing image' });
  assert.equal((await call('validate_draft', { post_id: missingImagePost.post.id })).valid, false);
});

test('image import rejects unsafe destinations and oversized streamed downloads', async () => {
  for (const url of ['https://127.0.0.1/image', 'http://images.unsplash.com/photo', 'https://user:pass@images.unsplash.com/photo', 'https://images.unsplash.com:444/photo', 'https://images.unsplash.com.evil.example/photo']) {
    assert.throws(() => checkImportUrl(url), /HTTPS/);
  }
  assert.equal(checkImportUrl('https://images.unsplash.com/photo-123?w=1200').hostname, 'images.unsplash.com');
  await assert.rejects(readLimitedImage(new Response(new Uint8Array(MAX_IMAGE_BYTES + 1))), /4 MiB/);
  await assert.rejects(readLimitedImage(new Response(null, { status: 302 })), /HTTP 302/);
});
