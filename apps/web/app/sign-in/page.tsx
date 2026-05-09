"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthPageShell, AuthFootLink } from "@/components/auth-page-shell";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";

const SEED_OPTIONS = [
  {
    label: "Seeded admin",
    email: "admin@buyanyautopart.com",
    password: "Admin1234!",
  },
  {
    label: "Seeded user",
    email: "user@buyanyautopart.com",
    password: "User1234!",
  },
];

export default function SignInPage() {
  const router = useRouter();
  const { signIn, status } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = React.useState("admin@buyanyautopart.com");
  const [password, setPassword] = React.useState("Admin1234!");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (status === "authenticated") router.replace("/me");
  }, [status, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await signIn(email, password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.message ?? "Sign in failed");
      toast({
        title: "Sign in failed",
        description: res.message ?? "",
        variant: "error",
      });
      return;
    }
    toast({
      title: "Welcome back",
      description: "Session verified with the API.",
      variant: "success",
    });
    router.replace("/me");
  }

  return (
    <AuthPageShell
      title="Welcome back"
      subtitle={
        <>
          Sign in with email and password. The UI calls{" "}
          <code className="rounded-md bg-muted/90 px-1.5 py-0.5 text-xs font-mono">
            POST /api/auth/sign-in/email
          </code>{" "}
          on the auth server, then confirms your token with{" "}
          <code className="rounded-md bg-muted/90 px-1.5 py-0.5 text-xs font-mono">GET /me</code>.
        </>
      }
      footnote={<AuthFootLink prompt="No account yet?" href="/sign-up" label="Create one" />}
    >
      <Card className="border-border/80 bg-card/95 shadow-lg shadow-primary/5 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>Use your seeded or new account credentials.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg"
                required
              />
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Couldn’t sign in</AlertTitle>
                <AlertDescription className="mt-1 text-destructive/95 [overflow-wrap:anywhere]">
                  {error}
                </AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? "Verifying…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 space-y-3 border-t border-border/60 pt-6">
            <p className="text-xs font-medium text-muted-foreground">
              Quick fill from seed users
            </p>
            <div className="flex flex-wrap gap-2">
              {SEED_OPTIONS.map((opt) => (
                <Button
                  key={opt.email}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-lg border-dashed"
                  onClick={() => {
                    setEmail(opt.email);
                    setPassword(opt.password);
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
