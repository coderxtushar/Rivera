"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import type { Role, User } from "./types";

interface AuthState {
  user: User | null;
  /** True until the first /auth/me answer arrives. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (input: { email: string; password: string; firstName: string; lastName?: string }) => Promise<User>;
  signOut: () => Promise<void>;
  /** Re-read the current user (after profile/role changes). */
  refresh: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export const ME_KEY = ["auth", "me"] as const;

async function fetchMe(): Promise<User | null> {
  try {
    const res = await api<{ data: { user: User } }>("/auth/me");
    return res.data.user;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return null;
    throw err;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 5 * 60_000, retry: 1 });
  const user = data ?? null;

  const setUser = useCallback((u: User | null) => qc.setQueryData(ME_KEY, u), [qc]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ data: { user: User } }>("/auth/signin", { method: "POST", body: { email, password }, noRefresh: true });
      setUser(res.data.user);
      return res.data.user;
    },
    [setUser],
  );

  const signUp = useCallback<AuthState["signUp"]>(
    async (input) => {
      const res = await api<{ data: { user: User } }>("/auth/signup", { method: "POST", body: input, noRefresh: true });
      setUser(res.data.user);
      return res.data.user;
    },
    [setUser],
  );

  const signOut = useCallback(async () => {
    await api("/auth/signout", { method: "POST", noRefresh: true }).catch(() => undefined);
    setUser(null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" && q.queryKey[0] !== "public" });
  }, [qc, setUser]);

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ME_KEY });
  }, [qc]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading: isPending,
      signIn,
      signUp,
      signOut,
      refresh,
      hasRole: (...roles) => Boolean(user && roles.includes(user.role)),
    }),
    [user, isPending, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
