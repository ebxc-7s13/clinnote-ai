/** Export dialog (UI-UX §4): warning → format → share sheet. Failure never changes stored data. */
import { Alert } from 'react-native';
import { EXPORT_WARNING, shareExport, type ExportFormat } from '../application/exportFile';
import type { ExportDoc } from '../domain/export';

export function askExport(prepare: () => Promise<ExportDoc>) {
  const go = async (format: ExportFormat) => {
    try {
      const doc = await prepare();
      await shareExport(doc, format);
    } catch (e) {
      Alert.alert('Export not completed', `${e instanceof Error && e.message ? e.message : 'The file could not be created.'} Your records are unchanged.`);
    }
  };
  Alert.alert('Export', EXPORT_WARNING, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Plain text', onPress: () => void go('TEXT') },
    { text: 'PDF', onPress: () => void go('PDF') },
  ]);
}

/** Single-format export with the leave-storage warning (Android dialogs hold at most three buttons). */
export function confirmExport(format: ExportFormat, prepare: () => Promise<ExportDoc>) {
  Alert.alert('Export', EXPORT_WARNING, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: `Export ${format === 'TEXT' ? 'text' : format}`,
      onPress: async () => {
        try {
          await shareExport(await prepare(), format);
        } catch (e) {
          Alert.alert('Export not completed', `${e instanceof Error && e.message ? e.message : 'The file could not be created.'} Your records are unchanged.`);
        }
      },
    },
  ]);
}
