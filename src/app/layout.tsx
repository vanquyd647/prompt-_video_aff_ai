import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fashion Prompt Builder",
  description: "Tạo prompt Character Turnaround Sheet 5 góc từ ảnh tham chiếu gốc bằng Gemini 3.5 Flash Lite.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
