import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

const SITE_ORIGIN = 'https://satuundangan.id';
const MAX_LINKS = 30;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5_000;

/** True for loopback, private, link-local and other non-public addresses (SSRF guard). */
export function isPrivateAddress(ip: string): boolean {
  if (ip.includes(':')) {
    const v6 = ip.toLowerCase();
    if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
    return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export function extractLinks(article: { content?: string | null; coverImage?: string | null; ogImage?: string | null; canonicalUrl?: string | null }) {
  const found: Array<{ url: string; kind: 'tautan' | 'gambar' }> = [];
  const html = article.content ?? '';
  for (const match of html.matchAll(/<a\s[^>]*href\s*=\s*"([^"]+)"/gi)) found.push({ url: match[1], kind: 'tautan' });
  for (const match of html.matchAll(/<img\s[^>]*src\s*=\s*"([^"]+)"/gi)) found.push({ url: match[1], kind: 'gambar' });
  for (const url of [article.coverImage, article.ogImage]) if (url) found.push({ url, kind: 'gambar' });
  if (article.canonicalUrl) found.push({ url: article.canonicalUrl, kind: 'tautan' });
  const seen = new Set<string>();
  return found
    .map(({ url, kind }) => ({ url: url.trim(), kind }))
    .filter(({ url }) => url && !url.startsWith('#') && !/^(mailto:|tel:|data:|javascript:)/i.test(url))
    .map(({ url, kind }) => ({ url: url.startsWith('/') ? SITE_ORIGIN + url : url, kind }))
    .filter(({ url }) => (seen.has(url) ? false : (seen.add(url), true)));
}

export interface LinkResult {
  url: string;
  kind: 'tautan' | 'gambar';
  status: 'ok' | 'rusak' | 'tidak_dicek';
  httpStatus: number | null;
  note: string | null;
}

@Injectable()
export class LinkCheckService {
  async check(article: Parameters<typeof extractLinks>[0]) {
    const all = extractLinks(article);
    const results: LinkResult[] = [];
    for (const link of all.slice(0, MAX_LINKS)) results.push({ ...link, ...(await this.probe(link.url)) });
    return {
      checked: results.length,
      truncated: all.length > MAX_LINKS,
      broken: results.filter((r) => r.status === 'rusak').length,
      notChecked: results.filter((r) => r.status === 'tidak_dicek').length,
      results,
      note: 'Pengecekan sekali jalan dari server dan dapat berbeda dengan yang dilihat pembaca (blokir bot, geo, login). Tautan yang gagal diperiksa ditandai tidak dicek, bukan rusak.',
    };
  }

  private async assertPublic(rawUrl: string): Promise<URL> {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Protokol tidak didukung');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new Error('Alamat non-publik diblokir');
    return url;
  }

  private async probe(rawUrl: string): Promise<Pick<LinkResult, 'status' | 'httpStatus' | 'note'>> {
    let current = rawUrl;
    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const url = await this.assertPublic(current);
        let response = await axios.head(url.toString(), { timeout: TIMEOUT_MS, maxRedirects: 0, validateStatus: () => true });
        if (response.status === 405 || response.status === 501) {
          response = await axios.get(url.toString(), { timeout: TIMEOUT_MS, maxRedirects: 0, validateStatus: () => true, responseType: 'stream', headers: { Range: 'bytes=0-0' } });
          response.data?.destroy?.();
        }
        if (response.status >= 300 && response.status < 400 && response.headers.location) {
          current = new URL(String(response.headers.location), url).toString();
          continue;
        }
        if (response.status >= 200 && response.status < 300) return { status: 'ok', httpStatus: response.status, note: null };
        if (response.status === 404 || response.status === 410) return { status: 'rusak', httpStatus: response.status, note: 'Tidak ditemukan' };
        if (response.status === 401 || response.status === 403 || response.status === 429) return { status: 'tidak_dicek', httpStatus: response.status, note: 'Server menolak pengecekan otomatis' };
        return { status: 'rusak', httpStatus: response.status, note: `HTTP ${response.status}` };
      }
      return { status: 'rusak', httpStatus: null, note: 'Terlalu banyak pengalihan' };
    } catch (error) {
      const message = (error as Error).message;
      if ((error as NodeJS.ErrnoException).code === 'ENOTFOUND') return { status: 'rusak', httpStatus: null, note: 'Domain tidak ditemukan' };
      if (message === 'Alamat non-publik diblokir' || message === 'Protokol tidak didukung') return { status: 'tidak_dicek', httpStatus: null, note: message };
      return { status: 'tidak_dicek', httpStatus: null, note: 'Server tujuan tidak dapat dihubungi saat ini' };
    }
  }
}
