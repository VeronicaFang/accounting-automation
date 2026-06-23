"use client";

import Link from "next/link";

const today = typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : "";

function getBillBadge(status: string, paymentDate: string): { label: string; cls: string } {
  if (paymentDate === today) return { label: "今日到期", cls: "bill-badge-overdue" };
  if (status === "paid") return { label: "已付款", cls: "bill-badge-paid" };
  if (status === "statement_received") return { label: "帳單確認", cls: "bill-badge-confirmed" };
  if (status === "needs_review") return { label: "待確認", cls: "bill-badge-overdue" };
  return { label: "預估中", cls: "bill-badge-estimated" };
}

import { getDisplayedBillAmount, getStatementVariance } from "@/lib/bill-calculations";
import { formatCurrency, formatVariance } from "@/lib/format";
import type { BillEstimate } from "@/lib/types";

export type BillStatementEditProps = {
  editingId: string | null;
  statementEdits: Record<string, string>;
  busy: boolean;
  onEditStart: (billId: string, currentAmount: number | undefined) => void;
  onAmountChange: (billId: string, value: string) => void;
  onSave: (bill: BillEstimate) => void;
  onCancel: () => void;
};

type Props = {
  bills: BillEstimate[];
  title?: string;
  statementEdit?: BillStatementEditProps;
};

export function BillEstimateTable({ bills, title = "每月帳單預估", statementEdit }: Props) {
  return (
    <section className="surface section-block">
      <div className="section-heading">
        <h2>{title}</h2>
        <span>{bills.length} 筆</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>帳單月</th>
              <th>信用卡</th>
              <th>預估金額</th>
              <th>真實帳單</th>
              <th>現金流採計</th>
              <th>差異</th>
              <th>付款日</th>
              <th>狀態</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => {
              const displayedAmount = getDisplayedBillAmount({
                estimatedAmount: bill.estimatedAmount,
                statementAmount: bill.statementAmount
              });
              const variance = getStatementVariance({
                estimatedAmount: bill.estimatedAmount,
                statementAmount: bill.statementAmount
              });
              const isEditing = statementEdit?.editingId === bill.id;

              const badge = getBillBadge(bill.status, bill.paymentDate);

              return (
                <tr key={bill.id}>
                  <td>{bill.month}</td>
                  <td>
                    <Link
                      className="table-link"
                      href={`/expenses?billMonth=${encodeURIComponent(bill.month)}&card=${encodeURIComponent(bill.creditCardName)}`}
                    >
                      {bill.creditCardName}
                    </Link>
                  </td>
                  <td>{formatCurrency(bill.estimatedAmount)}</td>
                  <td>
                    {statementEdit && isEditing ? (
                      <span className="bill-statement-edit-cell">
                        <input
                          type="number"
                          className="expense-amount-input"
                          value={statementEdit.statementEdits[bill.id] ?? ""}
                          onChange={(e) => statementEdit.onAmountChange(bill.id, e.target.value)}
                          disabled={statementEdit.busy}
                          min={0}
                          step={1}
                        />
                        <button
                          className="action-btn-sm"
                          onClick={() => statementEdit.onSave(bill)}
                          disabled={statementEdit.busy}
                        >
                          確認
                        </button>
                        <button className="action-btn-sm muted" onClick={statementEdit.onCancel} disabled={statementEdit.busy}>
                          取消
                        </button>
                      </span>
                    ) : (
                      <span className="bill-statement-display-cell">
                        <span>{bill.statementAmount ? formatCurrency(bill.statementAmount) : "尚未輸入"}</span>
                        {statementEdit ? (
                          <button
                            className="action-btn-sm"
                            onClick={() => statementEdit.onEditStart(bill.id, bill.statementAmount)}
                            disabled={statementEdit.busy}
                          >
                            {bill.statementAmount ? "修改" : "輸入"}
                          </button>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td>{formatCurrency(displayedAmount)}</td>
                  <td className={variance && variance > 0 ? "text-danger" : ""}>
                    {variance === null ? "尚未比對" : formatVariance(variance)}
                  </td>
                  <td>{bill.paymentDate}</td>
                  <td><span className={`bill-status-badge ${badge.cls}`}>{badge.label}</span></td>
                </tr>
              );
            })}
            {bills.length === 0 ? (
              <tr>
                <td colSpan={8}>目前沒有可顯示的帳單預估。</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
