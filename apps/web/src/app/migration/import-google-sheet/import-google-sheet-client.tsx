"use client";

import { useState } from "react";

import { readStoredSupabaseSession } from "@/lib/auth/supabase-auth";

type ImportStats = {
  inserted: number;
  skippedExisting: number;
  skippedMissingReference: number;
};

type ImportResult = {
  householdId: string;
  expenses: ImportStats;
  paymentSchedules: ImportStats;
  incomeSchedules: ImportStats;
};

function StatRow({ label, stats }: { label: string; stats: ImportStats }) {
  return (
    <tr>
      <th>{label}</th>
      <td>{stats.inserted.toLocaleString("zh-TW")}</td>
      <td>{stats.skippedExisting.toLocaleString("zh-TW")}</td>
      <td>{stats.skippedMissingReference.toLocaleString("zh-TW")}</td>
    </tr>
  );
}

export function ImportGoogleSheetClient() {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runImport() {
    const session = readStoredSupabaseSession(window.localStorage);

    if (!session) {
      setError("請先完成 Supabase 登入，再回到此頁執行匯入。");
      return;
    }

    setIsImporting(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/migration/import-google-sheet", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      const payload = (await response.json()) as ImportResult | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "匯入失敗");
      }

      setResult(payload as ImportResult);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "匯入失敗");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="panel">
      <p className="eyebrow">Migration Tool</p>
      <h1>匯入 Google Sheet 交易資料</h1>
      <p className="section-intro">
        使用目前登入的 Supabase session，將本機已清理的匯入包寫入指定 household。
      </p>
      <div className="stack">
        <button className="primary-action" disabled={isImporting} onClick={runImport} type="button">
          {isImporting ? "匯入中..." : "開始匯入"}
        </button>
        <p className="muted">會匯入缺少的消費、付款排程與收入排程；已存在的 legacy_id 會略過。</p>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {result ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>資料表</th>
                <th>新增</th>
                <th>已存在</th>
                <th>缺參照略過</th>
              </tr>
            </thead>
            <tbody>
              <StatRow label="IncomeSchedule" stats={result.incomeSchedules} />
              <StatRow label="ExpenseRecords" stats={result.expenses} />
              <StatRow label="PaymentSchedule" stats={result.paymentSchedules} />
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
