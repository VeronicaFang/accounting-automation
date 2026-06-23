"use client";

import { useEffect, useState } from "react";

import { BillEstimateTable } from "@/components/bill-estimate-table";
import { filterFutureBills, filterHistoricalBills, monthKeyFromDateValue } from "@/lib/accounting/dashboard-filters";
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

  const currentMonth = monthKeyFromDateValue();
  const futureBills = filterFutureBills(bills, currentMonth);
  const historicalBills = filterHistoricalBills(bills, currentMonth).slice().reverse();

  return (
    <>
      <PageHeader
        eyebrow="帳單中心"
        title="每月信用卡帳單預估"
        description="本月以後的帳單用來檢查接下來的付款；過往月份保留在歷史帳單中查核。"
      />
      <div className={`data-source-pill data-source-${state}`}>{getStateText(state, bills.length)}</div>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="grid-two">
        <div>
          <BillEstimateTable bills={futureBills} title="本月以後帳單" />
          <BillEstimateTable bills={historicalBills} title="歷史帳單" />
        </div>
        <DetailDrawer title="帳單預估邏輯">
          <p className="muted">
            點擊信用卡名稱可查看該月份、該信用卡連結到的消費明細，用來對照是否有消費漏記或帳單差異。
          </p>
        </DetailDrawer>
      </div>
    </>
  );
}
