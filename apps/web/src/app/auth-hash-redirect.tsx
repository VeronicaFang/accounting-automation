"use client";

import { useEffect } from "react";
import { hasSupabaseHashSession, parseSupabaseHashError } from "@/lib/auth/supabase-auth";

export function AuthHashRedirect() {
  useEffect(() => {
    const hash = window.location.hash;

    if (hasSupabaseHashSession(hash) && window.location.pathname !== "/auth/callback") {
      window.location.replace(`/auth/callback${hash}`);
      return;
    }

    const authError = parseSupabaseHashError(hash);

    if (authError && window.location.pathname !== "/login") {
      const params = new URLSearchParams();
      params.set("auth_error", authError.errorCode ?? authError.error);

      if (authError.errorDescription) {
        params.set("auth_error_description", authError.errorDescription);
      }

      window.location.replace(`/login?${params.toString()}`);
    }
  }, []);

  return null;
}
