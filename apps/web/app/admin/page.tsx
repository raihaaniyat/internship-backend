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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleGate } from "@/components/role-gate";
import {
  createPart,
  deletePart,
  listParts,
  updatePart,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import type { Part } from "@/lib/types";

const ADMIN_PAGE_SIZE = 20;

export default function AdminPage() {
  return (
    <RoleGate requireAuth requireAdmin>
      <AdminPanel />
    </RoleGate>
  );
}

function AdminPanel() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [parts, setParts] = React.useState<Part[]>([]);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const result = await listParts(token, { page, pageSize: ADMIN_PAGE_SIZE });
    if (!result.ok) {
      setError(`${result.error}: ${result.message}`);
      setParts([]);
      setTotal(0);
    } else {
      setError(null);
      setParts(result.data.items);
      setTotal(result.data.total);
    }
    setLoading(false);
  }, [token, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleToggleStock(part: Part) {
    if (!token) return;
    setBusyId(part.id);
    const result = await updatePart(token, part.id, { inStock: !part.inStock });
    setBusyId(null);
    if (!result.ok) {
      toast({
        title: "Update failed",
        description: result.message,
        variant: "error",
      });
      return;
    }
    toast({
      title: "Updated",
      description: `${part.name} is now ${result.data.inStock ? "in stock" : "out of stock"}.`,
      variant: "success",
    });
    await load();
  }

  async function handleDelete(part: Part) {
    if (!token) return;
    if (!window.confirm(`Delete "${part.name}"? This cannot be undone.`)) return;
    setBusyId(part.id);
    const result = await deletePart(token, part.id);
    setBusyId(null);
    if (!result.ok) {
      toast({
        title: "Delete failed",
        description: result.message,
        variant: "error",
      });
      return;
    }
    toast({
      title: "Deleted",
      description: part.name,
      variant: "info",
    });
    await load();
  }

  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin · Parts</h1>
          <p className="text-sm text-muted-foreground">
            Admin-only routes. Backend enforces this with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">requireAdmin</code>{" "}
            middleware. Every action is written to{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">audit_logs</code>.
          </p>
        </div>
        <Badge variant="success" className="gap-1">
          <span className="live-dot" aria-hidden /> Admin role verified
        </Badge>
      </div>

      <CreatePartCard
        token={token!}
        onCreated={() => {
          setPage(1);
          void load();
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All parts</CardTitle>
          <CardDescription>
            Page {page} of {totalPages} · {total} total
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.map((part) => (
                  <TableRow key={part.id}>
                    <TableCell className="font-medium">{part.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {part.partNumber}
                    </TableCell>
                    <TableCell>{part.category ?? "—"}</TableCell>
                    <TableCell>${part.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={part.inStock ? "success" : "destructive"}>
                        {part.inStock ? "in" : "out"}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === part.id}
                        onClick={() => void handleToggleStock(part)}
                      >
                        Toggle
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === part.id}
                        onClick={() => void handleDelete(part)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function CreatePartCard({
  token,
  onCreated,
}: {
  token: string;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState("Brake Pad Set Premium");
  const [partNumber, setPartNumber] = React.useState(
    () => `BP-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
  );
  const [price, setPrice] = React.useState("149.99");
  const [category, setCategory] = React.useState("Brakes");
  const [description, setDescription] = React.useState(
    "High-performance ceramic brake pads for daily drivers.",
  );
  const [inStock, setInStock] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const priceNum = Number.parseFloat(price);
    const result = await createPart(token, {
      name: name.trim(),
      partNumber: partNumber.trim(),
      price: Number.isFinite(priceNum) ? priceNum : 0,
      description: description.trim() || undefined,
      category: category.trim() || undefined,
      inStock,
    });
    setSubmitting(false);
    if (!result.ok) {
      const conflict = result.status === 409;
      toast({
        title: conflict ? "Duplicate part number" : "Could not create",
        description: result.message,
        variant: conflict ? "warning" : "error",
      });
      return;
    }
    toast({
      title: "Part created",
      description: `${result.data.name} (#${result.data.partNumber})`,
      variant: "success",
    });
    setPartNumber(`BP-${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
    onCreated();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create a part</CardTitle>
        <CardDescription>
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            POST /parts
          </code>{" "}
          — duplicate <code>partNumber</code> returns{" "}
          <strong>409 conflict</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="part-name">Name</Label>
            <Input
              id="part-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="part-number">Part number</Label>
            <Input
              id="part-number"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="part-price">Price (USD)</Label>
            <Input
              id="part-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="part-category">Category</Label>
            <Input
              id="part-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="part-description">Description</Label>
            <Textarea
              id="part-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => setInStock(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            In stock
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create part"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
