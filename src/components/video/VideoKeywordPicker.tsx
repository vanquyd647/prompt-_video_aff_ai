"use client";

import { useState } from "react";
import { VIDEO_KEYWORDS, VIDEO_KEYWORD_SOURCE, keywordRestriction, resolveVideoKeyword, validateVideoKeywords } from "@/lib/prompts/video-keywords";
import type { VideoPromptMode } from "@/types";

const searchable = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

export function VideoKeywordPicker({ mode, selected, onChange, disabled }: {
  mode: VideoPromptMode; selected: string[]; onChange: (keys: string[]) => void; disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [error, setError] = useState("");

  function toggle(key: string) {
    const keyword = resolveVideoKeyword(key);
    if (!keyword) { setError("Không tìm thấy key hoặc tên gọi tương đương trong thư viện video."); return; }
    const next = selected.includes(keyword.key) ? selected.filter((item) => item !== keyword.key)
      : [...selected.filter((item) => keyword.role !== "concept" || resolveVideoKeyword(item)?.role !== "concept"), keyword.key];
    try { onChange(validateVideoKeywords(next, mode).map((item) => item.key)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể chọn key này."); }
  }

  const filtered = VIDEO_KEYWORDS.filter((keyword) => (showUnavailable || !keywordRestriction(keyword, mode)) && searchable([keyword.key, keyword.meaning_vi, keyword.prompt_hint_en, ...keyword.aliases].join(" ")).includes(searchable(search)));
  return <fieldset className="video-keyword-picker" disabled={disabled}>
    <legend>Concept & từ khóa video</legend>
    <p>Chọn 1 concept và tối đa 3 key kỹ thuật. Bỏ trống để AI chọn theo ảnh. Key được chuyển thành chỉ dẫn cụ thể trong prompt.</p>
    <div className="video-keyword-toolbar"><input aria-label="Tìm từ khóa video" placeholder="Tìm /fitcheck, /ootd, slow motion…" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); toggle(search); } }} /><button type="button" onClick={() => toggle(search)} disabled={!search.trim()}>Thêm key</button><button type="button" onClick={() => { onChange([]); setError(""); }} disabled={!selected.length}>AI tự chọn</button></div>
    <div className="video-keyword-selected" aria-live="polite">{selected.length ? selected.map((key) => <button key={key} type="button" aria-label={`Bỏ ${key}`} onClick={() => toggle(key)}>{key} ×</button>) : <span>AI sẽ chọn concept phù hợp và kỹ thuật cần thiết.</span>}</div>
    <label className="video-keyword-unavailable"><input type="checkbox" checked={showUnavailable} onChange={(event) => setShowUnavailable(event.target.checked)} />Hiện cả key không phù hợp với chế độ hiện tại</label>
    {error && <p className="video-keyword-error" role="alert">{error}</p>}
    <div className="video-keyword-library">{(["concept", "modifier"] as const).map((role) => <section key={role}><h3>{role === "concept" ? "Concept / Cách giới thiệu" : "Kỹ thuật / Chuyển động"}</h3><div className="video-keyword-grid">{filtered.filter((item) => item.role === role).map((keyword) => {
      const restriction = keywordRestriction(keyword, mode);
      return <button key={keyword.key} type="button" aria-pressed={selected.includes(keyword.key)} disabled={Boolean(restriction)} title={restriction ?? keyword.prompt_hint_en} onClick={() => toggle(keyword.key)}><strong>{keyword.key}</strong><span>{keyword.meaning_vi}</span>{restriction && <small>{restriction}</small>}</button>;
    })}</div></section>)}</div>
    {!filtered.length && <p>Không có key phù hợp với tìm kiếm này.</p>}
    <small>Nguồn: {VIDEO_KEYWORD_SOURCE.name} v{VIDEO_KEYWORD_SOURCE.version} · {VIDEO_KEYWORD_SOURCE.count} key gốc, lọc cho video thời trang.</small>
  </fieldset>;
}
