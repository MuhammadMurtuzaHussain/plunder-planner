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

/** Compact form used by the import button: ascending ids, delta-encoded, base 36, joined with dots. */
export function decodeIdFragment(fragment: string): Locker {
  const ids = new Set<number>();
  let id = 0;
  for (const part of fragment.split('.')) {
    const n = parseInt(part, 36);
    if (!/^[0-9a-z]+$/.test(part) || !Number.isInteger(n) || n < 0) throw new Error('That import link is damaged. Run the import again.');
    id += n; ids.add(id);
  }
  if (ids.size === 0) throw new Error('That import contained no items.');
  return { ids, created: null };
}

/**
 * The import button. It runs on a fortnite.gg locker page (the short link is fine), reads the list of
 * item ids that page already holds, and opens this site with the list after the # so it never reaches a server.
 * No Epic login is involved at any point.
 */
export function importBookmarklet(siteUrl: string): string {
  const js = `(()=>{const a=(window.ThisItems&&ThisItems.length?ThisItems:window.LockerItems)||[];if(!a.length){alert('Open a fortnite.gg locker page first, then click this again.');return}const s=[...new Set(a)].sort((x,y)=>x-y);let p=0;const d=s.map(v=>{const r=(v-p).toString(36);p=v;return r}).join('.');const u=${JSON.stringify(siteUrl)}+'#locker='+d;window.open(u,'_blank')||(location.href=u)})()`;
  return 'javascript:' + encodeURIComponent(js);
}

export async function decodeLocker(input: string): Promise<Locker> {
  let s = input.trim();
  if (!s) throw new Error('Paste a locker link or a list of item ids first.');
  const frag = s.match(/#locker=([0-9a-z.]+)/);
  if (frag) return decodeIdFragment(frag[1]);
  if (/^\d+(\s*[,\s]\s*\d+)+$/.test(s)) {            // a plain list of fortnite.gg item ids
    const ids = new Set(s.split(/[,\s]+/).map(Number));
    return { ids, created: null };
  }
  if (/locker\?id=\d+/.test(s) && !/items=/.test(s))
    throw new Error('That is the short profile link, which only fortnite.gg can open. Use the One-click import tab instead: it works on that page.');
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
