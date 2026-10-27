import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "사이 SAI STUDIO — 나를 읽고, 서로를 알아가는 사이",
  description: "별자리, 사주, 자미두수의 상징으로 나를 가볍게 들여다보는 사이.",
  icons: {
    icon: "/experience/favicon.svg",
    shortcut: "/experience/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
