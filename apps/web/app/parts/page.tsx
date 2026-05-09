"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PartCard } from "@/components/part-card";
import {
  listParts,
  listSavedParts,
  removeSavedPart,
  savePart,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import type { Part, SavedPart } from "@/lib/types";

const PAGE_SIZE = 12;

export default function PartsPage() {
  const { token, status } = useAuth();
  const { toast } = useToast();

  const [page, setPage] = React.useState(1);
  const [category, setCategory] = React.useState("");
  const [appliedCategory, setAppliedCategory] = React.useState("");
  const [items, setItems] = React.useState<Part[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<Map<string, SavedPart>>(new Map());
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadParts = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      const result = await listParts(token, {
        page,
        pageSize: PAGE_SIZE,
        category: appliedCategory || undefined,
      });
      if (signal?.aborted) return;
      if (!result.ok) {
        setError(`${result.error}: ${result.message}`);
        setItems([]);
        setTotal(0);
      } else {
        setItems(result.data.items);
        setTotal(result.data.total);
      }
      setLoading(false);
    },
    [token, page, appliedCategory],
  );

  const loadSaved = React.useCallback(async () => {
    if (!token) {
      setSaved(new Map());
      return;
    }
    const result = await listSavedParts(token);
    if (!result.ok) return;
    const map = new Map<string, SavedPart>();
    for (const item of result.data.items) map.set(item.part.id, item);
    setSaved(map);
  }, [token]);

  React.useEffect(() => {
    const controller = new AbortController();
    void loadParts(controller.signal);
    return () => controller.abort();
  }, [loadParts]);

  React.useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  async function handleSave(part: Part) {
    if (!token) {
      toast({
        title: "Sign in to save parts",
        variant: "info",
      });
      return;
    }
    setSavingId(part.id);
    const result = await savePart(token, part.id);
    setSavingId(null);
    if (!result.ok) {
      toast({
        title: "Could not save",
        description: result.message,
        variant: "error",
      });
      return;
    }
    toast({
      title: "Saved",
      description: `${part.name} added to your saved parts.`,
      variant: "success",
    });
    await loadSaved();
  }

  async function handleUnsave(part: Part) {
    const bookmark = saved.get(part.id);
    if (!token || !bookmark) return;
    setSavingId(part.id);
    const result = await removeSavedPart(token, bookmark.bookmarkId);
    setSavingId(null);
    if (!result.ok) {
      toast({
        title: "Could not remove",
        description: result.message,
        variant: "error",
      });
      return;
    }
    toast({
      title: "Removed",
      description: `${part.name} removed from saved parts.`,
      variant: "info",
    });
    await loadSaved();
  }

  function applyFilter(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    setAppliedCategory(category.trim());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Parts catalog</h1>
          <p className="text-sm text-muted-foreground">
            Public endpoint · no auth required ·{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              GET /parts?page=&amp;pageSize=&amp;category=
            </code>
          </p>
        </div>
        <Badge variant={loading ? "muted" : "success"} className="gap-1">
          <span
            className={loading ? "h-1.5 w-1.5 rounded-full bg-muted-foreground" : "live-dot"}
            aria-hidden
          />
          {loading ? "loading" : `${total} parts`}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            The category filter maps directly to{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">?category=</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={applyFilter}
          >
            <div className="flex-1 space-y-1.5 min-w-48">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="e.g. Engine, Brakes, Suspension"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <Button type="submit" variant="default">
              Apply
            </Button>
            {appliedCategory ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCategory("");
                  setAppliedCategory("");
                  setPage(1);
                }}
              >
                Clear
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load parts</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-3/5" />
                </CardContent>
              </Card>
            ))
          : items.map((part) => (
              <PartCard
                key={part.id}
                part={part}
                saved={saved.has(part.id)}
                busy={savingId === part.id}
                onSave={status === "authenticated" ? handleSave : undefined}
                onUnsave={status === "authenticated" ? handleUnsave : undefined}
              />
            ))}
      </div>

      {!loading && items.length === 0 && !error ? (
        <Alert variant="info">
          <AlertTitle>No parts found</AlertTitle>
          <AlertDescription>
            Try clearing the filter, or run{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">bun run db:seed</code>{" "}
            to populate sample data.
          </AlertDescription>
        </Alert>
      ) : null}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
