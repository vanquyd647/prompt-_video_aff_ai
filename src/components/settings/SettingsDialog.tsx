"use client";

import { Database, ExternalLink, KeyRound, Trash2, X } from "lucide-react";
import { RATE_LIMITS_URL } from "@/lib/gemini/models";
import type { AppSettings } from "@/types";

interface SettingsDialogProps {
  open: boolean; settings: AppSettings; hasKey: boolean; historyCount: number;
  onClose: () => void; onChange: (settings: AppSettings) => void; onManageKey: () => void; onClearHistory: () => void; onClearAll: () => void;
}

export function SettingsDialog(props: SettingsDialogProps) {
  if (!props.open) return null;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
    <section className="dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="dialog-top"><h2 id="settings-title">Cài đặt</h2><button className="icon-button" onClick={props.onClose} aria-label="Đóng"><X size={19} /></button></div>
      <div className="settings-section"><h3>Gemini</h3><div className="settings-row"><div><span>API key</span><small>{props.hasKey ? "Đã lưu cục bộ trong trình duyệt" : "Chưa kết nối"}</small></div><button className="button secondary" onClick={props.onManageKey}><KeyRound size={16} />Quản lý key</button></div><a href={RATE_LIMITS_URL} target="_blank" rel="noreferrer" className="settings-link">Mở trang giới hạn của AI Studio <ExternalLink size={15} /></a></div>
      <div className="settings-section"><h3>Mặc định</h3><label className="switch-row"><div><span>Tự động lưu kết quả</span><small>Lưu prompt và dữ liệu ảnh đã chọn vào IndexedDB.</small></div><input type="checkbox" aria-label="Tự động lưu kết quả" checked={props.settings.autosave} onChange={(e) => props.onChange({ ...props.settings, autosave: e.target.checked })} /></label></div>
      <div className="settings-section"><h3>Dữ liệu trên thiết bị</h3><div className="storage-summary"><Database size={19} /><span><strong>{props.historyCount}</strong> bộ prompt trong lịch sử</span></div><div className="danger-actions"><button onClick={props.onClearHistory}><Trash2 size={15} />Xóa lịch sử</button><button onClick={props.onClearAll}><Trash2 size={15} />Xóa toàn bộ dữ liệu</button></div></div>
    </section>
  </div>;
}
