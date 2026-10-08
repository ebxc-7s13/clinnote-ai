/** Pure WAV helpers: merge PCM WAV chunks (same format) into one file for final transcription. */

export interface WavInfo {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataOffset: number;
  dataLength: number;
}

const str = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));

export function parseWav(b: Uint8Array): WavInfo | null {
  if (b.length < 44 || str(b, 0, 4) !== 'RIFF' || str(b, 8, 4) !== 'WAVE') return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let o = 12;
  let fmt: Omit<WavInfo, 'dataOffset' | 'dataLength'> | null = null;
  while (o + 8 <= b.length) {
    const id = str(b, o, 4);
    const size = dv.getUint32(o + 4, true);
    if (id === 'fmt ') fmt = { channels: dv.getUint16(o + 10, true), sampleRate: dv.getUint32(o + 12, true), bitsPerSample: dv.getUint16(o + 22, true) };
    if (id === 'data') {
      if (!fmt) return null;
      const len = Math.min(size === 0 || size === 0xffffffff ? b.length - (o + 8) : size, b.length - (o + 8));
      return { ...fmt, dataOffset: o + 8, dataLength: len };
    }
    o += 8 + size + (size % 2);
  }
  return null;
}

export function wavHeader(channels: number, sampleRate: number, bits: number, dataLength: number): Uint8Array {
  const h = new Uint8Array(44);
  const dv = new DataView(h.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => (h[o + i] = c.charCodeAt(0)));
  w(0, 'RIFF');
  dv.setUint32(4, 36 + dataLength, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, channels, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, (sampleRate * channels * bits) / 8, true);
  dv.setUint16(32, (channels * bits) / 8, true);
  dv.setUint16(34, bits, true);
  w(36, 'data');
  dv.setUint32(40, dataLength, true);
  return h;
}

/** Concatenates chunks that share the first chunk's format; incompatible or unreadable chunks are skipped. */
export function mergeWav(chunks: Uint8Array[]): { bytes: Uint8Array; seconds: number; skipped: number } | null {
  const parsed = chunks.map((c) => ({ c, info: parseWav(c) }));
  const first = parsed.find((p) => p.info)?.info;
  if (!first) return null;
  const ok = parsed.filter((p) => p.info && p.info.channels === first.channels && p.info.sampleRate === first.sampleRate && p.info.bitsPerSample === first.bitsPerSample);
  const total = ok.reduce((s, p) => s + (p.info as WavInfo).dataLength, 0);
  const out = new Uint8Array(44 + total);
  out.set(wavHeader(first.channels, first.sampleRate, first.bitsPerSample, total), 0);
  let o = 44;
  for (const p of ok) {
    const i = p.info as WavInfo;
    out.set(p.c.subarray(i.dataOffset, i.dataOffset + i.dataLength), o);
    o += i.dataLength;
  }
  return { bytes: out, seconds: total / ((first.sampleRate * first.channels * first.bitsPerSample) / 8), skipped: chunks.length - ok.length };
}
