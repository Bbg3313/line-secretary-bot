import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LINE 비서 대시보드",
  description: "채팅 일정 요약 & 미완료 업무",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${plusJakarta.variable} font-sans min-h-screen bg-slate-50 text-gray-900 antialiased`}>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <header className="mb-10 border-b border-gray-200 pb-8">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              LINE 비서 대시보드
            </h1>
            <p className="mt-2 text-gray-500">
              채팅에서 수집한 일정과 업무를 한눈에 관리하세요.
            </p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
