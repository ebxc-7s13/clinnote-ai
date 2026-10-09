/**
 * Synthetic demo data (ADR-006). DEMO DATA — NOT A REAL PATIENT. Used only to exercise the workflow without
 * speaking; segments are tagged sourceProvider "demo-script".
 */
import type { SpeakerRole } from '../domain/types';

export interface DemoLine {
  role: SpeakerRole;
  text: string;
}

export const DEMO_VISIT_1: DemoLine[] = [
  { role: 'DOCTOR', text: 'What brings you in today?' },
  { role: 'PATIENT', text: "I've had a cough for about three weeks now, and it's worse at night." },
  { role: 'DOCTOR', text: 'Any fever?' },
  { role: 'PATIENT', text: "No, I don't have any fever." },
  { role: 'PATIENT', text: "I've lost about 3 kg." },
  { role: 'PATIENT', text: 'I have diabetes and I take metformin 500 milligrams twice daily.' },
  { role: 'DOCTOR', text: 'Weight 72 kg. BP 138 over 86.' },
  { role: 'DOCTOR', text: "We'll order a chest x-ray." },
  { role: 'DOCTOR', text: 'Come back in two weeks.' },
  { role: 'DOCTOR', text: 'If you develop chest pain, come back straight away.' },
];

export const DEMO_VISIT_2: DemoLine[] = [
  { role: 'DOCTOR', text: 'How has the cough been?' },
  { role: 'PATIENT', text: 'I have had a cough for 5 weeks now.' },
  { role: 'PATIENT', text: 'I take metformin 500 milligrams twice daily.' },
  { role: 'PATIENT', text: 'I also take atorvastatin 20 mg at night.' },
  { role: 'DOCTOR', text: 'Weight 70 kg.' },
  { role: 'DOCTOR', text: 'The chest x-ray results came back.' },
  { role: 'DOCTOR', text: 'Allergies were not discussed today.' },
  { role: 'DOCTOR', text: 'Follow up in one month.' },
];
