import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="設定"
        title="系統設定"
        description="信用卡規則、期初金額、資料匯入、家庭共用預留欄位集中在這裡。"
      />
      <section className="surface section-block">
        <div className="grid-three">
          <div className="setting-tile">
            <strong>信用卡規則</strong>
            <span>結帳日與付款日</span>
          </div>
          <div className="setting-tile">
            <strong>期初金額</strong>
            <span>現金流起算餘額</span>
          </div>
          <div className="setting-tile">
            <strong>資料移轉</strong>
            <span>Google Sheet 到 Supabase</span>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
