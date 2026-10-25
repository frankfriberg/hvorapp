import { Platform, Share } from "react-native";
import { t } from "./i18n";

const TITLE = t.shareTitle;

// Wide enough to read the rows in a chat, small enough to send quickly.
const IMAGE_WIDTH_PX = 1080;

/**
 * Shares the map with the pin as an image, captioned with the link, so a chat
 * shows the seat without waiting for a link preview. Falls back to the link
 * alone where the image can't be made or sent (Expo Go has no RNShare).
 */
export async function shareLocation(
  url: string,
  /** The image as a PNG file of the given width, resolving to its URI. */
  capture: (width: number) => Promise<string>,
): Promise<void> {
  try {
    const file = await capture(IMAGE_WIDTH_PX);
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
