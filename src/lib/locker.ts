/**
 * fortnite.gg "Copy link" locker URLs carry the whole locker in the `items` parameter:
 * base64url( raw-deflate( "<account date>,<id>,<delta>,<delta>,..." ) ) with ids ascending.
 * Decoding happens entirely on this device; nothing is uploaded.
 */
export interface Locker {
  ids: Set<number>;
  created: string | null;   // account creation date as stored in the link
}

async function inflateRaw(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return await new Response(stream).text();
}

export async function decodeLocker(input: string): Promise<Locker> {
  let s = input.trim();
  if (!s) throw new Error('Paste your fortnite.gg locker link first.');
  if (/locker\?id=\d+/.test(s) && !/items=/.test(s))
    throw new Error('That is the short profile link, which only fortnite.gg can open. On your locker page press "Copy link" and paste the long link it gives you.');
  const m = s.match(/[?&]items=([^&#\s]+)/);
  if (m) s = m[1];
  try { s = decodeURIComponent(s); } catch { /* already plain */ }
  s = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]+=*$/.test(s) || s.length < 8) throw new Error('That does not look like a fortnite.gg locker link.');
  let text: string;
  try {
    const bin = atob(s);
    text = await inflateRaw(Uint8Array.from(bin, c => c.charCodeAt(0)));
  } catch {
    throw new Error('Could not read that link. Make sure the whole link was copied; they are very long.');
  }
  const parts = text.split(',');
  const created = /^\d{4}-\d{2}-\d{2}/.test(parts[0]) ? parts.shift()!.slice(0, 10) : null;
  const ids = new Set<number>();
  let id = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0) throw new Error('The link decoded, but its contents were not a locker.');
    id += n; ids.add(id);
  }
  if (ids.size === 0) throw new Error('That locker link is empty.');
  return { ids, created };
}
