import type { Metadata } from "next";
import { VideoPromptApp } from "@/components/video/VideoPromptApp";

export const metadata: Metadata = {
  title: "Video Prompt · Fashion Prompt Builder",
  description: "Tạo prompt video chuyển mượt từ ảnh tham chiếu đầu sang ảnh tham chiếu cuối.",
};

export default function VideoPromptPage() {
  return <VideoPromptApp />;
}
