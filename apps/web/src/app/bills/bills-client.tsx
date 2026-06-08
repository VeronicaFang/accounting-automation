"use client";

import { useEffect, useState } from "react";

import { BillEstimateTable } from "@/components/bill-estimate-table";
import { DetailDrawer } from "@/components/detail-drawer";
import { PageHeader } from "@/components/page-header";
import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";
import { getSupabaseBillEstimates } from "@/lib/data/supabase-repository";
import type { BillEstimate } from "@/lib/types";

type LoadState = "signed-out" | "expired" | "loading" | "ready" | "error";

function getStateText(state: LoadState, count: number): string {
  if (state === "ready") {
    return `已連線 Supabase，顯示 ${count} 筆帳單預估`;
  }

  if (state === "loading") {
    return "正在讀取 Supabase";
  }

  if (state === "expired") {
    return "Session 已過期，請重新登入";
  }

  if (state === "error") {
    return "Supabase 讀取失敗";
  }

  return "請先登入 Supabase";
}

export function BillsClient() {
  const [bills, setBills] = useState<BillEstimate[]>([]);
  const [state, setState] = useState<LoadState>("signed-out");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = readStoredSupabaseSession(window.localStorage);

    if (!session) {
      setState("signed-out");
      return;
    }

    if (!isStoredSupabaseSessionValid(window.localStorage)) {
      setState("expired");
      return;
    }

    let isCurrent = true;
    setState("loading");
    setError(null);

    getSupabaseBillEstimates(session.accessToken)
      .then((rows) => {
        if (!isCurrent) {
          return;
        }

        setBills(rows);
        setState("ready");
      })
      .catch((caughtError) => {
        if (!isCurrent) {
          return;
        }

        setBills([]);
        setError(caughtError instanceof Error ? caughtError.message : "Supabase 讀取失敗");
        setState("error");
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="帳單中心"
        title="每月信用卡帳單預估"
        description="資料源是付款排程；只有帳單金額怪怪的時候，再進付款排程檢視與修正。"
      />
      <div className={`data-source-pill data-source-${state}`}>{getStateText(state, bills.length)}</div>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="grid-two">
        <BillEstimateTable bills={bills} />
        <DetailDrawer title="帳單預估邏輯">
          <p className="muted">
            每月帳單預估由已記錄的信用卡付款排程彙總而來。真實信用卡帳單建立後，這裡會同時顯示預估金額與真實帳單差異。
          </p>
        </DetailDrawer>
      </div>
    </>
  );
}
