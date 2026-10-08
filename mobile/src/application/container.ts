/** Composition root: storage key, encrypted store, providers and services. */
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { newId } from '../domain/util';
import { mergeWav } from '../infrastructure/audio/wav';
import { ClinicalStore } from '../infrastructure/storage/clinicalStore';
import { DocumentCipher } from '../infrastructure/storage/crypto';
import { audioDir, ExpoFileBackend } from '../infrastructure/storage/expoFileBackend';
import { SupabaseBackend, type Backend } from '../providers/backend';
import { EvidenceService } from './evidenceService';
import { VisitService } from './visitService';

const KEY_NAME = 'clinnote.dek.v1';

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], (h) => parseInt(h, 16));

/** 256-bit data-encryption key in Android Keystore-backed secure storage (SECURITY.md §8). */
async function dataKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(KEY_NAME);
  if (existing && existing.length === 64) return unhex(existing);
  const key = Crypto.getRandomBytes(32);
  await SecureStore.setItemAsync(KEY_NAME, hex(key), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return key;
}

export interface Container {
  store: ClinicalStore;
  backend: Backend;
  evidence: EvidenceService;
  visits: VisitService;
}

let container: Promise<Container> | null = null;

export function getContainer(): Promise<Container> {
  if (!container) {
    container = (async () => {
      const key = await dataKey();
      const store = new ClinicalStore(new ExpoFileBackend(), new DocumentCipher(key, (n) => Crypto.getRandomBytes(n)));
      const backend = new SupabaseBackend();
      const evidence = new EvidenceService(store);
      return { store, backend, evidence, visits: new VisitService(store, backend, evidence) };
    })();
    container.catch(() => (container = null));
  }
  return container;
}

/** Destroys the data key as part of "Delete all local data" so any leftover file is unreadable. */
export async function destroyDataKey() {
  await SecureStore.deleteItemAsync(KEY_NAME);
  container = null;
}

export const APP_VARIANT = (process.env.EXPO_PUBLIC_APP_VARIANT ?? (__DEV__ ? 'development' : 'production')) as 'development' | 'preview' | 'production';
/** R2 possibilities may only be switched on in development/preview builds with synthetic data (ADR-025). */
export const R2_SELECTABLE = APP_VARIANT !== 'production';

// ---------------------------------------------------------------- temporary audio (ADR-014)
export function mergeAudio(uris: string[]): string | null {
  const chunks: Uint8Array[] = [];
  for (const u of uris) {
    try {
      const f = new File(u);
      if (f.exists) chunks.push(f.bytesSync());
    } catch {
      /* unreadable chunk is skipped */
    }
  }
  const merged = mergeWav(chunks);
  if (!merged || merged.seconds < 1) return null;
  const out = new File(audioDir(), `merged-${newId()}.wav`);
  out.create();
  out.write(merged.bytes);
  return out.uri;
}

export function deleteAudio(uris: (string | null | undefined)[]) {
  for (const u of uris) {
    if (!u) continue;
    try {
      const f = new File(u);
      if (f.exists) f.delete();
    } catch {
      /* already gone */
    }
  }
}
