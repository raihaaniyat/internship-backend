"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function StaggerChildren({
  children,
  className,
  childClassName,
  staggerMs = 55,
}: {
  children: React.ReactNode;
  className?: string;
  /** Applied to each child wrapper */
  childClassName?: string;
  staggerMs?: number;
}) {
  const items = React.Children.toArray(children);
  return (
    <div className={cn(className)}>
      {items.map((child, i) => (
        <div
          key={i}
          className={cn("animate-fade-in-up opacity-0 [animation-fill-mode:forwards]", childClassName)}
          style={{ animationDelay: `${i * staggerMs}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
