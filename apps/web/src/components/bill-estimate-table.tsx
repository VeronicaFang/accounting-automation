import Link from "next/link";

import { getDisplayedBillAmount, getStatementVariance } from "@/lib/bill-calculations";
import { formatCurrency, formatVariance } from "@/lib/format";
import type { BillEstimate } from "@/lib/types";

export function BillEstimateTable({ bills, title = "每月帳單預估" }: { bills: BillEstimate[]; title?: string }) {
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

              return (
                <tr key={bill.id}>
                  <td>{bill.month}</td>
                                    <td>
                    <Link
                      className="table-link"
                      href={`/expenses?month=${encodeURIComponent(bill.month)}&card=${encodeURIComponent(bill.creditCardName)}`}
                    >
                      {bill.creditCardName}
                    </Link>
                  </td>
                  <td>{formatCurrency(bill.estimatedAmount)}</td>
                  <td>{bill.statementAmount ? formatCurrency(bill.statementAmount) : "尚未輸入"}</td>
                  <td>{formatCurrency(displayedAmount)}</td>
                  <td className={variance && variance > 0 ? "text-danger" : ""}>
                    {variance === null ? "尚未比對" : formatVariance(variance)}
                  </td>
                  <td>{bill.paymentDate}</td>
                </tr>
              );
            })}
            {bills.length === 0 ? (
              <tr>
                <td colSpan={7}>目前沒有可顯示的帳單預估。</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
