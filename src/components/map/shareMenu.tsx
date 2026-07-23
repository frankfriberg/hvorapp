"use client";

import { cn } from "@/lib/utils";
import { CheckIcon, ShareIcon } from "lucide-react";
import type { NextURL } from "next/dist/server/web/next-url";
import { useState } from "react";
import { Button } from "../ui/button";

type ShareMenuProps = {
  url?: NextURL;
};

export default function ShareMenu({ url }: ShareMenuProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (!url) return;

    // Native share sheet (mobile). A rejected promise is usually the user
    // dismissing the sheet, so we swallow it.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Her sitter jeg!", url: url.href });
      } catch {
        // cancelled or unavailable — nothing to do
      }
      return;
    }

    // Fallback for environments without the Web Share API (e.g. desktop):
    // copy the link to the clipboard and briefly confirm.
    try {
      await navigator.clipboard.writeText(url.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.warn("Could not copy link to clipboard.");
    }
  };

  return (
    <Button
      className={cn(
        "fixed right-[-25vw] bottom-[10vw] size-20 rounded-full transition-[right]",
        url && "right-[10vw]",
      )}
      onClick={handleShare}
      aria-label={copied ? "Lenke kopiert" : "Del plassering"}
    >
      {copied ? (
        <CheckIcon className="size-7!" />
      ) : (
        <ShareIcon className="size-7!" />
      )}
    </Button>
  );
}
