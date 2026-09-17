"use client";

import { ArrowRight, ChevronDown, Clock3, ExternalLink, Film, History as HistoryIcon, KeyRound, LoaderCircle, Plus, RefreshCw, Settings as SettingsIcon, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiKeyDialog } from "@/components/settings/ApiKeyDialog";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { HistoryDrawer } from "@/components/history/HistoryDrawer";
import { UploadCard } from "./UploadCard";
import { PromptOutput } from "./PromptOutput";
import { GeminiError, generatePromptSet, listAvailableModels, regeneratePromptPart } from "@/lib/gemini/client";
import { GEMINI_MODEL_OPTIONS, RATE_LIMITS_URL, type GeminiModelOption } from "@/lib/gemini/models";
import { createUploadedImage, fromStoredImage, toStoredImage } from "@/lib/images/processing";
import { API_KEY_STORAGE, DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/storage/local-settings";
import { clearHistory, deleteHistoryItem, getHistory, saveHistoryItem } from "@/lib/storage/history";
import { createId } from "@/lib/utils/id";
import { DEFAULT_FASHION_POSES } from "@/lib/prompts/fashion-defaults";
import type { AppSettings, PromptGenerationResult, PromptHistoryItem, UploadedImage } from "@/types";

const PROGRESS_STAGES = ["Đang đọc ảnh người mẫu", "Đang phân tích sản phẩm", "Đang phân tích bối cảnh", "Đang xếp 4 pose vào ảnh 9:16", "Đang hoàn thiện bộ prompt"];

const LANGUAGE_OPTIONS = [
  { value: "Vietnamese", label: "Tiếng Việt" },
  { value: "English", label: "Tiếng Anh" },
  { value: "Bilingual", label: "Song ngữ" },
];
const DETAIL_OPTIONS = [
  { value: "Compact", label: "Ngắn gọn" },
  { value: "Standard", label: "Tiêu chuẩn" },
  { value: "Detailed", label: "Chi tiết" },
];

function revoke(image?: UploadedImage) { if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl); }

export function BuilderApp() {
  const [ready, setReady] = useState(false);
  const [apiKey, setApiKey] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem(API_KEY_STORAGE) ?? "");
  const [settings, setSettings] = useState<AppSettings>(() => typeof window === "undefined" ? DEFAULT_SETTINGS : loadSettings());
  const [models, setModels] = useState<GeminiModelOption[]>(GEMINI_MODEL_OPTIONS);
  const [modelImage, setModelImage] = useState<UploadedImage>();
  const [products, setProducts] = useState<UploadedImage[]>([]);
  const [background, setBackground] = useState<UploadedImage>();
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<PromptGenerationResult>();
  const [history, setHistory] = useState<PromptHistoryItem[]>([]);
  const [currentHistoryId, setCurrentHistoryId] = useState<string>();
  const [apiOpen, setApiOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progressStage, setProgressStage] = useState(0);
  const [regenerating, setRegenerating] = useState<string>();
  const [error, setError] = useState<{ message: string; technical?: string; status?: number }>();
  const [fileMessage, setFileMessage] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) return;
      setApiOpen(!localStorage.getItem(API_KEY_STORAGE));
      if (window.location.hash === "#history") setHistoryOpen(true);
      setReady(true);
    });

    getHistory()
      .then((items) => { if (active) setHistory(items); })
      .catch(() => { if (active) setFileMessage("Không thể mở lịch sử cục bộ trên trình duyệt này."); });

    return () => { active = false; };
  }, []);

  useEffect(() => { if (ready) saveSettings(settings); }, [settings, ready]);
  useEffect(() => {
    if (!generating) return;
    const timer = window.setInterval(() => setProgressStage((value) => Math.min(value + 1, PROGRESS_STAGES.length - 1)), 2400);
    return () => window.clearInterval(timer);
  }, [generating]);

  const ingest = useCallback(async (files: File[]) => {
    try { setFileMessage(undefined); return await Promise.all(files.map(createUploadedImage)); }
    catch (cause) { setFileMessage(cause instanceof Error ? cause.message : "Không thể đọc ảnh."); return []; }
  }, []);

  const setSingle = async (slot: "model" | "background", files: File[]) => {
    const images = await ingest(files.slice(0, 1));
    if (!images[0]) return;
    if (slot === "model") { revoke(modelImage); setModelImage(images[0]); }
    else { revoke(background); setBackground(images[0]); }
  };

  const addProducts = async (files: File[]) => {
    const images = await ingest(files);
    if (images.length) setProducts((items) => [...items, ...images]);
  };

  const persist = useCallback(async (nextResult: PromptGenerationResult, id = currentHistoryId ?? createId()) => {
    if (!settings.autosave || !modelImage) return id;
    const now = new Date().toISOString();
    const existing = history.find((item) => item.id === id);
    const item: PromptHistoryItem = {
      id, createdAt: existing?.createdAt ?? now, updatedAt: now, modelId: settings.modelId, settings,
      references: { model: toStoredImage(modelImage), products: products.map(toStoredImage), background: background ? toStoredImage(background) : undefined },
      notes, result: nextResult,
    };
    await saveHistoryItem(item);
    setHistory((items) => [item, ...items.filter((entry) => entry.id !== id)]);
    setCurrentHistoryId(id);
    return id;
  }, [background, currentHistoryId, history, modelImage, notes, products, settings]);

  const handleGenerate = async () => {
    if (!apiKey || !modelImage || products.length === 0 || !background) return;
    const controller = new AbortController(); abortRef.current = controller;
    setGenerating(true); setProgressStage(0); setError(undefined);
    try {
      const next = await generatePromptSet({ apiKey, model: modelImage, products, background, notes, settings, signal: controller.signal });
      setResult(next); setCurrentHistoryId(undefined); await persist(next, createId());
      window.setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") setFileMessage("Đã hủy yêu cầu. Các ảnh của bạn vẫn được giữ nguyên.");
      else setError({ message: cause instanceof Error ? cause.message : "Đã xảy ra lỗi.", technical: cause instanceof GeminiError ? cause.technical : undefined, status: cause instanceof GeminiError ? cause.status : undefined });
    } finally { setGenerating(false); abortRef.current = null; }
  };

  const handleResultChange = (next: PromptGenerationResult) => { setResult(next); persist(next).catch(() => setFileMessage("Không thể cập nhật lịch sử cục bộ.")); };

  const handleRegenerate = async (kind: "master" | "keyframe", index?: number) => {
    if (!result || !apiKey) return;
    const key = kind === "master" ? "master" : `keyframe-${(index ?? 0) + 1}`;
    setRegenerating(key); setError(undefined);
    try {
      const replacement = await regeneratePromptPart({ apiKey, modelId: settings.modelId, result, kind, index });
      const next = kind === "master"
        ? { ...result, version: (result.version ?? 1) + 1, masterPrompt: { title: replacement.title, prompt: replacement.prompt } }
        : { ...result, version: (result.version ?? 1) + 1, keyframes: result.keyframes.map((item, i) => i === index ? { ...item, ...replacement, index: item.index } : item) };
      handleResultChange(next);
    } catch (cause) { setError({ message: cause instanceof Error ? cause.message : "Không thể tạo lại prompt." }); }
    finally { setRegenerating(undefined); }
  };

  const refreshModels = async () => {
    if (!apiKey) { setApiOpen(true); return; }
    setFileMessage("Đang làm mới danh sách model…");
    try {
      const available = await listAvailableModels(apiKey);
      const useful = available.filter((item) => /gemini/i.test(item.id) && !/(embedding|tts|image|live|veo|imagen)/i.test(item.id));
      setModels(useful.length ? useful : GEMINI_MODEL_OPTIONS);
      setFileMessage(`Đã tìm thấy ${useful.length || available.length} model hỗ trợ tạo nội dung.`);
    } catch (cause) { setFileMessage(cause instanceof Error ? cause.message : "Không thể tải danh sách model."); }
  };

  const reset = (keep: "none" | "model" | "model-background" = "none") => {
    if (keep === "none") { revoke(modelImage); setModelImage(undefined); }
    products.forEach(revoke); setProducts([]);
    if (keep !== "model-background") { revoke(background); setBackground(undefined); }
    setNotes(""); setResult(undefined); setCurrentHistoryId(undefined); setError(undefined); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openHistory = (item: PromptHistoryItem) => {
    revoke(modelImage); products.forEach(revoke); revoke(background);
    setModelImage(item.references.model ? fromStoredImage(item.references.model) : undefined);
    setProducts(item.references.products.map(fromStoredImage));
    setBackground(item.references.background ? fromStoredImage(item.references.background) : undefined);
    setNotes(item.notes); setSettings(item.settings); setResult(item.result); setCurrentHistoryId(item.id); setHistoryOpen(false);
    window.setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const removeHistory = async (id: string) => { await deleteHistoryItem(id); setHistory((items) => items.filter((item) => item.id !== id)); if (currentHistoryId === id) setCurrentHistoryId(undefined); };
  const clearAllHistory = async () => { if (!window.confirm("Xóa toàn bộ lịch sử prompt trên thiết bị? API key của bạn vẫn được giữ lại.")) return; await clearHistory(); setHistory([]); setCurrentHistoryId(undefined); };
  const clearAllData = async () => { if (!window.confirm("Xóa API key, cài đặt và toàn bộ lịch sử trên thiết bị?")) return; await clearHistory(); localStorage.removeItem(API_KEY_STORAGE); localStorage.removeItem("fashion-prompt-builder:settings"); setApiKey(""); setSettings(DEFAULT_SETTINGS); setHistory([]); setSettingsOpen(false); setApiOpen(true); reset(); };

  const canGenerate = Boolean(apiKey && modelImage && products.length && background && !generating);
  const selectedModel = models.find((model) => model.id === settings.modelId) ?? GEMINI_MODEL_OPTIONS.find((model) => model.id === settings.modelId);
  const modelOptions = useMemo(() => models.some((model) => model.id === settings.modelId) ? models : [selectedModel!, ...models].filter(Boolean), [models, selectedModel, settings.modelId]);
  if (!ready) return <main className="boot"><LoaderCircle className="spin" /><span>Đang mở không gian làm việc trên thiết bị…</span></main>;

  return <>
    <header className="app-header">
      <a className="brand" href="#top" aria-label="Trang chủ Fashion Prompt Builder">Fashion Prompt Builder</a>
      <nav aria-label="Điều hướng chính">
        <button onClick={() => reset()}><Plus size={17} />Tạo mới</button>
        <Link href="/video-prompt"><Film size={17} />Video Prompt</Link>
        <button onClick={() => setHistoryOpen(true)}><HistoryIcon size={17} />Lịch sử <span className="nav-count">{history.length}</span></button>
      </nav>
      <div className="header-actions">
        <label className="header-select"><Sparkles size={16} /><select aria-label="Mô hình Gemini" value={settings.modelId} onChange={(e) => setSettings({ ...settings, modelId: e.target.value })}>{modelOptions.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select><ChevronDown size={15} /></label>
        <button className="header-button" onClick={() => setSettingsOpen(true)}><SettingsIcon size={17} /><span>Cài đặt</span></button>
      </div>
    </header>

    <main id="top" className="app-main">
      <section className="intro">
        <div><h1>Tạo câu chuyện thời trang nhất quán</h1><p>Tạo prompt cho 4 khung dọc 9:16 trong một ảnh 9:16, bố cục 2×2: phía trước, phía sau, góc 3/4 và slay. Giữ nguyên cơ thể ảnh 01, chính xác sản phẩm ảnh 02 và bối cảnh ảnh 03.</p></div>
        <div className="step-thread" aria-label="Bốn bước thêm ảnh tham chiếu">{["01", "02", "03", "04"].map((step) => <span key={step}>{step}<i /></span>)}</div>
      </section>

      {fileMessage && <div className="notice" role="status"><span>{fileMessage}</span><button onClick={() => setFileMessage(undefined)} aria-label="Đóng thông báo"><X size={15} /></button></div>}

      <div className="input-grid">
        <UploadCard index="01" title="Người mẫu / Nhận diện" description="Dùng ảnh toàn thân, rõ mặt để giữ nguyên vóc dáng và tỷ lệ cơ thể. Có số đo thực tế thì nhập ở ghi chú; không suy đoán số đo từ ảnh." images={modelImage ? [modelImage] : []} onFiles={(files) => setSingle("model", files)} onRemove={() => { revoke(modelImage); setModelImage(undefined); }} />
        <UploadCard index="02" title="Sản phẩm / Trang phục" description="Giữ đúng thiết kế, màu sắc, chất liệu và từng chi tiết. Thêm ảnh trước, sau và bên để thấy đủ sản phẩm." images={products} multiple onFiles={addProducts} onRemove={(id) => setProducts((items) => { const target = items.find((item) => item.id === id); revoke(target); return items.filter((item) => item.id !== id); })} onReorder={(from, to) => setProducts((items) => { const next = [...items]; const [moved] = next.splice(from, 1); if (moved) next.splice(to, 0, moved); return next; })} />
        <UploadCard index="03" title="Bối cảnh" description="Bắt buộc có ảnh để giữ đúng không gian, đồ vật, bố cục và ánh sáng trong cả 4 ô. Không tự thay bối cảnh." images={background ? [background] : []} onFiles={(files) => setSingle("background", files)} onRemove={() => { revoke(background); setBackground(undefined); }} />
        <section className="upload-card notes-card" aria-labelledby="slot-04"><span className="watermark" aria-hidden>04</span><div className="card-heading"><div><h2 id="slot-04">04 — Ghi chú bổ sung</h2><p>Nhập số đo thực tế nếu có hoặc chi tiết cần chú ý. Luôn giữ nguyên cơ thể, sản phẩm, bối cảnh và thứ tự 4 pose.</p></div><span className="optional-label">Không bắt buộc</span></div><textarea value={notes} maxLength={3000} onChange={(e) => setNotes(e.target.value)} placeholder="Nhập số đo thực tế của người mẫu (nếu biết). Ví dụ ghi chú: không bóp eo, không kéo dài chân; giữ đúng logo, đường may và ánh sáng của bối cảnh." /><span className="character-count">{notes.length} / 3000</span></section>
      </div>

      <section className="generation-rail" aria-label="Cài đặt tạo prompt">
        <Control label="Mô hình"><div className="select-control"><Sparkles size={16} /><select aria-label="Mô hình Gemini" value={settings.modelId} onChange={(e) => setSettings({ ...settings, modelId: e.target.value })}>{modelOptions.map((model) => <option key={model.id} value={model.id}>{model.label}{model.recommended ? " · Đề xuất" : ""}</option>)}</select><ChevronDown size={15} /></div><button className="refresh-models" onClick={refreshModels} title="Làm mới danh sách mô hình" aria-label="Làm mới danh sách mô hình Gemini"><RefreshCw size={15} /></button></Control>
        <Control label="Tỷ lệ"><div className="select-control locked-control" aria-label="Tỷ lệ khung hình cố định"><span>9:16 · Cố định</span></div></Control>
        <Control label="Ngôn ngữ"><Select label="Ngôn ngữ đầu ra" value={settings.language} onChange={(value) => setSettings({ ...settings, language: value as AppSettings["language"] })} options={LANGUAGE_OPTIONS} /></Control>
        <Control label="Mức độ chi tiết"><Select label="Mức độ chi tiết của prompt" value={settings.detailLevel} onChange={(value) => setSettings({ ...settings, detailLevel: value as AppSettings["detailLevel"] })} options={DETAIL_OPTIONS} /></Control>
        <button className="generate-button" type="button" disabled={!canGenerate} onClick={handleGenerate}>{generating ? <LoaderCircle className="spin" size={20} /> : <Sparkles size={20} />}{generating ? PROGRESS_STAGES[progressStage] : "Tạo bộ prompt"}{!generating && <ArrowRight size={20} />}</button>
        <div className="privacy-line"><KeyRound size={14} /><span>Ảnh tham chiếu và lịch sử prompt được lưu cục bộ trên trình duyệt của bạn.</span></div>
      </section>

      {generating && <section className="progress-panel" aria-live="polite"><div className="progress-track"><i /></div><div><Clock3 size={18} /><span>{PROGRESS_STAGES[progressStage]}</span><button onClick={() => abortRef.current?.abort()}>Hủy</button></div></section>}

      {error && <section className="error-panel" role="alert"><div><h3>{error.status === 429 ? "Đã chạm giới hạn Gemini" : "Không thể hoàn tất quá trình tạo"}</h3><p>{error.message}</p>{error.technical && <details><summary>Chi tiết kỹ thuật</summary><pre>{error.technical}</pre></details>}</div><div>{error.status === 429 && <a href={RATE_LIMITS_URL} target="_blank" rel="noreferrer">Xem giới hạn <ExternalLink size={15} /></a>}<button onClick={handleGenerate}>Thử lại</button><button onClick={() => setError(undefined)} aria-label="Đóng lỗi"><X size={17} /></button></div></section>}

      {!result && !generating && <section className="empty-guide pose-guide"><h2>4 pose trong một ảnh dọc 9:16.</h2><ol>{DEFAULT_FASHION_POSES.map((pose) => <li key={pose.index}><strong>{String(pose.index).padStart(2, "0")} · {pose.title}</strong><span>{pose.poseSummary}</span></li>)}</ol><p>Lưới 2×2, đọc từ trái sang phải và từ trên xuống dưới. Mỗi ô dọc 9:16 chứa một pose; chỉ xuất một file ảnh tổng 9:16.</p></section>}
      {result && <PromptOutput result={result} onChange={handleResultChange} onRegenerate={handleRegenerate} regenerating={regenerating} />}
    </main>

    <ApiKeyDialog open={apiOpen} initialValue={apiKey} required={!apiKey} onClose={() => setApiOpen(false)} onSave={(key) => { localStorage.setItem(API_KEY_STORAGE, key); setApiKey(key); }} onClear={() => { localStorage.removeItem(API_KEY_STORAGE); setApiKey(""); }} />
    <HistoryDrawer open={historyOpen} items={history} onClose={() => setHistoryOpen(false)} onOpen={openHistory} onDelete={removeHistory} onClear={clearAllHistory} />
    <SettingsDialog open={settingsOpen} settings={settings} hasKey={Boolean(apiKey)} historyCount={history.length} onClose={() => setSettingsOpen(false)} onChange={setSettings} onManageKey={() => { setSettingsOpen(false); setApiOpen(true); }} onClearHistory={clearAllHistory} onClearAll={clearAllData} />
  </>;
}

function Control({ label, children }: { label: string; children: React.ReactNode }) { return <div className="control-group"><span>{label}</span><div className="control-inline">{children}</div></div>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <div className="select-control"><select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={15} /></div>; }
