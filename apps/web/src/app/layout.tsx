import type { Metadata } from "next";
import "@/styles/globals.css";
import { AuthHashRedirect } from "./auth-hash-redirect";

export const metadata: Metadata = {
  title: "Accounting Automation",
  description: "Private household accounting dashboard"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthHashRedirect />
        {children}
      </body>
    </html>
  );
}
