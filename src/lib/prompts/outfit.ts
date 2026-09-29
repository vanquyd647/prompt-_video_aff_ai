import type { UploadedImage } from "@/types";

export const OUTFIT_CATEGORIES = {
  top: "Áo", trousers: "Quần", skirt: "Chân váy", dress: "Váy liền", outerwear: "Áo khoác", shoes: "Giày", accessory: "Phụ kiện",
} as const;
export type OutfitCategory = keyof typeof OUTFIT_CATEGORIES;
export type OutfitProduct = UploadedImage & { category: OutfitCategory | "" };

export const OUTFIT_LAYOUT = "Create exactly ONE landscape 16:9 image containing three equal panels in one horizontal row, ordered left to right: FRONT (0 degrees), SIDE (90 degrees), BACK (180 degrees). Show the same full-body 3D mannequin wearing the same complete outfit in all three views, with identical body proportions, garment construction, colors, materials and fit. Use a neutral faceless mannequin, not a real person's face. Keep head and feet fully visible, matching scale, camera height, neutral studio background and soft lighting. No perspective three-quarter substitutes, extra views, separate image files, captions, text or watermarks.";
