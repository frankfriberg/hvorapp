"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const isRoot = pathname === "/";

  return (
    <Button
      variant="ghost"
      className={cn(
        "-ml-2 mr-2 h-8 w-8 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
        "transition-all duration-300 ease-in-out",
        isRoot
          ? "pointer-events-none w-0 opacity-0"
          : "pointer-events-auto opacity-100",
      )}
      onClick={() => router.push("/")}
      aria-hidden={isRoot}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="!size-6"
      >
        <title>back arrow</title>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
        />
      </svg>
      <span className="sr-only">Go Back</span>
    </Button>
  );
}
