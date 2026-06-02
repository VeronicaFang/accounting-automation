"use client";

import { useEffect } from "react";
import { hasSupabaseHashSession } from "@/lib/auth/supabase-auth";

export function AuthHashRedirect() {
  useEffect(() => {
    const hash = window.location.hash;

    if (!hasSupabaseHashSession(hash) || window.location.pathname === "/auth/callback") {
      return;
    }

    window.location.replace(`/auth/callback${hash}`);
  }, []);

  return null;
}
