import { t } from "./i18n";

const TITLE = t.shareTitle;

// Wide enough to read the rows in a chat, small enough to send quickly.
const IMAGE_WIDTH_PX = 1080;

/**
 * Shares a picture of the map with the pin, and nothing else: no link, the
 * picture says where. Throws where it can't be made or sent (Expo Go has no
 * RNShare).
 */
export async function shareImage(
  /** The picture as a file, about the given width, resolving to its URI. */
  capture: (width: number) => Promise<string>,
  type: "image/png" | "image/jpeg" = "image/png",
): Promise<void> {
  const file = await capture(IMAGE_WIDTH_PX);
  // Required lazily: the module throws on import where it isn't linked.
  const { default: RNShare } = require("react-native-share");
  await RNShare.open({ title: TITLE, url: file, type, failOnCancel: false });
}
