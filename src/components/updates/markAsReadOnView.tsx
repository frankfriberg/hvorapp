"use client";

import { markUpdatesAsRead } from "@/actions/updates";
import { useEffect, useRef } from "react";

export function MarkAsReadOnView() {
  const hasMarked = useRef(false);

  useEffect(() => {
    if (!hasMarked.current) {
      hasMarked.current = true;
      markUpdatesAsRead();
    }
  }, []);

  return null;
}
