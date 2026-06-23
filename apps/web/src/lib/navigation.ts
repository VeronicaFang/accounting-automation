export type NavigationGroup = "瀏覽" | "記帳" | "管理";

export type NavigationItem = {
  href: string;
  label: string;
  description: string;
  group: NavigationGroup;
  color: string;
};

export const navigationItems: NavigationItem[] = [
  { href: "/", label: "首頁", description: "本月狀態與待辦", group: "瀏覽", color: "#0d9488" },
  { href: "/cash-flow", label: "現金流", description: "收入、支出與淨流量", group: "瀏覽", color: "#0284c7" },
  { href: "/bills", label: "帳單", description: "信用卡帳單預估與真實帳單", group: "瀏覽", color: "#7c3aed" },
  { href: "/expense-entry", label: "新增消費", description: "單筆、固定、批次", group: "記帳", color: "#2563eb" },
  { href: "/income-entry", label: "收入", description: "薪資、獎金與其他收入", group: "記帳", color: "#16a34a" },
  { href: "/expenses", label: "消費明細", description: "已記錄消費", group: "記帳", color: "#8b5cf6" },
  { href: "/review", label: "匯入發票", description: "匯入與規則審核", group: "記帳", color: "#ea580c" },
  { href: "/budget", label: "預算管理", description: "年度與月度預算", group: "管理", color: "#4f46e5" },
  { href: "/rules", label: "規則設定", description: "店家與分類規則", group: "管理", color: "#64748b" },
  { href: "/settings", label: "設定", description: "信用卡與系統設定", group: "管理", color: "#94a3b8" },
];

export const navigationGroups: NavigationGroup[] = ["瀏覽", "記帳", "管理"];
