import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fashion Prompt Builder",
  description: "Tạo ảnh Character Turnaround Sheet chân thực với 5 góc nhìn nhất quán từ ảnh tham chiếu gốc.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
