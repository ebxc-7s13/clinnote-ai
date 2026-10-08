/** Minimal file backend so storage logic is testable without the native file system. */
export interface FileBackend {
  readText(path: string): Promise<string | null>;
  /** Atomic replace: implementations write a temp file then move it over the target. */
  writeTextAtomic(path: string, content: string): Promise<void>;
  remove(path: string): Promise<void>;
  removeDir(path: string): Promise<void>;
  list(dir: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
}

export class MemoryFileBackend implements FileBackend {
  files = new Map<string, string>();
  failNextWrite = false;

  async readText(path: string) {
    return this.files.has(path) ? (this.files.get(path) as string) : null;
  }
  async writeTextAtomic(path: string, content: string) {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      // Simulates a crash during the temp write: the target must stay intact.
      this.files.set(`${path}.tmp`, content.slice(0, Math.floor(content.length / 2)));
      throw new Error('simulated write failure');
    }
    this.files.set(`${path}.tmp`, content);
    this.files.set(path, content);
    this.files.delete(`${path}.tmp`);
  }
  async remove(path: string) {
    this.files.delete(path);
  }
  async removeDir(dir: string) {
    for (const k of Array.from(this.files.keys())) if (k.startsWith(`${dir}/`)) this.files.delete(k);
  }
  async list(dir: string) {
    const out = new Set<string>();
    for (const k of this.files.keys()) {
      if (k.startsWith(`${dir}/`)) out.add(k.slice(dir.length + 1).split('/')[0]);
    }
    return Array.from(out);
  }
  async exists(path: string) {
    return this.files.has(path) || Array.from(this.files.keys()).some((k) => k.startsWith(`${path}/`));
  }
}
