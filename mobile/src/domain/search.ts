/** Local, offline search (UI-UX Screen 17). Runs on device only; queries are never logged or sent. */
import type { PatientIndexEntry, Visit } from './types';

export type SearchScope = 'PATIENTS' | 'VISITS' | 'NOTES';

export interface SearchHit {
  kind: SearchScope;
  patientId: string;
  patientReference: string;
  visitId?: string;
  title: string;
  detail: string;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/\s+/g, ' ').trim();

export function searchLocal(q: string, patients: PatientIndexEntry[], visitsByPatient: Record<string, Visit[]>, scope: SearchScope): SearchHit[] {
  const query = norm(q);
  if (!query) return [];
  const refOf = (id: string) => patients.find((p) => p.patientId === id)?.patientReference ?? '';
  if (scope === 'PATIENTS') {
    return patients
      .filter((p) => norm(`${p.patientReference} ${p.name ?? ''}`).includes(query))
      .map((p) => ({ kind: 'PATIENTS', patientId: p.patientId, patientReference: p.patientReference, title: p.name ? `${p.patientReference} · ${p.name}` : p.patientReference, detail: `${p.visitCount} visit(s)` }));
  }
  const hits: SearchHit[] = [];
  for (const [patientId, visits] of Object.entries(visitsByPatient)) {
    for (const v of visits) {
      if (scope === 'VISITS') {
        const facts = v.facts.map((f) => f.value).join(' ');
        if (norm(`${v.visitCode} ${refOf(patientId)} ${facts}`).includes(query)) {
          hits.push({ kind: 'VISITS', patientId, patientReference: refOf(patientId), visitId: v.visitId, title: `${v.visitCode} · ${refOf(patientId)}`, detail: v.startedAt.slice(0, 10) });
        }
      } else {
        const note = v.noteVersions[v.noteVersions.length - 1];
        if (!note) continue;
        const i = norm(note.content).indexOf(query);
        if (i >= 0) {
          const flat = note.content.replace(/\s+/g, ' ');
          hits.push({ kind: 'NOTES', patientId, patientReference: refOf(patientId), visitId: v.visitId, title: `${v.visitCode} note · ${refOf(patientId)}`, detail: `…${flat.slice(Math.max(0, i - 30), i + query.length + 40)}…` });
        }
      }
    }
  }
  return hits;
}
