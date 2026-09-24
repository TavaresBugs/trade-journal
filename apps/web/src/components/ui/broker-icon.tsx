"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrokerIconProps {
  icon?: string | null;
  iconDark?: string | null;
  name?: string;
  className?: string;
  invertInDark?: boolean;
}

export function BrokerIcon({ icon, iconDark, name, className, invertInDark }: BrokerIconProps) {
  const [lightError, setLightError] = useState(false);
  const [darkError, setDarkError] = useState(false);

  if (!icon || (lightError && (!iconDark || darkError))) {
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

  const lightSrc = icon.startsWith("/") ? icon : `/assets/brokers/${icon}`;
  const effectiveDarkSrc =
    iconDark && !darkError
      ? iconDark.startsWith("/")
        ? iconDark
        : `/assets/brokers/${iconDark}`
      : lightSrc;

  if (iconDark && !darkError) {
    return (
      <>
        {!lightError && (
          <img
            src={lightSrc}
            alt={name || ""}
            onError={() => setLightError(true)}
            className={cn("size-8 shrink-0 rounded-md object-contain dark:hidden", className)}
          />
        )}
        <img
          src={effectiveDarkSrc}
          alt={name || ""}
          onError={() => setDarkError(true)}
          className={cn(
            lightError
              ? "size-8 shrink-0 rounded-md object-contain"
              : "hidden size-8 shrink-0 rounded-md object-contain dark:block",
            invertInDark && "dark:invert",
            className,
          )}
        />
      </>
    );
  }

  return (
    <img
      src={lightSrc}
      alt={name || ""}
      onError={() => setLightError(true)}
      className={cn(
        "size-8 shrink-0 rounded-md object-contain",
        invertInDark && "dark:invert",
        className,
      )}
    />
  );
}
