import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Bai_Jamjuree } from "next/font/google";
import "./globals.css";

const bodyFont = IBM_Plex_Sans_Thai({
  variable: "--font-body",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
});

const dispFont = Bai_Jamjuree({
  variable: "--font-disp",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "แบบฟอร์มเก็บข้อมูล Workflow ของทีม",
  description: "กรอกข้อมูล workflow ของทีมเพื่อทำผัง swimlane",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${bodyFont.variable} ${dispFont.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--ink)]">{children}</body>
    </html>
  );
}
