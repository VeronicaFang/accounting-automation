import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { CallbackClient } from "./callback-client";

export default function AuthCallbackPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="登入完成" title="Supabase Session" description="確認登入連結並保存本機 session。" />
      <CallbackClient />
    </AppShell>
  );
}
