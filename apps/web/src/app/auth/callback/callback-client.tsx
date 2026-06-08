"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getSessionExpiryDate, parseSupabaseHashSession, supabaseSessionStorageKey } from "@/lib/auth/supabase-auth";

type CallbackState =
  | { status: "checking"; message: string }
  | { status: "ready"; message: string }
  | { status: "error"; message: string };

export function CallbackClient() {
  const [state, setState] = useState<CallbackState>({
    status: "checking",
    message: "正在確認登入狀態..."
  });

  useEffect(() => {
    const session = parseSupabaseHashSession(window.location.hash);

    if (!session) {
      setState({
        status: "error",
        message: "沒有取得有效的 Supabase session，請重新寄送 magic link。"
      });
      return;
    }

    window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify(session));
    window.history.replaceState(null, "", "/auth/callback");

    const expiryDate = getSessionExpiryDate(session);
    setState({
      status: "ready",
      message: expiryDate
        ? `登入完成，session 有效至 ${expiryDate.toLocaleString("zh-TW")}`
        : "登入完成，session 已儲存在此瀏覽器。"
    });
  }, []);

  return (
    <section className="surface section-block">
      <p className={`auth-message auth-${state.status === "error" ? "error" : "sent"}`}>{state.message}</p>
      <Link className="text-link" href="/">
        回首頁
      </Link>
    </section>
  );
}
