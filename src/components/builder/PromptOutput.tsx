"use client";

import { Check, ChevronDown, Clipboard, Copy, Pencil, RotateCw, Save, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { consistencyWarnings, formatAllPrompts, scorePoseDiversity } from "@/lib/prompts/quality";
import { hasCatalogPosePlan } from "@/lib/prompts/fitcheck-catalog";
import type { PromptGenerationResult } from "@/types";

interface PromptOutputProps {
  result: PromptGenerationResult;
  onChange: (result: PromptGenerationResult) => void;
  onRegenerate: (kind: "master" | "keyframe", index?: number) => void;
  regenerating?: string;
}

async function copyText(text: string) { await navigator.clipboard.writeText(text); }

function CopyButton({ text, label = "Sao chép" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="text-action" type="button" onClick={async () => { await copyText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Đã sao chép" : label}</button>;
}

export function PromptOutput({ result, onChange, onRegenerate, regenerating }: PromptOutputProps) {
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [editing, setEditing] = useState<string>();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const diversity = scorePoseDiversity(result);
  const semanticWarnings = consistencyWarnings(result);
  const isLegacyLayout = !hasCatalogPosePlan(result);
  const toggleMasterEdit = () => {
    if (editing === "master") {
      const prompt = drafts.master ?? result.masterPrompt.prompt;
      if (prompt !== result.masterPrompt.prompt) onChange({ ...result, version: (result.version ?? 1) + 1, masterPrompt: { ...result.masterPrompt, prompt } });
      setEditing(undefined);
    } else {
      setDrafts((current) => ({ ...current, master: result.masterPrompt.prompt }));
      setEditing("master");
    }
  };
  const toggleKeyframeEdit = (position: number, key: string) => {
    if (editing === key) {
      const prompt = drafts[key] ?? result.keyframes[position].prompt;
      if (prompt !== result.keyframes[position].prompt) onChange({ ...result, version: (result.version ?? 1) + 1, keyframes: result.keyframes.map((item, i) => i === position ? { ...item, prompt } : item) });
      setEditing(undefined);
    } else {
      setDrafts((current) => ({ ...current, [key]: result.keyframes[position].prompt }));
      setEditing(key);
    }
  };

  return (
    <section className="results" id="results">
      <div className="results-heading">
        <div><h2>Bộ prompt của bạn</h2><p>{isLegacyLayout ? "Bộ prompt cũ chưa dùng danh sách pose. Nhấn Tạo bộ prompt để phân tích và chọn lại." : "Một ảnh 9:16 ghép 2×2: front, back và hai pose đã chọn từ danh sách. Khôi phục Master Prompt sẽ giữ nguyên bốn pose này."}</p></div>
        <div className="result-actions"><span className={`score score-${diversity.score >= 80 ? "great" : diversity.score >= 60 ? "good" : "weak"}`}><Sparkles size={15} />Độ đa dạng {diversity.score}/100</span><CopyButton text={formatAllPrompts(result)} label="Sao chép tất cả" /></div>
      </div>

      <div className="analysis-panel">
        <button className="analysis-toggle" type="button" onClick={() => setAnalysisOpen(!analysisOpen)} aria-expanded={analysisOpen}><span>Phân tích ảnh tham chiếu</span><ChevronDown size={18} className={analysisOpen ? "rotated" : ""} /></button>
        {analysisOpen && <div className="analysis-grid">
          <div><span>Người mẫu</span><strong>{result.analysis.model.identitySummary}</strong><p>{result.analysis.model.faceSummary} {result.analysis.model.hairSummary}</p><small>Mức độ tin cậy về cơ thể: {({ low: "thấp", medium: "trung bình", high: "cao" } as const)[result.analysis.model.bodyReferenceConfidence]}</small></div>
          <div><span>Sản phẩm</span><strong>{result.analysis.product.category}</strong><p>{result.analysis.product.description}</p><small>{result.analysis.product.colors.join(" · ")}</small></div>
          <div><span>Bối cảnh</span><strong>{({ slot3: "Ảnh bối cảnh", "slot2-fallback": "Suy luận từ ảnh sản phẩm", generated: "AI đề xuất" } as const)[result.analysis.background.source]}</strong><p>{result.analysis.background.description}</p><small>{result.analysis.background.lighting}</small></div>
          <div><span>Diễn giải ghi chú</span><strong>{result.analysis.userNotes.normalizedInstructions.length || 0} yêu cầu</strong><p>{result.analysis.userNotes.normalizedInstructions.join(" · ") || "Không có yêu cầu bổ sung."}</p></div>
        </div>}
      </div>

      {(result.warnings.length > 0 || diversity.issues.length > 0 || semanticWarnings.length > 0) && <details className="quality-warnings"><summary><TriangleAlert size={16} />Lưu ý chất lượng ({result.warnings.length + diversity.issues.length + semanticWarnings.length})</summary><ul>{[...result.warnings, ...diversity.issues, ...semanticWarnings].map((warning, i) => <li key={`${warning}-${i}`}>{warning}</li>)}</ul></details>}

      <article className="master-card">
        <div className="prompt-card-top"><div><span className="prompt-number">M</span><h3>{result.masterPrompt.title || "Prompt tham chiếu chính"}</h3></div><div className="prompt-tools"><CopyButton text={result.masterPrompt.prompt} /><button className="text-action" type="button" onClick={toggleMasterEdit}>{editing === "master" ? <Save size={15} /> : <Pencil size={15} />}{editing === "master" ? "Xong" : "Chỉnh sửa"}</button><button className="text-action" type="button" onClick={() => onRegenerate("master")} disabled={Boolean(regenerating) || isLegacyLayout}><RotateCw className={regenerating === "master" ? "spin" : ""} size={15} />Khôi phục mặc định</button></div></div>
        {editing === "master" ? <textarea className="prompt-editor" value={drafts.master ?? result.masterPrompt.prompt} onChange={(e) => setDrafts((current) => ({ ...current, master: e.target.value }))} /> : <p className="prompt-copy">{result.masterPrompt.prompt}</p>}
        <footer>{result.masterPrompt.prompt.length.toLocaleString("vi-VN")} ký tự · Phiên bản {result.version ?? 1}{editing === "master" && " · Đã chỉnh sửa"}</footer>
      </article>

      <div className="keyframe-title"><h3>{isLegacyLayout ? `${result.keyframes.length} keyframe đã lưu` : "Bốn pose trong ảnh ghép"}</h3><span>{isLegacyLayout ? "Nội dung lịch sử được giữ nguyên." : "Mỗi prompt mô tả một ô dọc 9:16 trong lưới 2×2 của Master Prompt."}</span></div>
      <div className="keyframe-list">
        {result.keyframes.map((keyframe, position) => {
          const key = `keyframe-${keyframe.index}`;
          return <article className="keyframe-card" key={keyframe.index}>
            <div className="keyframe-index">{String(keyframe.index).padStart(2, "0")}</div>
            <div className="keyframe-body">
              <div className="prompt-card-top"><div><h3>{keyframe.title}</h3><p>{keyframe.poseSummary}</p></div><div className="prompt-tools"><CopyButton text={keyframe.prompt} /><button className="text-action" type="button" onClick={() => toggleKeyframeEdit(position, key)}>{editing === key ? <Save size={15} /> : <Pencil size={15} />}{editing === key ? "Xong" : "Chỉnh sửa"}</button><button className="text-action" type="button" onClick={() => onRegenerate("keyframe", position)} disabled={Boolean(regenerating) || isLegacyLayout}><RotateCw className={regenerating === key ? "spin" : ""} size={15} />Tạo lại</button></div></div>
              <div className="pose-facts"><span>Cơ thể · {keyframe.bodyDirection}</span><span>Khuôn mặt · {keyframe.faceDirection}</span><span>Máy ảnh · {keyframe.camera}</span></div>
              {keyframe.poseId && <p className="pose-selection-reason"><strong>Pose #{keyframe.poseId} · Lý do chọn:</strong> {keyframe.selectionReason}</p>}
              {editing === key ? <textarea className="prompt-editor compact" value={drafts[key] ?? keyframe.prompt} onChange={(e) => setDrafts((current) => ({ ...current, [key]: e.target.value }))} /> : <p className="prompt-copy compact">{keyframe.prompt}</p>}
            </div>
          </article>;
        })}
      </div>
      <div className="copy-footer"><Clipboard size={17} /><span>Sẵn sàng cho quy trình tạo ảnh của bạn.</span><CopyButton text={formatAllPrompts(result)} label="Sao chép trọn bộ" /></div>
    </section>
  );
}
