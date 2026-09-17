import type { Metadata } from "next";
import { VideoPromptApp } from "@/components/video/VideoPromptApp";

export const metadata: Metadata = {
  title: "Video Prompt · Fashion Prompt Builder",
  description: "Tạo prompt video hook fit check từ một ảnh pose riêng hoặc cặp ảnh đầu và cuối, giữ nguyên người mẫu, sản phẩm và bối cảnh, không lời thoại.",
};

export default function VideoPromptPage() {
  return <VideoPromptApp />;
}
