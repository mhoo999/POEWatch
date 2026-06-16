import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "POE2 Meta Radar",
    template: "%s · POE2 Meta Radar",
  },
  description:
    "Path of Exile 2 거래소 데이터를 수집·정규화하여 아이템 가격, 유효 공급량, 옵션 메타 변화를 추적하는 경제 분석 플랫폼.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <NavBar />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
