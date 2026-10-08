/**
 * Encryption at rest for JSON documents (SECURITY.md §8 restriction, ADR-046 replaces SQLCipher with
 * per-document AES-256-GCM). The 256-bit key lives in Keystore-backed secure storage; nonces are random 96-bit.
 */
import { gcm } from '@noble/ciphers/aes.js';

export type RandomBytes = (n: number) => Uint8Array;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

export function base64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(Math.max(0, len));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1]) << 12) |
      ((B64.indexOf(clean[i + 2]) & 63) << 6) |
      (B64.indexOf(clean[i + 3]) & 63);
    if (o < len) out[o++] = (n >> 16) & 255;
    if (o < len) out[o++] = (n >> 8) & 255;
    if (o < len) out[o++] = n & 255;
  }
  return out;
}

/** Self-contained UTF-8 codec (Hermes does not guarantee TextDecoder). */
export function utf8Encode(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    let cp = ch.codePointAt(0) as number;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else {
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
    cp = 0;
  }
  return Uint8Array.from(out);
}

export function utf8Decode(b: Uint8Array): string {
  let s = '';
  let i = 0;
  const parts: string[] = [];
  while (i < b.length) {
    const c = b[i++];
    let cp: number;
    if (c < 0x80) cp = c;
    else if (c < 0xe0) cp = ((c & 31) << 6) | (b[i++] & 63);
    else if (c < 0xf0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(cp);
    if (s.length > 4096) {
      parts.push(s);
      s = '';
    }
  }
  parts.push(s);
  return parts.join('');
}

export interface Envelope {
  v: 1;
  alg: 'AES-256-GCM';
  n: string;
  c: string;
}

export class DocumentCipher {
  constructor(
    private readonly key: Uint8Array,
    private readonly random: RandomBytes,
  ) {
    if (key.length !== 32) throw new Error('key must be 256-bit');
  }

  encrypt(plaintext: string): string {
    const nonce = this.random(12);
    const ct = gcm(this.key, nonce).encrypt(utf8Encode(plaintext));
    const env: Envelope = { v: 1, alg: 'AES-256-GCM', n: bytesToBase64(nonce), c: bytesToBase64(ct) };
    return JSON.stringify(env);
  }

  decrypt(stored: string): string {
    const env = JSON.parse(stored) as Envelope;
    if (env.v !== 1 || env.alg !== 'AES-256-GCM') throw new Error('unsupported envelope');
    const pt = gcm(this.key, base64ToBytes(env.n)).decrypt(base64ToBytes(env.c));
    return utf8Decode(pt);
  }
}
