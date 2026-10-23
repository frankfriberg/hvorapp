import { t } from "./i18n";

/**
 * The banner drawn under the map in a shared image. One banner at a time;
 * replace these values to run a different one (a sponsor, an event).
 */
export const SHARE_BANNER: {
  headline: string;
  body?: string;
  background: string;
  foreground: string;
} = {
  headline: t.bannerHeadline,
  body: t.bannerBody,
  background: "#18181b",
  foreground: "#fff",
};
