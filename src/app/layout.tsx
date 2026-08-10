import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fashion Prompt Builder",
  description: "Tạo bộ prompt ảnh thời trang nhất quán từ các ảnh tham chiếu.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
