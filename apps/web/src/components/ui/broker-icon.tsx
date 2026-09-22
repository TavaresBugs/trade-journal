"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrokerIconProps {
  icon: string;
  name?: string;
  className?: string;
  invertInDark?: boolean;
}

export function BrokerIcon({
  icon,
  name,
  className,
  invertInDark,
}: BrokerIconProps) {
  const [hasError, setHasError] = useState(false);

  const src = icon.startsWith("/") ? icon : `/assets/brokers/${icon}`;

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

  return (
    <img
      src={src}
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
