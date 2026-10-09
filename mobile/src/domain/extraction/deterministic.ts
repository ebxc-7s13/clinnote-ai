/**
 * Deterministic (rule-based) extraction — runs first, before and without any AI (owner instruction: "deterministic
 * extraction first"). Every value is a verbatim span of one segment; provenance is assigned later by code from the
 * clinician-confirmed speaker role (DATA_MODEL §8.3). Output items go through the same validators as AI items.
 */
import type { TranscriptSegment } from '../types';
import type { ExtractionItem } from './item';
import { ALLERGENS, CONDITIONS, EXAM_TERMS, INVESTIGATIONS, MEDICATIONS, SYMPTOMS, SYNONYMS } from '../lexicon';
import { clauseContext, isNegatedSpan, splitClauses, wordsToDigits, type ClauseContext } from '../text';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
const termRe = (terms: string[]) =>
  new RegExp(`\\b(${terms.sort((a, b) => b.length - a.length).map(esc).join('|')})\\b`, 'gi');

const SYMPTOM_TERMS = SYMPTOMS.concat(Object.keys(SYNONYMS).filter((k) => SYMPTOMS.includes(SYNONYMS[k])));
const CONDITION_TERMS = CONDITIONS.concat(Object.keys(SYNONYMS).filter((k) => CONDITIONS.includes(SYNONYMS[k])));
const INVESTIGATION_TERMS = INVESTIGATIONS.concat(Object.keys(SYNONYMS).filter((k) => INVESTIGATIONS.includes(SYNONYMS[k])));

const DURATION_RE =
  /\b((?:for|over|past|last|about|around|approximately|nearly|almost)\s+)*(?:\d+(?:\.\d+)?|a|one|a couple of|a few)\s+(?:days?|weeks?|months?|years?)(?:\s+ago|\s+now)?\b|\bsince\s+(?:yesterday|last\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|\d+)\b/i;
const SEVERITY_RE = /\b(mild|moderate|severe|bad|terrible|slight|constant|intermittent)\b/i;
const TIMING_RE = /\b(worse at night|at night|in the morning|worse in the morning|on exertion|when lying down|after meals|worse when lying down)\b/i;
const PROGRESSION_RE = /\b(getting worse|worsening|improving|getting better|better now|unchanged|the same|persistent)\b/i;
const FREQ_RE =
  /\b((?:once|twice|three times|four times|\d+ times)\s+(?:a|per)\s+(?:day|week)|once daily|twice daily|daily|nightly|at night|in the morning|every \d+ hours|as needed|when needed|prn|bd|bid|tds|tid|od|qds|weekly)\b/i;
const ROUTE_RE = /\b(by mouth|orally|oral|inhaled|inhaler|injection|injected|subcutaneous|intravenous|iv|topical|cream|eye drops)\b/i;
const DOSE_RE = /\b(\d+(?:\.\d+)?)\s*(mg|milligrams?|mcg|micrograms?|g|grams?|units?|ml|millilitres?|milliliters?|puffs?)\b/i;

const PLAN_VERB_RE =
  /\b(start(?:ing)?|continue|stop|increase|decrease|reduce|prescrib(?:e|ing)|i'?ll prescribe|we'?ll (?:order|do|send|start|arrange|refer|check|repeat|get)|i'?m going to|let'?s|refer(?:ral)?|book|arrange|advise|switch(?:ing)? to|come back if|return if|seek (?:urgent )?care if)\b/i;
const FOLLOW_UP_RE =
  /\b(come back|follow[- ]?up|see you(?: again)?|review(?: you)?|return|recheck)\b[^.?!]*?\b(?:in|after|within)\s+((?:\d+|a|one|two|three|four|five|six|a couple of|a few)\s+(?:days?|weeks?|months?))\b/i;

function unclear(seg: TranscriptSegment): boolean {
  return /\[unclear\]/i.test(seg.text) || seg.confidence === 'LOW' || !!seg.clinicianMarkedUncertain;
}

/** Occupations accepted after "I'm a …" (anything after "I work as …" is accepted verbatim). */
const OCCUPATIONS = [
  'teacher', 'nurse', 'doctor', 'driver', 'farmer', 'engineer', 'student', 'labourer', 'laborer', 'shopkeeper', 'clerk', 'accountant',
  'cook', 'chef', 'tailor', 'carpenter', 'electrician', 'plumber', 'mechanic', 'police officer', 'soldier', 'lawyer', 'banker', 'pharmacist',
  'housewife', 'homemaker', 'retired', 'pensioner', 'software engineer', 'developer', 'manager', 'salesman', 'saleswoman', 'cleaner', 'security guard',
  'construction worker', 'factory worker', 'office worker', 'businessman', 'businesswoman', 'shop owner', 'weaver', 'fisherman', 'painter', 'barber',
];
export const DEMOGRAPHIC_NEGATION = /\b(?:not|never|no longer)\b|n't\b/i;
const OCCUPATION_RE = new RegExp(`\\b(?:i'?m|i am|i was)\\s+(?:an?\\s+|a retired\\s+)?(${[...OCCUPATIONS].sort((a, b) => b.length - a.length).map((o) => o.replace(/\s+/g, '\\s+')).join('|')})\\b`, 'i');
const LANGUAGES = ['english', 'telugu', 'hindi', 'bengali', 'tamil', 'kannada', 'malayalam', 'urdu', 'marathi', 'gujarati', 'punjabi', 'odia'];

/**
 * Patient details stated in conversation (ADR-050). Self-reports only from the PATIENT role, statements to the
 * patient ("you are 47") only from the DOCTOR role. Questions never ground a value; nothing is inferred
 * (no sex from pronouns, no occupation from context).
 */
function demographicItems(seg: TranscriptSegment, clause: string, ctx: ClauseContext): ExtractionItem[] {
  const out: ExtractionItem[] = [];
  const role = seg.speakerRole;
  if (role !== 'PATIENT' && role !== 'DOCTOR') return out;
  const self = role === 'PATIENT' ? "(?:i'?m|i am)" : "(?:you'?re|you are)";
  const push = (span: string, kind: NonNullable<ExtractionItem['attributes']['demographicKind']>, detail: string, attrs: ExtractionItem['attributes'] = {}) => {
    const it = base(seg, 'DEMOGRAPHIC', span.trim());
    // only a negation inside the statement counts ("I don't work as …"); a leading "No, I'm 47" is a correction
    it.informationState = ctx.hedge ? 'UNKNOWN' : DEMOGRAPHIC_NEGATION.test(span) ? 'NEGATIVE' : 'POSITIVE';
    if (it.informationState === 'UNKNOWN') flag(it, 'HEDGED_STATEMENT');
    it.attributes = { demographicKind: kind, demographicValue: detail.trim(), ...attrs };
    out.push(it);
  };
  // age: "I'm 47", "I turned 47", "47 years old" (patient); "you're 47" / "you are 47 years old" (doctor)
  const age =
    clause.match(new RegExp(`\\b${self}\\s+(\\d{1,3})(?:\\s+years?(?:\\s+old)?)?(?=\\s*(?:[.,!?;]|$|and\\b|now\\b|this\\b))`, 'i')) ??
    (role === 'PATIENT' ? clause.match(/\b(?:i (?:just |recently )?turned|my age is|i'?m aged)\s+(\d{1,3})\b(?:\s+years?(?:\s+old)?)?/i) ?? clause.match(/\b(\d{1,3})\s+years?\s+old\b/i) : null);
  if (age && Number(age[1]) <= 130) push(age[0], 'AGE', age[1], { numericValue: Number(age[1]), unit: 'years' });
  if (role === 'PATIENT') {
    const prev = /\b(used to|retired|former(?:ly)?|previously)\b/i.test(clause);
    const job =
      clause.match(/\b(?:i (?:used to )?work(?:ed)? as|i'?m working as|i am working as|my (?:job|occupation|profession) is|i'?m employed as|by profession i'?m)\s+(?:an?\s+)?([a-z]+(?:\s+[a-z]+)?)/i) ??
      clause.match(OCCUPATION_RE);
    if (job) {
      const title = job[1].replace(/\s+(?:and|at|in|for|but)$/i, '').trim();
      if (title && !/^(?:little|bit|lot|smoker|diabetic|vegetarian)$/i.test(title)) push(job[0].replace(/\s+(?:and|at|in|for|but)$/i, ''), 'OCCUPATION', title, prev ? { demographicQualifier: 'PREVIOUS' } : { demographicQualifier: 'CURRENT' });
    }
    const edu = clause.match(/\b(?:in|studying in|i study in|i'?m in)\s+(?:the\s+)?(?:(class|grade|standard|std)\s+(\d{1,2})|(\d{1,2})(?:st|nd|rd|th)\s+(class|grade|standard))\b/i);
    if (edu) push(edu[0], 'EDUCATION', edu[1] ? `${edu[1]} ${edu[2]}` : `${edu[3]} ${edu[4]}`);
    const lang = clause.match(new RegExp(`\\b(?:i (?:only |mostly )?(?:speak|prefer|understand)|my (?:first |mother |home )?(?:language|tongue) is)\\s+(${LANGUAGES.join('|')})\\b`, 'i'));
    if (lang) push(lang[0], 'LANGUAGE', lang[1]);
    const name = clause.match(/\bmy name is\s+([a-z][a-z'-]+(?:\s+(?!and\b)[a-z][a-z'-]+){0,2})/i);
    if (name) push(name[0], 'NAME', name[1]);
  }
  return out;
}

function stateFor(ctx: ClauseContext, span: string): ExtractionItem['informationState'] {
  if (ctx.hedge) return 'UNKNOWN';
  if (isNegatedSpan(ctx.clause, span)) return 'NEGATIVE';
  return 'POSITIVE';
}

function base(seg: TranscriptSegment, category: ExtractionItem['category'], value: string): ExtractionItem {
  const item: ExtractionItem = {
    category,
    value: value.trim(),
    informationState: 'POSITIVE',
    sourceSegmentIds: [seg.segmentId],
    derivationMethod: 'VERBATIM_EXTRACTION',
    confidence: seg.confidence === 'LOW' ? 'LOW' : 'HIGH',
    needsClarification: false,
    attributes: {},
  };
  if (unclear(seg)) {
    item.needsClarification = true;
    item.clarificationReason = 'UNCERTAIN_SPEECH';
  }
  return item;
}

function flag(item: ExtractionItem, reason: ExtractionItem['clarificationReason']): ExtractionItem {
  item.needsClarification = true;
  if (!item.clarificationReason || item.clarificationReason === 'UNCERTAIN_SPEECH' && reason === 'CONTEXT_UNCLEAR') item.clarificationReason = reason;
  return item;
}

function clauseItems(seg: TranscriptSegment, rawClause: string): ExtractionItem[] {
  const clause = wordsToDigits(rawClause);
  const ctx = clauseContext(clause);
  const role = seg.speakerRole;
  const out: ExtractionItem[] = [];
  const isDoctor = role === 'DOCTOR';
  const lower = clause.toLowerCase();

  // A question on its own never grounds a POSITIVE or NEGATIVE fact (rule 19). Hedged answers ("Maybe metformin?")
  // can still yield UNKNOWN facts.
  const questionOnly = ctx.question && !ctx.hedge;
  if (questionOnly) return out;

  // ---- explicit "not discussed"
  if (ctx.notDiscussed) {
    if (/allerg/i.test(clause)) {
      const it = base(seg, 'ALLERGY', rawClause.trim().replace(/[.!]$/, ''));
      it.informationState = 'NOT_DISCUSSED';
      it.attributes = { substance: 'ANY' };
      out.push(it);
    }
    if (/medication|medicine/i.test(clause)) {
      const it = base(seg, 'MEDICATION', rawClause.trim().replace(/[.!]$/, ''));
      it.informationState = 'NOT_DISCUSSED';
      it.attributes = { rawName: 'ANY' };
      out.push(it);
    }
    return out;
  }

  // ---- doctor's conditional safety-net advice → PLAN text that keeps its condition (ADR-045 d7)
  if (isDoctor && ctx.hypothetical) {
    if (PLAN_VERB_RE.test(clause) || /\b(come back|return|call|seek)\b/i.test(clause)) {
      out.push(base(seg, 'PLAN', clause.trim().replace(/[.!]$/, '')));
    }
    return out;
  }

  // ---- other person (experiencer): family history or a flagged statement (ADR-045 d3)
  if (ctx.experiencer) {
    const cond = clause.match(termRe(CONDITION_TERMS));
    const sym = clause.match(termRe(SYMPTOM_TERMS));
    const span = clause.trim().replace(/[.!]$/, '');
    if (cond && /\b(mother|mom|mum|father|dad|brother|sister|parents|grandmother|grandfather|grandma|grandpa|aunt|uncle|cousin|family)\b/i.test(clause) && !/\b(son|daughter)\b/i.test(clause)) {
      const it = base(seg, 'HISTORY_FAMILY', span);
      it.informationState = stateFor(ctx, cond[0]);
      out.push(it);
    } else if (cond || sym) {
      // e.g. a caregiver: "My son has had a fever" — kept, flagged, ineligible (OD-012 interim rule)
      const it = base(seg, cond ? 'HISTORY_MEDICAL' : 'SYMPTOM', span);
      it.informationState = stateFor(ctx, (cond ?? sym)![0]);
      out.push(flag(it, 'CONTEXT_UNCLEAR'));
    }
    return out;
  }

  out.push(...demographicItems(seg, clause, ctx));

  // ---- allergies
  const noAllergy = clause.match(/\b(no (?:known )?(?:drug )?allergies|not allergic to anything|no allergies)\b/i);
  if (noAllergy) {
    const it = base(seg, 'ALLERGY', noAllergy[0]);
    it.informationState = ctx.hedge ? 'UNKNOWN' : 'NEGATIVE';
    it.attributes = { substance: 'ANY' };
    out.push(it);
  } else {
    const allergyRe = new RegExp(`\\ballerg(?:ic|y)\\s+to\\s+(${ALLERGENS.map(esc).join('|')})\\b`, 'i');
    const m = clause.match(allergyRe);
    const reaction = clause.match(/\b(rash|hives|swelling|anaphylaxis|reaction|itching)\b/i);
    if (m) {
      const it = base(seg, 'ALLERGY', m[0]);
      it.informationState = ctx.hedge ? 'UNKNOWN' : isNegatedSpan(clause, m[0]) ? 'NEGATIVE' : 'POSITIVE';
      it.attributes = { substance: m[1].toLowerCase(), ...(reaction ? { reaction: reaction[0] } : {}) };
      out.push(it);
    } else if (ctx.hypothetical && reaction) {
      const al = clause.match(termRe(ALLERGENS));
      if (al) {
        // "If I take penicillin I get a rash" — kept flagged; still shown in the allergy list (allergy exception)
        const it = base(seg, 'ALLERGY', clause.trim().replace(/[.!]$/, ''));
        it.attributes = { substance: al[0].toLowerCase(), reaction: reaction[0] };
        out.push(flag(it, 'CONTEXT_UNCLEAR'));
      }
    }
  }

  // ---- medications
  const blanketMed = clause.match(
    /\b((?:don'?t|do not|not)\s+(?:take|taking|on)\s+any\s+(?:medications?|medicines?|tablets|pills)|no (?:regular )?medications?|not on any (?:medications?|medicines?))\b/i,
  );
  const stoppedUnknown = clause.match(/\b(stopped|quit|came off|stopped taking)\s+(?:my|the|that|those|this)?\s*(?:old\s+)?(medication|medicine|tablets|pills|meds)\b/i);
  const isPlanClause = isDoctor && PLAN_VERB_RE.test(clause);
  if (blanketMed) {
    const it = base(seg, 'MEDICATION', blanketMed[0]);
    it.informationState = ctx.hedge ? 'UNKNOWN' : 'NEGATIVE';
    it.attributes = { rawName: 'ANY' };
    out.push(it);
  } else if (stoppedUnknown && !clause.match(termRe(MEDICATIONS))) {
    // CS-26: no identifiable medication → no taking-status change
    const it = base(seg, 'MEDICATION', stoppedUnknown[0]);
    it.informationState = 'UNKNOWN';
    out.push(flag(it, 'UNIDENTIFIED_SUBJECT'));
  } else if (!isPlanClause) {
    const re = termRe(MEDICATIONS);
    let m: RegExpExecArray | null;
    while ((m = re.exec(clause))) {
      const name = m[1];
      const after = clause.slice(m.index);
      const dose = after.slice(0, 40).match(DOSE_RE) ?? clause.slice(Math.max(0, m.index - 25), m.index).match(DOSE_RE);
      const freq = after.match(FREQ_RE);
      const route = clause.match(ROUTE_RE);
      // value: the verbatim span from the name to the end of dose/frequency
      let end = m.index + name.length;
      for (const x of [dose, freq]) {
        if (x && x.index !== undefined) {
          const absolute = clause.indexOf(x[0], m.index);
          if (absolute >= m.index) end = Math.max(end, absolute + x[0].length);
        }
      }
      const value = clause.slice(m.index, end);
      const it = base(seg, 'MEDICATION', value);
      const pre = clause.slice(0, m.index).toLowerCase();
      let taking: ExtractionItem['attributes']['takingStatus'];
      if (/\b(stopped|quit|came off|discontinued|no longer)\b/.test(lower)) taking = 'DISCONTINUED';
      else if (/\bused to\b/.test(pre)) taking = 'PREVIOUS';
      else if (/\b(take|taking|i'?m on|on|currently|started|use|using)\b/.test(pre) || /\b(still)\b/.test(lower)) taking = 'CURRENT';
      it.informationState = ctx.hedge ? 'UNKNOWN' : isNegatedSpan(clause, name) && taking !== 'DISCONTINUED' ? 'NEGATIVE' : 'POSITIVE';
      if (ctx.hedge) {
        taking = 'UNKNOWN';
        flag(it, 'HEDGED_STATEMENT');
      }
      it.attributes = {
        rawName: name.toLowerCase(),
        ...(dose ? { dose: `${dose[1]} ${normUnit(dose[2])}` } : {}),
        ...(freq ? { frequency: freq[0] } : {}),
        ...(route ? { route: route[0] } : {}),
        ...(taking ? { takingStatus: taking } : {}),
      };
      out.push(it);
    }
  }

  // ---- vitals (spoken values: CLINICIAN_STATED / PATIENT_REPORTED by role, never MEASURED — CS-31)
  const vitals: [RegExp, NonNullable<ExtractionItem['attributes']['vitalKind']>, string][] = [
    [/\b(?:blood pressure|bp)\s*(?:is|was|of|reading)?\s*(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})\b/i, 'BP', 'mmHg'],
    [/\b(?:pulse|heart rate|hr)\s*(?:is|was|of)?\s*(\d{2,3})\b/i, 'PULSE', 'bpm'],
    [/\b(?:temperature|temp)\s*(?:is|was|of)?\s*(\d{2,3}(?:\.\d)?)\b/i, 'TEMPERATURE', ''],
    [/\b(?:oxygen saturation|saturations?|sats|spo2|oxygen)\s*(?:is|was|of|at)?\s*(\d{2,3})\s*(?:%|percent)?/i, 'SPO2', '%'],
    [/\b(?:weight|weighs|weigh|weighing)\s*(?:is|was|of|in at|today)?\s*(?:about\s+)?(\d{2,3}(?:\.\d)?)\s*(?:kg|kilos?|kilograms?)\b/i, 'WEIGHT', 'kg'],
    [/\b(?:height|tall)\s*(?:is|was|of)?\s*(\d{3})\s*(?:cm|centimet(?:er|re)s?)\b/i, 'HEIGHT', 'cm'],
    [/\b(?:blood sugar|glucose|sugar level)\s*(?:is|was|of)?\s*(\d{1,3}(?:\.\d)?)\b/i, 'GLUCOSE', ''],
  ];
  for (const [re, kind, unit] of vitals) {
    const m = clause.match(re);
    if (!m) continue;
    const it = base(seg, 'VITAL_SIGN', m[0]);
    const v1 = Number(m[1]);
    const u = kind === 'TEMPERATURE' ? (v1 > 50 ? '°F' : '°C') : unit;
    it.attributes = { vitalKind: kind, numericValue: v1, ...(m[2] ? { numericValue2: Number(m[2]) } : {}), ...(u ? { unit: u } : {}) };
    out.push(it);
  }

  // ---- weight loss with an amount ("lost about 3 kg")
  const wl = clause.match(/\b(?:lost|losing|lose)\s+(?:about|around|approximately|nearly)?\s*(\d+(?:\.\d+)?)\s*(kg|kilos?|kilograms?|pounds|lbs)\b/i);
  if (wl) {
    const it = base(seg, 'SYMPTOM', wl[0]);
    it.informationState = stateFor(ctx, wl[0]);
    it.attributes = { numericValue: Number(wl[1]), unit: /^k/i.test(wl[2]) ? 'kg' : 'lb' };
    out.push(it);
  }

  // ---- symptoms
  if (!(isDoctor && PLAN_VERB_RE.test(clause))) {
    const re = termRe(SYMPTOM_TERMS);
    let m: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((m = re.exec(clause))) {
      const term = m[1];
      const canon = (SYNONYMS[term.toLowerCase()] ?? term).toLowerCase();
      if (seen.has(canon) || (wl && canon === 'weight loss')) continue;
      seen.add(canon);
      if (isDoctor && ctx.question) continue;
      if (ctx.hypothetical) {
        // patient-side conditional symptom ("If I climb stairs I get chest pain") — kept, flagged (ADR-045 d3)
        const it = base(seg, 'SYMPTOM', clause.trim().replace(/[.!]$/, ''));
        it.informationState = stateFor(ctx, term);
        out.push(flag(it, 'CONTEXT_UNCLEAR'));
        continue;
      }
      const it = base(seg, 'SYMPTOM', term);
      it.informationState = stateFor(ctx, term);
      if (it.informationState === 'UNKNOWN') flag(it, 'HEDGED_STATEMENT');
      const dur = clause.match(DURATION_RE);
      const sev = clause.match(SEVERITY_RE);
      const tim = clause.match(TIMING_RE);
      const prog = clause.match(PROGRESSION_RE);
      if (it.informationState !== 'NEGATIVE') {
        it.attributes = {
          ...(dur ? { duration: dur[0].trim().replace(/^(?:for|over|the past|past|last)\s+/i, '').replace(/\s+now$/i, '') } : {}),
          ...(sev ? { severity: sev[0] } : {}),
          ...(tim ? { timing: tim[0] } : {}),
          ...(prog ? { progression: prog[0] } : {}),
        };
      }
      out.push(it);
    }
  }

  // ---- medical history / assessment
  {
    const re = termRe(CONDITION_TERMS);
    let m: RegExpExecArray | null;
    while ((m = re.exec(clause))) {
      const term = m[1];
      if (isDoctor) {
        const historyStyle = /\b(history of|known|background of|previous|previously)\b/i.test(clause);
        const assessStyle =
          /\b(has|have|got|is suffering from|diagnos\w*|impression|assessment|i think|likely|probably|possibly|looks like|could be|consistent with|may have|might have|this is|it'?s)\b/i.test(clause);
        if (!historyStyle && !assessStyle) continue;
        const it = base(seg, historyStyle ? 'HISTORY_MEDICAL' : 'ASSESSMENT', historyStyle ? term : clause.trim().replace(/[.!]$/, ''));
        it.informationState = stateFor(ctx, term);
        if (it.informationState === 'UNKNOWN') flag(it, 'HEDGED_STATEMENT');
        out.push(it);
      } else {
        // a patient's report of a diagnosis is history, never an Assessment (CS-40)
        const it = base(seg, 'HISTORY_MEDICAL', term);
        it.informationState = stateFor(ctx, term);
        if (it.informationState === 'UNKNOWN') flag(it, 'HEDGED_STATEMENT');
        out.push(it);
      }
    }
  }

  // ---- surgical and social history
  const surg = clause.match(/\b(?:had|underwent|have had)\s+(?:an?\s+|my\s+)?((?:[a-z]+ectomy)|(?:[a-z]+ surgery)|(?:[a-z]+ (?:removed|out))|(?:an operation on (?:my )?[a-z]+))\b/i);
  if (surg) out.push({ ...base(seg, 'HISTORY_SURGICAL', surg[0]), informationState: stateFor(ctx, surg[1]) });
  const smoke = clause.match(/\b(ex-smoker|former smoker|smoker|smokes?|smoking|cigarettes)\b/i);
  if (smoke) out.push({ ...base(seg, 'HISTORY_SOCIAL', smoke[0]), informationState: stateFor(ctx, smoke[0]) });
  const alcohol = clause.match(/\b(drinks?|drinking|alcohol)\b/i);
  if (alcohol && /\b(alcohol|beer|wine|spirits|drink(?:s|ing)?\s+(?:alcohol|beer|wine|socially|heavily))\b/i.test(clause))
    out.push({ ...base(seg, 'HISTORY_SOCIAL', alcohol[0]), informationState: stateFor(ctx, alcohol[0]) });

  // ---- investigations
  {
    const re = termRe(INVESTIGATION_TERMS);
    let m: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((m = re.exec(clause))) {
      const term = m[1].toLowerCase();
      if (seen.has(term)) continue;
      seen.add(term);
      let status: ExtractionItem['attributes']['investigationStatus'] = 'UNKNOWN';
      if (/\b(order|ordering|request|send (?:you )?for|we'?ll (?:do|get|check|arrange)|need (?:a|an)|get (?:a|an))\b/i.test(clause)) status = 'ORDERED';
      if (/\b(booked|scheduled|appointment for)\b/i.test(clause)) status = 'SCHEDULED';
      if (/\b(had (?:a|an|the|my)|was done|been done|did (?:a|an|the))\b/i.test(clause)) status = 'COMPLETED';
      if (/\b(results?|came back|showed|shows)\b/i.test(clause)) status = 'RESULT_AVAILABLE';
      const after = clause.slice(m.index + m[0].length, m.index + m[0].length + 25);
      const num = after.match(/^\s*(?:is|was|of|at|level)?\s*(\d+(?:\.\d+)?)\s*(%|mmol\/l|mg\/dl)?/i);
      const value = num ? clause.slice(m.index, m.index + m[0].length + num[0].length) : m[0];
      const it = base(seg, 'INVESTIGATION', value);
      it.attributes = { testName: term, investigationStatus: status, ...(num ? { result: num[1] + (num[2] ? ` ${num[2]}` : ''), numericValue: Number(num[1]) } : {}) };
      out.push(it);
    }
  }

  // ---- examination (clinician only)
  if (isDoctor) {
    const ex = clause.match(termRe(EXAM_TERMS));
    if (ex) {
      const it = base(seg, 'EXAMINATION_FINDING', clause.trim().replace(/[.!]$/, ''));
      it.informationState = /\b(clear|normal)\b/i.test(clause) ? 'NEGATIVE' : stateFor(ctx, ex[0]);
      out.push(it);
    }
  }

  // ---- plan and follow-up (clinician only)
  if (isDoctor) {
    const fu = clause.match(FOLLOW_UP_RE);
    if (fu) {
      const it = base(seg, 'FOLLOW_UP', fu[0]);
      it.attributes = { interval: fu[2], followUpStatus: 'PENDING', task: fu[1] };
      out.push(it);
    } else if (PLAN_VERB_RE.test(clause)) {
      out.push(base(seg, 'PLAN', clause.trim().replace(/[.!]$/, '')));
    }
  }
  return out;
}

function normUnit(u: string): string {
  const x = u.toLowerCase();
  if (x.startsWith('milligram') || x === 'mg') return 'mg';
  if (x.startsWith('microgram') || x === 'mcg') return 'mcg';
  if (x.startsWith('gram') || x === 'g') return 'g';
  if (x.startsWith('millil') || x === 'ml') return 'ml';
  if (x.startsWith('unit')) return 'units';
  if (x.startsWith('puff')) return 'puffs';
  return x;
}

export function extractDeterministic(segments: TranscriptSegment[]): ExtractionItem[] {
  const out: ExtractionItem[] = [];
  for (const seg of segments) {
    if (!seg.text.trim()) continue;
    for (const clause of splitClauses(seg.text)) out.push(...clauseItems(seg, clause));
  }
  return out;
}
