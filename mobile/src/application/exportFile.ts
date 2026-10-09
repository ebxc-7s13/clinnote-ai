/**
 * Export flow (UI-UX §4, FR-26). Works offline: the file is rendered on device (PDF via expo-print, text via
 * expo-file-system) into the cache directory, handed to the system share sheet, then deleted from the cache.
 * A failure leaves every stored record unchanged.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ExportDoc } from '../domain/export';

export type ExportFormat = 'PDF' | 'TEXT';

export const EXPORT_WARNING = "This file will leave ClinNote's protected storage. ClinNote cannot delete copies shared with other apps.";

function exportDir(): Directory {
  const d = new Directory(Paths.cache, 'clinnote-export');
  d.create({ intermediates: true, idempotent: true });
  return d;
}

export async function shareExport(doc: ExportDoc, format: ExportFormat): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  let file: File;
  if (format === 'PDF') {
    const { uri } = await Print.printToFileAsync({ html: doc.html });
    const src = new File(uri);
    file = new File(exportDir(), `${doc.fileBase}.pdf`);
    if (file.exists) file.delete();
    src.moveSync(file);
  } else {
    file = new File(exportDir(), `${doc.fileBase}.txt`);
    if (file.exists) file.delete();
    file.create();
    file.write(doc.text);
  }
  try {
    await Sharing.shareAsync(file.uri, { mimeType: format === 'PDF' ? 'application/pdf' : 'text/plain', dialogTitle: 'Export from ClinNote' });
  } finally {
    // the shared copy belongs to the receiving app; ClinNote's temporary copy is removed
    setTimeout(() => {
      try {
        if (file.exists) file.delete();
      } catch {
        /* already removed */
      }
    }, 60000);
  }
}
