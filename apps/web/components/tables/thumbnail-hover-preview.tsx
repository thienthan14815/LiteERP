"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ImageIcon } from "lucide-react";

interface Props {
  href: string;
  thumbnailUrl?: string | null;
  alt: string;
  previewSize?: number;
}

export function ThumbnailHoverPreview({
  href,
  thumbnailUrl,
  alt,
  previewSize = 320,
}: Props) {
  const ref = React.useRef<HTMLAnchorElement | null>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const handleEnter = () => {
    if (!thumbnailUrl || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const spaceRight = window.innerWidth - rect.right;
    // Nếu bên phải không đủ chỗ, đẩy sang trái.
    const left =
      spaceRight >= previewSize + 16
        ? rect.right + 8
        : Math.max(8, rect.left - previewSize - 8);
    const top = Math.min(
      Math.max(8, rect.top - previewSize / 3),
      window.innerHeight - previewSize - 8,
    );
    setPos({ top, left });
  };
  const handleLeave = () => setPos(null);

  return (
    <>
      <Link
        ref={ref}
        href={href}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="block h-12 w-12 overflow-hidden rounded border bg-slate-50"
        title={thumbnailUrl ? "Rê chuột để xem to" : "Chưa có ảnh"}
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={alt}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
      </Link>
      {pos && thumbnailUrl && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[100] rounded-md border bg-white p-1 shadow-2xl"
              style={{ top: pos.top, left: pos.left, width: previewSize }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl.replace(/sz=w\d+/, "sz=w1200")}
                alt={alt}
                className="h-auto w-full rounded"
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
