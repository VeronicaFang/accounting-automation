import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="登入"
        title="Supabase Session"
        description="查看目前登入狀態，或使用 Email magic link 重新取得 Supabase session。"
      />
      <section className="surface section-block">
        <LoginForm />
      </section>
    </AppShell>
  );
}
