// The only file that imports the image picker, the image manipulator (ADR 0033)
// and the file system of the device.
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";

import type { LocalFile } from "../api/pets";
import { shrinkSize } from "./photoSize";

/**
 * The quality for the photo of a nose: the picker does not compress the
 * image again. A new compression changes the pixels, and the detector can
 * stop finding the nose in a small photo.
 */
export const NOSE_PHOTO_QUALITY = 1;

/**
 * Opens the gallery of the device. Returns the chosen image, or null when
 * the person cancels. quality is the JPEG quality of the copy that the
 * picker makes, from 0 to 1.
 */
export async function pickPhoto(quality = 0.8): Promise<LocalFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  return localFile(result.assets[0]);
}

function localFile(asset: ImagePicker.ImagePickerAsset): LocalFile {
  return { uri: asset.uri, file: asset.file };
}

/**
 * Opens the camera of the device for the photo of a nose. Returns the photo, null when the owner
 * cancels, or "denied" when the app has no permission to use the camera.
 */
export async function takePhoto(square = false): Promise<LocalFile | null | "denied"> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return "denied";
  }
  // The camera compresses the photo one time, from the sensor. This is not
  // a new compression of a file, and quality 1 gives a file that can pass
  // the 8 MB of RN-59.
  // A square crop keeps only what is inside the square, as the guide of the
  // noseprint capture says (Focinho-Captura artboard).
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9, allowsEditing: square, aspect: [1, 1] });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  return localFile(result.assets[0]);
}

/**
 * Returns the content of a file of the device as the part of a multipart
 * body. The fetch of Expo reads the bytes of the file from this object.
 */
export function filePart(file: LocalFile): Blob {
  // On the web, the browser already gave the content of the file.
  return file.file ?? (new File(file.uri) as unknown as Blob);
}

/**
 * Makes a profile photo or a found-dog photo smaller before the upload
 * (#254): the larger side goes to 1600 px, in JPEG. A small photo, null
 * and "denied" pass as they are. Never use it for a photo of a nose: a new
 * compression can stop the detector from finding the nose.
 */
export async function shrinkPhoto<T extends LocalFile | null | "denied">(photo: T): Promise<T | LocalFile> {
  if (photo === null || photo === "denied") {
    return photo;
  }
  const context = ImageManipulator.manipulate(photo.uri);
  const original = await context.renderAsync();
  const size = shrinkSize(original.width, original.height);
  if (size === null) {
    return photo;
  }
  const image = await context.resize(size).renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  // On the web the upload reads the content of the file, not the address.
  const file = Platform.OS === "web" ? await (await fetch(saved.uri)).blob() : undefined;
  return { uri: saved.uri, file, name: "photo.jpg" };
}

/** Asks where the photo of the pet comes from (camera or gallery) and gives it to use, made smaller (#254). */
export function askPetPhoto(use: (photo: LocalFile | null | "denied") => void): void {
  // On the web the file picker of the browser already offers the camera on a phone (#263).
  if (Platform.OS === "web") {
    void pickPhoto().then(shrinkPhoto).then(use);
    return;
  }
  Alert.alert("Foto do pet", undefined, [
    { text: "Câmera", onPress: () => void takePhoto().then(shrinkPhoto).then(use) },
    { text: "Galeria", onPress: () => void pickPhoto().then(shrinkPhoto).then(use) },
    { text: "Cancelar", style: "cancel" },
  ]);
}
