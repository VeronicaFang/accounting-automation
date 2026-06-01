import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

export default function RulesPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="規則"
        title="商戶與分類規則"
        description="規則先由審核結果累積，之後才加入最近 5 次有 4 次相同的保守學習。"
      />
      <section className="surface section-block">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>商戶</th>
                <th>支付方式</th>
                <th>信用卡</th>
                <th>預算項目</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>統一超商</td>
                <td>信用卡</td>
                <td>聯邦</td>
                <td>24. 餐費</td>
                <td>啟用</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
