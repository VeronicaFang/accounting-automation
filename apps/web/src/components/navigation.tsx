"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AuthSessionIndicator } from "@/components/auth-session-indicator";
import { navigationGroups, navigationItems } from "@/lib/navigation";

export function Navigation({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <img alt="" src="/private-finance-icon.png" />
        </span>
        <div>
          <strong>澄帳</strong>
          <span>家庭財務管理</span>
        </div>
      </div>

      <nav aria-label="主選單">
        {navigationGroups.map((group) => {
          const items = navigationItems.filter((item) => item.group === group);

          return (
            <div key={group} className="nav-group">
              <p className="nav-group-label">{group}</p>
              <div className="nav-list">
                {items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      className={`nav-item${isActive ? " nav-item-active" : ""}`}
                      href={item.href}
                      onClick={onClose}
                    >
                      <span className="nav-dot" style={{ background: item.color }} />
                      <span className="nav-label">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="nav-group">
          <div className="nav-list">
            <AuthSessionIndicator />
          </div>
        </div>
      </nav>
    </aside>
  );
}
