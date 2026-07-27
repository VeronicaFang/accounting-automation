import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

import { RulesClient } from "../rules/rules-client";
import { SettingsClient } from "./settings-client";

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="設定"
        title="系統設定"
        description="管理信用卡結帳規則、付款日設定，以及商戶與分類規則。"
      />
      <SettingsClient />
      <RulesClient showHeader={false} />
    </AppShell>
  );
}
