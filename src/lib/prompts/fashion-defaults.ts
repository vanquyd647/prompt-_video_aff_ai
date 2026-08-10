import type { PromptGenerationResult } from "@/types";

export const DEFAULT_FASHION_POSES = [
  {
    index: 1,
    title: "Hero slay chính diện",
    poseSummary: "Tư thế hero mạnh nhất, đứng toàn thân chếch 3/4 nhẹ, một tay đặt eo và ánh nhìn trực diện.",
    bodyDirection: "Đứng toàn thân, thân chếch 3/4 nhẹ, trọng tâm dồn vào chân sau, chân trước kéo dài tự nhiên",
    faceDirection: "Nhìn thẳng máy ảnh, cằm nâng rất nhẹ, thần thái tự tin và sắc sảo",
    camera: "Máy ngang tầm mắt, khung hình toàn thân dọc 9:16, góc hero tôn dáng",
  },
  {
    index: 2,
    title: "Bước đi thời trang",
    poseSummary: "Bước đi chéo nhẹ trong không gian, tay chuyển động tự nhiên và outfit vẫn được nhìn rõ.",
    bodyDirection: "Bước một nhịp tự nhiên theo đường chéo về phía máy ảnh, vai và hông tạo nhịp chuyển động mềm",
    faceDirection: "Nhìn lệch nhẹ khỏi ống kính theo hướng bước đi, biểu cảm bình tĩnh và sang trọng",
    camera: "Máy ngang hông đến ngang ngực, toàn thân dọc 9:16, bắt khoảnh khắc giữa bước chân",
  },
  {
    index: 3,
    title: "Xoay người nhìn qua vai",
    poseSummary: "Cơ thể xoay 3/4 khỏi máy ảnh rồi nhìn lại qua vai để khoe phom sau và đường nét outfit.",
    bodyDirection: "Thân xoay 3/4 ra xa máy ảnh, lưng thẳng, hông chuyển nhẹ, một chân đặt sau để giữ cân bằng",
    faceDirection: "Quay đầu nhìn qua vai về phía ống kính, giữ rõ khuôn mặt và không để tóc che mặt",
    camera: "Góc máy 3/4 phía sau ở tầm mắt, khung toàn thân dọc 9:16",
  },
  {
    index: 4,
    title: "Tựa nhẹ vào bối cảnh",
    poseSummary: "Tựa nhẹ vào một chi tiết có thật của background, chân tạo đường chéo và hai tay bất đối xứng tự nhiên.",
    bodyDirection: "Tựa rất nhẹ vào kiến trúc hoặc đạo cụ phù hợp, một chân duỗi chéo, chân còn lại chịu lực, không làm biến dạng outfit",
    faceDirection: "Nhìn nghiêng sang một bên rồi đưa mắt nhẹ về máy ảnh, biểu cảm nữ tính và thư thái",
    camera: "Máy chếch 3/4 ở tầm mắt, khung toàn thân hoặc 3/4 dọc 9:16 tùy không gian",
  },
  {
    index: 5,
    title: "Ngồi tương tác sang trọng",
    poseSummary: "Ngồi trên điểm tựa hợp lý trong bối cảnh, thân trên kéo dài, chân đặt chéo và tay thả tự nhiên.",
    bodyDirection: "Ngồi thẳng thanh lịch trên điểm tựa có thật, thân trên kéo dài, hai chân đặt chéo tự nhiên; nếu không có chỗ ngồi thì dùng tư thế bán tựa tương đương",
    faceDirection: "Hướng mặt về máy ảnh hoặc chếch nhẹ, giữ gương mặt rõ và thần thái tự tin",
    camera: "Máy ngang tầm mắt hoặc thấp hơn rất nhẹ, khung toàn thân dọc 9:16 và giữ đúng phối cảnh",
  },
] as const;

const POSE_SECTION = DEFAULT_FASHION_POSES.map((pose) =>
  `${pose.index}. ${pose.title}: ${pose.poseSummary} Cơ thể: ${pose.bodyDirection}. Khuôn mặt: ${pose.faceDirection}. Góc máy: ${pose.camera}.`,
).join("\n");

export const DEFAULT_FASHION_MASTER_PROMPT = `Tạo một bộ 5 ảnh dọc tỷ lệ 9:16 theo concept review model thời trang.

1. Quy tắc sử dụng ảnh tham chiếu
Ảnh tham chiếu 1 – Nhân vật: Dùng làm chuẩn tuyệt đối cho khuôn mặt, đặc điểm nhận diện, kiểu tóc, màu tóc, làn da, thần thái, chiều cao, tỷ lệ cơ thể và toàn bộ vóc dáng của người mẫu.
Ảnh tham chiếu 2 – Trang phục: Chỉ dùng làm chuẩn cho trang phục/outfit, bao gồm thiết kế, màu sắc, chất liệu, họa tiết, đường may, form dáng, độ ôm, độ dài và các chi tiết đặc trưng của sản phẩm.
Ảnh tham chiếu cuối cùng – Background: Dùng làm chuẩn cho bối cảnh cố định của toàn bộ 5 ảnh. Nếu không có ảnh background riêng, hãy ưu tiên dùng bối cảnh trong ảnh sản phẩm. Nếu vẫn không phù hợp, hãy tạo một background thời trang phù hợp với outfit, sang trọng, chân thực và có tính thẩm mỹ cao.

2. Quy tắc ưu tiên bắt buộc
Body, tỷ lệ cơ thể, đường cong, chiều cao, dáng người, khuôn mặt và thần thái phải luôn lấy từ ảnh tham chiếu 1. Không sử dụng body, tỷ lệ người, pose, dáng đứng, góc chụp hoặc thần thái của ảnh tham chiếu 2. Ảnh tham chiếu 2 chỉ là nguồn tham chiếu về trang phục, không phải nguồn tham chiếu về cơ thể.
Outfit từ ảnh tham chiếu 2 phải được mặc lại và fit lại theo đúng body của ảnh tham chiếu 1. Toàn bộ các yếu tố như độ ôm, độ rủ, chiều dài, vị trí chi tiết thiết kế và cách trang phục nằm trên cơ thể phải được điều chỉnh tự nhiên để phù hợp với body của ảnh tham chiếu 1, thay vì giữ nguyên cách outfit bám trên body của ảnh tham chiếu 2.

3. Yêu cầu đầu ra
Tạo 5 ảnh riêng biệt, mỗi ảnh là một file độc lập. Tỷ lệ chuẩn 9:16. Không collage, không contact sheet, không chia khung, không ghép nhiều ảnh trong một file. Cả 5 ảnh phải giữ cùng một người mẫu, cùng một outfit, cùng một background và cùng overall styling. Ảnh mang phong cách nhiếp ảnh thời trang review, chân thực, sắc nét và thẩm mỹ cao.

4. Yêu cầu về người mẫu
Người mẫu là nữ trưởng thành, mang vẻ đẹp quyến rũ, sang trọng, nữ tính và tự tin. Giữ đúng ảnh tham chiếu 1 về khuôn mặt, đặc điểm nhận diện, kiểu tóc, màu tóc, làn da, thần thái, tỷ lệ cơ thể và vóc dáng.
Vóc dáng phải đúng theo ảnh tham chiếu 1: dáng đồng hồ cát gợi cảm, cân đối và hài hòa; vòng một rất đầy đặn, nổi bật, lớn nhưng vẫn tự nhiên, mềm mại và cân đối với tổng thể; eo thon rõ nét; hông nở cân đối; chân dài đẹp. Tổng thể cuốn hút nhưng vẫn chân thực, thẩm mỹ và không phóng đại phi thực tế.

5. Yêu cầu về trang phục
Tái hiện chính xác outfit từ ảnh tham chiếu 2: đúng thiết kế, màu sắc, chất liệu, họa tiết, đường may, form dáng, độ ôm, độ dài và các chi tiết nổi bật của sản phẩm. Outfit phải được fit theo body của ảnh tham chiếu 1, không được fit theo body của ảnh tham chiếu 2.

6. Năm tư thế mặc định bắt buộc
Mỗi ảnh phải sử dụng đúng một tư thế dưới đây theo đúng thứ tự. Không tự đổi pose, không hoán đổi thứ tự và không gộp nhiều pose vào cùng một ảnh. Ảnh 1 phải là ảnh đẹp nhất, nổi bật nhất, “slay” nhất và có thần thái mạnh nhất.
${POSE_SECTION}

7. Yêu cầu về background và tính nhất quán
Giữ cùng một background cho cả 5 ảnh. Không thay đổi địa điểm, kiến trúc, đồ vật lớn hay nguồn sáng chính. Chỉ thay đổi nhẹ góc máy, bố cục và vị trí đứng/ngồi theo năm tư thế đã khóa. Người mẫu phải hòa hợp tự nhiên với background, đúng phối cảnh, tỷ lệ, ánh sáng và bóng đổ. Không tạo cảm giác cắt ghép hoặc lạc khỏi không gian.

8. Yêu cầu chất lượng hình ảnh
Phong cách high-end fashion review photography; chân thực, sắc nét, high detail; ánh sáng đẹp và tự nhiên; da thật, không nhựa; chất liệu vải rõ; bố cục sạch, sang trọng; gương mặt rõ ở mọi góc thấy mặt. Không để tóc, tay hoặc phụ kiện che mặt quá nhiều. Không lỗi giải phẫu, không méo người, không thừa tay chân, không sai tỷ lệ cơ thể, không xuyên vật thể và không lỗi phối cảnh.`;

export function attachLockedPoseBlueprint(position: number, prompt: string): string {
  const pose = DEFAULT_FASHION_POSES[position];
  if (!pose) return prompt;
  const marker = `TƯ THẾ MẶC ĐỊNH ${pose.index} — ${pose.title}`;
  if (prompt.startsWith(marker)) return prompt;
  return `${marker}\n${pose.poseSummary}\nCơ thể: ${pose.bodyDirection}.\nKhuôn mặt: ${pose.faceDirection}.\nGóc máy: ${pose.camera}.\n\n${prompt}`;
}

export function applyDefaultFashionPlan(result: PromptGenerationResult): PromptGenerationResult {
  return {
    ...result,
    masterPrompt: {
      title: "Master Prompt mặc định · 5 ảnh dọc 9:16",
      prompt: DEFAULT_FASHION_MASTER_PROMPT,
    },
    keyframes: result.keyframes.map((keyframe, position) => {
      const pose = DEFAULT_FASHION_POSES[position];
      if (!pose) return keyframe;
      return {
        ...keyframe,
        index: pose.index,
        title: pose.title,
        poseSummary: pose.poseSummary,
        bodyDirection: pose.bodyDirection,
        faceDirection: pose.faceDirection,
        camera: pose.camera,
        prompt: attachLockedPoseBlueprint(position, keyframe.prompt),
      };
    }),
  };
}
