import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';
import { createHandler } from './server.ts';
import { checkImportUrl, readLimitedImage, MAX_IMAGE_BYTES, imageDimensions } from './images.ts';
import { activityArguments } from './activity.ts';
import { seoIssues } from '../../../src/lib/seo-health.ts';

const db = new PGlite();
const storedImages = new Map<string, Uint8Array>();
const migrations = new URL('../../migrations/', import.meta.url);

before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema storage;
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select, insert, delete on storage.objects to authenticated;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  await db.exec(await readFile(new URL('202610050001_articles.sql', migrations), 'utf8'));
  await db.exec(await readFile(new URL('20261005115834_mcp_blog_tools.sql', migrations), 'utf8'));
  await db.exec(await readFile(new URL('20261005170811_mcp_images_v2.sql', migrations), 'utf8'));
  await db.exec(await readFile(new URL('20261007043618_basic_admin.sql', migrations), 'utf8'));
  await db.exec(await readFile(new URL('20261007051335_good_admin.sql', migrations), 'utf8'));
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
      if (url.pathname.endsWith('/mcp_operations')) {
        if (request.method === 'POST') {
          const record = await request.json();
          await db.query('insert into public.mcp_operations(tool,arguments,result,outcome,error,duration_ms) values ($1,$2::jsonb,$3::jsonb,$4,$5,$6)',[record.tool,JSON.stringify(record.arguments),JSON.stringify(record.result),record.outcome,record.error,record.duration_ms]);
          return Response.json({});
        }
        const { rows } = await db.query('select id from public.mcp_operations limit 1');
        return Response.json(rows);
      }
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
          const columns = ['path', 'url', 'sha256', 'mime_type', 'byte_size', 'alt', 'source_url', 'credit', 'license_note', 'width', 'height'];
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
      if (url.pathname.endsWith('/categories')) {
        const { rows } = await db.query('select name from public.categories order by name');
        return Response.json(rows);
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

test('basic admin enforces roles, manages categories and protects used media', async () => {
  await db.exec('reset role');
  const adminId = randomUUID();
  await db.query('insert into auth.users(id) values ($1)', [adminId]);
  await db.query('insert into public.admin_users(user_id) values ($1)', [adminId]);
  try {
    await db.exec('set role anon');
    assert.ok((await db.query('select * from public.categories')).rows.length >= 3);
    await assert.rejects(db.query("insert into public.categories(name) values ('Blocked')"), /permission denied/);
    await assert.rejects(db.query('select public.admin_access()'), /permission denied/);
    await db.exec('set role authenticated');
    assert.equal((await db.query<{ access: boolean }>('select public.admin_access() as access')).rows[0].access, false);
    await assert.rejects(db.query("insert into public.categories(name) values ('Blocked')"), /row-level security/);
    assert.equal((await db.query("update public.site_settings set name='Blocked' returning id")).rows.length, 0);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [adminId]);
    assert.equal((await db.query<{ access: boolean }>('select public.admin_access() as access')).rows[0].access, true);
    await db.query("insert into public.categories(name) values ('Custom topic')");
    const { rows: posts } = await db.query<{id: string; revision: number}>("insert into public.posts(title,slug,description,category,body) values ('Admin test','admin-check','Admin test summary','Custom topic','<p>Test content</p>') returning id,revision");
    await db.query("update public.categories set name='Renamed topic' where name='Custom topic'");
    const renamed = await db.query<{category: string; revision: number}>('select category,revision from public.posts where id=$1',[posts[0].id]);
    assert.equal(renamed.rows[0].category,'Renamed topic');
    assert.equal(renamed.rows[0].revision,2);
    assert.equal((await db.query('update public.posts set title=$1 where id=$2 and revision=$3 returning id',['Stale edit',posts[0].id,1])).rows.length,0);
    await assert.rejects(db.query("delete from public.categories where name='Renamed topic'"), /foreign key/);
    assert.equal((await db.query("update public.site_settings set name='Configured site' returning id")).rows.length,1);
    const image = (await db.query<{url: string;path: string}>('select url,path from public.blog_images limit 1')).rows[0];
    await db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['blog-images',image.path]);
    assert.equal((await db.query('delete from public.blog_images where path=$1 returning path',[image.path])).rows.length,0,'Inline article protects registry');
    assert.equal((await db.query('delete from storage.objects where name=$1 returning id',[image.path])).rows.length,0,'Inline article protects file');
    await db.query("update public.posts set body='<p>No image</p>',cover_image_url='' where strpos(body,$1)>0 or cover_image_url=$1",[image.url]);
    assert.equal((await db.query('delete from storage.objects where name=$1 returning id',[image.path])).rows.length,1);
    assert.equal((await db.query('delete from public.blog_images where path=$1 returning path',[image.path])).rows.length,1);
    await db.query('delete from public.posts where id=$1',[posts[0].id]);
    await db.query("delete from public.categories where name='Renamed topic'");
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    await db.exec('set role service_role');
  }
});

test('MCP discovers and publishes into an admin-managed category', async () => {
  await db.exec('reset role');
  await db.query("insert into public.categories(name) values ('MCP custom topic')");
  try {
    await db.exec('set role service_role');
    assert.ok((await call('get_site_context', {})).categories.includes('MCP custom topic'));
    const created = await call('create_draft', { ...draft(), category: 'MCP custom topic' });
    assert.ok(!created.error, JSON.stringify(created));
    const published = await call('publish_post', { post_id: created.post.id, expected_revision: 1, request_id: randomUUID(), confirmed: true });
    assert.ok(!published.error, JSON.stringify(published));
    assert.equal(published.post.category, 'MCP custom topic');
  } finally {
    await db.exec('reset role');
    await db.query("delete from public.posts where category='MCP custom topic'");
    await db.query("delete from public.categories where name='MCP custom topic'");
    await db.exec('set role service_role');
  }
});

test('operations log successful calls, handler failures, schema failures and redacted uploads', async () => {
  await call('get_site_context', {});
  const bad = await call('create_draft', { request_id: randomUUID(), title: 'Incomplete' });
  assert.ok(bad.error);
  const failed = await call('get_post', { post_id: randomUUID() });
  assert.ok(failed.error);
  const records = await db.query<{tool: string;outcome: string;arguments: Record<string,unknown>;result: Record<string,unknown>;error: string}>('select * from public.mcp_operations');
  assert.ok(records.rows.some(row => row.tool === 'get_site_context' && row.outcome === 'success'));
  assert.ok(records.rows.some(row => row.tool === 'create_draft' && row.outcome === 'failed'));
  assert.ok(records.rows.some(row => row.tool === 'get_post' && row.outcome === 'failed' && row.error.includes('POST_NOT_FOUND')));
  assert.ok(records.rows.filter(row => row.tool === 'upload_image').every(row => row.arguments.base64 === '[omitted]'));
  assert.deepEqual(activityArguments({base64: 'abc',token: 'private',changes: {password: 'private',body:'Article'}}),{base64:'[omitted]',token:'[omitted]',changes:{password:'[omitted]',body:'Article'}});
  assert.equal(activityArguments({body:'x'.repeat(250001)}).payload_omitted,'Arguments exceeded the logging limit.');
  const health = await handler(new Request('https://example.com/blog-mcp/health'));
  assert.equal(health.status,200);
  assert.equal((await health.json()).activity_tracking,true);
});

test('revision snapshots preserve content through updates, restoration and deletion', async () => {
  const created = await call('create_draft', draft());
  const changed = await call('update_draft', {post_id:created.post.id,expected_revision:1,request_id:randomUUID(),changes:{body:'<p>Changed content.</p>'}});
  await db.exec('reset role');
  try {
    const versions = await db.query<{revision: number;snapshot: {body: string};source: string}>('select * from public.post_revisions where post_id=$1 order by revision',[created.post.id]);
    assert.equal(versions.rows.length,2);
    assert.equal(versions.rows[0].snapshot.body,created.post.body);
    assert.equal(versions.rows[1].snapshot.body,changed.post.body);
    await db.query('update public.posts set body=$1,status=$2 where id=$3 and revision=$4',[versions.rows[0].snapshot.body,'draft',created.post.id,2]);
    const restored = await db.query<{revision:number;body:string;status:string}>('select * from public.posts where id=$1',[created.post.id]);
    assert.equal(restored.rows[0].revision,3);
    assert.equal(restored.rows[0].body,created.post.body);
    assert.equal(restored.rows[0].status,'draft');
    await db.query('delete from public.posts where id=$1',[created.post.id]);
    assert.equal((await db.query('select * from public.post_revisions where post_id=$1',[created.post.id])).rows.length,3);
  } finally { await db.exec('set role service_role'); }
});

test('operation logs and revisions are private to designated admins and immutable from browser clients', async () => {
  try {
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.mcp_operations'),/permission denied/);
    await assert.rejects(db.query('select * from public.post_revisions'),/permission denied/);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.mcp_operations')).rows.length,0);
    assert.equal((await db.query('select * from public.post_revisions')).rows.length,0);
    await assert.rejects(db.query("insert into public.mcp_operations(tool,outcome,duration_ms) values ('fake','success',0)"),/permission denied/);
    await assert.rejects(db.query('delete from public.post_revisions'),/permission denied/);
  } finally { await db.exec('set role service_role'); }
});

test('admin-scheduled posts stay hidden until their date', async () => {
  await db.exec('reset role');
  const id = randomUUID();
  try {
    await db.query("insert into public.posts(id,title,slug,description,category,body,status,date) values ($1,'Scheduled','scheduled-check','A scheduled test','Automation','<p>Content</p>','published',current_date+1)",[id]);
    await db.exec('set role anon');
    assert.equal((await db.query('select * from public.posts where id=$1',[id])).rows.length,0);
    await db.exec('reset role');
    await db.query('update public.posts set date=current_date where id=$1',[id]);
    await db.exec('set role anon');
    assert.equal((await db.query('select * from public.posts where id=$1',[id])).rows.length,1);
  } finally { await db.exec('reset role'); await db.query('delete from public.posts where id=$1',[id]); await db.exec('set role service_role'); }
});

test('image metadata reads PNG, JPEG and WebP dimensions', () => {
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDYQAAAAASUVORK5CYII=','base64'));
  assert.deepEqual(imageDimensions(png),{width:1,height:1});
  const webp = new Uint8Array(30); webp.set(Buffer.from('RIFF'),0); webp.set(Buffer.from('WEBPVP8X'),8); webp[24]=99; webp[27]=49;
  assert.deepEqual(imageDimensions(webp),{width:100,height:50});
  const jpeg = new Uint8Array([255,216,255,192,0,8,8,0,50,0,100,0,255,217]);
  assert.deepEqual(imageDimensions(jpeg),{width:100,height:50});
});

test('SEO catches unpublished internal links, duplicate slugs, missing descriptions and image alt text', () => {
  const article = { ...draft(), id:randomUUID(),author:'AI Insights',date:'2026-10-07',status:'published' as const,featured:false,cover_image_url:'https://example.com/image.png',cover_image_alt:'',description:'',title:'x'.repeat(61) };
  const other = {...article,id:randomUUID(),status:'draft' as const};
  const issues = seoIssues(article,[article,other],{images:[{src:'image',alt:''}],links:['/blog/draft-article','https://external.example/article']},'2026-10-07');
  for (const expected of ['Missing meta description','Title exceeds the recommended 60 characters','Missing featured-image alt text','1 inline image(s) missing alt text','Duplicate slug','Broken or unpublished internal link: /blog/draft-article']) assert.ok(issues.includes(expected), expected);
  assert.equal(issues.length,6);
  const healthy = {...article,title:'Healthy title',description:'A useful description',cover_image_alt:'Meaningful alt'};
  assert.deepEqual(seoIssues(healthy,[healthy],{images:[],links:[`/blog/${healthy.slug}`]},'2026-10-07'),[]);
});
