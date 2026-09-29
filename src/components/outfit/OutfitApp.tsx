"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Box, Copy, Download, KeyRound, LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { ApiKeyDialog } from "@/components/settings/ApiKeyDialog";
import { generateOutfitPrompt } from "@/lib/gemini/client";
import { GEMINI_MODEL_OPTIONS } from "@/lib/gemini/models";
import { createUploadedImage } from "@/lib/images/processing";
import { OUTFIT_CATEGORIES, type OutfitCategory, type OutfitProduct } from "@/lib/prompts/outfit";
import { API_KEY_STORAGE, DEFAULT_SETTINGS, loadSettings } from "@/lib/storage/local-settings";
import type { AppSettings, UploadedImage } from "@/types";

export function OutfitApp() {
  const [bodies, setBodies] = useState<UploadedImage[]>([]);
  const [products, setProducts] = useState<OutfitProduct[]>([]);
  const [notes, setNotes] = useState("");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = useState("");
  const [apiOpen, setApiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const resources = useRef(new Set<string>());
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const uploadLock = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const urls = resources.current;
    queueMicrotask(() => {
      if (!mounted.current) return;
      setSettings(loadSettings());
      setApiKey(localStorage.getItem(API_KEY_STORAGE) ?? "");
    });
    return () => { mounted.current = false; abort.current?.abort(); urls.forEach((url) => URL.revokeObjectURL(url)); urls.clear(); };
  }, []);

  function invalidate() { setPrompt(""); setCopied(false); }

  async function upload(files: File[], kind: "body" | "product") {
    if (busy || uploadLock.current || !files.length) return;
    uploadLock.current = true;
    setUploading(true); setError("");
    const results = await Promise.allSettled(files.map(createUploadedImage));
    const images: UploadedImage[] = [];
    const failures: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const image = result.value;
        if (!mounted.current || !image.width || !image.height) {
          URL.revokeObjectURL(image.previewUrl);
          failures.push(`${files[index].name}: không đọc được ảnh.`);
        } else { resources.current.add(image.previewUrl); images.push(image); }
      } else failures.push(`${files[index].name}: ${result.reason instanceof Error ? result.reason.message : "Không tải được ảnh."}`);
    });
    uploadLock.current = false;
    if (!mounted.current) return;
    if (kind === "body") setBodies((current) => [...current, ...images]);
    else setProducts((current) => [...current, ...images.map((image) => ({ ...image, category: "" as const }))]);
    if (images.length) invalidate();
    setError(failures.join(" ")); setUploading(false);
  }

  function remove(image: UploadedImage, kind: "body" | "product") {
    URL.revokeObjectURL(image.previewUrl); resources.current.delete(image.previewUrl);
    if (kind === "body") setBodies((current) => current.filter(({ id }) => id !== image.id));
    else setProducts((current) => current.filter(({ id }) => id !== image.id));
    invalidate();
  }

  async function generate() {
    if (abort.current || uploadLock.current) return;
    if (!apiKey) { setApiOpen(true); return; }
    const controller = new AbortController(); abort.current = controller;
    setBusy(true); setError(""); invalidate();
    try { const result = await generateOutfitPrompt({ apiKey, bodies, products, notes, settings, signal: controller.signal }); if (mounted.current && !controller.signal.aborted) setPrompt(result); }
    catch (cause) { if (mounted.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tạo prompt."); }
    finally { abort.current = null; if (mounted.current) setBusy(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); }
    catch { setError("Không thể sao chép tự động. Hãy chọn nội dung prompt và sao chép thủ công."); }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([prompt], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "outfit-3d-front-side-back.txt"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <>
    <header className="app-header">
      <Link className="brand" href="/">Fashion Prompt Builder</Link>
      <nav aria-label="Điều hướng chính"><Link href="/">Tạo ảnh</Link><Link href="/outfit-3d" className="active" aria-current="page"><Box size={17} />Outfit 3D</Link><Link href="/video-prompt">Video Prompt</Link></nav>
      <button className="header-button" onClick={() => setApiOpen(true)}><KeyRound size={16} />API key</button>
    </header>
    <main className="outfit-page">
      <div className="outfit-intro"><span className="outfit-eyebrow">FASHION STUDIO / 3D OUTFIT</span><h1>Outfit trên ma-nơ-canh 3D</h1><p>Từ ảnh body và sản phẩm, tạo prompt cho một ảnh ngang với ba góc nhìn nhất quán.</p></div>
      <div className="outfit-layout-preview" aria-label="Bố cục đầu ra: một ảnh ngang 16:9, ba góc front, side, back">{["Front · Mặt trước", "Side · Mặt ngang", "Back · Mặt sau"].map((view, index) => <div key={view}><span>0{index + 1}</span><Box size={32} strokeWidth={1} /><strong>{view}</strong></div>)}</div>
      <p className="outfit-help">Một ảnh 16:9 · Toàn thân · Cùng body và outfit · Nền studio trung tính</p>
      <fieldset className="outfit-fields" disabled={busy || uploading}>
        <div className="outfit-columns">
          {(["body", "product"] as const).map((kind) => <section className="outfit-card" key={kind}>
            <h2>{kind === "body" ? "01 — Body mẫu" : "02 — Sản phẩm"}</h2>
            <p>{kind === "body" ? "Một hoặc nhiều góc chụp của cùng body. Chỉ lấy tỷ lệ và vóc dáng để dựng ma-nơ-canh." : "Thêm một hoặc nhiều ảnh. Chọn đúng loại sản phẩm cần lấy trong từng ảnh."}</p>
            <label className="outfit-upload">{uploading ? "Đang tải ảnh…" : "Chọn ảnh hoặc thêm nhiều ảnh"}<input type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label={kind === "body" ? "Ảnh body mẫu" : "Ảnh sản phẩm"} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void upload(files, kind); }} /></label>
            <small>JPG, PNG, WebP · Tối đa 15MB / ảnh</small>
            <div className="outfit-images">{(kind === "body" ? bodies : products).map((image, index) => <article className="outfit-image" key={image.id}>
              <div className="outfit-thumb"><Image src={image.previewUrl} alt={`${kind === "body" ? "Body" : "Sản phẩm"} ${index + 1}: ${image.file.name}`} fill unoptimized sizes="200px" /></div>
              <div className="outfit-image-title"><span title={image.file.name}>{index + 1}. {image.file.name}</span><button type="button" aria-label={`Xóa ${image.file.name}`} onClick={() => remove(image, kind)}><Trash2 size={16} /></button></div>
              {kind === "product" && <label>Loại sản phẩm<select aria-label={`Loại sản phẩm ảnh ${index + 1}`} value={products.find(({ id }) => id === image.id)?.category ?? ""} onChange={(event) => { const category = event.target.value as OutfitCategory; setProducts((current) => current.map((product) => product.id === image.id ? { ...product, category } : product)); invalidate(); }}><option value="" disabled>Chọn loại…</option>{Object.entries(OUTFIT_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
            </article>)}</div>
          </section>)}
        </div>
        <section className="outfit-card outfit-notes"><label htmlFor="outfit-notes">03 — Ghi chú thêm <span>(không bắt buộc)</span></label><textarea id="outfit-notes" rows={4} value={notes} onChange={(event) => { setNotes(event.target.value); invalidate(); }} placeholder="Ví dụ: sơ vin áo vào chân váy, giữ độ dài qua gối, ma-nơ-canh màu trắng mờ…" /></section>
        <div className="outfit-controls"><label>Model<select value={settings.modelId} onChange={(event) => { setSettings({ ...settings, modelId: event.target.value }); invalidate(); }}>{!GEMINI_MODEL_OPTIONS.some(({ id }) => id === settings.modelId) && <option value={settings.modelId}>{settings.modelId}</option>}{GEMINI_MODEL_OPTIONS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label><label>Ngôn ngữ prompt<select value={settings.language} onChange={(event) => { setSettings({ ...settings, language: event.target.value as AppSettings["language"] }); invalidate(); }}><option value="Vietnamese">Tiếng Việt</option><option value="English">Tiếng Anh</option><option value="Bilingual">Song ngữ</option></select></label><button className="generate-button" disabled={!bodies.length || !products.length || products.some(({ category }) => !category)} onClick={generate}>{busy ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}{busy ? "Đang phân tích outfit…" : "Tạo prompt outfit 3D"}</button></div>
      </fieldset>
      {busy && <button className="button secondary" onClick={() => abort.current?.abort()}>Hủy tạo prompt</button>}
      <p className="outfit-help" role="status">{busy ? "Gemini đang phân tích ảnh body, từng sản phẩm và ghi chú." : "Cần ít nhất 1 ảnh body, 1 ảnh sản phẩm và chọn loại cho mọi ảnh sản phẩm. Kết quả là prompt để dùng với công cụ tạo ảnh."}</p>
      {error && <div className="inline-message error" role="alert">{error}</div>}
      {prompt && <section className="outfit-card outfit-result"><div className="outfit-result-heading"><h2>Prompt outfit 3D · Front / Side / Back</h2><div><button className="button secondary" onClick={copy}><Copy size={16} />{copied ? "Đã sao chép" : "Sao chép"}</button><button className="button secondary" onClick={download}><Download size={16} />Tải .txt</button></div></div><p>Dùng prompt kèm các ảnh tham chiếu đã chọn theo thứ tự: body trước, sản phẩm sau.</p><textarea aria-label="Prompt outfit 3D" rows={16} value={prompt} onChange={(event) => { setPrompt(event.target.value); setCopied(false); }} /></section>}
    </main>
    {apiOpen && <ApiKeyDialog open initialValue={apiKey} onClose={() => setApiOpen(false)} onSave={(key) => { localStorage.setItem(API_KEY_STORAGE, key); setApiKey(key); }} onClear={() => { localStorage.removeItem(API_KEY_STORAGE); setApiKey(""); }} />}
  </>;
}
