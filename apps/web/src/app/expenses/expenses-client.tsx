"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { filterExpenses, getDefaultExpenseMonths, monthKeyFromDateValue } from "@/lib/accounting/dashboard-filters";
import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";
import { fetchSupabaseRows } from "@/lib/data/supabase-rest";
import { getSupabaseExpenses } from "@/lib/data/supabase-repository";
import { formatCurrency } from "@/lib/format";
import type { ExpenseRecord } from "@/lib/types";

type LoadState = "signed-out" | "expired" | "loading" | "ready" | "error";

type BudgetItemLookup = {
  id: string;
  name: string | null;
  legacy_id: string | null;
  legacy_name: string | null;
};

type CreditCardLookup = {
  id: string;
  name: string;
  cutoff_day: number;
};

type Message = {
  tone: "success" | "error" | "muted";
  text: string;
};

function paymentLabel(expense: ExpenseRecord): string {
  if (expense.paymentToolType === "credit_card") {
    return `信用卡 ${expense.creditCardName ?? ""}`.trim();
  }

  return "現金";
}

function getBudgetItemLabel(item: BudgetItemLookup): string {
  return item.legacy_name ?? item.legacy_id ?? item.name ?? "";
}

const merchantTags = [
  { label: "蝦皮", value: "蝦皮" },
  { label: "拼多多", value: "拼多多" },
  { label: "淘寶", value: "淘寶" }
];
function getStateText(state: LoadState, count: number): string {
  if (state === "ready") {
    return `已連線 Supabase，顯示 ${count} 筆消費明細`;
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

export function ExpensesClient() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItemLookup[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardLookup[]>([]);
  const [itemEdits, setItemEdits] = useState<Record<string, string>>({});
  const [budgetEdits, setBudgetEdits] = useState<Record<string, string>>({});
  const [paymentEdits, setPaymentEdits] = useState<Record<string, string>>({});
  const [cardEdits, setCardEdits] = useState<Record<string, string>>({});
  const [amountEdits, setAmountEdits] = useState<Record<string, string>>({});
  const [state, setState] = useState<LoadState>("signed-out");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>({ tone: "muted", text: "可直接修正品項、預算項目，或刪除錯誤與重複消費。" });
  const [busyExpenseId, setBusyExpenseId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [newExpense, setNewExpense] = useState({
    consumptionDate: today,
    merchantName: "",
    itemDescription: "",
    amount: "",
    budgetItemId: "",
    paymentToolType: "cash",
    creditCardId: "",
    installmentCount: 1,
    showInstallment: false
  });
  const searchParams = useSearchParams();
  const currentMonth = monthKeyFromDateValue();
  const defaultMonths = useMemo(() => getDefaultExpenseMonths(currentMonth), [currentMonth]);
  const queryMonth = searchParams.get("month") ?? "";
  const queryBillMonth = searchParams.get("billMonth") ?? "";
  const queryCard = searchParams.get("card") ?? "";
  const queryBudget = searchParams.get("budget") ?? "";
  const queryMerchant = searchParams.get("merchant") ?? "";
  const queryTag = searchParams.get("tag") ?? "";
  const queryText = searchParams.get("q") ?? "";
  const [selectedMonth, setSelectedMonth] = useState(queryMonth);
  const [searchText, setSearchText] = useState(queryText);
  const [activeTag, setActiveTag] = useState(queryTag || queryMerchant);

  async function loadExpenses(accessToken: string, isCurrent = () => true) {
    const [rows, budgetRows, cardRows] = await Promise.all([
      getSupabaseExpenses(accessToken, 1000),
      fetchSupabaseRows<BudgetItemLookup>(
        "budget_items",
        {
          select: "id,name,legacy_id,legacy_name",
          is_active: "eq.true",
          order: "legacy_code.asc"
        },
        undefined,
        accessToken
      ),
      fetchSupabaseRows<CreditCardLookup>(
        "credit_cards",
        { select: "id,name,cutoff_day", is_active: "eq.true", order: "name.asc" },
        undefined,
        accessToken
      )
    ]);

    if (!isCurrent()) {
      return;
    }

    setExpenses(rows);
    setBudgetItems(budgetRows);
    setCreditCards(cardRows);
    setItemEdits(Object.fromEntries(rows.map((expense) => [expense.id, expense.itemDescription])));
    setBudgetEdits(Object.fromEntries(rows.map((expense) => [expense.id, expense.budgetItemId])));
    setPaymentEdits(Object.fromEntries(rows.map((expense) => [expense.id, expense.paymentToolType])));
    setCardEdits(Object.fromEntries(rows.map((expense) => [expense.id, expense.creditCardName ?? ""])));
    setAmountEdits(Object.fromEntries(rows.map((expense) => [expense.id, String(expense.amount)])));
    setState("ready");
  }

  useEffect(() => {
    setSelectedMonth(queryMonth);
    setSearchText(queryText);
    setActiveTag(queryTag || queryMerchant);
  }, [queryMonth, queryText, queryTag, queryMerchant]);
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

    loadExpenses(session.accessToken, () => isCurrent).catch((caughtError) => {
      if (!isCurrent) {
        return;
      }

      setExpenses([]);
      setError(caughtError instanceof Error ? caughtError.message : "Supabase 讀取失敗");
      setState("error");
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  const availableMonths = useMemo(
    () => [...new Set(expenses.map((expense) => expense.budgetMonth))].sort().reverse(),
    [expenses]
  );
  const cardCutoffDayByName = useMemo(
    () => new Map(creditCards.map((c) => [c.name.toLowerCase(), c.cutoff_day])),
    [creditCards]
  );

  const visibleExpenses = useMemo(() => {
    const activeBillMonth = queryBillMonth || undefined;
    const cutoffDay = activeBillMonth && queryCard
      ? cardCutoffDayByName.get(queryCard.toLowerCase())
      : undefined;

    return filterExpenses(expenses, {
      billMonth: activeBillMonth,
      creditCardCutoffDay: cutoffDay,
      month: activeBillMonth ? undefined : (selectedMonth || undefined),
      months: activeBillMonth || selectedMonth ? undefined : defaultMonths,
      creditCardName: queryCard || undefined,
      budgetItemName: queryBudget || undefined,
      merchantTag: activeTag || undefined,
      query: searchText || undefined
    });
  }, [activeTag, cardCutoffDayByName, defaultMonths, expenses, queryBillMonth, queryBudget, queryCard, searchText, selectedMonth]);
  const activeContext = [
    queryBillMonth ? `帳單月 ${queryBillMonth}` : selectedMonth ? `月份 ${selectedMonth}` : `預設 ${defaultMonths.join("、")}`,
    queryCard ? `信用卡 ${queryCard}` : "",
    queryBudget ? `預算 ${queryBudget}` : "",
    activeTag ? `店家 ${activeTag}` : "",
    searchText ? `搜尋 ${searchText}` : ""
  ].filter(Boolean);
  async function submitExpenseAction(action: string, body: Record<string, unknown>) {
    const session = readStoredSupabaseSession(window.localStorage);

    if (!session || !isStoredSupabaseSessionValid(window.localStorage)) {
      setMessage({ tone: "error", text: "Supabase session 已過期，請重新登入。" });
      return null;
    }

    const response = await fetch("/api/accounting/expense-entry", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, ...body })
    });
    const result = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw new Error(typeof result.error === "string" ? result.error : "消費明細更新失敗。");
    }

    await loadExpenses(session.accessToken);
    return result;
  }

  async function saveExpenseDetails(expense: ExpenseRecord) {
    const itemDescription = String(itemEdits[expense.id] ?? "").trim();
    const budgetItemId = String(budgetEdits[expense.id] ?? "").trim();
    const paymentToolType = String(paymentEdits[expense.id] ?? expense.paymentToolType);
    const creditCardName = String(cardEdits[expense.id] ?? expense.creditCardName ?? "").trim();
    const amountRaw = String(amountEdits[expense.id] ?? expense.amount).replace(/,/g, "");
    const newAmount = Number(amountRaw);

    if (!itemDescription) {
      setMessage({ tone: "error", text: "品項不可空白。" });
      return;
    }

    if (!budgetItemId) {
      setMessage({ tone: "error", text: "請選擇預算項目。" });
      return;
    }

    if (!Number.isFinite(newAmount) || newAmount < 0) {
      setMessage({ tone: "error", text: "請輸入有效的消費金額（≥ 0）。" });
      return;
    }

    if (paymentToolType === "credit_card" && !creditCardName) {
      setMessage({ tone: "error", text: "請選擇信用卡。" });
      return;
    }

    const amountChanged = newAmount !== expense.amount;
    const paymentChanged = paymentToolType !== expense.paymentToolType || creditCardName !== (expense.creditCardName ?? "");

    setBusyExpenseId(expense.id);
    setMessage({ tone: "muted", text: "正在更新消費明細..." });

    try {
      const body: Record<string, unknown> = { expenseId: expense.id, itemDescription, budgetItemId };

      if (amountChanged || paymentChanged) {
        body.amount = newAmount;
        body.paymentToolType = paymentToolType;

        if (paymentToolType === "credit_card") {
          body.creditCardName = creditCardName;
        }
      }

      await submitExpenseAction("updateExpenseDetails", body);
      setMessage({ tone: "success", text: "消費明細已更新。" });
    } catch (caughtError) {
      setMessage({ tone: "error", text: caughtError instanceof Error ? caughtError.message : "消費明細更新失敗。" });
    } finally {
      setBusyExpenseId(null);
    }
  }

  async function deleteExpense(expense: ExpenseRecord) {
    if (!window.confirm(`刪除這筆消費？\n${expense.consumptionDate} ${expense.merchantName} ${expense.itemDescription}`)) {
      return;
    }

    setBusyExpenseId(expense.id);
    setMessage({ tone: "muted", text: "正在刪除消費並更新現金流..." });

    try {
      const result = await submitExpenseAction("deleteExpenses", { expenseIds: [expense.id] });
      setMessage({ tone: "success", text: `已刪除 ${result?.deletedExpenses ?? 0} 筆消費。` });
    } catch (caughtError) {
      setMessage({ tone: "error", text: caughtError instanceof Error ? caughtError.message : "刪除消費失敗。" });
    } finally {
      setBusyExpenseId(null);
    }
  }

  function resetAddForm() {
    setNewExpense({
      consumptionDate: new Date().toISOString().slice(0, 10),
      merchantName: "",
      itemDescription: "",
      amount: "",
      budgetItemId: "",
      paymentToolType: "cash",
      creditCardId: "",
      installmentCount: 1,
      showInstallment: false
    });
    setShowAddForm(false);
  }

  async function addExpense() {
    const { consumptionDate, merchantName, itemDescription, amount, budgetItemId, paymentToolType, creditCardId, installmentCount } = newExpense;

    if (!consumptionDate) {
      setMessage({ tone: "error", text: "請填寫消費日期。" });
      return;
    }

    if (!itemDescription.trim()) {
      setMessage({ tone: "error", text: "品項不可空白。" });
      return;
    }

    if (!budgetItemId) {
      setMessage({ tone: "error", text: "請選擇預算項目。" });
      return;
    }

    const amountNum = Number(amount);

    if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) {
      setMessage({ tone: "error", text: "請輸入有效的消費金額（> 0）。" });
      return;
    }

    if (paymentToolType === "credit_card" && !creditCardId) {
      setMessage({ tone: "error", text: "請選擇信用卡。" });
      return;
    }

    setAddBusy(true);
    setMessage({ tone: "muted", text: "正在新增消費..." });

    try {
      await submitExpenseAction("singleExpense", {
        consumptionDate,
        merchantName,
        itemDescription,
        amount: amountNum,
        budgetItemId,
        paymentToolType,
        creditCardId: paymentToolType === "credit_card" ? creditCardId : "",
        installmentCount: paymentToolType === "credit_card" ? installmentCount : 1,
        notes: "",
        sourceSystem: "manual_no_invoice",
        sourceTable: "expense_entry"
      });
      setMessage({ tone: "success", text: "消費已新增。" });
      resetAddForm();
    } catch (caughtError) {
      setMessage({ tone: "error", text: caughtError instanceof Error ? caughtError.message : "新增消費失敗。" });
    } finally {
      setAddBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="消費明細"
        title="已記錄消費"
        description="可依月份、店家、品項、信用卡或預算項目查找；預設顯示本月與前月。"
      />
      <div className={`data-source-pill data-source-${state}`}>{getStateText(state, visibleExpenses.length)} / 全部 {expenses.length} 筆</div>
      <div className={`entry-message entry-message-${message.tone}`}>{message.text}</div>
      {error ? <p className="error-text">{error}</p> : null}
      <section className="surface section-block filter-panel">
        <div className="filter-row">
          <label>
            月份
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              <option value="">本月與前月</option>
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-search">
            搜尋
            <input
              placeholder="店家或品項關鍵字"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </label>
          <button className="secondary-action" type="button" onClick={() => { setSelectedMonth(""); setSearchText(""); setActiveTag(""); }}>
            清除篩選
          </button>
        </div>
        <div className="tag-row">
          {merchantTags.map((tag) => (
            <button
              key={tag.value}
              className={activeTag === tag.value ? "tag-button tag-button-active" : "tag-button"}
              type="button"
              onClick={() => setActiveTag((current) => (current === tag.value ? "" : tag.value))}
            >
              {tag.label}
            </button>
          ))}
        </div>
        <p className="muted">{activeContext.length > 0 ? `目前條件：${activeContext.join("、")}` : "目前條件：本月與前月"}</p>
      </section>
      <section className="surface section-block">
        {showAddForm ? (
          <div className="quick-add-form">
            <div className="quick-add-title">新增消費</div>
            <div className="quick-add-fields">
              <label>
                消費日
                <input
                  type="date"
                  value={newExpense.consumptionDate}
                  onChange={(e) => setNewExpense((prev) => ({ ...prev, consumptionDate: e.target.value }))}
                />
              </label>
              <label>
                店家
                <input
                  type="text"
                  placeholder="選填"
                  value={newExpense.merchantName}
                  onChange={(e) => setNewExpense((prev) => ({ ...prev, merchantName: e.target.value }))}
                />
              </label>
              <label>
                品項
                <input
                  type="text"
                  placeholder="必填"
                  value={newExpense.itemDescription}
                  onChange={(e) => setNewExpense((prev) => ({ ...prev, itemDescription: e.target.value }))}
                />
              </label>
              <label>
                金額
                <input
                  type="number"
                  min={1}
                  step={1}
                  placeholder="必填"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </label>
              <label>
                預算項目
                <select
                  value={newExpense.budgetItemId}
                  onChange={(e) => setNewExpense((prev) => ({ ...prev, budgetItemId: e.target.value }))}
                >
                  <option value="">請選擇</option>
                  {budgetItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {getBudgetItemLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                支付
                <select
                  value={newExpense.paymentToolType}
                  onChange={(e) => setNewExpense((prev) => ({ ...prev, paymentToolType: e.target.value, creditCardId: "" }))}
                >
                  <option value="cash">現金</option>
                  <option value="credit_card">信用卡</option>
                </select>
              </label>
              {newExpense.paymentToolType === "credit_card" ? (
                <label>
                  信用卡
                  <select
                    value={newExpense.creditCardId}
                    onChange={(e) => setNewExpense((prev) => ({ ...prev, creditCardId: e.target.value }))}
                  >
                    <option value="">請選擇</option>
                    {creditCards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {newExpense.paymentToolType === "credit_card" && !newExpense.showInstallment ? (
                <label style={{ alignSelf: "flex-end" }}>
                  <span style={{ visibility: "hidden" }}>placeholder</span>
                  <button
                    className="installment-toggle-btn"
                    type="button"
                    onClick={() => setNewExpense((prev) => ({ ...prev, showInstallment: true }))}
                  >
                    分期
                  </button>
                </label>
              ) : null}
              {newExpense.paymentToolType === "credit_card" && newExpense.showInstallment ? (
                <label>
                  分期期數
                  <div className="installment-inline">
                    <select
                      value={newExpense.installmentCount}
                      onChange={(e) => setNewExpense((prev) => ({ ...prev, installmentCount: Number(e.target.value) }))}
                    >
                      {[3, 6, 12, 18, 24, 30, 36].map((n) => (
                        <option key={n} value={n}>{n} 期</option>
                      ))}
                    </select>
                    <button
                      className="installment-cancel-btn"
                      type="button"
                      onClick={() => setNewExpense((prev) => ({ ...prev, showInstallment: false, installmentCount: 1 }))}
                    >
                      ×
                    </button>
                  </div>
                </label>
              ) : null}
            </div>
            <div className="quick-add-actions">
              <button className="primary-action" type="button" onClick={addExpense} disabled={addBusy}>
                {addBusy ? "新增中..." : "確認新增"}
              </button>
              <button className="secondary-action" type="button" onClick={resetAddForm} disabled={addBusy}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            className="secondary-action"
            type="button"
            onClick={() => setShowAddForm(true)}
            disabled={state !== "ready"}
          >
            + 新增消費
          </button>
        )}
      </section>
      <section className="surface section-block">
        <div className="section-heading">
          <h2>消費列表</h2>
          <span>{visibleExpenses.length} 筆</span>
        </div>
        <div className="table-scroll">
          <table className="data-table expenses-table">
            <thead>
              <tr>
                <th>消費日</th>
                <th>預算月</th>
                <th>店家</th>
                <th>品項</th>
                <th>預算項目</th>
                <th>支付</th>
                <th>金額</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleExpenses.map((expense) => {
                const isBusy = busyExpenseId === expense.id;
                const itemValue = itemEdits[expense.id] ?? expense.itemDescription;
                const budgetValue = budgetEdits[expense.id] ?? expense.budgetItemId;
                const paymentValue = paymentEdits[expense.id] ?? expense.paymentToolType;
                const cardValue = cardEdits[expense.id] ?? (expense.creditCardName ?? "");
                const amountValue = amountEdits[expense.id] ?? String(expense.amount);
                const isChanged =
                  itemValue.trim() !== expense.itemDescription ||
                  budgetValue !== expense.budgetItemId ||
                  paymentValue !== expense.paymentToolType ||
                  cardValue !== (expense.creditCardName ?? "") ||
                  Number(amountValue) !== expense.amount;

                return (
                  <tr key={expense.id}>
                    <td>{expense.consumptionDate}</td>
                    <td>{expense.budgetMonth}</td>
                    <td>{expense.merchantName || "未填"}</td>
                    <td>
                      <input
                        className="expense-item-input"
                        value={itemValue}
                        onChange={(event) => setItemEdits((current) => ({ ...current, [expense.id]: event.target.value }))}
                      />
                    </td>
                    <td>
                      <select
                        className="expense-budget-select"
                        value={budgetValue}
                        onChange={(event) => setBudgetEdits((current) => ({ ...current, [expense.id]: event.target.value }))}
                      >
                        <option value="">請選擇</option>
                        {budgetItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {getBudgetItemLabel(item)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="expense-payment-cell">
                        <select
                          className="expense-budget-select"
                          value={paymentValue}
                          disabled={isBusy}
                          onChange={(event) => setPaymentEdits((current) => ({ ...current, [expense.id]: event.target.value }))}
                        >
                          <option value="cash">現金</option>
                          <option value="credit_card">信用卡</option>
                        </select>
                        {paymentValue === "credit_card" ? (
                          <select
                            className="expense-budget-select"
                            value={cardValue}
                            disabled={isBusy}
                            onChange={(event) => setCardEdits((current) => ({ ...current, [expense.id]: event.target.value }))}
                          >
                            <option value="">請選擇</option>
                            {creditCards.map((card) => (
                              <option key={card.id} value={card.name}>{card.name}</option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <input
                        className="expense-amount-input"
                        type="number"
                        min="0"
                        step="1"
                        value={amountValue}
                        disabled={isBusy}
                        onChange={(event) => setAmountEdits((current) => ({ ...current, [expense.id]: event.target.value }))}
                      />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="secondary-action" disabled={isBusy || !isChanged} onClick={() => saveExpenseDetails(expense)} type="button">
                          儲存
                        </button>
                        <button className="secondary-action danger-action" disabled={isBusy} onClick={() => deleteExpense(expense)} type="button">
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {state === "ready" && visibleExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8}>目前沒有可顯示的消費明細。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}