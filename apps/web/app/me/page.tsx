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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  addVehicle,
  deleteVehicle,
  listGarage,
  listSavedParts,
  removeSavedPart,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import type { SavedPart, Vehicle } from "@/lib/types";

export default function MePage() {
  return (
    <RoleGate requireAuth>
      <MeAuthed />
    </RoleGate>
  );
}

function MeAuthed() {
  const { user, token } = useAuth();
  const { toast } = useToast();

  if (!user || !token) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle>My account</CardTitle>
            <Badge variant={user.role === "admin" ? "success" : "muted"}>
              role: {user.role ?? "user"}
            </Badge>
          </div>
          <CardDescription>
            Live data from{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">GET /me</code>{" "}
            — every request is verified with your bearer token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Name
              </dt>
              <dd className="font-medium">{user.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Email
              </dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Email verified
              </dt>
              <dd>
                <Badge variant={user.emailVerified ? "success" : "warning"}>
                  {user.emailVerified ? "yes" : "no"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                User ID
              </dt>
              <dd className="font-mono text-xs">{user.id}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Tabs defaultValue="garage">
        <TabsList>
          <TabsTrigger value="garage">Garage</TabsTrigger>
          <TabsTrigger value="saved">Saved parts</TabsTrigger>
        </TabsList>
        <TabsContent value="garage">
          <GarageSection token={token} toast={toast} />
        </TabsContent>
        <TabsContent value="saved">
          <SavedPartsSection token={token} toast={toast} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Garage
// ---------------------------------------------------------------------------

function GarageSection({
  token,
  toast,
}: {
  token: string;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [items, setItems] = React.useState<Vehicle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [make, setMake] = React.useState("Honda");
  const [model, setModel] = React.useState("Civic");
  const [year, setYear] = React.useState("2018");
  const [trim, setTrim] = React.useState("EX");
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const result = await listGarage(token);
    if (!result.ok) {
      setError(`${result.error}: ${result.message}`);
      setItems([]);
    } else {
      setError(null);
      setItems(result.data.items);
    }
    setLoading(false);
  }, [token]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const yearNum = Number.parseInt(year, 10);
    const result = await addVehicle(token, {
      make: make.trim(),
      model: model.trim(),
      year: Number.isFinite(yearNum) ? yearNum : 0,
      trim: trim.trim() || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast({
        title: "Could not add vehicle",
        description: result.message,
        variant: "error",
      });
      return;
    }
    toast({
      title: "Vehicle added",
      description: `${result.data.year} ${result.data.make} ${result.data.model}`,
      variant: "success",
    });
    await load();
  }

  async function handleRemove(id: string) {
    setBusyId(id);
    const result = await deleteVehicle(token, id);
    setBusyId(null);
    if (!result.ok) {
      toast({
        title: "Could not remove",
        description: result.message,
        variant: "error",
      });
      return;
    }
    toast({ title: "Vehicle removed", variant: "info" });
    await load();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a vehicle</CardTitle>
          <CardDescription>
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              POST /me/garage
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="make">Make</Label>
                <Input
                  id="make"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  min={1900}
                  max={2100}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="trim">Trim (optional)</Label>
                <Input
                  id="trim"
                  value={trim}
                  onChange={(e) => setTrim(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Add to garage"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My garage</CardTitle>
          <CardDescription>
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              GET /me/garage
            </code>{" "}
            — scoped to your <code>userId</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-2/3" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No vehicles yet. Add one on the left.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Trim</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">
                      {v.year} {v.make} {v.model}
                    </TableCell>
                    <TableCell>{v.trim ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === v.id}
                        onClick={() => void handleRemove(v.id)}
                      >
                        {busyId === v.id ? "…" : "Remove"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saved parts
// ---------------------------------------------------------------------------

function SavedPartsSection({
  token,
  toast,
}: {
  token: string;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [items, setItems] = React.useState<SavedPart[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const result = await listSavedParts(token);
    if (!result.ok) {
      setError(`${result.error}: ${result.message}`);
      setItems([]);
    } else {
      setError(null);
      setItems(result.data.items);
    }
    setLoading(false);
  }, [token]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleRemove(item: SavedPart) {
    setBusyId(item.bookmarkId);
    const result = await removeSavedPart(token, item.bookmarkId);
    setBusyId(null);
    if (!result.ok) {
      toast({
        title: "Could not remove",
        description: result.message,
        variant: "error",
      });
      return;
    }
    toast({ title: "Removed from saved", variant: "info" });
    await load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Saved parts</CardTitle>
        <CardDescription>
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            GET /me/saved-parts
          </code>{" "}
          — joined with the parts table.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : items.length === 0 ? (
          <Alert variant="info">
            <AlertTitle>No saved parts yet</AlertTitle>
            <AlertDescription>
              Open the catalog and click <strong>Save</strong> on any part.
            </AlertDescription>
          </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>#</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Saved</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.bookmarkId}>
                  <TableCell className="font-medium">{item.part.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {item.part.partNumber}
                  </TableCell>
                  <TableCell>${item.part.price.toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(item.savedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.bookmarkId}
                      onClick={() => void handleRemove(item)}
                    >
                      {busyId === item.bookmarkId ? "…" : "Remove"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
