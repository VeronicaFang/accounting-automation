"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { TaskWorkbench } from "@/components/task-workbench";
import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";
import { getSupabaseReviewTasks } from "@/lib/data/supabase-repository";
import type { ReviewTask } from "@/lib/types";

type LoadState = "signed-out" | "expired" | "loading" | "ready" | "error";

export function ReviewClient() {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
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

    getSupabaseReviewTasks(session.accessToken)
      .then((rows) => {
        if (!isCurrent) {
          return;
        }

        setTasks(rows);
        setState("ready");
      })
      .catch((caughtError) => {
        if (!isCurrent) {
          return;
        }

        setError(caughtError instanceof Error ? caughtError.message : "讀取待處理項目失敗");
        setState("error");
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="待處理"
        title="待確認與對帳事項"
        description="顯示 Supabase 中仍需要人工確認的匯入資料、預算 mapping 或帳單差異。"
      />
      <div className={`data-source-pill data-source-${state}`}>
        {state === "ready"
          ? "已連線 Supabase"
          : state === "loading"
            ? "讀取 Supabase 中"
            : state === "expired"
              ? "Session 已過期，請重新登入"
              : "請先登入 Supabase"}
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {tasks.length === 0 && state === "ready" ? (
        <section className="surface section-block">
          <div className="empty-state">
            <strong>目前沒有待處理項目</strong>
            <p className="muted">Supabase 中沒有待確認發票或預算 mapping draft。</p>
          </div>
        </section>
      ) : (
        <TaskWorkbench tasks={tasks} />
      )}
    </>
  );
}
