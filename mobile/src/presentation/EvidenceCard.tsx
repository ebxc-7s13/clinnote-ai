/** Evidence record card: source, type + tier, identifier, URL, retrieval time, "Retrieved for", staleness marker. */
import { Linking, View } from 'react-native';
import type { EvidenceSource } from '../domain/types';
import { formatDate, formatDateTime } from '../domain/util';
import { Button, Card, Chip, KeyValue, Row, T } from './components';
import { SOURCE_TYPE_LABEL } from './labels';
import { useTheme } from './theme';

export function EvidenceCard({ e }: { e: EvidenceSource }) {
  const { c } = useTheme();
  const us = /fda|dailymed/i.test(e.provider);
  return (
    <Card accessibilityLabel={`${SOURCE_TYPE_LABEL[e.sourceType]}, ${e.provider}: ${e.title}`}>
      <Row wrap>
        <Chip label={`${SOURCE_TYPE_LABEL[e.sourceType]} · tier ${e.tier}`} tone="info" />
        {e.jurisdictionLabel || us ? <Chip label={e.jurisdictionLabel ?? 'U.S. regulatory information'} tone="neutral" icon="flag-outline" /> : null}
        {e.factsChangedSinceRetrieval ? <Chip label="Based on facts that changed since retrieval" tone="warning" icon="alert-outline" /> : null}
        {!e.citable ? <Chip label="Not citable for possibilities" tone="neutral" /> : null}
      </Row>
      <T style={{ fontWeight: '700' }} selectable>{e.title}</T>
      {e.authors || e.journal ? <T variant="small" muted>{[e.authors, e.journal].filter(Boolean).join(' · ')}</T> : null}
      <KeyValue k="Source" v={e.provider} />
      <KeyValue k="Identifier" v={`${e.identifierType} ${e.identifier}`} />
      {e.publishedAt ? <KeyValue k="Published / updated" v={formatDate(e.publishedAt)} /> : null}
      <KeyValue k="Retrieved" v={formatDateTime(e.retrievedAt)} />
      <KeyValue k="Retrieved for" v={e.retrievedFor === 'Clinician search' ? 'Clinician search' : e.retrievedFor} />
      <KeyValue k="Relevance (retrieval)" v={e.relevance.toLowerCase()} />
      {e.excerpt ? (
        <View style={{ gap: 2 }}>
          <T variant="small" style={{ fontWeight: '700', color: c.textMuted }}>Reference information (quoted from source)</T>
          <T variant="small" selectable>{e.excerpt}</T>
        </View>
      ) : null}
      {e.sourceType === 'REGULATORY'
        ? (
            [
              ['boxedWarning', 'Boxed warning'],
              ['indications', 'Indications stated in the label'],
              ['contraindications', 'Contraindications'],
              ['warnings', 'Warnings and precautions'],
              ['interactions', 'Drug interactions section'],
            ] as const
          )
            .filter(([k]) => e.extra?.[k])
            .map(([k, label]) => (
              <View key={k} style={{ gap: 2 }}>
                <T variant="small" style={{ fontWeight: '700', color: k === 'boxedWarning' ? c.danger : c.textMuted }}>{label} (quoted from {e.provider})</T>
                <T variant="small" selectable>{e.extra?.[k]}</T>
              </View>
            ))
        : null}
      {e.sourceType === 'REGULATORY' ? <T variant="small" muted>Label information — not a dosing recommendation, and not an assessment of suitability for this patient.</T> : null}
      <Button kind="ghost" compact icon="open-in-new" label="Open source" accessibilityHint={e.url} onPress={() => void Linking.openURL(e.url).catch(() => undefined)} style={{ alignSelf: 'flex-start' }} />
      <T variant="small" muted selectable>{e.url}</T>
    </Card>
  );
}
