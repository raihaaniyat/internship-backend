"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SystemStatus } from "@/components/system-status";
import { StaggerChildren } from "@/components/stagger-children";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { ArrowRight, Package, Shield, Sparkles } from "lucide-react";

export default function HomePage() {
  const { status, user } = useAuth();

  return (
    <div className="space-y-12">
      <section className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <div className="hero-panel space-y-6 p-6 sm:p-8 animate-fade-in-up">
          <div className="space-y-4">
            <Badge
              variant="secondary"
              className="border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary"
            >
              Live assignment demo
            </Badge>
            <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight md:text-5xl md:leading-[1.08]">
              Parts marketplace backend,{" "}
              <span className="gradient-text">wired for real demos.</span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground [text-wrap:balance]">
              Better Auth on{" "}
              <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-mono">:3001</code>
              , resource API on{" "}
              <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-mono">:3000</code>
              , Drizzle + PostgreSQL underneath — rate limits, CORS, and integration tests included.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/parts"
              className={cn(
                buttonVariants({ size: "lg" }),
                "inline-flex gap-2 shadow-lg shadow-primary/25",
              )}
            >
              <Package className="h-4 w-4" aria-hidden />
              Browse catalog
            </Link>
            {status === "authenticated" ? (
              <Link
                href="/me"
                className={buttonVariants({ size: "lg", variant: "outline", className: "border-primary/25" })}
              >
                My account
              </Link>
            ) : (
              <Link
                href="/sign-up"
                className={buttonVariants({ size: "lg", variant: "outline", className: "border-primary/25" })}
              >
                Create account
              </Link>
            )}
            <Link
              href="/status"
              className={cn(
                buttonVariants({ size: "lg", variant: "ghost" }),
                "gap-1",
              )}
            >
              Diagnostics
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          {status === "authenticated" && user ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
              <Shield className="h-4 w-4 shrink-0 text-success" aria-hidden />
              <span className="min-w-0 break-words text-muted-foreground">
                Signed in as <strong className="text-foreground">{user.name ?? user.email}</strong>
              </span>
              <Badge variant={user.role === "admin" ? "success" : "muted"} className="shrink-0">
                {user.role ?? "user"}
              </Badge>
            </div>
          ) : null}
        </div>

        <SystemStatus />
      </section>

      <Separator className="bg-gradient-to-r from-transparent via-border to-transparent" />

      <section className="space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Sparkles className="h-6 w-6 text-primary" aria-hidden />
              What&apos;s wired up
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Each card links to a flow that hits a real route — good for walkthroughs.
            </p>
          </div>
        </div>
        <StaggerChildren className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" staggerMs={70}>
          <FeatureCard
            href="/sign-up"
            title="Email + password auth"
            badge="POST /api/auth/sign-up/email"
            description="Bearer via set-auth-token, verified on /me after sign-in."
          />
          <FeatureCard
            href="/parts"
            title="Public catalog"
            badge="GET /parts"
            description="Pagination and category filters; proves DB connectivity from the status card."
          />
          <FeatureCard
            href="/me"
            title="User-scoped data"
            badge="/me · garage · saved-parts"
            description="Queries always scoped by session user id — no userId in the path."
          />
          <FeatureCard
            href="/admin"
            title="Admin mutations"
            badge="POST /parts"
            description="Role-gated writes with audit logging for reviewers."
          />
          <FeatureCard
            href="/status"
            title="Diagnostics"
            badge="Probes + hardening"
            description="Live checks for auth gate, invalid token, and admin access patterns."
          />
          <FeatureCard
            href="/parts"
            title="Drizzle ORM"
            badge="packages/db"
            description="Shared schema: users, parts, vehicles, bookmarks, audit trail."
          />
        </StaggerChildren>
      </section>
    </div>
  );
}

function FeatureCard({
  href,
  title,
  badge,
  description,
}: {
  href: string;
  title: string;
  badge: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group block h-full min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full rounded-2xl border-border/70 bg-card/90 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/25 group-hover:shadow-lg group-hover:shadow-primary/10">
        <CardHeader className="space-y-2 pb-2">
          <Badge
            variant="muted"
            className="w-fit max-w-full break-all font-mono text-[10px] leading-snug"
          >
            {badge}
          </Badge>
          <CardTitle className="text-base leading-snug transition-colors group-hover:text-primary">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="line-clamp-4 sm:line-clamp-none">{description}</CardDescription>
          <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            Open
            <ArrowRight className="h-3 w-3" aria-hidden />
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
