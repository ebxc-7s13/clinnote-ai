/** Storage tests: encryption at rest, atomic writes, corruption handling, deletion. */
import { ClinicalStore, StorageError } from '../infrastructure/storage/clinicalStore';
import { DocumentCipher, base64ToBytes, bytesToBase64, utf8Decode, utf8Encode } from '../infrastructure/storage/crypto';
import { MemoryFileBackend } from '../infrastructure/storage/fileBackend';

const rnd = (n: number) => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));
const key = rnd(32);

function make() {
  const fs = new MemoryFileBackend();
  return { fs, store: new ClinicalStore(fs, new DocumentCipher(key, rnd)) };
}

test('utf8 and base64 round trip', () => {
  const s = 'Cough · 3 weeks — 38.2 °C — 咳嗽 😀';
  expect(utf8Decode(utf8Encode(s))).toBe(s);
  const b = rnd(1000);
  expect(Array.from(base64ToBytes(bytesToBase64(b)))).toEqual(Array.from(b));
});

test('documents are encrypted at rest and readable with the key only', async () => {
  const { fs, store } = make();
  const p = await store.createPatient({ name: 'Test Person', age: 47, sex: 'MALE', isDemo: true });
  const raw = Array.from(fs.files.values()).join('');
  expect(raw).not.toContain('Test Person');
  expect(raw).not.toContain('P-000001');
  expect((await store.getPatient(p.patientId)).name).toBe('Test Person');
  const other = new ClinicalStore(fs, new DocumentCipher(rnd(32), rnd));
  await expect(other.getPatient(p.patientId)).rejects.toBeInstanceOf(StorageError);
});

test('patient references are sequential and visits are stored per patient', async () => {
  const { fs, store } = make();
  const a = await store.createPatient({ isDemo: false });
  const b = await store.createPatient({ isDemo: false });
  expect(a.patientReference).toBe('P-000001');
  expect(b.patientReference).toBe('P-000002');
  const v = await store.createVisit(a.patientId, 'AMBIENT');
  expect(v.visitCode).toBe('V-000001');
  expect(fs.files.has('data/patients/P-000001/visits/V-000001.json.enc')).toBe(true);
  expect((await store.listVisits(a.patientId)).length).toBe(1);
  expect((await store.listPatients()).find((x) => x.patientId === a.patientId)?.visitCount).toBe(1);
});

test('a failed write leaves the previous copy intact', async () => {
  const { fs, store } = make();
  const p = await store.createPatient({ name: 'Before', isDemo: false });
  fs.failNextWrite = true;
  await expect(store.savePatient({ ...p, name: 'After' })).rejects.toBeInstanceOf(StorageError);
  expect((await store.getPatient(p.patientId)).name).toBe('Before');
});

test('delete visit, patient and all data', async () => {
  const { fs, store } = make();
  const p = await store.createPatient({ isDemo: false });
  const v = await store.createVisit(p.patientId, 'MANUAL');
  await store.deleteVisit(p.patientId, v.visitId);
  expect((await store.listVisits(p.patientId)).length).toBe(0);
  await store.deletePatient(p.patientId);
  expect(await store.listPatients()).toEqual([]);
  await store.createPatient({ isDemo: false });
  await store.deleteAll();
  expect(fs.files.size).toBe(0);
});
