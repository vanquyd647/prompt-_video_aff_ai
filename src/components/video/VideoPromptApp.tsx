"use client";

import {
  ArrowRight,
  Blend,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Film,
  Image as ImageIcon,
  KeyRound,
  LoaderCircle,
  MoveRight,
  Pencil,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiKeyDialog } from "@/components/settings/ApiKeyDialog";
import { UploadCard } from "@/components/builder/UploadCard";
import { GeminiError, generateVideoPrompt } from "@/lib/gemini/client";
import { GEMINI_MODEL_OPTIONS, RATE_LIMITS_URL } from "@/lib/gemini/models";
import { createUploadedImage } from "@/lib/images/processing";
import { API_KEY_STORAGE, DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/storage/local-settings";
import type { AppSettings, UploadedImage, VideoPromptMode, VideoPromptResult } from "@/types";

const ASPECT_RATIO_OPTIONS = ["9:16", "16:9", "4:5", "1:1"];
const LANGUAGE_OPTIONS: Array<{ value: AppSettings["language"]; label: string }> = [
  { value: "Vietnamese", label: "Tiếng Việt" },
  { value: "English", label: "Tiếng Anh" },
  { value: "Bilingual", label: "Song ngữ" },
];
const DURATION_OPTIONS = ["3 giây", "4 giây", "5 giây", "6 giây", "8 giây"];
const PROGRESS_STAGES = ["Đang phân tích nhân vật và trang phục", "Đang chọn kịch bản từ danh sách fit check", "Đang điều chỉnh chuyển động theo ảnh", "Đang hoàn thiện prompt không lời thoại"];

function revoke(image?: UploadedImage) {
  if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
}

export function VideoPromptApp() {
  const [ready, setReady] = useState(false);
  const [apiKey, setApiKey] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem(API_KEY_STORAGE) ?? "");
  const [settings, setSettings] = useState<AppSettings>(() => typeof window === "undefined" ? DEFAULT_SETTINGS : loadSettings());
  const [referenceOne, setReferenceOne] = useState<UploadedImage>();
  const [referenceTwo, setReferenceTwo] = useState<UploadedImage>();
  const [mode, setMode] = useState<VideoPromptMode>("single");
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState("3 giây");
  const [result, setResult] = useState<VideoPromptResult>();
  const [draftPrompt, setDraftPrompt] = useState("");
  const [editing, setEditing] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progressStage, setProgressStage] = useState(0);
  const [message, setMessage] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<{ message: string; technical?: string; status?: number }>();
  const abortRef = useRef<AbortController | null>(null);
  const imageRefs = useRef<{ one?: UploadedImage; two?: UploadedImage }>({});

  useEffect(() => {
    imageRefs.current = { one: referenceOne, two: referenceTwo };
  }, [referenceOne, referenceTwo]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setApiOpen(!localStorage.getItem(API_KEY_STORAGE));
      setReady(true);
    });
    return () => {
      active = false;
      abortRef.current?.abort();
      revoke(imageRefs.current.one);
      revoke(imageRefs.current.two);
    };
  }, []);

  useEffect(() => {
    if (ready) saveSettings(settings);
  }, [ready, settings]);

  useEffect(() => {
    if (!generating) return;
    const timer = window.setInterval(() => setProgressStage((value) => Math.min(value + 1, PROGRESS_STAGES.length - 1)), 1800);
    return () => window.clearInterval(timer);
  }, [generating]);

  const setSingle = async (slot: "one" | "two", files: File[]) => {
    if (!files[0] || generating || uploading) return;
    setUploading(true);
    try {
      setMessage(undefined);
      const next = await createUploadedImage(files[0]);
      if (slot === "one") {
        revoke(referenceOne);
        setReferenceOne(next);
      } else {
        revoke(referenceTwo);
        setReferenceTwo(next);
      }
      setResult(undefined);
      setEditing(false);
      setError(undefined);
      setCopied(false);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Không thể đọc ảnh.");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (slot: "one" | "two") => {
    if (slot === "one") {
      revoke(referenceOne);
      setReferenceOne(undefined);
    } else {
      revoke(referenceTwo);
      setReferenceTwo(undefined);
    }
    setResult(undefined);
    setEditing(false);
    setError(undefined);
    setCopied(false);
  };

  const changeMode = (nextMode: VideoPromptMode) => {
    if (nextMode === mode || generating || uploading) return;
    setMode(nextMode);
    setResult(undefined);
    setDraftPrompt("");
    setEditing(false);
    setError(undefined);
    setMessage(undefined);
    setCopied(false);
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setApiOpen(true);
      return;
    }
    if (!referenceOne || generating || uploading) return;
    const references = mode === "single"
      ? { mode, referenceOne }
      : referenceTwo ? { mode, referenceOne, referenceTwo } : undefined;
    if (!references) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setProgressStage(0);
    setError(undefined);
    setMessage(undefined);
    setEditing(false);
    setResult(undefined);
    setCopied(false);

    try {
      const next = await generateVideoPrompt({
        apiKey,
        ...references,
        notes,
        duration,
        settings,
        signal: controller.signal,
      });
      setResult(next);
      setDraftPrompt(next.prompt);
      window.setTimeout(() => document.getElementById("video-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        setMessage("Đã hủy yêu cầu. Ảnh tham chiếu vẫn được giữ nguyên.");
      } else {
        setError({
          message: cause instanceof Error ? cause.message : "Đã xảy ra lỗi.",
          technical: cause instanceof GeminiError ? cause.technical : undefined,
          status: cause instanceof GeminiError ? cause.status : undefined,
        });
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const copyPrompt = async () => {
    const text = editing ? draftPrompt : result?.prompt;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const toggleEdit = () => {
    if (!result) return;
    if (editing) setResult({ ...result, prompt: draftPrompt });
    else setDraftPrompt(result.prompt);
    setEditing(!editing);
  };

  const single = mode === "single";
  const canGenerate = Boolean(apiKey && referenceOne && (single || referenceTwo) && !generating && !uploading);
  if (!ready) return <main className="boot"><LoaderCircle className="spin" /><span>Đang mở trình tạo prompt video…</span></main>;

  return <>
    <header className="app-header">
      <Link className="brand" href="/">Fashion Prompt Builder</Link>
      <nav aria-label="Điều hướng chính">
        <Link href="/"><ImageIcon size={17} />Tạo ảnh</Link>
        <Link href="/video-prompt" className="active" aria-current="page"><Film size={17} />Video Prompt</Link>
        <Link href="/#history"><Clock3 size={17} />Lịch sử</Link>
      </nav>
      <div className="header-actions">
        <label className="header-select"><Sparkles size={16} /><select aria-label="Mô hình Gemini" value={settings.modelId} onChange={(event) => setSettings({ ...settings, modelId: event.target.value })}>{GEMINI_MODEL_OPTIONS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select><ChevronDown size={15} /></label>
        <button className="header-button" type="button" onClick={() => setApiOpen(true)}><SettingsIcon size={17} /><span>Cài đặt</span></button>
      </div>
    </header>

    <main id="top" className="app-main video-main">
      <section className="intro video-intro">
        <div><h1>Tạo video hook fit check từ ảnh</h1><p>AI phân tích chi tiết nhân vật, trang phục và tư thế, rồi chọn kịch bản phù hợp từ danh sách fitcheck_prompts. Giữ nguyên người mẫu, sản phẩm, bối cảnh và không lời thoại.</p></div>
      </section>

      {message && <div className="notice" role="status"><span>{message}</span><button onClick={() => setMessage(undefined)} aria-label="Đóng thông báo"><X size={15} /></button></div>}

      <fieldset className="video-mode-picker" disabled={generating || uploading}>
        <legend>Chọn cách tạo prompt</legend>
        <label className={single ? "is-selected" : ""}><input type="radio" name="video-mode" value="single" checked={single} onChange={() => changeMode("single")} /><span><strong>Một ảnh pose</strong><small>Chọn kịch bản fit check cho từng ảnh pose riêng.</small></span></label>
        <label className={!single ? "is-selected" : ""}><input type="radio" name="video-mode" value="transition" checked={!single} onChange={() => changeMode("transition")} /><span><strong>Ảnh đầu + cuối</strong><small>Nối hai tư thế bằng một đoạn blur mềm, ngắn.</small></span></label>
      </fieldset>

      <fieldset className={`video-reference-fields input-grid video-input-grid ${single ? "video-single-input" : ""}`} disabled={generating || uploading}>
        <legend className="sr-only">Ảnh tham chiếu cho video</legend>
        <UploadCard index="01" title={single ? "Ảnh pose thành phần" : "Ảnh tham chiếu đầu"} description={single ? "Tải một ảnh pose riêng. Nếu đang có ảnh ghép 2×2, hãy cắt lấy một ô trước khi tải lên. Không cần ảnh cuối." : "Tư thế và bố cục mở đầu của video."} images={referenceOne ? [referenceOne] : []} onFiles={(files) => setSingle("one", files)} onRemove={() => removeImage("one")} />
        {!single && <UploadCard index="02" title="Ảnh tham chiếu cuối" description="Tư thế và bố cục kết thúc của video." images={referenceTwo ? [referenceTwo] : []} onFiles={(files) => setSingle("two", files)} onRemove={() => removeImage("two")} />}
      </fieldset>
      {uploading && <p role="status">Đang đọc ảnh…</p>}

      <div className="transition-cue"><span /><strong>{single ? "Một ảnh · Chuyển động liền mạch" : "Blur mềm · ngắn · mượt"}</strong><MoveRight size={20} /><span /></div>

      <section className="upload-card video-notes-card" aria-labelledby="video-notes-title">
        <span className="watermark" aria-hidden>{single ? "02" : "03"}</span>
        <div className="card-heading"><div><h2 id="video-notes-title">{single ? "02" : "03"} — Ghi chú chuyển động</h2><p>Bổ sung chuyển động fit check. Prompt luôn yêu cầu giữ nguyên người mẫu, vóc dáng, sản phẩm, bối cảnh và không lời thoại.</p></div><span className="optional-label">Không bắt buộc</span></div>
        <textarea aria-labelledby="video-notes-title" value={notes} maxLength={1000} onChange={(event) => setNotes(event.target.value)} placeholder={single ? "Ví dụ: từ pose hiện tại, chuyển trọng tâm nhẹ để khoe phom đồ rồi dừng tự nhiên; giữ hướng người và máy quay cố định." : "Ví dụ: người mẫu chuyển trọng tâm nhẹ rồi nghiêng người sang tư thế cuối để khoe phom đồ, tay không che sản phẩm, máy quay ổn định."} />
        <span className="character-count">{notes.length} / 1000</span>
      </section>

      <section className="generation-rail video-generation-rail" aria-label="Cài đặt tạo prompt video">
        <VideoControl label="Mô hình"><Sparkles size={16} /><select aria-label="Mô hình Gemini" value={settings.modelId} onChange={(event) => setSettings({ ...settings, modelId: event.target.value })}>{GEMINI_MODEL_OPTIONS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select><ChevronDown size={15} /></VideoControl>
        <VideoControl label="Tỷ lệ"><select aria-label="Tỷ lệ video" value={settings.aspectRatio} onChange={(event) => setSettings({ ...settings, aspectRatio: event.target.value })}>{ASPECT_RATIO_OPTIONS.map((ratio) => <option key={ratio}>{ratio}</option>)}</select><ChevronDown size={15} /></VideoControl>
        <VideoControl label="Ngôn ngữ"><select aria-label="Ngôn ngữ prompt" value={settings.language} onChange={(event) => setSettings({ ...settings, language: event.target.value as AppSettings["language"] })}>{LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={15} /></VideoControl>
        <VideoControl label="Thời lượng"><Clock3 size={16} /><select aria-label="Thời lượng video" value={duration} onChange={(event) => setDuration(event.target.value)}>{DURATION_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={15} /></VideoControl>
        <button className="generate-button" type="button" disabled={!canGenerate} onClick={handleGenerate}>{generating ? <LoaderCircle className="spin" size={20} /> : <Sparkles size={20} />}{generating ? PROGRESS_STAGES[progressStage] : "Tạo prompt video"}{!generating && <ArrowRight size={20} />}</button>
        <div className="privacy-line"><KeyRound size={14} /><span>Ảnh tham chiếu được gửi thẳng đến Gemini bằng API key của bạn.</span></div>
      </section>

      {generating && <section className="progress-panel" aria-live="polite"><div className="progress-track"><i /></div><div><Clock3 size={18} /><span>{PROGRESS_STAGES[progressStage]}</span><button type="button" onClick={() => abortRef.current?.abort()}>Hủy</button></div></section>}

      {error && <section className="error-panel" role="alert"><div><h3>{error.status === 429 ? "Đã chạm giới hạn Gemini" : "Không thể tạo prompt video"}</h3><p>{error.message}</p>{error.technical && <details><summary>Chi tiết kỹ thuật</summary><pre>{error.technical}</pre></details>}</div><div>{error.status === 429 && <a href={RATE_LIMITS_URL} target="_blank" rel="noreferrer">Xem giới hạn</a>}<button type="button" onClick={handleGenerate}>Thử lại</button><button type="button" onClick={() => setError(undefined)} aria-label="Đóng lỗi"><X size={17} /></button></div></section>}

      {result && <section id="video-result" className="video-results" aria-labelledby="video-result-title">
        <div className="video-result-heading"><div><span className="result-status"><Check size={15} />Hoàn tất</span><h2 id="video-result-title">Prompt video đã sẵn sàng</h2><p>{result.title}</p></div><div className="prompt-tools"><button className="text-action" type="button" onClick={copyPrompt}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Đã sao chép" : "Sao chép"}</button><button className="text-action" type="button" onClick={toggleEdit}>{editing ? <Save size={15} /> : <Pencil size={15} />}{editing ? "Lưu chỉnh sửa" : "Chỉnh sửa"}</button></div></div>
        <div className="video-scenario"><h3>Kịch bản #{result.scenario.id} · {result.scenario.title}</h3><p><strong>Lý do chọn:</strong> {result.scenario.reason}</p><p><strong>Điều chỉnh theo ảnh:</strong> {result.scenario.adaptation}</p><details><summary>Kịch bản gốc trong danh sách</summary><p>{result.scenario.sourcePrompt}</p></details></div>
        <details className="video-analysis" open><summary>Phân tích nhân vật và trang phục</summary><div className="analysis-grid"><div><strong>Nhân vật</strong><p>{result.analysis.model}</p></div><div><strong>Trang phục / Sản phẩm</strong><p>{result.analysis.outfit}</p></div><div><strong>Tư thế</strong><p>{result.analysis.pose}</p></div><div><strong>Bối cảnh</strong><p>{result.analysis.background}</p></div></div>{result.analysis.motionConstraints.length > 0 && <ul>{result.analysis.motionConstraints.map((constraint, index) => <li key={index}>{constraint}</li>)}</ul>}</details>
        {editing ? <textarea className="video-prompt-editor" value={draftPrompt} onChange={(event) => setDraftPrompt(event.target.value)} /> : <p className="video-prompt-copy">{result.prompt}</p>}
        {result.warnings.length > 0 && <div className="video-warning"><strong>Lưu ý từ ảnh:</strong> {result.warnings.join(" · ")}</div>}
        <div className="constraint-rail">
          <Constraint icon={<UserRound size={21} />} title="Giữ người mẫu & chi tiết sản phẩm" detail={result.summary.subjectContinuity} />
          <Constraint icon={<MoveRight size={21} />} title="Hook fit check · Không lời thoại" detail={result.summary.poseTransition} />
          <Constraint icon={<Blend size={21} />} title={single ? "Liền mạch · Không chuyển cảnh" : "Chỉ blur mềm"} detail={result.summary.transitionEffect} />
        </div>
      </section>}

      {!result && !generating && <section className="video-empty-guide"><ShieldCheck size={22} /><div><h2>{single ? "Mỗi ảnh pose có một prompt video riêng" : "Hook fit check · Giữ nguyên mẫu và sản phẩm"}</h2><p>{single ? "Tải lần lượt từng ảnh pose để AI phân tích và chọn kịch bản fit check phù hợp. Chuyển động nhỏ theo pose gốc, một cảnh quay liên tục, không cần ảnh kết thúc hay hiệu ứng nối." : "Nối tư thế đầu sang tư thế cuối bằng một đoạn blur mềm rất ngắn."} Giữ nguyên khuôn mặt, vóc dáng, từng chi tiết sản phẩm và bối cảnh. Không lời thoại, voice-over hay nhép miệng.</p></div></section>}
    </main>

    <ApiKeyDialog open={apiOpen} initialValue={apiKey} required={!apiKey} onClose={() => setApiOpen(false)} onSave={(key) => { localStorage.setItem(API_KEY_STORAGE, key); setApiKey(key); }} onClear={() => { localStorage.removeItem(API_KEY_STORAGE); setApiKey(""); }} />
  </>;
}

function VideoControl({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="control-group"><span>{label}</span><span className="select-control">{children}</span></label>;
}

function Constraint({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div><span className="constraint-icon">{icon}</span><div><strong>{title}</strong><p>{detail}</p></div></div>;
}
