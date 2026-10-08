/**
 * Transient extraction item (DATA_MODEL §8.2). Produced by the deterministic extractor and by AI jobs 2–9.
 * Items never carry provenance or review status: code assigns those on promotion (§8.3).
 */
import { z } from 'zod';
import { ClarificationReason, ConfidenceLevel, DerivationMethod, FactAttributes, FactCategory, InformationState } from '../types';

export const ExtractionItem = z
  .object({
    category: FactCategory,
    conceptKey: z.string().optional(),
    value: z.string().min(1).max(400),
    informationState: InformationState,
    sourceSegmentIds: z.array(z.string()).min(1),
    derivationMethod: z.enum(['VERBATIM_EXTRACTION', 'NORMALIZED_EXTRACTION', 'AI_INFERENCE']),
    confidence: ConfidenceLevel,
    needsClarification: z.boolean().default(false),
    clarificationReason: ClarificationReason.optional(),
    attributes: FactAttributes.default({}),
  })
  .strict();
export type ExtractionItem = z.infer<typeof ExtractionItem>;
export type ExtractorKind = 'DETERMINISTIC' | 'AI';

export const AiExtractionOutput = z.object({ items: z.array(z.unknown()) }).strict();

export type DerivationMethodT = z.infer<typeof DerivationMethod>;
