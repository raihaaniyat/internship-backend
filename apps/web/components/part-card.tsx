"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Part } from "@/lib/types";

export interface PartCardProps {
  part: Part;
  saved?: boolean;
  busy?: boolean;
  onSave?: (part: Part) => void;
  onUnsave?: (part: Part) => void;
}

export function PartCard({ part, saved, busy, onSave, onUnsave }: PartCardProps) {
  return (
    <Card className="flex h-full min-w-0 flex-col border-border/80 bg-card/95 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <CardTitle className="min-w-0 flex-1 break-words text-base leading-snug">{part.name}</CardTitle>
          <Badge variant={part.inStock ? "success" : "destructive"} className="shrink-0">
            {part.inStock ? "in stock" : "out of stock"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="muted" className="max-w-full break-all font-mono text-[10px]">
            #{part.partNumber}
          </Badge>
          {part.category ? (
            <Badge variant="accent" className="max-w-full break-words">
              {part.category}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 text-sm">
        {part.description ? (
          <p className="line-clamp-3 text-muted-foreground">{part.description}</p>
        ) : (
          <p className="italic text-muted-foreground">No description.</p>
        )}
      </CardContent>
      <CardFooter className="flex min-w-0 flex-wrap items-center justify-between gap-2 pt-0">
        <span className="shrink-0 text-lg font-semibold tabular-nums">${part.price.toFixed(2)}</span>
        {onSave || onUnsave ? (
          saved ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onUnsave?.(part)}
            >
              {busy ? "…" : "Remove"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="success"
              disabled={busy}
              onClick={() => onSave?.(part)}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          )
        ) : null}
      </CardFooter>
    </Card>
  );
}
