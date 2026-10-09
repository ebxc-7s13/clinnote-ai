/**
 * JS-layer timing in Node (jest), NOT on an Android device: encrypted store read/write, timeline, comparison, note
 * rendering and export for a synthetic patient with 30 visits. Thresholds are generous regression guards only.
 */
import { DEMO_VISIT_1, DEMO_VISIT_2 } from '../application/demo';
import { EvidenceService } from '../application/evidenceService';
import { VisitService } from '../application/visitService';
import { compareVisits } from '../domain/diff';
import { exportNote } from '../domain/export';
import { renderNote } from '../domain/note';
import { patientTimeline } from '../domain/timeline';
import { ClinicalStore, DEFAULT_SETTINGS } from '../infrastructure/storage/clinicalStore';
import { DocumentCipher } from '../infrastructure/storage/crypto';
import { MemoryFileBackend } from '../infrastructure/storage/fileBackend';
import { MockBackend } from '../providers/backend';

const rnd = (n: number) => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));
const ms = async <T,>(fn: () => T | Promise<T>) => {
  const t = performance.now();
  const r = await fn();
  return { r, ms: Math.round((performance.now() - t) * 10) / 10 };
};

test('30-visit synthetic patient: load, timeline, compare, note, export', async () => {
  const store = new ClinicalStore(new MemoryFileBackend(), new DocumentCipher(rnd(32), rnd));
  const svc = new VisitService(store, new MockBackend({ kind: 'NOT_CONFIGURED' }), new EvidenceService(store));
  const p = await store.createPatient({ age: 47, sex: 'MALE', isDemo: true });
  for (let i = 0; i < 30; i++) {
    const v = await store.createVisit(p.patientId, 'AMBIENT');
    v.startedAt = new Date(Date.UTC(2026, 0, 1 + i * 7)).toISOString();
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    (i % 2 ? DEMO_VISIT_2 : DEMO_VISIT_1).forEach((l, j) => svc.addLiveSegment(v, l.text, 0.9, l.role, j * 5, j * 5 + 4, 'demo-script'));
    svc.stopRecording(v, 60);
    svc.confirmRoles(v, {});
    await svc.runExtraction(v, { ...DEFAULT_SETTINGS, cloudProcessingEnabled: false }, []);
    svc.draftNote(v, p, [v], 'SOAP');
    await store.saveVisit(v);
  }
  const load = await ms(() => store.listVisits(p.patientId));
  const visits = load.r;
  const tl = await ms(() => patientTimeline(visits));
  const cmp = await ms(() => compareVisits(visits[28], visits[29]));
  const note = await ms(() => renderNote('PROGRESS', { patient: p, visit: visits[29], allVisits: visits }));
  const exp = await ms(() => exportNote(p, visits[29]));
  const save = await ms(() => store.saveVisit(visits[29]));
  const out = { loadPatientWith30Visits: load.ms, timeline: tl.ms, compare: cmp.ms, renderNote: note.ms, exportNote: exp.ms, saveVisit: save.ms };
  console.log(`PERF (Node/jest, not device): ${JSON.stringify(out)}`);
  expect(visits.length).toBe(30);
  expect(load.ms).toBeLessThan(5000);
  expect(tl.ms + cmp.ms + note.ms + exp.ms).toBeLessThan(2000);
});
