// The only file that imports the image picker and the file system of the device.
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

import type { LocalFile } from "../api/pets";

/**
 * Opens the gallery of the device. Returns the chosen image, or null when
 * the owner cancels.
 */
export async function pickPhoto(): Promise<LocalFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  return { uri: result.assets[0].uri };
}

/**
 * Returns the content of a file of the device as the part of a multipart
 * body. The fetch of Expo reads the bytes of the file from this object.
 */
export function filePart(file: LocalFile): Blob {
  return new File(file.uri) as unknown as Blob;
}
