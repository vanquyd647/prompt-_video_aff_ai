"use client";

import { ArrowUpDown, GripVertical, ImagePlus, Info, Plus, RotateCcw, Trash2, Upload, User, X } from "lucide-react";
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

export function UploadCard({
  index,
  title,
  description,
  images,
  multiple,
  optional,
  onFiles,
  onRemove,
  onReorder,
}: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptFiles = (list: FileList | null) => list && onFiles(Array.from(list));

  const isSingle = !multiple;
  const hasImages = images.length > 0;
  const singleImage = isSingle && hasImages ? images[0] : null;

  return (
    <section className="upload-card" aria-labelledby={`slot-${index}`}>
      <span className="watermark" aria-hidden>{index}</span>

      <div className="card-heading">
        <div>
          <h2 id={`slot-${index}`}>
            {index} — {title}
            <span className="card-info-icon" title={description} aria-label="Thông tin thêm">
              <Info size={14} />
            </span>
          </h2>
          <p>{description}</p>
        </div>

        <div className="card-actions-header">
          {optional && <span className="optional-label">Không bắt buộc</span>}
          {multiple && hasImages && (
            <button
              type="button"
              className="card-action-btn"
              title="Kéo các thẻ ảnh bên dưới để thay đổi thứ tự ưu tiên"
            >
              <ArrowUpDown size={13} />
              <span>Sắp xếp</span>
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        aria-label={`Chọn ảnh cho ${title.toLowerCase()}`}
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        onChange={(e) => { acceptFiles(e.target.files); e.target.value = ""; }}
      />

      {!hasImages ? (
        <button
          type="button"
          className={`drop-zone ${dragging ? "is-dragging" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); acceptFiles(e.dataTransfer.files); }}
        >
          {index === "01" ? (
            <User size={26} strokeWidth={1.5} />
          ) : optional ? (
            <ImagePlus size={26} strokeWidth={1.5} />
          ) : (
            <Upload size={26} strokeWidth={1.5} />
          )}
          <span>Kéo và thả {multiple ? "các ảnh" : "ảnh"} vào đây</span>
          <span className="browse-link">Chọn tệp</span>
          <small>JPG, PNG hoặc WebP · tối đa 15MB</small>
        </button>
      ) : isSingle && singleImage ? (
        /* Split view for single image (Model / Background) matching editorial concept */
        <div className="single-preview-container">
          <button
            type="button"
            className={`drop-zone ${dragging ? "is-dragging" : ""}`}
            style={{ margin: 0, width: "100%", minHeight: "154px" }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); acceptFiles(e.dataTransfer.files); }}
          >
            <RotateCcw size={22} strokeWidth={1.5} />
            <span>Kéo thả để thay ảnh</span>
            <span className="browse-link">Chọn ảnh mới</span>
            <small>{formatBytes(singleImage.file.size)}{singleImage.width ? ` · ${singleImage.width}×${singleImage.height}` : ""}</small>
          </button>

          <div className="single-preview-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={singleImage.previewUrl} alt={`Ảnh tham chiếu ${title.toLowerCase()}`} />
            <button
              className="preview-remove"
              type="button"
              aria-label={`Xóa ${singleImage.file.name}`}
              onClick={() => onRemove(singleImage.id)}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      ) : (
        /* Horizontal list/grid of outfit product cards matching concept */
        <div className="preview-grid is-multiple">
          {images.map((image, position) => (
            <article
              className="image-preview"
              key={image.id}
              draggable={multiple}
              onDragStart={(event) => event.dataTransfer.setData("text/plain", String(position))}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onReorder?.(Number(event.dataTransfer.getData("text/plain")), position)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.previewUrl} alt={`Bản xem trước ${title.toLowerCase()} ${position + 1}`} />
              <button
                className="preview-remove"
                type="button"
                aria-label={`Xóa ${image.file.name}`}
                onClick={() => onRemove(image.id)}
              >
                <X size={14} />
              </button>
              <div className="preview-meta">
                <GripVertical size={13} aria-hidden />
                <span>Ảnh {position + 1}</span>
                <small>{formatBytes(image.file.size)}</small>
              </div>
            </article>
          ))}

          <button
            type="button"
            className="add-more"
            onClick={() => inputRef.current?.click()}
            aria-label={`Thêm ảnh ${title.toLowerCase()}`}
          >
            <Plus size={24} strokeWidth={1.8} />
            <span>Thêm ảnh</span>
          </button>

          <span className="reorder-hint">
            Kéo để đổi thứ tự • JPG, PNG hoặc WebP tối đa 15MB mỗi ảnh
          </span>
        </div>
      )}
    </section>
  );
}
