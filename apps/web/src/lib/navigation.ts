export type NavigationItem = {
  href: string;
  label: string;
  description: string;
};

export const navigationItems: NavigationItem[] = [
  { href: "/", label: "首頁", description: "本月狀態與待辦" },
  { href: "/expense-entry", label: "記帳", description: "單筆、固定、批次" },
  { href: "/income-entry", label: "收入", description: "薪資、獎金與其他收入" },
  { href: "/expenses", label: "消費明細", description: "已記錄消費" },
  { href: "/review", label: "待處理", description: "匯入與規則審核" },
  { href: "/bills", label: "帳單中心", description: "信用卡帳單預估與真實帳單" },
  { href: "/cash-flow", label: "現金流", description: "收入、支出與淨流量" },
  { href: "/budget", label: "預算", description: "年度與月度預算" },
  { href: "/rules", label: "規則", description: "店家與分類規則" },
  { href: "/settings", label: "設定", description: "信用卡與系統設定" }
];
