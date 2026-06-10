"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";

export interface UploadedAssetItem {
  assetId: string;
  fileName: string;
  status: "idle" | "uploading" | "uploaded" | "failed";
  error?: string | null;
}

interface UploadPanelProps {
  assets: UploadedAssetItem[];
  onUploaded: (asset: UploadedAssetItem) => void;
}

function humanReadableUploadError(error: string) {
  switch (error) {
    case "file_too_large":
      return "文件过大";
    case "unsupported_file_type":
      return "文件类型不支持";
    case "unauthorized":
      return "登录状态失效";
    default:
      return "上传失败";
  }
}

export function UploadPanel({ assets, onUploaded }: UploadPanelProps) {
  const [isUploading, setIsUploading] = useState(false);
  const accept = useMemo(() => "image/png,image/jpeg,image/webp", []);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setIsUploading(true);

    for (const file of files) {
      try {
        const presignResponse = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
            fileSize: file.size,
          }),
        });
        const presignBody = await presignResponse.json();

        if (!presignResponse.ok) {
          onUploaded({
            assetId: crypto.randomUUID(),
            fileName: file.name,
            status: "failed",
            error: humanReadableUploadError(presignBody.error),
          });
          continue;
        }

        await fetch(presignBody.uploadUrl, {
          method: "PUT",
          headers: presignBody.headers,
          body: file,
        });

        onUploaded({
          assetId: presignBody.assetId,
          fileName: file.name,
          status: "uploaded",
        });
      } catch {
        onUploaded({
          assetId: crypto.randomUUID(),
          fileName: file.name,
          status: "failed",
          error: "上传失败",
        });
      }
    }

    setIsUploading(false);
    event.target.value = "";
  }

  return (
    <section className="space-y-4">
      <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[var(--line)] bg-white px-6 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--accent)]">
          <Upload aria-hidden="true" size={20} />
        </div>
        <p className="mt-4 text-sm font-medium">上传正面图、背面图、细节图</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
          先上传至少一张正面图。系统会根据素材完整度推荐可用模板。
        </p>
        <span className="mt-4 inline-flex h-10 items-center rounded-md border border-[var(--line)] px-4 text-sm font-medium">
          {isUploading ? "上传中..." : "选择图片"}
        </span>
        <input
          accept={accept}
          className="sr-only"
          multiple
          onChange={handleFileChange}
          type="file"
        />
      </label>

      <div className="space-y-2">
        {assets.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">尚未上传素材。</p>
        ) : (
          assets.map((asset) => (
            <div
              className="flex items-center justify-between rounded-md border border-[var(--line)] bg-white px-4 py-3"
              key={`${asset.assetId}-${asset.fileName}`}
            >
              <div>
                <p className="text-sm font-medium">{asset.fileName}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {asset.status === "uploaded"
                    ? "已上传"
                    : asset.status === "failed"
                      ? asset.error ?? "上传失败"
                      : "待上传"}
                </p>
              </div>
              <span className="text-xs text-[var(--muted)]">
                {asset.status === "uploaded" ? "Ready" : asset.status}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
