"use client";

import { Copy, History, RotateCcw, Trash2, X } from "lucide-react";
import { formatAllPrompts } from "@/lib/prompts/quality";
import type { PromptHistoryItem } from "@/types";

interface HistoryDrawerProps {
  open: boolean;
  items: PromptHistoryItem[];
  onClose: () => void;
  onOpen: (item: PromptHistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export function HistoryDrawer({ open, items, onClose, onOpen, onDelete, onClear }: HistoryDrawerProps) {
  if (!open) return null;
  return <div className="drawer-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="history-title">
      <div className="drawer-header"><div><h2 id="history-title">Lịch sử trên thiết bị</h2><p>{items.length} bộ prompt đã lưu</p></div><button className="icon-button" onClick={onClose} aria-label="Đóng lịch sử"><X size={19} /></button></div>
      <div className="history-list">
        {items.length === 0 ? <div className="history-empty"><History size={30} strokeWidth={1.3} /><h3>Chưa có bộ prompt nào</h3><p>Các lần tạo thành công sẽ tự động xuất hiện tại đây.</p></div> : items.map((item) => <article className="history-item" key={item.id}>
          <div className="history-thumb-row">
            {item.references.model && <StoredThumb blob={item.references.model.blob} alt="Ảnh thu nhỏ người mẫu" />}
            {item.references.products.slice(0, 2).map((product) => <StoredThumb blob={product.blob} alt={product.name} key={product.id} />)}
          </div>
          <div className="history-meta"><span>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.updatedAt))}</span><span>{item.modelId}</span></div>
          <h3>{item.result.masterPrompt.title}</h3><p>{item.result.masterPrompt.prompt.slice(0, 150)}…</p>
          <div className="history-actions"><button onClick={() => onOpen(item)}><RotateCcw size={15} />Dùng lại</button><button onClick={() => navigator.clipboard.writeText(formatAllPrompts(item.result))}><Copy size={15} />Sao chép tất cả</button><button className="danger" onClick={() => onDelete(item.id)}><Trash2 size={15} />Xóa</button></div>
        </article>)}
      </div>
      {items.length > 0 && <button className="clear-history" onClick={onClear}>Xóa toàn bộ lịch sử</button>}
    </aside>
  </div>;
}

function StoredThumb({ blob, alt }: { blob: Blob; alt: string }) {
  const url = URL.createObjectURL(blob);
  return <img src={url} alt={alt} onLoad={() => URL.revokeObjectURL(url)} />; // eslint-disable-line @next/next/no-img-element
}
