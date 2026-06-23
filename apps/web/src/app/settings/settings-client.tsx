"use client";

import { useEffect, useState } from "react";

import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";

type CreditCard = {
  id: string;
  name: string;
  legacy_id: string | null;
  cutoff_day: number;
  payment_day: number;
  is_active: boolean;
};

type EditState = {
  name: string;
  cutoffDay: string;
  paymentDay: string;
  isActive: boolean;
};

type Message = { tone: "success" | "error" | "muted"; text: string };

function emptyEdit(card?: CreditCard): EditState {
  return {
    name: card?.name ?? "",
    cutoffDay: card ? String(card.cutoff_day) : "",
    paymentDay: card ? String(card.payment_day) : "",
    isActive: card?.is_active ?? true
  };
}

export function SettingsClient() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<EditState>(emptyEdit());
  const [isAdding, setIsAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>({ tone: "muted", text: "" });

  function getSession() {
    const session = readStoredSupabaseSession(window.localStorage);

    if (!session || !isStoredSupabaseSessionValid(window.localStorage)) {
      return null;
    }

    return session;
  }

  async function loadCards() {
    const session = getSession();

    if (!session) {
      setLoadState("error");
      setMessage({ tone: "error", text: "請先登入 Supabase。" });
      return;
    }

    setLoadState("loading");

    try {
      const response = await fetch("/api/settings/credit-cards", {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "讀取失敗。");
      }

      setCards(data as CreditCard[]);
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "讀取失敗。" });
    }
  }

  useEffect(() => {
    loadCards();
  }, []);

  async function saveCard(action: "create" | "update", id?: string) {
    const session = getSession();

    if (!session) {
      setMessage({ tone: "error", text: "Session 已過期，請重新登入。" });
      return;
    }

    const name = edits.name.trim();
    const cutoffDay = Number(edits.cutoffDay);
    const paymentDay = Number(edits.paymentDay);

    if (!name) {
      setMessage({ tone: "error", text: "請輸入信用卡名稱。" });
      return;
    }

    if (!Number.isInteger(cutoffDay) || cutoffDay < 1 || cutoffDay > 31) {
      setMessage({ tone: "error", text: "結帳日必須是 1–31 的整數。" });
      return;
    }

    if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
      setMessage({ tone: "error", text: "繳款日必須是 1–31 的整數。" });
      return;
    }

    setBusy(true);
    setMessage({ tone: "muted", text: "儲存中..." });

    try {
      const body =
        action === "create"
          ? { action: "create", name, cutoffDay, paymentDay }
          : { action: "update", id, name, cutoffDay, paymentDay, isActive: edits.isActive };

      const response = await fetch("/api/settings/credit-cards", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "儲存失敗。");
      }

      setMessage({ tone: "success", text: action === "create" ? "已新增信用卡。" : "信用卡規則已更新。" });
      setEditingId(null);
      setIsAdding(false);
      await loadCards();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "儲存失敗。" });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(card: CreditCard) {
    setEditingId(card.id);
    setEdits(emptyEdit(card));
    setIsAdding(false);
    setMessage({ tone: "muted", text: "" });
  }

  function startAdd() {
    setIsAdding(true);
    setEditingId(null);
    setEdits(emptyEdit());
    setMessage({ tone: "muted", text: "" });
  }

  function cancelEdit() {
    setEditingId(null);
    setIsAdding(false);
  }

  function updateEdit(field: keyof EditState, value: string | boolean) {
    setEdits((prev) => ({ ...prev, [field]: value }));
  }

  const editRow = (
    <tr>
      <td>
        <input
          className="expense-item-input"
          style={{ minWidth: 120 }}
          placeholder="卡片名稱"
          value={edits.name}
          disabled={busy}
          onChange={(e) => updateEdit("name", e.target.value)}
        />
      </td>
      <td>
        <input
          className="expense-amount-input"
          type="number"
          min={1}
          max={31}
          placeholder="1–31"
          value={edits.cutoffDay}
          disabled={busy}
          onChange={(e) => updateEdit("cutoffDay", e.target.value)}
        />
      </td>
      <td>
        <input
          className="expense-amount-input"
          type="number"
          min={1}
          max={31}
          placeholder="1–31"
          value={edits.paymentDay}
          disabled={busy}
          onChange={(e) => updateEdit("paymentDay", e.target.value)}
        />
      </td>
      {!isAdding ? (
        <td>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={edits.isActive}
              disabled={busy}
              onChange={(e) => updateEdit("isActive", e.target.checked)}
            />
            啟用
          </label>
        </td>
      ) : (
        <td />
      )}
      <td>
        <div className="row-actions">
          <button
            className="secondary-action"
            type="button"
            disabled={busy}
            onClick={() => (isAdding ? saveCard("create") : saveCard("update", editingId ?? undefined))}
          >
            {busy ? "儲存中…" : "儲存"}
          </button>
          <button className="secondary-action" type="button" disabled={busy} onClick={cancelEdit}>
            取消
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <section className="surface section-block">
      <div className="section-heading">
        <h2>信用卡結算規則</h2>
        <button className="secondary-action" type="button" onClick={startAdd} disabled={isAdding || busy}>
          新增信用卡
        </button>
      </div>

      {message.text ? <p className={`entry-message entry-message-${message.tone}`}>{message.text}</p> : null}

      {loadState === "loading" ? <p className="muted">讀取中…</p> : null}

      {loadState === "ready" || cards.length > 0 ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>信用卡名稱</th>
                <th>結帳日</th>
                <th>繳款日</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {isAdding ? editRow : null}
              {cards.map((card) =>
                editingId === card.id ? (
                  editRow
                ) : (
                  <tr key={card.id} style={{ opacity: card.is_active ? 1 : 0.5 }}>
                    <td>{card.name}</td>
                    <td>每月 {card.cutoff_day} 日</td>
                    <td>次月 {card.payment_day} 日</td>
                    <td>{card.is_active ? "啟用" : "停用"}</td>
                    <td>
                      <button className="secondary-action" type="button" onClick={() => startEdit(card)}>
                        編輯
                      </button>
                    </td>
                  </tr>
                )
              )}
              {cards.length === 0 && !isAdding ? (
                <tr>
                  <td colSpan={5}>尚未設定任何信用卡，請點擊「新增信用卡」。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="muted" style={{ marginTop: 10 }}>
        結帳日：每月消費截止日，超過此日的消費歸入下個帳單月。繳款日：次月繳款截止日。
      </p>
    </section>
  );
}
