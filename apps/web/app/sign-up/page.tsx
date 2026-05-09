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

export default function SignUpPage() {
  const router = useRouter();
  const { signUp, status } = useAuth();
  const { toast } = useToast();
  const [name, setName] = React.useState("Demo User");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (status === "authenticated") router.replace("/me");
  }, [status, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await signUp(name, email, password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.message ?? "Sign up failed");
      toast({
        title: "Sign up failed",
        description: res.message ?? "",
        variant: "error",
      });
      return;
    }
    toast({
      title: "You’re in",
      description: "Account created and token verified.",
      variant: "success",
    });
    router.replace("/me");
  }

  return (
    <AuthPageShell
      title="Create your account"
      subtitle={
        <>
          Registers via{" "}
          <code className="rounded-md bg-muted/90 px-1.5 py-0.5 text-xs font-mono">
            POST /api/auth/sign-up/email
          </code>
          . The bearer token arrives in the{" "}
          <code className="rounded-md bg-muted/90 px-1.5 py-0.5 text-xs font-mono">
            set-auth-token
          </code>{" "}
          header — we store it locally and validate with the API.
        </>
      }
      footnote={<AuthFootLink prompt="Already registered?" href="/sign-in" label="Sign in" />}
    >
      <Card className="border-border/80 bg-card/95 shadow-lg shadow-primary/5 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl">Sign up</CardTitle>
          <CardDescription>Pick a strong password (min. 8 characters).</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-lg"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                className="rounded-lg"
                required
              />
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Couldn’t create account</AlertTitle>
                <AlertDescription className="mt-1 text-destructive/95 [overflow-wrap:anywhere]">
                  {error}
                </AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? "Creating…" : "Create account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
