"use client";

import { ImagePlus, GripVertical, RotateCcw, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { formatBytes } from "@/lib/images/processing";
import type { UploadedImage } from "@/types";

interface UploadCardProps {
  index: string;
  title: string;
  description: string;
  images: UploadedImage[];
  multiple?: boolean;
  optional?: boolean;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onReorder?: (from: number, to: number) => void;
}

export function UploadCard({ index, title, description, images, multiple, optional, onFiles, onRemove, onReorder }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptFiles = (list: FileList | null) => list && onFiles(Array.from(list));
  return (
    <section className="upload-card" aria-labelledby={`slot-${index}`}>
      <span className="watermark" aria-hidden>{index}</span>
      <div className="card-heading">
        <div>
          <h2 id={`slot-${index}`}>{index} — {title}</h2>
          <p>{description}</p>
        </div>
        {optional && <span className="optional-label">Không bắt buộc</span>}
      </div>

      <input ref={inputRef} className="sr-only" type="file" aria-label={`Chọn ảnh cho ${title.toLowerCase()}`} accept="image/jpeg,image/png,image/webp" multiple={multiple} onChange={(e) => acceptFiles(e.target.files)} />
      {images.length === 0 ? (
        <button
          type="button"
          className={`drop-zone ${dragging ? "is-dragging" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); acceptFiles(e.dataTransfer.files); }}
        >
          {optional ? <ImagePlus size={24} strokeWidth={1.5} /> : <Upload size={24} strokeWidth={1.5} />}
          <span>Kéo và thả {multiple ? "các ảnh" : "ảnh"} vào đây</span>
          <span className="browse-link">Chọn tệp</span>
          <small>JPEG, PNG hoặc WebP · tối đa 15MB</small>
        </button>
      ) : (
        <div className={`preview-grid ${multiple ? "is-multiple" : ""}`}>
          {images.map((image, position) => (
            <article className="image-preview" key={image.id} draggable={multiple} onDragStart={(event) => event.dataTransfer.setData("text/plain", String(position))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onReorder?.(Number(event.dataTransfer.getData("text/plain")), position)}>
              {/* Browser-created object URLs are the correct local preview source here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.previewUrl} alt={`Bản xem trước ${title.toLowerCase()} ${position + 1}`} />
              <button className="preview-remove" type="button" aria-label={`Xóa ${image.file.name}`} onClick={() => onRemove(image.id)}><Trash2 size={15} /></button>
              <div className="preview-meta">
                {multiple && <GripVertical size={14} aria-hidden />}
                <span>{multiple ? `Ảnh sản phẩm ${position + 1}` : image.file.name}</span>
                <small>{formatBytes(image.file.size)}{image.width ? ` · ${image.width}×${image.height}` : ""}</small>
              </div>
            </article>
          ))}
          <button type="button" className="add-more" onClick={() => inputRef.current?.click()}>
            {multiple ? <><ImagePlus size={22} /><span>Thêm ảnh</span></> : <><RotateCcw size={20} /><span>Thay ảnh</span></>}
          </button>
        </div>
      )}
    </section>
  );
}
