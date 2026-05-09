"use client";

import * as React from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";

interface RoleGateProps {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  children: React.ReactNode;
}

export function RoleGate({
  requireAuth = true,
  requireAdmin = false,
  children,
}: RoleGateProps) {
  const { status, user } = useAuth();

  if (status === "loading") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (requireAuth && status !== "authenticated") {
    return (
      <Alert variant="info" className="animate-fade-in">
        <AlertTitle>Sign in required</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>You need to be signed in to view this page.</span>
          <div className="flex gap-2">
            <Link
              href="/sign-in"
              className={buttonVariants({ size: "sm", variant: "ghost" })}
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className={buttonVariants({ size: "sm" })}
            >
              Create account
            </Link>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (requireAdmin && user?.role !== "admin") {
    return (
      <Alert variant="warning">
        <AlertTitle>Admin only</AlertTitle>
        <AlertDescription>
          The signed-in user does not have the <code>admin</code> role. The
          backend will return <strong>403 forbidden</strong> for this route.
          Sign in with the seeded admin account to demo this section.
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}
