"use client";

import * as React from "react";
import { API_BASE, getMe, signIn, signUp } from "./api";
import type { User } from "./types";

const STORAGE_KEY = "internship-demo:auth";

type AuthState = {
  token: string | null;
  user: User | null;
  status: "loading" | "authenticated" | "unauthenticated";
};

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

function readStored(): { token: string; user: User | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; user?: User | null };
    if (!parsed.token) return null;
    return { token: parsed.token, user: parsed.user ?? null };
  } catch {
    return null;
  }
}

function writeStored(value: { token: string; user: User | null } | null) {
  if (typeof window === "undefined") return;
  if (!value) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    token: null,
    user: null,
    status: "loading",
  });

  const applyToken = React.useCallback(async (token: string) => {
    const result = await getMe(token);
    if (result.ok) {
      setState({ token, user: result.data, status: "authenticated" });
      writeStored({ token, user: result.data });
      return { ok: true } as const;
    }
    setState({ token: null, user: null, status: "unauthenticated" });
    writeStored(null);
    if (result.error === "network_error" || result.status === 0) {
      return {
        ok: false,
        message: `Cannot reach the API at ${API_BASE} (needed to verify your token with GET /me). Open another terminal in the repo root and run: bun run api:dev`,
      } as const;
    }
    return { ok: false, message: result.message } as const;
  }, []);

  React.useEffect(() => {
    const stored = readStored();
    if (!stored) {
      setState({ token: null, user: null, status: "unauthenticated" });
      return;
    }
    void applyToken(stored.token);
  }, [applyToken]);

  const handleSignIn = React.useCallback<AuthContextValue["signIn"]>(
    async (email, password) => {
      const result = await signIn(email, password);
      if (!result.ok) return { ok: false, message: result.message };
      const verified = await applyToken(result.data.token);
      if (!verified.ok) {
        return {
          ok: false,
          message:
            verified.message ?? "Token rejected by API. Check CORS / restart backend.",
        };
      }
      return { ok: true };
    },
    [applyToken],
  );

  const handleSignUp = React.useCallback<AuthContextValue["signUp"]>(
    async (name, email, password) => {
      const result = await signUp(name, email, password);
      if (!result.ok) return { ok: false, message: result.message };
      const verified = await applyToken(result.data.token);
      if (!verified.ok) {
        return { ok: false, message: verified.message ?? "Token verification failed." };
      }
      return { ok: true };
    },
    [applyToken],
  );

  const handleSignOut = React.useCallback(() => {
    setState({ token: null, user: null, status: "unauthenticated" });
    writeStored(null);
  }, []);

  const refresh = React.useCallback(async () => {
    if (!state.token) return;
    const result = await getMe(state.token);
    if (result.ok) {
      setState((prev) => ({ ...prev, user: result.data, status: "authenticated" }));
      writeStored({ token: state.token, user: result.data });
    } else if (result.status === 401) {
      handleSignOut();
    }
  }, [state.token, handleSignOut]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn: handleSignIn,
      signUp: handleSignUp,
      signOut: handleSignOut,
      refresh,
    }),
    [state, handleSignIn, handleSignUp, handleSignOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
