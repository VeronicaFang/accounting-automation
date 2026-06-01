import { formatCurrency } from "@/lib/format";
import type { CashFlowMonth } from "@/lib/types";

export function CashFlowTable({ months }: { months: CashFlowMonth[] }) {
  return (
    <section className="surface section-block">
      <div className="section-heading">
        <h2>現金流</h2>
        <span>收入、現金支出、信用卡付款、月淨流量</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>月份</th>
              <th>收入</th>
              <th>現金支出</th>
              <th>信用卡付款</th>
              <th>月淨流量</th>
              <th>月底餘額</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month.month}>
                <td>{month.month}</td>
                <td>{formatCurrency(month.income)}</td>
                <td>{formatCurrency(month.cashExpense)}</td>
                <td>{formatCurrency(month.actualCardPayment ?? month.estimatedCardPayment)}</td>
                <td className={month.netFlow < 0 ? "text-danger" : "text-good"}>
                  {formatCurrency(month.netFlow)}
                </td>
                <td>{month.endingBalance === undefined ? "未設定" : formatCurrency(month.endingBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
