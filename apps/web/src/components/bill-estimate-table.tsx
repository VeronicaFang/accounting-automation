import { getDisplayedBillAmount, getStatementVariance } from "@/lib/bill-calculations";
import { formatCurrency, formatVariance } from "@/lib/format";
import type { BillEstimate } from "@/lib/types";

export function BillEstimateTable({ bills }: { bills: BillEstimate[] }) {
  return (
    <section className="surface section-block">
      <div className="section-heading">
        <h2>帳單中心</h2>
        <span>預估與真實帳單</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>帳單月</th>
              <th>信用卡</th>
              <th>預估</th>
              <th>真實帳單</th>
              <th>現金流採用</th>
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
                  <td>{bill.creditCardName}</td>
                  <td>{formatCurrency(bill.estimatedAmount)}</td>
                  <td>{bill.statementAmount ? formatCurrency(bill.statementAmount) : "未輸入"}</td>
                  <td>{formatCurrency(displayedAmount)}</td>
                  <td className={variance && variance > 0 ? "text-danger" : ""}>
                    {variance === null ? "尚無差異" : formatVariance(variance)}
                  </td>
                  <td>{bill.paymentDate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
