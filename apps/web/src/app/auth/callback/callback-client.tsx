"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parseSupabaseHashSession } from "@/lib/auth/supabase-auth";

type CallbackState =
  | { status: "checking"; message: string }
  | { status: "ready"; message: string }
  | { status: "error"; message: string };

const sessionStorageKey = "accounting.supabase.session";

export function CallbackClient() {
  const [state, setState] = useState<CallbackState>({
    status: "checking",
    message: "正在確認登入狀態。"
  });

  useEffect(() => {
    const session = parseSupabaseHashSession(window.location.hash);

    if (!session) {
      setState({
        status: "error",
        message: "沒有取得登入 session。請重新寄送登入連結。"
      });
      return;
    }

    window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
    window.history.replaceState(null, "", "/auth/callback");

    setState({
      status: "ready",
      message: "登入完成。你的 Supabase 使用者與 household membership 已建立。"
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
