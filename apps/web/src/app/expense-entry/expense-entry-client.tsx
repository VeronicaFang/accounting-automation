"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";
import { fetchSupabaseRows } from "@/lib/data/supabase-rest";

type ReferenceBudgetItem = {
  id: string;
  name: string;
  legacy_id: string | null;
  legacy_name: string | null;
};

type ReferenceCreditCard = {
  id: string;
  name: string;
  legacy_id: string | null;
};

type Message = {
  tone: "success" | "error" | "muted";
  text: string;
};

const defaultSingleExpense = {
  consumptionDate: "",
  itemDescription: "",
  amount: "",
  merchantName: "",
  budgetItemId: "",
  paymentToolType: "cash",
  creditCardId: "",
  installmentCount: "1",
  notes: ""
};

const defaultFixedExpense = {
  startMonth: "",
  dayOfMonth: "5",
  repeatCount: "12",
  itemDescription: "",
  amount: "",
  merchantName: "",
  budgetItemId: "",
  paymentToolType: "cash",
  creditCardId: "",
  notes: ""
};

function getBudgetItemLabel(item: ReferenceBudgetItem): string {
  return item.legacy_name ?? item.legacy_id ?? item.name;
}

function getCreditCardLabel(card: ReferenceCreditCard): string {
  return card.legacy_id ?? card.name;
}

async function readFileText(file: File): Promise<string> {
  return file.text();
}

export function ExpenseEntryClient() {
  const router = useRouter();
  const [budgetItems, setBudgetItems] = useState<ReferenceBudgetItem[]>([]);
  const [creditCards, setCreditCards] = useState<ReferenceCreditCard[]>([]);
  const [singleExpense, setSingleExpense] = useState(defaultSingleExpense);
  const [fixedExpense, setFixedExpense] = useState(defaultFixedExpense);
  const [manualBatchText, setManualBatchText] = useState("");
  const [invoiceText, setInvoiceText] = useState("");
  const [invoiceFileName, setInvoiceFileName] = useState("");
  const [message, setMessage] = useState<Message>({ tone: "muted", text: "請先登入 Supabase，再使用記帳功能。" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const session = readStoredSupabaseSession(window.localStorage);

    if (!session || !isStoredSupabaseSessionValid(window.localStorage)) {
      setMessage({ tone: "error", text: "目前沒有有效的 Supabase session，請先登入。" });
      return;
    }

    let isCurrent = true;

    Promise.all([
      fetchSupabaseRows<ReferenceBudgetItem>(
        "budget_items",
        {
          select: "id,name,legacy_id,legacy_name",
          is_active: "eq.true",
          order: "legacy_code.asc"
        },
        undefined,
        session.accessToken
      ),
      fetchSupabaseRows<ReferenceCreditCard>(
        "credit_cards",
        {
          select: "id,name,legacy_id",
          is_active: "eq.true",
          order: "name.asc"
        },
        undefined,
        session.accessToken
      )
    ])
      .then(([budgetItemRows, creditCardRows]) => {
        if (!isCurrent) {
          return;
        }

        setBudgetItems(budgetItemRows);
        setCreditCards(creditCardRows);
        setSingleExpense((current) => ({ ...current, budgetItemId: budgetItemRows[0]?.id ?? "" }));
        setFixedExpense((current) => ({ ...current, budgetItemId: budgetItemRows[0]?.id ?? "" }));
        setMessage({ tone: "success", text: "已連線 Supabase，可以開始記帳。" });
      })
      .catch((error) => {
        if (!isCurrent) {
          return;
        }

        setMessage({ tone: "error", text: error instanceof Error ? error.message : "讀取參考資料失敗。" });
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const canPickCreditCard = useMemo(() => creditCards.length > 0, [creditCards.length]);

  async function submitAccountingAction(action: string, payload: Record<string, unknown>) {
    const session = readStoredSupabaseSession(window.localStorage);

    if (!session || !isStoredSupabaseSessionValid(window.localStorage)) {
      setMessage({ tone: "error", text: "Supabase session 已失效，請重新登入。" });
      return null;
    }

    setIsSubmitting(true);
    setMessage({ tone: "muted", text: "正在寫入 Supabase..." });

    try {
      const response = await fetch("/api/accounting/expense-entry", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action, ...payload })
      });
      const result = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        throw new Error(typeof result.error === "string" ? result.error : "寫入失敗。");
      }

      return result;
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "寫入失敗。" });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveSingleExpense() {
    const result = await submitAccountingAction("singleExpense", singleExpense);

    if (!result) {
      return;
    }

    setMessage({
      tone: "success",
      text: `已新增 ${result.insertedExpenses ?? 0} 筆消費，建立 ${result.insertedPaymentSchedules ?? 0} 筆付款排程。`
    });
    setSingleExpense((current) => ({
      ...defaultSingleExpense,
      budgetItemId: current.budgetItemId,
      paymentToolType: current.paymentToolType,
      creditCardId: current.creditCardId
    }));
  }

  async function saveMonthlyFixedExpense() {
    const result = await submitAccountingAction("monthlyFixedExpense", fixedExpense);

    if (!result) {
      return;
    }

    setMessage({
      tone: "success",
      text: `已建立固定消費，新增 ${result.insertedExpenses ?? 0} 筆消費與 ${result.insertedPaymentSchedules ?? 0} 筆付款排程。`
    });
  }

  async function importManualBatch() {
    const result = await submitAccountingAction("batchManualExpenses", { text: manualBatchText });

    if (!result) {
      return;
    }

    setMessage({
      tone: "success",
      text: `已解析 ${result.parsedRows ?? 0} 筆，新增 ${result.insertedExpenses ?? 0} 筆消費。`
    });
    setManualBatchText("");
  }

  async function importInvoices() {
    const result = await submitAccountingAction("invoiceImport", { text: invoiceText, fileName: invoiceFileName });

    if (!result) {
      return;
    }

    setMessage({
      tone: "success",
      text: `已解析 ${result.parsedRows ?? 0} 筆發票，新增 ${result.insertedDrafts ?? 0} 筆待確認草稿，略過 ${result.skippedExisting ?? 0} 筆。`
    });
    setInvoiceText("");
    setInvoiceFileName("");
    router.push("/review");
  }

  return (
    <>
      <PageHeader
        eyebrow="記帳"
        title="新增與匯入"
        description="單筆、固定、批次與財政部發票匯入都會寫入目前登入帳號可讀取的 Supabase household。"
      />

      <div className={`entry-message entry-message-${message.tone}`}>{message.text}</div>

      <section className="surface section-block entry-section">
        <div className="section-heading">
          <h2>新增手動消費</h2>
          <span>直接入帳並自動建立付款排程</span>
        </div>
        <div className="entry-form-grid">
          <label>
            消費日
            <input
              type="date"
              value={singleExpense.consumptionDate}
              onChange={(event) => setSingleExpense({ ...singleExpense, consumptionDate: event.target.value })}
            />
          </label>
          <label>
            購買品項
            <input
              value={singleExpense.itemDescription}
              onChange={(event) => setSingleExpense({ ...singleExpense, itemDescription: event.target.value })}
            />
          </label>
          <label>
            消費金額
            <input
              min="0"
              step="1"
              type="number"
              value={singleExpense.amount}
              onChange={(event) => setSingleExpense({ ...singleExpense, amount: event.target.value })}
            />
          </label>
          <label>
            消費通路
            <input
              value={singleExpense.merchantName}
              onChange={(event) => setSingleExpense({ ...singleExpense, merchantName: event.target.value })}
            />
          </label>
          <BudgetItemSelect
            budgetItems={budgetItems}
            value={singleExpense.budgetItemId}
            onChange={(budgetItemId) => setSingleExpense({ ...singleExpense, budgetItemId })}
          />
          <PaymentControls
            creditCards={creditCards}
            disabled={!canPickCreditCard}
            paymentToolType={singleExpense.paymentToolType}
            creditCardId={singleExpense.creditCardId}
            onPaymentToolTypeChange={(paymentToolType) => setSingleExpense({ ...singleExpense, paymentToolType })}
            onCreditCardChange={(creditCardId) => setSingleExpense({ ...singleExpense, creditCardId })}
          />
          <label>
            分期期數
            <input
              min="1"
              step="1"
              type="number"
              value={singleExpense.installmentCount}
              onChange={(event) => setSingleExpense({ ...singleExpense, installmentCount: event.target.value })}
            />
          </label>
          <label>
            備註
            <input
              value={singleExpense.notes}
              onChange={(event) => setSingleExpense({ ...singleExpense, notes: event.target.value })}
            />
          </label>
        </div>
        <button className="primary-action" disabled={isSubmitting} onClick={saveSingleExpense} type="button">
          儲存消費
        </button>
      </section>

      <section className="surface section-block entry-section">
        <div className="section-heading">
          <h2>建立每月固定消費</h2>
          <span>建立排程，也同步產生每月消費與付款排程</span>
        </div>
        <div className="entry-form-grid">
          <label>
            開始月份
            <input
              type="month"
              value={fixedExpense.startMonth}
              onChange={(event) => setFixedExpense({ ...fixedExpense, startMonth: event.target.value })}
            />
          </label>
          <label>
            每月幾號
            <input
              min="1"
              max="31"
              type="number"
              value={fixedExpense.dayOfMonth}
              onChange={(event) => setFixedExpense({ ...fixedExpense, dayOfMonth: event.target.value })}
            />
          </label>
          <label>
            重複次數
            <input
              min="1"
              type="number"
              value={fixedExpense.repeatCount}
              onChange={(event) => setFixedExpense({ ...fixedExpense, repeatCount: event.target.value })}
            />
          </label>
          <label>
            固定支出項目
            <input
              placeholder="例：Netflix / 每月家用"
              value={fixedExpense.itemDescription}
              onChange={(event) => setFixedExpense({ ...fixedExpense, itemDescription: event.target.value })}
            />
          </label>
          <label>
            每月金額
            <input
              min="0"
              type="number"
              value={fixedExpense.amount}
              onChange={(event) => setFixedExpense({ ...fixedExpense, amount: event.target.value })}
            />
          </label>
          <label>
            消費通路
            <input
              placeholder="例：App Store / 家庭轉帳"
              value={fixedExpense.merchantName}
              onChange={(event) => setFixedExpense({ ...fixedExpense, merchantName: event.target.value })}
            />
          </label>
          <BudgetItemSelect
            budgetItems={budgetItems}
            value={fixedExpense.budgetItemId}
            onChange={(budgetItemId) => setFixedExpense({ ...fixedExpense, budgetItemId })}
          />
          <PaymentControls
            creditCards={creditCards}
            disabled={!canPickCreditCard}
            paymentToolType={fixedExpense.paymentToolType}
            creditCardId={fixedExpense.creditCardId}
            onPaymentToolTypeChange={(paymentToolType) => setFixedExpense({ ...fixedExpense, paymentToolType })}
            onCreditCardChange={(creditCardId) => setFixedExpense({ ...fixedExpense, creditCardId })}
          />
          <label>
            備註
            <input
              value={fixedExpense.notes}
              onChange={(event) => setFixedExpense({ ...fixedExpense, notes: event.target.value })}
            />
          </label>
        </div>
        <button className="primary-action" disabled={isSubmitting} onClick={saveMonthlyFixedExpense} type="button">
          建立固定消費
        </button>
      </section>

      <section className="surface section-block entry-section">
        <div className="section-heading">
          <h2>批次匯入手動消費</h2>
          <span>可貼上 CSV 或 Excel 複製的表格</span>
        </div>
        <input
          type="file"
          accept=".csv,.txt"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            setManualBatchText(await readFileText(file));
          }}
        />
        <textarea
          className="entry-textarea"
          placeholder="建議欄位：消費日,購買品項,消費金額,消費通路,預算項目,支付方式,信用卡,備註"
          value={manualBatchText}
          onChange={(event) => setManualBatchText(event.target.value)}
        />
        <button className="primary-action" disabled={isSubmitting} onClick={importManualBatch} type="button">
          批次匯入手動消費
        </button>
      </section>

      <section className="surface section-block entry-section">
        <div className="section-heading">
          <h2>財政部發票匯入</h2>
          <span>匯入後先進待確認，不直接正式入帳</span>
        </div>
        <input
          type="file"
          accept=".csv,.txt"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            setInvoiceFileName(file.name);
            setInvoiceText(await readFileText(file));
          }}
        />
        <textarea
          className="entry-textarea"
          placeholder="請貼上財政部發票明細，第一列需包含欄位名稱"
          value={invoiceText}
          onChange={(event) => setInvoiceText(event.target.value)}
        />
        <button className="primary-action" disabled={isSubmitting} onClick={importInvoices} type="button">
          匯入待確認清單
        </button>
      </section>
    </>
  );
}

function BudgetItemSelect({
  budgetItems,
  value,
  onChange
}: {
  budgetItems: ReferenceBudgetItem[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      預算項目
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {budgetItems.map((item) => (
          <option key={item.id} value={item.id}>
            {getBudgetItemLabel(item)}
          </option>
        ))}
      </select>
    </label>
  );
}

function PaymentControls({
  creditCards,
  disabled,
  paymentToolType,
  creditCardId,
  onPaymentToolTypeChange,
  onCreditCardChange
}: {
  creditCards: ReferenceCreditCard[];
  disabled: boolean;
  paymentToolType: string;
  creditCardId: string;
  onPaymentToolTypeChange: (value: string) => void;
  onCreditCardChange: (value: string) => void;
}) {
  return (
    <>
      <label>
        支付工具類型
        <select value={paymentToolType} onChange={(event) => onPaymentToolTypeChange(event.target.value)}>
          <option value="cash">現金</option>
          <option value="credit_card">信用卡</option>
        </select>
      </label>
      <label>
        信用卡
        <select
          disabled={disabled || paymentToolType !== "credit_card"}
          value={creditCardId}
          onChange={(event) => onCreditCardChange(event.target.value)}
        >
          <option value="">請選擇</option>
          {creditCards.map((card) => (
            <option key={card.id} value={card.id}>
              {getCreditCardLabel(card)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
