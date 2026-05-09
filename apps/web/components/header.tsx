"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CarFront } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; admin?: boolean; auth?: boolean }[] = [
  { href: "/", label: "Overview" },
  { href: "/parts", label: "Catalog" },
  { href: "/me", label: "My Account", auth: true },
  { href: "/admin", label: "Admin", admin: true },
  { href: "/status", label: "System" },
];

export function Header() {
  const { user, status, signOut } = useAuth();
  const pathname = usePathname();
  const { toast } = useToast();

  const isAdmin = user?.role === "admin";

  function handleSignOut() {
    signOut();
    toast({
      title: "Signed out",
      description: "Local session cleared.",
      variant: "info",
    });
  }

  const visibleNav = NAV.filter((item) => {
    if (item.admin && !isAdmin) return false;
    if (item.auth && status !== "authenticated") return false;
    return true;
  });

  return (
    <header className="sticky top-0 z-40 border-b border-primary/10 bg-card/80 shadow-sm shadow-primary/5 backdrop-blur-md">
      <div className="container flex min-h-14 min-w-0 flex-wrap items-center gap-x-4 gap-y-2 py-2 sm:flex-nowrap sm:py-0">
        <Link
          href="/"
          className="flex min-w-0 max-w-[calc(100%-4rem)] shrink-0 items-center gap-2.5 text-sm font-semibold sm:max-w-none"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-emerald-700 text-primary-foreground shadow-md shadow-primary/30">
            <CarFront className="h-5 w-5" aria-hidden strokeWidth={2} />
          </span>
          <span className="min-w-0 truncate font-bold tracking-tight text-primary sm:whitespace-normal">
            <span className="hidden sm:inline">BuyAnyAutoPart</span>
            <span className="sm:hidden">BAP</span>
          </span>
          <Badge
            variant="secondary"
            className="hidden shrink-0 text-[10px] font-normal sm:inline-flex"
          >
            demo
          </Badge>
        </Link>

        <nav className="order-3 flex w-full min-w-0 flex-1 basis-full items-center gap-0.5 overflow-x-auto py-1 sm:order-0 sm:w-auto sm:basis-auto sm:py-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleNav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm transition-all",
                  active
                    ? "bg-primary/12 font-semibold text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-primary/[0.07] hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
          {status === "authenticated" && user ? (
            <>
              <div className="hidden min-w-0 max-w-[140px] flex-col items-end leading-tight md:flex lg:max-w-[200px]">
                <span className="truncate text-xs font-medium">
                  {user.name ?? user.email}
                </span>
                <span className="max-w-full truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                  {user.role ?? "user"}
                </span>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/85 text-xs font-bold text-primary-foreground shadow-sm">
                {(user.name?.[0] ?? user.email[0] ?? "U").toUpperCase()}
              </span>
              <Button size="sm" variant="outline" className="rounded-full border-primary/25" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : status === "unauthenticated" ? (
            <>
              <Link
                href="/sign-in"
                className={buttonVariants({ size: "sm", variant: "ghost", className: "rounded-full" })}
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className={buttonVariants({ size: "sm", className: "shadow-sm shadow-primary/25" })}
              >
                Sign up
              </Link>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Session…</span>
          )}
        </div>
      </div>
    </header>
  );
}
