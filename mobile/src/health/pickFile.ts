// The only file that imports the document picker (ADR 0026).
import * as DocumentPicker from "expo-document-picker";

import type { LocalFile } from "../api/pets";

/**
 * Opens the files of the device, for an image or a PDF (RN-82). Returns the
 * file, or null when the owner cancels.
 */
export async function pickAttachment(): Promise<LocalFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    // In Expo Go, the file system of the app cannot read the copy in the
    // cache of the picker. The content address of Android can be read.
    copyToCacheDirectory: false,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  const asset = result.assets[0];
  return { uri: asset.uri, file: asset.file, name: asset.name };
}
