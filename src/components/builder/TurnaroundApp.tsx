"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Download, Film, History, KeyRound, LoaderCircle, Plus, Sparkles, Trash2, X } from "lucide-react";
import { ApiKeyDialog } from "@/components/settings/ApiKeyDialog";
import { UploadCard } from "./UploadCard";
import { generateTurnaroundImage } from "@/lib/gemini/client";
import { createUploadedImage, fromStoredImage, toStoredImage } from "@/lib/images/processing";
import { API_KEY_STORAGE } from "@/lib/storage/local-settings";
import { deleteTurnaround, getTurnarounds, saveTurnaround, type TurnaroundHistoryItem } from "@/lib/storage/turnaround-history";
import { MAX_TURNAROUND_BYTES, MAX_TURNAROUND_REFERENCES, TURNAROUND_MODELS, TURNAROUND_VIEWS } from "@/lib/prompts/turnaround";
import { createId } from "@/lib/utils/id";
import type { UploadedImage } from "@/types";

type References = { character: UploadedImage[]; products: UploadedImage[]; background: UploadedImage[] };
const EMPTY_REFERENCES: References = { character: [], products: [], background: [] };
type Result = { url: string; mimeType: string; text: string; id: string };

export function TurnaroundApp() {
  const [ready, setReady] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiOpen, setApiOpen] = useState(false);
  const [references, setReferences] = useState<References>(EMPTY_REFERENCES);
  const [notes, setNotes] = useState("");
  const [modelId, setModelId] = useState<string>(TURNAROUND_MODELS[0].id);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<TurnaroundHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [autosave, setAutosave] = useState(true);
  const active = useRef(false);
  const uploadLock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const urls = useRef(new Set<string>());
  const resultUrl = useRef<string | null>(null);

  useEffect(() => {
    active.current = true;
    const resources = urls.current;
    queueMicrotask(() => {
      if (!active.current) return;
      try { setApiKey(localStorage.getItem(API_KEY_STORAGE) ?? ""); }
      catch { setNotice("Trình duyệt không cho đọc API key đã lưu. Bạn có thể nhập key để dùng trong phiên này."); }
      setHistoryOpen(window.location.hash === "#history");
      setReady(true);
    });
    getTurnarounds().then((items) => { if (active.current) setHistory(items); }).catch(() => { if (active.current) setNotice("Không thể đọc lịch sử ảnh trên trình duyệt này."); });
    return () => { active.current = false; controller.current?.abort(); resources.forEach((url) => URL.revokeObjectURL(url)); resources.clear(); };
  }, []);

  function release(url: string) { URL.revokeObjectURL(url); urls.current.delete(url); }
  function clearResult() {
    if (resultUrl.current) release(resultUrl.current);
    resultUrl.current = null;
    setResult(undefined);
  }
  function showResult(item: Pick<TurnaroundHistoryItem, "id" | "image" | "text">) {
    clearResult();
    const url = URL.createObjectURL(item.image); urls.current.add(url); resultUrl.current = url;
    setResult({ url, mimeType: item.image.type, text: item.text, id: item.id });
  }

  async function upload(slot: keyof References, files: File[]) {
    if (!files.length || uploadLock.current || controller.current) return;
    uploadLock.current = true; setUploading(true); setError("");
    const incoming = slot === "background" ? files.slice(0, 1) : files;
    const existing = Object.entries(references).flatMap(([key, images]) => key === "background" && slot === "background" ? [] : images);
    if (existing.length + incoming.length > MAX_TURNAROUND_REFERENCES || [...existing.map(({ file }) => file), ...incoming].reduce((sum, file) => sum + file.size, 0) > MAX_TURNAROUND_BYTES) {
      setError("Tối đa 14 ảnh tham chiếu với tổng dung lượng 14MB. Hãy giảm số ảnh hoặc dung lượng.");
      uploadLock.current = false; setUploading(false); return;
    }
    const outcomes = await Promise.allSettled(incoming.map(createUploadedImage));
    const added: UploadedImage[] = [];
    const failures: string[] = [];
    outcomes.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") {
        const image = outcome.value;
        if (!active.current || !image.width || !image.height) { URL.revokeObjectURL(image.previewUrl); failures.push(`${incoming[index].name}: không đọc được ảnh.`); }
        else { urls.current.add(image.previewUrl); added.push(image); }
      } else failures.push(`${incoming[index].name}: ${outcome.reason instanceof Error ? outcome.reason.message : "Không tải được ảnh."}`);
    });
    uploadLock.current = false;
    if (!active.current) return;
    if (added.length) {
      if (slot === "background") references.background.forEach(({ previewUrl }) => release(previewUrl));
      setReferences((current) => ({ ...current, [slot]: slot === "background" ? added : [...current[slot], ...added] }));
      clearResult();
    }
    setError(failures.join(" ")); setUploading(false);
  }

  function remove(slot: keyof References, id: string) {
    const image = references[slot].find((image) => image.id === id);
    if (image) release(image.previewUrl);
    setReferences((current) => ({ ...current, [slot]: current[slot].filter((image) => image.id !== id) })); clearResult();
  }
  function reorder(slot: keyof References, from: number, to: number) {
    if (!Number.isInteger(from) || !references[slot][from] || !references[slot][to] || from === to) return;
    const ordered = [...references[slot]];
    ordered.splice(to, 0, ordered.splice(from, 1)[0]);
    setReferences({ ...references, [slot]: ordered }); clearResult();
  }
  function reset() {
    Object.values(references).flat().forEach(({ previewUrl }) => release(previewUrl));
    setReferences(EMPTY_REFERENCES); setNotes(""); setError(""); setNotice(""); clearResult();
  }

  async function generate() {
    if (controller.current || uploadLock.current || !references.character.length) return;
    if (!apiKey) { setApiOpen(true); return; }
    const request = new AbortController(); controller.current = request;
    setGenerating(true); setError(""); setNotice("");
    try {
      const output = await generateTurnaroundImage({ apiKey, modelId, references: references.character, products: references.products, background: references.background[0], notes, signal: request.signal });
      // Validate the returned bytes before offering an image download.
      const bitmap = await createImageBitmap(output.image); bitmap.close();
      if (!active.current || request.signal.aborted) return;
      const item: TurnaroundHistoryItem = { id: createId(), createdAt: new Date().toISOString(), modelId, ...output, notes, references: references.character.map(toStoredImage), products: references.products.map(toStoredImage), background: references.background[0] ? toStoredImage(references.background[0]) : undefined };
      showResult(item);
      if (autosave) {
        try { await saveTurnaround(item); if (active.current) setHistory((current) => [item, ...current]); }
        catch { if (active.current) setNotice("Ảnh đã tạo thành công nhưng không lưu được lịch sử. Bạn vẫn có thể tải ảnh xuống."); }
      }
    } catch (cause) {
      if (active.current) {
        if (request.signal.aborted) setNotice("Đã hủy yêu cầu tạo ảnh.");
        else setError(cause instanceof Error ? cause.message : "Không thể tạo ảnh. Hãy thử lại.");
      }
    } finally { controller.current = null; if (active.current) setGenerating(false); }
  }

  function restore(item: TurnaroundHistoryItem) {
    reset();
    const restored = { character: item.references.map(fromStoredImage), products: item.products.map(fromStoredImage), background: item.background ? [fromStoredImage(item.background)] : [] };
    Object.values(restored).flat().forEach(({ previewUrl }) => urls.current.add(previewUrl));
    setReferences(restored); setNotes(item.notes); setModelId(item.modelId); showResult(item); setHistoryOpen(false);
  }
  async function deleteItem(id: string) {
    try { await deleteTurnaround(id); if (active.current) setHistory((current) => current.filter((item) => item.id !== id)); }
    catch { setError("Không thể xóa ảnh khỏi lịch sử. Hãy thử lại."); }
  }

  if (!ready) return <main className="boot"><LoaderCircle className="spin" /><span>Đang mở không gian tạo ảnh…</span></main>;
  const locked = generating || uploading;
  const extension = result?.mimeType === "image/jpeg" ? "jpg" : result?.mimeType === "image/webp" ? "webp" : "png";

  return <>
    <header className="app-header turnaround-header">
      <Link className="brand" href="/">Fashion Prompt Builder</Link>
      <nav aria-label="Điều hướng chính"><button disabled={locked} onClick={reset}><Plus size={17} />Tạo mới</button><Link href="/outfit-3d">Outfit 3D</Link><Link href="/video-prompt"><Film size={17} />Video Prompt</Link><button disabled={locked} onClick={() => setHistoryOpen(!historyOpen)}><History size={17} />Lịch sử ảnh <span className="nav-count">{history.length}</span></button></nav>
      <div className="header-actions"><button className="header-button" disabled={generating} onClick={() => setApiOpen(true)}><KeyRound size={17} />{apiKey ? "API key" : "Kết nối Gemini"}</button></div>
    </header>
    <main className="app-main" id="top">
      <section className="intro"><div><h1>Tạo câu chuyện thời trang nhất quán</h1><p>Tạo trực tiếp một ảnh Character Turnaround Sheet chân thực: cùng một nhân vật trong 5 góc nhìn, lấy ảnh tham chiếu gốc làm chuẩn cho khuôn mặt, vóc dáng và trang phục.</p></div></section>
      <section className="turnaround-views" aria-label="Năm góc nhìn cố định">{TURNAROUND_VIEWS.map((view, index) => <div key={view}><span>0{index + 1}</span><strong>{view}</strong><small>{["Chính diện · 0°", "Trước ba phần tư · 45°", "Ngang tuyệt đối · 90°", "Sau chính diện · 180°", "Sau ba phần tư · 135°"][index]}</small></div>)}</section>
      <p className="turnaround-caption">Một ảnh ngang 16:9 · 2K · 5 góc toàn thân · Đồng nhất nhân vật</p>
      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Đóng thông báo"><X size={16} /></button></div>}
      {error && <section className="error-panel" role="alert"><p>{error}</p><button onClick={() => setError("")} aria-label="Đóng lỗi"><X size={17} /></button></section>}
      {historyOpen && <section className="turnaround-history" id="history"><div className="turnaround-result-heading"><h2>Lịch sử ảnh trên thiết bị</h2><button className="button secondary" onClick={() => setHistoryOpen(false)}>Đóng</button></div><Link href="/prompt-history#history">Mở lịch sử bộ prompt cũ</Link>{!history.length && <p>Chưa có ảnh đã lưu. Ảnh tạo thành công sẽ xuất hiện tại đây khi bật tự động lưu.</p>}<div>{history.map((item) => <article key={item.id}><strong>{new Date(item.createdAt).toLocaleString("vi-VN")}</strong><span>{item.modelId}</span><button className="button secondary" disabled={locked} onClick={() => restore(item)}>Mở ảnh / dùng lại</button><button className="icon-button" disabled={locked} aria-label={`Xóa ảnh ${item.id}`} onClick={() => deleteItem(item.id)}><Trash2 size={16} /></button></article>)}</div></section>}
      <fieldset className="turnaround-inputs" disabled={locked}>
        <legend className="sr-only">Ảnh tham chiếu và cài đặt tạo ảnh</legend>
        <div className="input-grid">
          <UploadCard index="01" title="Ảnh gốc / Nhân vật" description="Một hoặc nhiều ảnh của cùng nhân vật. Ưu tiên ảnh toàn thân rõ mặt; thêm góc ngang và sau để giữ đúng chi tiết." images={references.character} multiple onFiles={(files) => upload("character", files)} onRemove={(id) => remove("character", id)} onReorder={(from, to) => reorder("character", from, to)} />
          <UploadCard index="02" title="Sản phẩm / Trang phục" description="Thêm khi cần mặc sản phẩm tham chiếu. Nếu bỏ trống, giữ nguyên outfit trong ảnh gốc." images={references.products} multiple optional onFiles={(files) => upload("products", files)} onRemove={(id) => remove("products", id)} onReorder={(from, to) => reorder("products", from, to)} />
          <UploadCard index="03" title="Bối cảnh" description="Dùng bối cảnh và ánh sáng tham chiếu cho cả 5 góc. Nếu bỏ trống, dùng nền studio trung tính." images={references.background} optional onFiles={(files) => upload("background", files)} onRemove={(id) => remove("background", id)} />
          <section className="upload-card notes-card"><div className="card-heading"><div><h2><label htmlFor="turnaround-notes">04 — Ghi chú bổ sung</label></h2><p>Chi tiết cần giữ đúng. Không thay đổi nhận diện nhân vật hoặc thứ tự 5 góc nhìn.</p></div></div><textarea id="turnaround-notes" value={notes} maxLength={3000} onChange={(event) => { setNotes(event.target.value); clearResult(); }} placeholder="Ví dụ: giữ nguyên tóc, logo áo, độ dài chân váy; không bóp eo hoặc kéo dài chân…" /><span className="character-count">{notes.length} / 3000</span></section>
        </div>
        <div className="turnaround-controls"><label>Model tạo ảnh<select aria-label="Model tạo ảnh" value={modelId} onChange={(event) => { setModelId(event.target.value); clearResult(); }}>{TURNAROUND_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label><label className="turnaround-autosave"><input type="checkbox" checked={autosave} onChange={(event) => setAutosave(event.target.checked)} />Tự động lưu ảnh và tham chiếu trên thiết bị</label><button className="generate-button" disabled={!references.character.length} onClick={generate}>{generating ? <LoaderCircle className="spin" size={20} /> : <Sparkles size={20} />}{generating ? "Đang tạo ảnh 5 góc…" : "Tạo ảnh 5 góc"}<ArrowRight size={20} /></button></div>
      </fieldset>
      <p className="turnaround-caption">{uploading ? "Đang đọc ảnh tham chiếu…" : "Tối đa 14 ảnh, tổng dung lượng 14MB. Ảnh được gửi đến Gemini khi bạn nhấn Tạo ảnh."}</p>
      {generating && <section className="progress-panel" aria-live="polite"><div className="progress-track"><i /></div><div><LoaderCircle className="spin" size={18} /><span>Gemini đang dựng Character Turnaround Sheet từ ảnh gốc…</span><button onClick={() => controller.current?.abort()}>Hủy</button></div></section>}
      {result ? <section className="turnaround-result" id="results"><div className="turnaround-result-heading"><div><h2>Ảnh Character Turnaround Sheet</h2><p>FRONT · 3/4 FRONT · STRICT SIDE · BACK · 3/4 BACK</p></div><div><button className="button secondary" disabled={locked} onClick={generate}>Tạo lại ảnh</button><a className="button primary" href={result.url} download={`character-turnaround-${result.id}.${extension}`}><Download size={17} />Tải ảnh</a></div></div><Image src={result.url} alt="Character Turnaround Sheet: cùng nhân vật qua 5 góc nhìn" width={2048} height={1152} unoptimized className="turnaround-output-image" />{result.text && <details><summary>Ghi chú từ Gemini</summary><p>{result.text}</p></details>}</section> : !generating && <section className="empty-guide"><h2>Ảnh gốc là chuẩn. Năm góc nhìn, cùng một nhân vật.</h2><p>Thêm ảnh nhân vật để bắt đầu. Kết quả sẽ là một ảnh hoàn chỉnh để xem và tải xuống ngay tại đây.</p></section>}
    </main>
    {apiOpen && <ApiKeyDialog open initialValue={apiKey} onClose={() => setApiOpen(false)} onSave={(key) => { setApiKey(key); try { localStorage.setItem(API_KEY_STORAGE, key); } catch { setNotice("API key chỉ được giữ cho phiên hiện tại vì trình duyệt không cho lưu."); } }} onClear={() => { setApiKey(""); try { localStorage.removeItem(API_KEY_STORAGE); } catch { setNotice("Không thể xóa key đã lưu trong trình duyệt."); } }} />}
  </>;
}
