"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrokerIconProps {
  icon: string;
  iconDark?: string;
  name?: string;
  className?: string;
  invertInDark?: boolean;
}

export function BrokerIcon({ icon, iconDark, name, className, invertInDark }: BrokerIconProps) {
  const [hasError, setHasError] = useState(false);

  const lightSrc = icon.startsWith("/") ? icon : `/assets/brokers/${icon}`;
  const darkSrc = iconDark
    ? iconDark.startsWith("/")
      ? iconDark
      : `/assets/brokers/${iconDark}`
    : null;

  if (hasError) {
    return (
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-muted-foreground",
          className,
        )}
        title={name}
      >
        <Landmark className="size-4 opacity-70" />
      </span>
    );
  }

  if (darkSrc) {
    return (
      <>
        <img
          src={lightSrc}
          alt={name || ""}
          onError={() => setHasError(true)}
          className={cn("size-8 shrink-0 rounded-md object-contain dark:hidden", className)}
        />
        <img
          src={darkSrc}
          alt={name || ""}
          onError={() => setHasError(true)}
          className={cn("hidden size-8 shrink-0 rounded-md object-contain dark:block", className)}
        />
      </>
    );
  }

  return (
    <img
      src={lightSrc}
      alt={name || ""}
      onError={() => setHasError(true)}
      className={cn(
        "size-8 shrink-0 rounded-md object-contain",
        invertInDark && "dark:invert",
        className,
      )}
    />
  );
}
