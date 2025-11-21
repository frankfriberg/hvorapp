"use client";

import mobilepay from "@public/mobilepay.svg";
import vipps from "@public/vipps.svg";
import Link, { type LinkProps } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { Button } from "../ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "../ui/drawer";

export function Menu() {
  const [open, setOpen] = React.useState(false);

  const onOpenChange = React.useCallback((open: boolean) => {
    setOpen(open);
  }, []);

  const links = [
    {
      title: "Kart",
      href: "/",
    },
    {
      title: "Oppdateringer",
      href: "/updates",
    },
    {
      title: "Tilbakemelding",
      href: "/feedback",
    },
  ];

  const vippsUrl = process.env.NEXT_PUBLIC_VIPPS_URL;
  const mobilepayUrl = process.env.NEXT_PUBLIC_MOBILEPAY_URL;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          className="-ml-2 mr-2 h-8 w-8 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="!size-6"
          >
            <title>two stripes</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 9h16.5m-16.5 6.75h16.5"
            />
          </svg>
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="min-h-[60svh] text-center">
        <div className="flex grow flex-col justify-between gap-3 p-6">
          <div className="flex flex-col gap-6">
            <DrawerTitle className="text-xs">MENY</DrawerTitle>
            {links.map(
              (item) =>
                item.href && (
                  <MobileLink
                    key={item.href}
                    href={item.href}
                    onOpenChange={setOpen}
                  >
                    {item.title}
                  </MobileLink>
                ),
            )}
          </div>
          <div className="flex flex-col gap-3">
            <p className="font-bold">Støtt oss via</p>
            {vippsUrl && (
              <Link href={vippsUrl}>
                <Image
                  src={vipps}
                  alt="Støtt oss via Vipps"
                  className="m-auto w-8/12"
                />
              </Link>
            )}
            {mobilepayUrl && (
              <Link href={mobilepayUrl}>
                <Image
                  src={mobilepay}
                  alt="Støtt oss via MobilePay"
                  className="m-auto w-8/12"
                />
              </Link>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

interface MobileLinkProps extends LinkProps {
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

function MobileLink({
  href,
  onOpenChange,
  className,
  children,
  ...props
}: MobileLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      onClick={() => {
        router.push(href.toString());
        onOpenChange?.(false);
      }}
      className={cn("text-3xl", active && "font-bold", className)}
      {...props}
    >
      {children}
    </Link>
  );
}
