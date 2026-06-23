"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BillEstimateTable } from "@/components/bill-estimate-table";
import type { BillStatementEditProps } from "@/components/bill-estimate-table";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statementEdits, setStatementEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const loadBills = useCallback((accessToken: string) => {
    setState("loading");
    setError(null);

    getSupabaseBillEstimates(accessToken)
      .then((rows) => {
        setBills(rows);
        setState("ready");
      })
      .catch((caughtError) => {
        setBills([]);
        setError(caughtError instanceof Error ? caughtError.message : "Supabase 讀取失敗");
        setState("error");
      });
  }, []);

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

    tokenRef.current = session.accessToken;
    loadBills(session.accessToken);
  }, [loadBills]);

  const handleEditStart: BillStatementEditProps["onEditStart"] = (billId, currentAmount) => {
    setEditingId(billId);
    setStatementEdits((prev) => ({
      ...prev,
      [billId]: currentAmount !== undefined ? String(currentAmount) : ""
    }));
    setSaveMessage(null);
  };

  const handleAmountChange: BillStatementEditProps["onAmountChange"] = (billId, value) => {
    setStatementEdits((prev) => ({ ...prev, [billId]: value }));
  };

  const handleCancel = () => {
    setEditingId(null);
    setSaveMessage(null);
  };

  const handleSave: BillStatementEditProps["onSave"] = async (bill) => {
    const raw = statementEdits[bill.id] ?? "";
    const amount = Number(raw);

    if (!Number.isFinite(amount) || amount < 0) {
      setSaveMessage("請輸入有效的金額（≥ 0）");
      return;
    }

    setBusy(true);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/accounting/expense-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateBillStatement",
          creditCardId: bill.creditCardId,
          billMonth: bill.month,
          paymentDueDate: bill.paymentDate,
          actualAmount: amount
        })
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      setEditingId(null);
      setSaveMessage("帳單金額已儲存");

      if (tokenRef.current) {
        loadBills(tokenRef.current);
      }
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setBusy(false);
    }
  };

  const statementEdit: BillStatementEditProps = {
    editingId,
    statementEdits,
    busy,
    onEditStart: handleEditStart,
    onAmountChange: handleAmountChange,
    onSave: handleSave,
    onCancel: handleCancel
  };

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
      {saveMessage ? <p className="save-message">{saveMessage}</p> : null}
      <div className="grid-two">
        <div>
          <BillEstimateTable bills={futureBills} title="本月以後帳單" statementEdit={statementEdit} />
          <BillEstimateTable bills={historicalBills} title="歷史帳單" statementEdit={statementEdit} />
        </div>
        <DetailDrawer title="帳單預估邏輯">
          <p className="muted">
            點擊信用卡名稱可查看該月份、該信用卡連結到的消費明細，用來對照是否有消費漏記或帳單差異。
          </p>
          <p className="muted">點擊「輸入」可填入信用卡寄來的真實帳單金額，系統會用真實金額取代預估金額計算現金流。</p>
        </DetailDrawer>
      </div>
    </>
  );
}
