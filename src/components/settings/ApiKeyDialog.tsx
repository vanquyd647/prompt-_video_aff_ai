"use client";

import { Check, Eye, EyeOff, KeyRound, LoaderCircle, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { testApiKey } from "@/lib/gemini/client";

interface ApiKeyDialogProps {
  open: boolean;
  initialValue: string;
  required?: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
  onClear: () => void;
}

export function ApiKeyDialog({ open, initialValue, required, onClose, onSave, onClear }: ApiKeyDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [visible, setVisible] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string }>();
  if (!open) return null;

  const test = async () => {
    setTesting(true); setMessage(undefined);
    try { const count = await testApiKey(value.trim()); setMessage({ type: "ok", text: `Kết nối thành công · ${count} model khả dụng` }); }
    catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể kiểm tra API key." }); }
    finally { setTesting(false); }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !required) onClose(); }}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="api-title" onSubmit={(event) => { event.preventDefault(); if (value.trim()) { onSave(value.trim()); onClose(); } }}>
        <div className="dialog-top">
          <span className="dialog-icon"><KeyRound size={22} /></span>
          {!required && <button className="icon-button" onClick={onClose} aria-label="Đóng"><X size={19} /></button>}
        </div>
        <h2 id="api-title">Kết nối Gemini API key</h2>
        <p>Fashion Prompt Builder gọi Gemini trực tiếp từ trình duyệt này. API key của bạn không bao giờ được gửi đến máy chủ ứng dụng.</p>
        <label className="field-label" htmlFor="gemini-key">Gemini API Key</label>
        <div className="secret-field">
          <input id="gemini-key" autoFocus type={visible ? "text" : "password"} value={value} onChange={(e) => { setValue(e.target.value); setMessage(undefined); }} placeholder="AIza…" autoComplete="off" />
          <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Ẩn API key" : "Hiện API key"}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        {message && <div className={`inline-message ${message.type}`} aria-live="polite">{message.type === "ok" && <Check size={16} />}{message.text}</div>}
        <div className="privacy-warning"><ShieldAlert size={18} /><span><strong>Được lưu cục bộ trong trình duyệt này.</strong> Bất kỳ ai có quyền truy cập hồ sơ trình duyệt đều có thể xem API key đã lưu.</span></div>
        <div className="dialog-actions">
          {initialValue && <button className="button ghost danger" type="button" onClick={() => { onClear(); setValue(""); }}>Xóa key</button>}
          <span className="dialog-spacer" />
          <button className="button secondary" type="button" disabled={!value.trim() || testing} onClick={test}>{testing && <LoaderCircle className="spin" size={16} />}Kiểm tra kết nối</button>
          <button className="button primary" type="submit" disabled={!value.trim()}>Lưu key</button>
        </div>
      </form>
    </div>
  );
}
