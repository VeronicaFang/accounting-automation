"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";
import { fetchSupabaseRows } from "@/lib/data/supabase-rest";

type MerchantPaymentRuleRow = {
  id: string;
  merchant_tax_id: string | null;
  merchant_name_contains: string | null;
  merchant_display_name: string | null;
  payment_tool_type: "cash" | "credit_card";
  credit_card_id: string | null;
  default_budget_item_id: string | null;
  is_active: boolean;
  created_at: string;
};

type BudgetItemRow = {
  id: string;
  name: string;
  legacy_id: string | null;
  legacy_name: string | null;
};

type CreditCardRow = {
  id: string;
  name: string;
  legacy_id: string | null;
};

type Message = {
  tone: "success" | "error" | "muted";
  text: string;
};

function getRuleMerchant(rule: MerchantPaymentRuleRow): string {
  return rule.merchant_display_name ?? rule.merchant_name_contains ?? rule.merchant_tax_id ?? "未命名店家";
}

function getPaymentToolLabel(value: MerchantPaymentRuleRow["payment_tool_type"]): string {
  return value === "credit_card" ? "信用卡" : "現金";
}

function getLookupLabel<T extends { id: string; name: string; legacy_id: string | null; legacy_name?: string | null }>(
  id: string | null,
  rows: T[]
): string {
  if (!id) {
    return "";
  }

  const row = rows.find((candidate) => candidate.id === id);
  return row?.legacy_name ?? row?.legacy_id ?? row?.name ?? "";
}

export function RulesClient() {
  const [rules, setRules] = useState<MerchantPaymentRuleRow[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItemRow[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardRow[]>([]);
  const [message, setMessage] = useState<Message>({ tone: "muted", text: "正在讀取 Supabase 規則資料..." });

  useEffect(() => {
    const session = readStoredSupabaseSession(window.localStorage);

    if (!session || !isStoredSupabaseSessionValid(window.localStorage)) {
      setMessage({ tone: "error", text: "Supabase session 已過期，請重新登入。" });
      return;
    }

    let isCurrent = true;

    Promise.all([
      fetchSupabaseRows<MerchantPaymentRuleRow>(
        "merchant_payment_rules",
        {
          select:
            "id,merchant_tax_id,merchant_name_contains,merchant_display_name,payment_tool_type,credit_card_id,default_budget_item_id,is_active,created_at",
          order: "created_at.desc",
          limit: "500"
        },
        undefined,
        session.accessToken
      ),
      fetchSupabaseRows<BudgetItemRow>(
        "budget_items",
        {
          select: "id,name,legacy_id,legacy_name",
          order: "legacy_code.asc"
        },
        undefined,
        session.accessToken
      ),
      fetchSupabaseRows<CreditCardRow>(
        "credit_cards",
        {
          select: "id,name,legacy_id",
          order: "name.asc"
        },
        undefined,
        session.accessToken
      )
    ])
      .then(([ruleRows, budgetRows, cardRows]) => {
        if (!isCurrent) {
          return;
        }

        setRules(ruleRows);
        setBudgetItems(budgetRows);
        setCreditCards(cardRows);
        setMessage({ tone: "success", text: `已載入 ${ruleRows.length} 筆店家付款規則。` });
      })
      .catch((error) => {
        if (!isCurrent) {
          return;
        }

        setMessage({ tone: "error", text: error instanceof Error ? error.message : "規則讀取失敗。" });
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const activeCount = useMemo(() => rules.filter((rule) => rule.is_active).length, [rules]);

  return (
    <>
      <PageHeader
        eyebrow="規則"
        title="商戶與分類規則"
        description="查看已累積的店家預設付款方式、信用卡與預算項目。"
      />

      <div className={`entry-message entry-message-${message.tone}`}>{message.text}</div>

      <section className="surface section-block">
        <div className="section-heading">
          <h2>店家付款規則</h2>
          <span>
            {activeCount} 筆啟用 / {rules.length} 筆總數
          </span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>商戶</th>
                <th>統編 / 關鍵字</th>
                <th>支付方式</th>
                <th>信用卡</th>
                <th>預算項目</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{getRuleMerchant(rule)}</td>
                  <td>{rule.merchant_tax_id ?? rule.merchant_name_contains ?? ""}</td>
                  <td>{getPaymentToolLabel(rule.payment_tool_type)}</td>
                  <td>{getLookupLabel(rule.credit_card_id, creditCards)}</td>
                  <td>{getLookupLabel(rule.default_budget_item_id, budgetItems)}</td>
                  <td>{rule.is_active ? "啟用" : "停用"}</td>
                </tr>
              ))}
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={6}>目前沒有店家付款規則。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
