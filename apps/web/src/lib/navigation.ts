export type NavigationItem = {
  href: string;
  label: string;
  description: string;
};

export const navigationItems: NavigationItem[] = [
  { href: "/", label: "首頁", description: "本月狀態與待辦" },
  { href: "/expense-entry", label: "記帳", description: "單筆、固定、批次" },
  { href: "/review", label: "待確認", description: "匯入與規則審核" },
  { href: "/bills", label: "帳單中心", description: "信用卡帳單預估與真實帳單" },
  { href: "/cash-flow", label: "現金流", description: "收入、支出、付款、淨流量" },
  { href: "/budget", label: "預算", description: "預算查詢與分類" },
  { href: "/rules", label: "規則", description: "商戶與分類規則" },
  { href: "/login", label: "登入", description: "Email magic link" },
  { href: "/settings", label: "設定", description: "信用卡、期初金額、資料匯入" }
];
