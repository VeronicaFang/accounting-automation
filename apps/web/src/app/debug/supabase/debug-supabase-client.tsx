"use client";

import { useEffect, useState } from "react";

import {
  getSupabaseAuthConfig,
  readStoredSupabaseSession,
  readStoredSupabaseUser,
  type SupabaseSessionUser
} from "@/lib/auth/supabase-auth";
import {
  createSupabaseRestHeaders,
  getSupabaseRestConfig,
  getSupabaseRestDiagnostics,
  type SupabaseRestDiagnostics
} from "@/lib/data/supabase-rest";

type DebugState = {
  parsedUser: SupabaseSessionUser | null;
  authConfigPresent: boolean;
  restDiagnostics: SupabaseRestDiagnostics;
  authUser: unknown;
  householdsStatus: number | null;
  householdsBody: unknown;
  membersStatus: number | null;
  membersBody: unknown;
  error: string | null;
};

function emptyState(): DebugState {
  return {
    parsedUser: null,
    authConfigPresent: false,
    restDiagnostics: {
      useSupabase: null,
      hasSupabaseUrl: false,
      hasPublishableKey: false,
      isConfigured: false
    },
    authUser: null,
    householdsStatus: null,
    householdsBody: null,
    membersStatus: null,
    membersBody: null,
    error: null
  };
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function DebugSupabaseClient() {
  const [state, setState] = useState<DebugState>(() => emptyState());

  useEffect(() => {
    const session = readStoredSupabaseSession(window.localStorage);
    const parsedUser = readStoredSupabaseUser(window.localStorage);
    const authConfig = getSupabaseAuthConfig();
    const restConfig = getSupabaseRestConfig();
    const restDiagnostics = getSupabaseRestDiagnostics();

    if (!session || !authConfig || !restConfig) {
      setState({
        ...emptyState(),
        parsedUser,
        authConfigPresent: Boolean(authConfig),
        restDiagnostics,
        error: "缺少 session 或 Supabase 設定"
      });
      return;
    }

    let isCurrent = true;

    Promise.all([
      fetch(`${authConfig.authUrl}/user`, {
        cache: "no-store",
        headers: createSupabaseRestHeaders(restConfig, session.accessToken)
      }),
      fetch(`${restConfig.restUrl}/households?select=id,name,created_at&order=created_at.asc`, {
        cache: "no-store",
        headers: createSupabaseRestHeaders(restConfig, session.accessToken)
      }),
      fetch(`${restConfig.restUrl}/household_members?select=household_id,user_id,role,display_name`, {
        cache: "no-store",
        headers: createSupabaseRestHeaders(restConfig, session.accessToken)
      })
    ])
      .then(async ([authResponse, householdsResponse, membersResponse]) => {
        const [authUser, householdsBody, membersBody] = await Promise.all([
          readJsonResponse(authResponse),
          readJsonResponse(householdsResponse),
          readJsonResponse(membersResponse)
        ]);

        if (!isCurrent) {
          return;
        }

        setState({
          parsedUser,
          authConfigPresent: true,
          restDiagnostics,
          authUser,
          householdsStatus: householdsResponse.status,
          householdsBody,
          membersStatus: membersResponse.status,
          membersBody,
          error: null
        });
      })
      .catch((caughtError) => {
        if (!isCurrent) {
          return;
        }

        setState({
          ...emptyState(),
          parsedUser,
          authConfigPresent: Boolean(authConfig),
          restDiagnostics,
          error: caughtError instanceof Error ? caughtError.message : "Supabase debug failed"
        });
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <section className="surface section-block">
      <div className="section-heading">
        <h2>Supabase Session Debug</h2>
        <span>本機診斷</span>
      </div>
      {state.error ? <p className="error-text">{state.error}</p> : null}
      <pre className="debug-pre">{JSON.stringify(state, null, 2)}</pre>
    </section>
  );
}
