"use client";

import { useState } from "react";

import { Navigation } from "./navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={`app-root${mobileOpen ? " sidebar-mobile-open" : ""}`}>
      <Navigation onClose={() => setMobileOpen(false)} />
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}
      <main className="main-panel">
        <button
          className="hamburger-btn"
          aria-label="開啟選單"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        {children}
      </main>
    </div>
  );
}
