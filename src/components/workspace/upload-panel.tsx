"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, RotateCcw, X } from "lucide-react";
import Image from "next/image";

export type UploadSlotRole = "front" | "back" | "side" | "detail" | "scene";

export interface UploadedAssetItem {
  assetId: string;
  fileName: string;
  intendedRole: UploadSlotRole;
  status: "idle" | "uploading" | "uploaded" | "failed";
  error?: string | null;
  previewUrl?: string | null;
}

interface UploadPanelProps {
  assets: UploadedAssetItem[];
  onUploaded: (asset: UploadedAssetItem) => void;
  onRemoveUploaded: (assetId: string) => void;
  onUploadingChange: (uploading: boolean) => void;
}

interface SlotConfig {
  role: UploadSlotRole;
  label: string;
  required: boolean;
  hint: string;
}

const uploadSlots: SlotConfig[] = [
  {
    role: "front",
    label: "正面图",
    required: true,
    hint: "必传，决定基础模板",
  },
  {
    role: "back",
    label: "背面图",
    required: false,
    hint: "开放背面展示",
  },
  {
    role: "detail",
    label: "细节图",
    required: false,
    hint: "开放细节特写",
  },
  {
    role: "side",
    label: "侧面图",
    required: false,
    hint: "辅助多角度",
  },
  {
    role: "scene",
    label: "场景图",
    required: false,
    hint: "辅助氛围参考",
  },
];

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

interface SelectedSlotFile {
  fileName: string;
  previewUrl: string;
}

export function UploadPanel({
  assets,
  onRemoveUploaded,
  onUploaded,
  onUploadingChange,
}: UploadPanelProps) {
  const [slotFiles, setSlotFiles] = useState<
    Partial<Record<UploadSlotRole, SelectedSlotFile>>
  >({});
  const [uploadingRoles, setUploadingRoles] = useState<Set<UploadSlotRole>>(
    () => new Set(),
  );
  const uploadTokens = useRef<Partial<Record<UploadSlotRole, number>>>({});
  const accept = useMemo(() => "image/png,image/jpeg,image/webp", []);
  const uploadedByRole = useMemo(
    () =>
      new Map(
        assets
          .filter((asset) => asset.status === "uploaded")
          .map((asset) => [asset.intendedRole, asset]),
      ),
    [assets],
  );
  const failedByRole = useMemo(
    () =>
      new Map(
        assets
          .filter((asset) => asset.status === "failed")
          .map((asset) => [asset.intendedRole, asset]),
      ),
    [assets],
  );

  useEffect(() => {
    onUploadingChange(uploadingRoles.size > 0);
  }, [onUploadingChange, uploadingRoles.size]);

  function setRoleUploading(role: UploadSlotRole, uploading: boolean) {
    setUploadingRoles((current) => {
      const next = new Set(current);
      if (uploading) {
        next.add(role);
      } else {
        next.delete(role);
      }
      return next;
    });
  }

  function nextUploadToken(role: UploadSlotRole) {
    const next = (uploadTokens.current[role] ?? 0) + 1;
    uploadTokens.current[role] = next;
    return next;
  }

  function handleSlotFileChange(
    role: UploadSlotRole,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const currentToken = nextUploadToken(role);
    const previewUrl = URL.createObjectURL(file);

    setSlotFiles((current) => {
      const existing = current[role];
      if (existing?.previewUrl) {
        URL.revokeObjectURL(existing.previewUrl);
      }
      return {
        ...current,
        [role]: {
          fileName: file.name,
          previewUrl,
        },
      };
    });
    void uploadRole(role, file, previewUrl, currentToken);
  }

  async function uploadRole(
    role: UploadSlotRole,
    file: File,
    previewUrl: string,
    token: number,
  ) {
    setRoleUploading(role, true);
    try {
      const presignResponse = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [
            {
              fileName: file.name,
              mimeType: file.type,
              fileSize: file.size,
              intendedRole: role,
            },
          ],
        }),
      });
      const presignBody = await presignResponse.json();

      if (!presignResponse.ok || !Array.isArray(presignBody.files)) {
        if (uploadTokens.current[role] === token) {
          onUploaded({
            assetId: crypto.randomUUID(),
            fileName: file.name,
            intendedRole: role,
            status: "failed",
            error: humanReadableUploadError(presignBody.error),
            previewUrl,
          });
        }
        return;
      }

      const signed = presignBody.files[0];
      const uploadResponse = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: signed.headers,
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error("upload_failed");
      }
      const completeResponse = await fetch("/api/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: signed.assetId }),
      });
      if (!completeResponse.ok) {
        throw new Error("complete_failed");
      }
      if (uploadTokens.current[role] === token) {
        onUploaded({
          assetId: signed.assetId,
          fileName: file.name,
          intendedRole: role,
          status: "uploaded",
          previewUrl,
        });
      }
    } catch {
      if (uploadTokens.current[role] === token) {
        onUploaded({
          assetId: crypto.randomUUID(),
          fileName: file.name,
          intendedRole: role,
          status: "failed",
          error: "上传失败",
          previewUrl,
        });
      }
    } finally {
      if (uploadTokens.current[role] === token) {
        setRoleUploading(role, false);
      }
    }
  }

  function removeSlot(role: UploadSlotRole) {
    nextUploadToken(role);
    setRoleUploading(role, false);
    setSlotFiles((current) => {
      const existing = current[role];
      if (existing?.previewUrl) {
        URL.revokeObjectURL(existing.previewUrl);
      }
      const next = { ...current };
      delete next[role];
      return next;
    });

    const existingAsset = uploadedByRole.get(role) ?? failedByRole.get(role);
    if (existingAsset) {
      if (existingAsset.previewUrl) {
        URL.revokeObjectURL(existingAsset.previewUrl);
      }
      onRemoveUploaded(existingAsset.assetId);
    }
  }

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-2">
        {uploadSlots.map((slot) => {
          const uploaded = uploadedByRole.get(slot.role);
          const failed = failedByRole.get(slot.role);
          const selected = slotFiles[slot.role];
          const uploading = uploadingRoles.has(slot.role);
          const previewUrl = selected?.previewUrl ?? uploaded?.previewUrl ?? failed?.previewUrl;
          const fileName = selected?.fileName ?? uploaded?.fileName ?? failed?.fileName;
          const hasImage = Boolean(previewUrl);

          return (
            <div
              className="relative flex min-h-40 min-w-0 flex-col rounded-lg border border-dashed border-[var(--line)] bg-white p-4 transition hover:border-[var(--accent)]"
              key={slot.role}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {slot.label}
                    {slot.required ? " *" : ""}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{slot.hint}</p>
                </div>
                {fileName ? (
                  <button
                    aria-label={`删除${slot.label}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--muted)] transition hover:border-red-200 hover:text-red-600"
                    onClick={() => removeSlot(slot.role)}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface)] text-[var(--accent)]">
                    {failed ? <RotateCcw size={16} /> : <ImagePlus size={16} />}
                  </div>
                )}
              </div>
              <label
                className="mt-3 flex min-h-24 cursor-pointer flex-col justify-center rounded-md bg-[var(--surface)] text-xs text-[var(--muted)]"
                htmlFor={`upload-slot-${slot.role}`}
              >
                {hasImage && previewUrl ? (
                  <Image
                    alt={`${slot.label}预览`}
                    className="aspect-[4/3] w-full rounded-md object-cover"
                    height={180}
                    src={previewUrl}
                    unoptimized
                    width={240}
                  />
                ) : (
                  <span className="px-3">选择图片</span>
                )}
              </label>
              <div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-xs">
                <p
                  className="min-w-0 flex-1 truncate text-[var(--muted)]"
                  title={fileName ?? undefined}
                >
                  {fileName ?? failed?.error ?? "未选择文件"}
                </p>
                <span className="shrink-0 text-[var(--muted)]">
                  {uploading ? "上传中" : uploaded ? "已上传" : failed ? "失败" : ""}
                </span>
              </div>
              {failed?.error ? (
                <p className="mt-1 text-xs text-red-600">{failed.error}</p>
              ) : null}
              <input
                accept={accept}
                aria-label={`选择${slot.label}`}
                className="sr-only"
                disabled={uploading}
                id={`upload-slot-${slot.role}`}
                onChange={(event) => handleSlotFileChange(slot.role, event)}
                type="file"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
