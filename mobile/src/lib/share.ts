import type { ComponentRef, RefObject } from "react";
import { Platform, Share, type View } from "react-native";
import { captureRef } from "react-native-view-shot";

const TITLE = "Her sitter jeg!";

// Wide enough to read the rows in a chat, small enough to send quickly.
const IMAGE_WIDTH_PX = 1080;

/**
 * Shares the map with the pin as an image, captioned with the link, so a chat
 * shows the seat without waiting for a link preview. Falls back to the link
 * alone where the image can't be made or sent (Expo Go has no RNShare).
 */
export async function shareLocation(
  url: string,
  card: RefObject<ComponentRef<typeof View> | null>,
): Promise<void> {
  try {
    // A file with a .png name, so share sheets treat it as an image rather
    // than a document.
    const file = await captureRef(card, {
      format: "png",
      result: "tmpfile",
      fileName: "hvor",
      width: IMAGE_WIDTH_PX,
    });
    // Required lazily: the module throws on import where it isn't linked.
    const { default: RNShare } = require("react-native-share");
    await RNShare.open({
      title: TITLE,
      message: url,
      url: file,
      type: "image/png",
      failOnCancel: false,
    });
  } catch {
    await shareLink(url);
  }
}

async function shareLink(url: string): Promise<void> {
  // iOS shares `url` as a link card; Android only reads `message`. Giving
  // iOS both shares the link twice.
  try {
    await Share.share(
      Platform.OS === "ios"
        ? { url, title: TITLE }
        : { message: url, title: TITLE },
    );
  } catch {
    // share sheet unavailable — nothing to do
  }
}
