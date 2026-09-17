import type { PromptGenerationResult } from "@/types";
import { FITCHECK_POSES, validateSelectedPoses } from "./fitcheck-catalog";

export const REQUIRED_FASHION_POSES = [
  {
    index: 1,
    poseId: 1,
    title: "Phía trước",
    poseSummary: "Đứng chính diện toàn thân để thấy rõ mặt trước và phom dáng sản phẩm.",
    bodyDirection: "Vai và hông hướng thẳng về máy ảnh, đứng cân bằng tự nhiên, hai tay thả nhẹ không che trang phục",
    faceDirection: "Mặt hướng thẳng và nhìn vào máy ảnh, biểu cảm tự tin tự nhiên",
    camera: "Camera cố định ở tầm mắt trước bối cảnh ảnh 03; người mẫu hướng chính diện, toàn thân trong ô dọc 9:16 phía trên bên trái",
  },
  {
    index: 2,
    poseId: 19,
    title: "Phía sau",
    poseSummary: "Đứng quay lưng hoàn toàn về máy ảnh để thấy rõ mặt sau sản phẩm, không xoay 3/4 hay nhìn qua vai.",
    bodyDirection: "Lưng, vai và hông quay thẳng về phía máy ảnh, hai tay thả tự nhiên không che chi tiết phía sau",
    faceDirection: "Đầu cùng hướng với cơ thể, nhìn ra xa máy ảnh; không quay mặt lại, không ép thấy khuôn mặt ở góc sau",
    camera: "Giữ nguyên camera và bối cảnh như ô 1; người mẫu quay lưng về máy, toàn thân trong ô dọc 9:16 phía trên bên phải",
  },
] as const;

export const FASHION_POSE_COUNT = 4;
export const DEFAULT_FASHION_MASTER_TITLE = "Master Prompt mặc định · 4 ảnh dọc 9:16 trong 1 ảnh 9:16";

export const FASHION_REFERENCE_LOCK = `KHÓA THAM CHIẾU BẮT BUỘC CHO CẢ 4 Ô
01 — Người mẫu / Nhận diện: Giữ nguyên người mẫu, khuôn mặt, làn da, tóc và toàn bộ vóc dáng, kích thước tương đối, tỷ lệ vai–ngực–eo–hông, chiều dài thân, tay và chân theo ảnh 01. Giữ nguyên mọi số đo thực tế do người dùng cung cấp rõ ràng; không suy đoán số đo cm, chiều cao hay cân nặng từ ảnh. Không làm gầy hoặc đầy hơn, không tăng giảm ngực/eo/hông, không kéo dài chân, không áp dáng đồng hồ cát, không lấy cơ thể từ ảnh sản phẩm. Nếu ảnh 01 không thấy đủ cơ thể, nêu rõ phần chưa xác định và yêu cầu ảnh toàn thân để giữ đúng vóc dáng; không khẳng định độ chính xác cho phần không nhìn thấy.
02 — Sản phẩm / Trang phục: Sao chép đúng sản phẩm từ ảnh 02: thiết kế, màu sắc, chất liệu, bề mặt vải, họa tiết và vị trí họa tiết, logo/chữ, đường may, cổ áo, tay áo, túi, nút, khóa, gấu, chiều dài và cấu trúc phom. Chỉ cho phép nếp vải, độ rủ và độ căng thay đổi tự nhiên khi mặc lên cơ thể ảnh 01; không sửa cơ thể để vừa đồ, không cắt sửa thiết kế hoặc thêm/bớt chi tiết. Không bịa chi tiết mặt sau hay phần bị che; ghi rõ thiếu ảnh bổ trợ nếu chưa xác định.
03 — Bối cảnh: Tái hiện đúng ảnh bối cảnh 03: địa điểm, kiến trúc, nền/tường/sàn, vật thể và vị trí tương đối, chất liệu, màu sắc, hướng sáng, độ mềm của ánh sáng và bóng đổ. Không thay cảnh, không dùng nền từ ảnh 01/02, không thêm/bớt đồ vật, không tự trang trí hay đổi ánh sáng. Đặt người mẫu tự nhiên trong đúng không gian đó; giữ cùng camera và bố cục nền, chỉ đổi tư thế/hướng cơ thể theo bốn pose đã chọn. Không dựng thêm phần bối cảnh chưa nhìn thấy.
Các khóa trên có ưu tiên cao hơn yêu cầu làm đẹp, phong cách slay hoặc ghi chú mâu thuẫn. Cả 4 ô phải dùng cùng cơ thể, cùng sản phẩm và cùng bối cảnh; chỉ thay đổi tư thế.`;

export function buildFashionMasterPrompt(poses?: PromptGenerationResult["keyframes"]): string {
  const poseSection = (poses ?? REQUIRED_FASHION_POSES).map((pose) =>
    `${pose.index}. ${pose.title} (pose #${pose.poseId}): ${pose.poseSummary} Cơ thể: ${pose.bodyDirection}. Khuôn mặt: ${pose.faceDirection}. Góc máy: ${pose.camera}.`,
  ).join("\n") + (poses ? "" : "\n3. Ô dưới trái: chọn một pose phù hợp từ fitcheck_pose_list.\n4. Ô dưới phải: chọn một pose khác từ fitcheck_pose_list.");
  return `Tạo duy nhất 1 ảnh dọc tỷ lệ 9:16 chứa 4 khung ảnh dọc 9:16 theo concept review model thời trang, bố cục lưới 2×2.

1. Quy tắc sử dụng ảnh tham chiếu
${FASHION_REFERENCE_LOCK}

2. Quy tắc ưu tiên bắt buộc
Body, tỷ lệ cơ thể, đường cong, chiều cao, dáng người, khuôn mặt và thần thái phải luôn lấy từ ảnh tham chiếu 1. Không sử dụng body, tỷ lệ người, pose, dáng đứng, góc chụp hoặc thần thái của ảnh tham chiếu 2. Ảnh tham chiếu 2 chỉ là nguồn tham chiếu về trang phục, không phải nguồn tham chiếu về cơ thể.
Mặc đúng sản phẩm từ ảnh 02 lên cơ thể giữ nguyên của ảnh 01. Chỉ điều chỉnh nếp vải, độ rủ và độ căng theo trọng lực và tư thế; giữ nguyên chiều dài thiết kế, cấu trúc, tỷ lệ chi tiết và vị trí logo/họa tiết trên sản phẩm. Không đổi số đo cơ thể, không thiết kế lại trang phục để ép độ vừa vặn giống người trong ảnh 02.

3. Yêu cầu đầu ra
Chỉ xuất 1 file ảnh tổng tỷ lệ 9:16, chia thành lưới 2 hàng × 2 cột với 4 ô bằng nhau, liền mép, không viền, không khoảng cách và không chữ hay số thứ tự trên ảnh. Mỗi ô chiếm một nửa chiều rộng và một nửa chiều cao ảnh tổng, nên từng ô cũng có tỷ lệ 9:16. Ví dụ: ảnh tổng 2160×3840 px chứa 4 ô 1080×1920 px. Không xuất 4 file riêng, không thêm ô thứ năm, không chồng khung hoặc trộn nhiều pose trong một ô. Mỗi ô có đúng một hình người mẫu toàn thân, không cắt đầu hoặc bàn chân. Cả 4 ô phải giữ cùng một người mẫu, cùng một outfit, cùng một background và cùng overall styling. Ảnh mang phong cách nhiếp ảnh thời trang review, chân thực, sắc nét và thẩm mỹ cao.

4. Yêu cầu về người mẫu
Giữ đúng người mẫu trưởng thành trong ảnh 01 về khuôn mặt, đặc điểm nhận diện, kiểu tóc, màu tóc, làn da và vóc dáng thực tế. Không thay bằng một người mẫu lý tưởng hóa. Phong cách slay chỉ thể hiện bằng tư thế và biểu cảm, không bằng việc sửa số đo hay hình thể.
Giữ nguyên tỷ lệ và kích thước tương đối của cơ thể trong cả 4 góc nhìn. Không tăng ngực, bóp eo, nở hông, kéo dài chân hoặc thay đổi chiều cao/cân nặng. Chỉ dùng số đo cụ thể nếu người dùng đã cung cấp; nếu thiếu ảnh toàn thân, ghi rõ giới hạn tham chiếu thay vì tự dựng vóc dáng rồi coi là chính xác.

5. Yêu cầu về trang phục
Tái hiện chính xác sản phẩm từ ảnh 02 theo khóa tham chiếu, không biến tấu thiết kế hay thay chất liệu, màu sắc hoặc chi tiết. Trang phục nằm tự nhiên trên body giữ nguyên của ảnh 01; độ rủ/nếp gấp có thể đổi theo tư thế nhưng cấu trúc sản phẩm phải nhất quán ở cả 4 ô. Chi tiết chưa thấy trong ảnh phải được ghi nhận là chưa xác định.

6. Bốn tư thế từ danh sách fitcheck_pose_list
Mỗi ô chỉ sử dụng một pose, theo thứ tự từ trái sang phải và từ trên xuống dưới: front ở trên trái, back ở trên phải, hai pose được chọn ở dưới trái và dưới phải. Hai pose cuối phải khác nhau và khác hai pose bắt buộc. Giữ đúng lựa chọn người dùng nếu có; nếu để tự động, phân tích người mẫu, sản phẩm và không gian để chọn pose phù hợp. Ô 2 thể hiện đúng mặt sau, không nhìn qua vai. Không thêm người, đồ vật hoặc che chi tiết sản phẩm để thực hiện pose.
${poseSection}

7. Yêu cầu về background và tính nhất quán
Giữ nguyên đúng bối cảnh ảnh 03 cho cả 4 ô, bao gồm bố cục vật thể, màu sắc, chất liệu, ánh sáng và bóng đổ. Giữ camera cố định so với bối cảnh; người mẫu đổi hướng và tư thế theo bốn pose đã khóa, không dựng góc phòng mới. Người mẫu phải hòa hợp tự nhiên với background trong từng ô, đúng phối cảnh, tỷ lệ và ánh sáng nguồn. Giữ cỡ người mẫu nhất quán giữa các ô, không kéo giãn người hoặc sản phẩm để lấp đầy khung.

8. Yêu cầu chất lượng hình ảnh
Phong cách fashion review photography; chân thực, sắc nét, high detail; giữ đúng ánh sáng ảnh 03, da thật theo ảnh 01 và chất liệu vải theo ảnh 02. Không retouch làm đổi hình thể, không nâng cấp hay thay thế bối cảnh để đạt vẻ sang trọng. Gương mặt rõ ở mọi góc thấy mặt. Không để tóc, tay hoặc phụ kiện che mặt quá nhiều. Không lỗi giải phẫu, không méo người, không thừa tay chân, không sai tỷ lệ cơ thể, không xuyên vật thể và không lỗi phối cảnh.`;
}

export const DEFAULT_FASHION_MASTER_PROMPT = buildFashionMasterPrompt();

export function attachLockedPoseBlueprint(pose: PromptGenerationResult["keyframes"][number], prompt: string): string {
  const marker = `TƯ THẾ ${pose.index} — ${pose.title} · pose #${pose.poseId}`;
  if (prompt.startsWith(marker) && prompt.includes(FASHION_REFERENCE_LOCK)) return prompt;
  const content = prompt.startsWith(marker) ? prompt : `${marker}\n${pose.poseSummary}\nCơ thể: ${pose.bodyDirection}.\nKhuôn mặt: ${pose.faceDirection}.\nGóc máy: ${pose.camera}.\n\n${prompt}`;
  return `${content}\n\n${FASHION_REFERENCE_LOCK}`;
}

export function applyDefaultFashionPlan(result: PromptGenerationResult): PromptGenerationResult {
  validateSelectedPoses(result.keyframes);
  const keyframes = result.keyframes.map((keyframe, position) => {
    const required = REQUIRED_FASHION_POSES[position];
    const pose = { ...keyframe, ...(required ?? {}), title: required?.title ?? FITCHECK_POSES.find(({ id }) => id === keyframe.poseId)!.name };
    return { ...pose, prompt: attachLockedPoseBlueprint(pose, keyframe.prompt) };
  });
  return {
    ...result,
    masterPrompt: {
      title: DEFAULT_FASHION_MASTER_TITLE,
      prompt: buildFashionMasterPrompt(keyframes),
    },
    keyframes,
  };
}
