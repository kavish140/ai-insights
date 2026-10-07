import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const IMAGE_BUCKET = 'blog-images';
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const IMPORT_HOSTS = ['images.unsplash.com', 'upload.wikimedia.org', 'images.pexels.com'];
const STORAGE_BASE = 'https://gutvbukqlqutjwlbmfpr.supabase.co/storage/v1/object/public/blog-images/';
const imagePath = /^articles\/[a-f0-9]{64}\.(png|jpg|webp)$/;
export const imageDetails = {
  alt: z.string().trim().min(1).max(300),
  source_url: z.url().max(2000).refine(value => new URL(value).protocol === 'https:', 'Use an HTTPS source page.'),
  credit: z.string().trim().min(1).max(300),
  license_note: z.string().trim().min(1).max(500).describe('Explain permission to reuse this image, including attribution requirements. Do not assume web images are free to reuse.'),
};

export function isBlogImageUrl(value: string) {
  return value.startsWith(STORAGE_BASE) && imagePath.test(value.slice(STORAGE_BASE.length));
}

export function imageType(bytes: Uint8Array) {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length > 24 && bytes[0] === 137 && ascii(1, 4) === 'PNG' && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10 && ascii(12, 16) === 'IHDR') return { mime: 'image/png', ext: 'png' };
  if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) return { mime: 'image/jpeg', ext: 'jpg' };
  if (bytes.length > 20 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(ascii(12, 16))) return { mime: 'image/webp', ext: 'webp' };
  throw new Error('Use a PNG, JPEG, or WebP file. SVG, HTML, GIF, and unrecognized files are not accepted.');
}

export function imageDimensions(bytes: Uint8Array): { width: number; height: number } | {} {
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const { ext } = imageType(bytes);
  let width = 0; let height = 0;
  if (ext === 'png') { width = view.getUint32(16); height = view.getUint32(20); }
  if (ext === 'webp') {
    const chunk = String.fromCharCode(...bytes.slice(12,16));
    const uint24 = (offset: number) => bytes[offset]! + (bytes[offset+1]! << 8) + (bytes[offset+2]! << 16);
    if (chunk === 'VP8X' && bytes.length >= 30) { width = uint24(24)+1; height = uint24(27)+1; }
    if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) { width = view.getUint16(26,true)&16383; height = view.getUint16(28,true)&16383; }
    if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 47) {
      const packed = view.getUint32(21,true); width = (packed&16383)+1; height = ((packed>>>14)&16383)+1;
    }
  }
  if (ext === 'jpg') {
    for (let offset = 2; offset+4 < bytes.length;) {
      if (bytes[offset] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++]!;
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset+2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset+length > bytes.length) break;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && length >= 7) { height = view.getUint16(offset+3); width = view.getUint16(offset+5); break; }
      offset += length;
    }
  }
  return width > 0 && height > 0 && width <= 100000 && height <= 100000 ? { width, height } : {};
}

export async function readLimitedImage(response: Response, maxBytes = MAX_IMAGE_BYTES) {
  if (!response.ok) throw new Error(`The image host returned HTTP ${response.status}.`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Image exceeds the configured size limit.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Image response was empty.');
  const chunks: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    total += value.length;
    if (total > maxBytes) { await reader.cancel(); throw new Error('Image exceeds the configured size limit.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export function checkImportUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !IMPORT_HOSTS.includes(url.hostname)) {
    throw new Error(`Image imports support HTTPS on these hosts only: ${IMPORT_HOSTS.join(', ')}. Use upload_image for other sources.`);
  }
  return url;
}

type Details = { alt: string; source_url: string; credit: string; license_note: string };
export function createImageTools(database: SupabaseClient, controls?: { max_image_bytes: number; allowed_formats: string[] }) {
  async function save(bytes: Uint8Array, details: Details) {
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('Image must be between 1 byte and 4 MiB.');
    const { mime, ext } = imageType(bytes);
    if (bytes.length > (controls?.max_image_bytes ?? MAX_IMAGE_BYTES)) throw new Error('Image exceeds the configured size limit.');
    if (controls && !controls.allowed_formats.includes(ext)) throw new Error('This image format is disabled by an administrator.');
    const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
    const sha = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    const path = `articles/${sha}.${ext}`;
    const { error } = await database.storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType: mime, cacheControl: '31536000', upsert: false });
    // Content-addressed paths make retries safe without replacing any object.
    if (error && !['409', 'Duplicate'].includes(String((error as { statusCode?: string }).statusCode)) && error.message !== 'The resource already exists') {
      throw new Error('Image upload failed. Check that the public blog-images bucket exists with the specified MIME types and 4 MiB limit.');
    }
    const { data, error: recordError } = await database.from('blog_images').upsert({
      path, url: STORAGE_BASE + path, sha256: sha, mime_type: mime, byte_size: bytes.length,
      alt: details.alt, source_url: details.source_url, credit: details.credit, license_note: details.license_note,
      ...imageDimensions(bytes),
    }, { onConflict: 'path', ignoreDuplicates: true }).select('*');
    if (recordError) throw new Error('The image uploaded, but its record could not be saved. Apply the v2 SQL migration, then retry the same image.');
    const existing = data?.[0] ?? (await database.from('blog_images').select('*').eq('path', path).single()).data;
    if (!existing) throw new Error('Could not read the saved image record.');
    return { image: existing, reused: !data?.length, note: 'Images in this public bucket are accessible before publication. Permission details are supplied by the caller and have not been independently verified.' };
  }
  return {
    upload: async (args: Details & { base64: string }) => {
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(args.base64)) throw new Error('Provide raw standard base64 without a data URL prefix.');
      const binary = atob(args.base64);
      return save(Uint8Array.from(binary, char => char.charCodeAt(0)), args);
    },
    importUrl: async (args: Details & { image_url: string }) => {
      const url = checkImportUrl(args.image_url);
      // Do not follow redirects to arbitrary hosts or private-network addresses.
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      return save(await readLimitedImage(response, controls?.max_image_bytes), args);
    },
    list: async (args: { page: number; page_size: number }) => {
      const { data, error, count } = await database.from('blog_images').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('path', { ascending: false }).range((args.page - 1) * args.page_size, args.page * args.page_size - 1);
      if (error) throw new Error('Could not list images. Apply the v2 migration.');
      return { images: data ?? [], total: count, ...args };
    },
  };
}
