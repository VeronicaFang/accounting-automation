import Link from "next/link";
import { navigationItems } from "@/lib/navigation";

export function Navigation() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">AA</span>
        <div>
          <strong>記帳軟體</strong>
          <span>Private Finance</span>
        </div>
      </div>

      <nav className="nav-list" aria-label="主要功能">
        {navigationItems.map((item) => (
          <Link key={item.href} className="nav-item" href={item.href}>
            <span>{item.label}</span>
            <small>{item.description}</small>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
