"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  AUTH_BASE,
  API_BASE,
  listParts,
  pingApi,
  pingAuth,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Probe = {
  label: string;
  description: string;
  state: "loading" | "ok" | "warn" | "bad";
  detail: string;
  latencyMs?: number;
};

const PROBE_AUTH = {
  label: "Auth server",
  description: AUTH_BASE,
} as const;
const PROBE_API = {
  label: "API server",
  description: API_BASE,
} as const;
const PROBE_DB = {
  label: "PostgreSQL",
  description: "verified via API → /parts",
} as const;
const PROBE_SESSION = {
  label: "Session",
  description: "bearer token → /me",
} as const;

const initialProbes: Probe[] = [
  { ...PROBE_AUTH, state: "loading", detail: "checking…" },
  { ...PROBE_API, state: "loading", detail: "checking…" },
  { ...PROBE_DB, state: "loading", detail: "checking…" },
  { ...PROBE_SESSION, state: "loading", detail: "checking…" },
];

const DOT_CLASSES: Record<Probe["state"], string> = {
  loading: "bg-muted",
  ok: "live-dot",
  warn: "live-dot warn",
  bad: "live-dot bad",
};

export interface SystemStatusProps {
  variant?: "compact" | "full";
  refreshIntervalMs?: number;
  className?: string;
}

export function SystemStatus({
  variant = "full",
  refreshIntervalMs = 15000,
  className,
}: SystemStatusProps) {
  const { token, status: authStatus } = useAuth();
  const [probes, setProbes] = React.useState<Probe[]>(initialProbes);
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null);

  const runChecks = React.useCallback(async () => {
    const [auth, api] = await Promise.all([pingAuth(), pingApi()]);

    const next: Probe[] = [
      {
        label: "Auth server",
        description: AUTH_BASE,
        state: auth.ok ? "ok" : "bad",
        detail: auth.ok ? `200 OK · ${auth.latencyMs}ms` : auth.error ?? "down",
        latencyMs: auth.latencyMs,
      },
      {
        label: "API server",
        description: API_BASE,
        state: api.ok ? "ok" : "bad",
        detail: api.ok ? `200 OK · ${api.latencyMs}ms` : api.error ?? "down",
        latencyMs: api.latencyMs,
      },
      { ...PROBE_DB, state: "loading", detail: "checking…" },
      { ...PROBE_SESSION, state: "loading", detail: "checking…" },
    ];

    if (api.ok) {
      const dbStart = performance.now();
      const dbResult = await listParts(token, { pageSize: 1 });
      const dbLatency = Math.round(performance.now() - dbStart);
      next[2] = {
        label: "PostgreSQL",
        description: "verified via API → /parts",
        state: dbResult.ok ? "ok" : "bad",
        detail: dbResult.ok
          ? `query ok · ${dbLatency}ms · ${dbResult.data.total} parts`
          : `${dbResult.error}: ${dbResult.message}`,
        latencyMs: dbLatency,
      };
    } else {
      next[2] = { ...PROBE_DB, state: "warn", detail: "skipped — API down" };
    }

    if (token) {
      const sessionStart = performance.now();
      const me = await fetch(`${API_BASE}/me`, {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      })
        .then(async (res) => ({ ok: res.ok, status: res.status }))
        .catch(() => ({ ok: false, status: 0 }));
      const sessionLatency = Math.round(performance.now() - sessionStart);
      next[3] = {
        label: "Session",
        description: "bearer token → /me",
        state: me.ok ? "ok" : "bad",
        detail: me.ok
          ? `token valid · ${sessionLatency}ms`
          : `rejected · HTTP ${me.status}`,
        latencyMs: sessionLatency,
      };
    } else if (authStatus === "loading") {
      next[3] = {
        ...PROBE_SESSION,
        state: "loading",
        detail: "loading session…",
      };
    } else {
      next[3] = {
        ...PROBE_SESSION,
        state: "warn",
        detail: "no session — sign in to verify",
      };
    }

    setProbes(next);
    setLastChecked(new Date());
  }, [token, authStatus]);

  React.useEffect(() => {
    void runChecks();
    if (refreshIntervalMs <= 0) return;
    const id = window.setInterval(() => void runChecks(), refreshIntervalMs);
    return () => window.clearInterval(id);
  }, [runChecks, refreshIntervalMs]);

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs backdrop-blur",
          className,
        )}
      >
        {probes.slice(0, 3).map((probe) => (
          <span key={probe.label} className="flex items-center gap-1.5">
            <span className={DOT_CLASSES[probe.state]} aria-hidden />
            <span className="font-medium">{probe.label}</span>
            <span className="text-muted-foreground">
              {probe.state === "loading" ? "…" : probe.detail.split(" · ")[0]}
            </span>
          </span>
        ))}
      </div>
    );
  }

  const allOk = probes.every((p) => p.state === "ok");
  const anyBad = probes.some((p) => p.state === "bad");

  return (
    <Card className={cn("animate-fade-in border-border/80 shadow-md", className)}>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <span
              className={
                anyBad
                  ? DOT_CLASSES.bad
                  : allOk
                    ? DOT_CLASSES.ok
                    : DOT_CLASSES.warn
              }
              aria-hidden
            />
            <span>Live system status</span>
          </CardTitle>
          <CardDescription className="mt-1.5 max-w-full">
            Auth → API → PostgreSQL. Refreshes every {Math.round(refreshIntervalMs / 1000)}s.
          </CardDescription>
        </div>
        <Badge
          variant={anyBad ? "destructive" : allOk ? "success" : "warning"}
          className="w-fit shrink-0"
        >
          {anyBad ? "Issue" : allOk ? "All green" : "Checking"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          {probes.map((probe) => (
            <ProbeRow key={probe.label} probe={probe} />
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          {lastChecked
            ? `Last check ${lastChecked.toLocaleTimeString()}`
            : "Running first check…"}
        </div>
      </CardContent>
    </Card>
  );
}

function ProbeRow({ probe }: { probe: Probe }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-border/70 bg-card/50 px-3 py-2.5">
      <span className={cn("mt-1.5 shrink-0", DOT_CLASSES[probe.state])} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{probe.label}</span>
          <Badge
            variant="muted"
            className="max-w-full break-all text-left font-mono text-[10px] leading-snug"
          >
            {probe.description}
          </Badge>
        </div>
        {probe.state === "loading" ? (
          <Skeleton className="mt-1.5 h-3 w-32" />
        ) : (
          <p className="mt-1 break-words text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]">
            {probe.detail}
          </p>
        )}
      </div>
    </div>
  );
}
