import { Navigation } from "./navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-root">
      <Navigation />
      <main className="main-panel">{children}</main>
    </div>
  );
}
