import type { Metadata } from "next";
import { OutfitApp } from "@/components/outfit/OutfitApp";

export const metadata: Metadata = {
  title: "Outfit 3D · Fashion Prompt Builder",
  description: "Tạo prompt outfit trên ma-nơ-canh 3D, một ảnh ngang front / side / back từ ảnh body và sản phẩm.",
};

export default function OutfitPage() {
  return <OutfitApp />;
}
