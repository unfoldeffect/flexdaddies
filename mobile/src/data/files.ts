// Picking a file to read, and handing a file to the phone's share sheet.
// (In the browser preview: an ordinary file chooser and an ordinary download.)
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Lets the person choose a CSV file and returns its text, or null if they backed out. */
export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return null;
  if (Platform.OS === 'web') {
    const webFile = (asset as { file?: { text: () => Promise<string> } }).file;
    const text = webFile ? await webFile.text() : await (await fetch(asset.uri)).text();
    return { name: asset.name, text };
  }
  return { name: asset.name, text: await new File(asset.uri).text() };
}

/** Saves text as a file and opens the share sheet (or downloads it, in the browser). */
export async function shareTextFile(name: string, text: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) return false;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    const link = doc.createElement('a');
    link.href = url;
    link.download = name;
    doc.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
  return true;
}
