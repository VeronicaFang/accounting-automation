import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Tabs } from "@/components/tabs";

export default function ExpenseEntryPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="記帳"
        title="新增消費"
        description="單筆消費、每月固定消費、批次貼上分開處理，避免日常入口混在同一張長表單。"
      />
      <section className="surface section-block">
        <Tabs tabs={["單筆", "每月固定", "批次貼上"]} />
        <div className="draft-panel">
          <strong>單筆消費</strong>
          <p>下一步接上 Supabase 後，這裡會使用同一套 expense creation contract。</p>
        </div>
      </section>
    </AppShell>
  );
}
