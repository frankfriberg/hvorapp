import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

// Profile photos are small squares: enough for a pin's head and a list row,
// and well under the server's AVATAR_MAX_BYTES as a JPEG.
const SIDE = 256;
const QUALITY = 0.7;

/** Lets me pick a photo, cropped square and shrunk; null when cancelled. */
export async function pickAvatar(): Promise<Blob | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (picked.canceled) return null;
  const { uri, width, height } = picked.assets[0];

  const photo = ImageManipulator.manipulate(uri);
  // Android's cropper may not hold the square; take the middle of it.
  const side = Math.min(width, height);
  if (width !== height) {
    photo.crop({
      originX: (width - side) / 2,
      originY: (height - side) / 2,
      width: side,
      height: side,
    });
  }
  photo.resize({ width: SIDE, height: SIDE });
  const image = await photo.renderAsync();
  const saved = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: QUALITY,
  });
  return (await fetch(saved.uri)).blob();
}
