"use client";

import { useActionState, useEffect, useState } from "react";

import {
  clearStoredSupabaseSession,
  getSessionExpiryDate,
  isStoredSupabaseSessionValid,
  parseSupabaseHashError,
  readStoredSupabaseSession
} from "@/lib/auth/supabase-auth";

import { sendMagicLink, type LoginActionState } from "./actions";

const initialState: LoginActionState = {
  status: "idle",
  message: ""
};

type SessionState =
  | { status: "checking" }
  | { status: "signed-out" }
  | { status: "expired"; expiryLabel: string | null }
  | { status: "signed-in"; expiryLabel: string | null };

type AuthLinkError = {
  code: string;
  message: string;
};

function formatExpiry(date: Date | null): string | null {
  return date ? date.toLocaleString("zh-TW") : null;
}

function readSessionState(): SessionState {
  const session = readStoredSupabaseSession(window.localStorage);

  if (!session) {
    return { status: "signed-out" };
  }

  const expiryDate = getSessionExpiryDate(session);
  const expiryLabel = formatExpiry(expiryDate);

  if (!isStoredSupabaseSessionValid(window.localStorage)) {
    return { status: "expired", expiryLabel };
  }

  return { status: "signed-in", expiryLabel };
}

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(sendMagicLink, initialState);
  const [sessionState, setSessionState] = useState<SessionState>({ status: "checking" });
  const [authLinkError, setAuthLinkError] = useState<AuthLinkError | null>(null);

  useEffect(() => {
    const hashError = parseSupabaseHashError(window.location.hash);
    const params = new URLSearchParams(window.location.search);
    const queryErrorCode = params.get("auth_error");

    if (hashError || queryErrorCode) {
      const code = hashError?.errorCode ?? queryErrorCode ?? "auth_error";
      const description = hashError?.errorDescription ?? params.get("auth_error_description");

      clearStoredSupabaseSession(window.localStorage);
      setAuthLinkError({
        code,
        message:
          code === "otp_expired"
            ? "這封 Supabase 登入信已失效或已使用過，請重新寄送 magic link。"
            : description ?? "Supabase 登入連結無效，請重新寄送 magic link。"
      });
      window.history.replaceState(null, "", "/login");
      setSessionState({ status: "signed-out" });
      return;
    }

    setSessionState(readSessionState());
  }, []);

  function signOut() {
    clearStoredSupabaseSession(window.localStorage);
    setSessionState({ status: "signed-out" });
  }

  if (sessionState.status === "checking") {
    return <p className="muted">正在確認 Supabase session...</p>;
  }

  if (sessionState.status === "signed-in") {
    return (
      <div className="auth-status-card">
        <p className="auth-message auth-sent">已登入 Supabase。</p>
        {sessionState.expiryLabel ? <p className="muted">Session 有效至：{sessionState.expiryLabel}</p> : null}
        <button className="secondary-action" onClick={signOut} type="button">
          登出
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="auth-form">
      {authLinkError ? <p className="auth-message auth-error">{authLinkError.message}</p> : null}
      {sessionState.status === "expired" ? (
        <p className="auth-message auth-error">
          Supabase session 已過期{sessionState.expiryLabel ? `（${sessionState.expiryLabel}）` : ""}，請重新登入。
        </p>
      ) : null}
      <label htmlFor="email">Email</label>
      <div className="auth-row">
        <input id="email" name="email" placeholder="you@example.com" type="email" required />
        <button disabled={isPending} type="submit">
          {isPending ? "寄送中..." : "寄送登入連結"}
        </button>
      </div>
      {state.message ? <p className={`auth-message auth-${state.status}`}>{state.message}</p> : null}
    </form>
  );
}
