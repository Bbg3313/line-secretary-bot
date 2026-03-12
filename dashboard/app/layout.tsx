import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <header className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-sky-400">
              LINE 비서 대시보드
            </h1>
            <p className="mt-1 text-slate-400">
              채팅에서 수집한 일정 요약과 미완료 업무를 한눈에 확인하세요.
            </p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
