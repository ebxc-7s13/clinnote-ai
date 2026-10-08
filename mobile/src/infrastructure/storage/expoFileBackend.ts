/** Native file backend in the app sandbox (document directory). Atomic replace: write temp file, then move. */
import { Directory, File, Paths } from 'expo-file-system';
import type { FileBackend } from './fileBackend';

const ROOT = 'clinnote';
const parts = (p: string) => p.split('/').filter(Boolean);

export class ExpoFileBackend implements FileBackend {
  private file(path: string) {
    return new File(Paths.document, ROOT, ...parts(path));
  }
  private dir(path: string) {
    return new Directory(Paths.document, ROOT, ...parts(path));
  }

  async readText(path: string) {
    const f = this.file(path);
    if (!f.exists) {
      // recover from an interrupted write: a complete temp file is never preferred over the target,
      // but if only the temp exists (crash after delete), it is the latest full copy.
      const tmp = this.file(`${path}.tmp`);
      return tmp.exists ? tmp.textSync() : null;
    }
    return f.textSync();
  }

  async writeTextAtomic(path: string, content: string) {
    const segs = parts(path);
    this.dir(segs.slice(0, -1).join('/')).create({ intermediates: true, idempotent: true });
    const tmp = this.file(`${path}.tmp`);
    if (tmp.exists) tmp.delete();
    tmp.create({ intermediates: true });
    tmp.write(content);
    // verify the temp copy before replacing the target
    if (tmp.textSync().length !== content.length) throw new Error('verify failed');
    tmp.moveSync(this.file(path), { overwrite: true });
  }

  async remove(path: string) {
    const f = this.file(path);
    if (f.exists) f.delete();
  }

  async removeDir(path: string) {
    const d = this.dir(path);
    if (d.exists) d.delete();
  }

  async list(dir: string) {
    const d = this.dir(dir);
    if (!d.exists) return [];
    return d.list().map((x) => x.name);
  }

  async exists(path: string) {
    return this.file(path).exists || this.dir(path).exists;
  }
}

/** Temporary audio lives in the cache directory and is deleted after processing (ADR-014, ≤ 24 h). */
export function audioDir(): Directory {
  const d = new Directory(Paths.cache, 'clinnote-audio');
  d.create({ intermediates: true, idempotent: true });
  return d;
}

export function purgeOldAudio(maxAgeMs = 24 * 3600 * 1000): number {
  const d = new Directory(Paths.cache, 'clinnote-audio');
  if (!d.exists) return 0;
  let n = 0;
  for (const x of d.list()) {
    if (x instanceof File) {
      const info = x.info();
      const mtime = info.modificationTime ?? 0;
      if (!mtime || Date.now() - mtime > maxAgeMs) {
        x.delete();
        n++;
      }
    }
  }
  return n;
}
