"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  isStoredSupabaseSessionValid,
  readStoredSupabaseSession,
  readStoredSupabaseUser
} from "@/lib/auth/supabase-auth";

type AuthState = "checking" | "signed-out" | "signed-in" | "expired";

export function AuthSessionIndicator() {
  const [state, setState] = useState<AuthState>("checking");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const session = readStoredSupabaseSession(window.localStorage);
    const user = readStoredSupabaseUser(window.localStorage);
    setEmail(user?.email ?? null);

    if (!session) {
      setState("signed-out");
      return;
    }

    setState(isStoredSupabaseSessionValid(window.localStorage) ? "signed-in" : "expired");
  }, []);

  const label = state === "signed-in" ? "已登入" : state === "expired" ? "Session 過期" : "登入";
  const description =
    state === "signed-in" ? email ?? "Supabase session 有效" : state === "expired" ? "請重新登入" : "Email magic link";

  return (
    <Link className={`nav-item auth-nav auth-nav-${state}`} href="/login">
      <span>{label}</span>
      <small>{description}</small>
    </Link>
  );
}
