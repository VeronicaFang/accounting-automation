import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

import { DebugSupabaseClient } from "./debug-supabase-client";

export default function DebugSupabasePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Debug"
        title="Supabase 連線診斷"
        description="檢查目前瀏覽器 session 在 Auth 與 REST/RLS 層看到的身份與 household。"
      />
      <DebugSupabaseClient />
    </AppShell>
  );
}
