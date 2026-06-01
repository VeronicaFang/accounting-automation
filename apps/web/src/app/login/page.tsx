import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="登入"
        title="Email Magic Link"
        description="輸入 email 後會收到登入連結。第一次登入時，Supabase 會自動建立你的 household 與 owner membership。"
      />
      <section className="surface section-block">
        <LoginForm />
      </section>
    </AppShell>
  );
}
