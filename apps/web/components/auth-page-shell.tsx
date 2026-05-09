"use client";

import * as React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

export function AuthPageShell({
  title,
  subtitle,
  footnote,
  children,
  staggerDelayMs = 0,
}: {
  title: string;
  subtitle: React.ReactNode;
  footnote?: React.ReactNode;
  children: React.ReactNode;
  staggerDelayMs?: number;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 pb-8 lg:min-h-[min(560px,calc(100vh-10rem))] lg:grid-cols-[1fr_minmax(0,420px)] lg:items-stretch lg:gap-12">
      <aside
        className={cn(
          "animate-fade-in-up relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br p-6 sm:p-8",
          "from-primary/[0.12] via-card/90 to-accent/[0.14] shadow-[0_24px_48px_-12px_hsl(var(--primary)/0.15)]",
        )}
        style={{ animationDelay: `${staggerDelayMs}ms` }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-accent/25 blur-3xl"
          aria-hidden
        />
        <div className="relative space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/90 shadow-sm ring-1 ring-primary/15">
              <BrandLogo size={44} className="h-10 w-10" priority />
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              BuyAnyAutoPart
            </p>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          <div className="max-w-md text-sm leading-relaxed text-muted-foreground">{subtitle}</div>
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <span className="break-words">Secure session tokens via Better Auth — no passwords stored in the browser.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span className="break-words">API verifies every request; your demo maps 1:1 to real HTTP routes.</span>
            </li>
          </ul>
        </div>
      </aside>

      <div
        className="flex min-w-0 flex-col justify-center animate-fade-in-up"
        style={{ animationDelay: `${staggerDelayMs + 80}ms` }}
      >
        <div className="min-w-0">{children}</div>
        {footnote ? (
          <div className="mt-6 text-center text-sm text-muted-foreground">{footnote}</div>
        ) : null}
      </div>
    </div>
  );
}

export function AuthFootLink({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: string;
  label: string;
}) {
  return (
    <p className="break-words px-1">
      {prompt}{" "}
      <Link
        href={href}
        className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
      >
        {label}
      </Link>
    </p>
  );
}
