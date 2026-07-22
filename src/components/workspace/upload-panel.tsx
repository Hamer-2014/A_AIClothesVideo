"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, RotateCcw, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import {
  getCaptureProtocol,
  type CaptureProtocolSlot,
} from "@/lib/video/capture-protocols";

export type UploadSlotRole = "front" | "back" | "side" | "detail" | "scene";

export interface UploadedAssetItem {
  assetId: string;
  fileName: string;
  intendedRole: UploadSlotRole;
  status: "idle" | "local" | "uploading" | "uploaded" | "failed";
  error?: string | null;
  previewUrl?: string | null;
}

interface UploadPanelProps {
  assets: UploadedAssetItem[];
  slots?: readonly CaptureProtocolSlot[];
  isAuthenticated?: boolean;
  onUploaded: (asset: UploadedAssetItem) => void;
  onRemoveUploaded: (assetId: string) => void;
  onUploadingChange: (uploading: boolean) => void;
  rightsAccepted: boolean;
  onRightsAcceptedChange: (accepted: boolean) => void;
}

interface SelectedSlotFile {
  fileName: string;
  previewUrl: string;
  status: "local" | "uploading";
}

function humanReadableUploadError(error: string) {
  switch (error) {
    case "file_too_large":
      return "文件过大";
    case "unsupported_file_type":
      return "文件类型不支持";
    case "unauthorized":
      return "登录状态失效";
    case "rights_attestation_required":
      return "请先确认素材与肖像授权声明";
    case "rights_attestation_version_mismatch":
      return "授权声明已更新，请重新确认";
    default:
      return "上传失败";
  }
}

export function UploadPanel({
  assets,
  slots = getCaptureProtocol("product_showcase").slots,
  isAuthenticated = true,
  onRemoveUploaded,
  onUploaded,
  onUploadingChange,
  rightsAccepted,
  onRightsAcceptedChange,
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
  const localByRole = useMemo(
    () =>
      new Map(
        assets
          .filter((asset) => asset.status === "local")
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
          status: isAuthenticated ? "uploading" : "local",
        },
      };
    });
    if (!isAuthenticated) {
      onUploaded({
        assetId: `local-${role}`,
        fileName: file.name,
        intendedRole: role,
        status: "local",
        previewUrl,
      });
      return;
    }
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
          rightsAttestation: {
            accepted: true,
            version: "image_rights_v1",
          },
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

    const existingAsset =
      uploadedByRole.get(role) ?? failedByRole.get(role) ?? localByRole.get(role);
    if (existingAsset) {
      if (existingAsset.previewUrl) {
        URL.revokeObjectURL(existingAsset.previewUrl);
      }
      onRemoveUploaded(existingAsset.assetId);
    }
  }

  return (
    <section className="space-y-4" data-testid="upload-panel-canvas">
      <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3 text-xs leading-5 text-[var(--muted)]">
        <label className="flex items-start gap-2" htmlFor="upload-rights-attestation">
          <input
            checked={rightsAccepted}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--action)]"
            id="upload-rights-attestation"
            onChange={(event) => onRightsAcceptedChange(event.target.checked)}
            type="checkbox"
          />
          <span>
            我确认拥有或已获得上传素材的版权、商标及商业使用授权；如包含可识别人物，已获得其肖像与商业宣传授权；如人物未满 18 周岁，已获得监护人授权。
          </span>
        </label>
        <p className="mt-2 pl-6">
          查看
          <Link className="mx-1 underline" href="/terms">
            服务条款
          </Link>
          和
          <Link className="ml-1 underline" href="/privacy">
            隐私政策
          </Link>
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3" data-testid="upload-slot-grid">
        {slots.map((slot, index) => {
          const uploaded = uploadedByRole.get(slot.role);
          const failed = failedByRole.get(slot.role);
          const local = localByRole.get(slot.role);
          const selected = slotFiles[slot.role];
          const uploading = uploadingRoles.has(slot.role);
          const previewUrl =
            selected?.previewUrl ??
            uploaded?.previewUrl ??
            failed?.previewUrl ??
            local?.previewUrl;
          const fileName =
            selected?.fileName ??
            uploaded?.fileName ??
            failed?.fileName ??
            local?.fileName;
          const localPreview = selected?.status === "local" || Boolean(local);
          const hasImage = Boolean(previewUrl);

          return (
            <div
              className={`group relative flex min-h-[19rem] min-w-0 flex-col rounded-[var(--radius-lg)] border border-dashed bg-[var(--surface-raised)] p-3 transition duration-[var(--motion-fast)] focus-within:border-[var(--action)] hover:border-[var(--action)] ${
                hasImage ? "border-[var(--line-strong)]" : "border-[var(--line)]"
              }`}
              data-testid="upload-slot"
              key={slot.role}
            >
              <span
                className="absolute left-3 top-3 z-10 rounded-full bg-[var(--ink)] px-2 py-1 text-[10px] font-semibold text-white"
                data-primary-slot={index === 0 ? "true" : "false"}
                data-testid={`upload-slot-${slot.role}`}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 pl-9">
                  <p className="text-sm font-medium">
                    {slot.label} <span className="text-[var(--brand)]">*</span>
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    {slot.hint}
                  </p>
                </div>
                {fileName ? (
                  <button
                    aria-label={`删除${slot.label}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                    onClick={() => removeSlot(slot.role)}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] text-[var(--action)]">
                    {failed ? <RotateCcw size={16} /> : <ImagePlus size={16} />}
                  </div>
                )}
              </div>
              <label
                className="mt-3 flex aspect-[4/5] min-h-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-subtle)] text-center text-xs text-[var(--muted)] transition group-hover:bg-[var(--surface-hover)]"
                htmlFor={`upload-input-${slot.role}`}
              >
                {hasImage && previewUrl ? (
                  <Image
                    alt={`${slot.label}预览`}
                    className="h-full w-full object-cover"
                    height={400}
                    src={previewUrl}
                    unoptimized
                    width={320}
                  />
                ) : (
                  <span className="flex flex-col items-center gap-2 px-4">
                    <ImagePlus aria-hidden="true" size={20} />
                    选择{slot.label}
                  </span>
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
                  {uploading
                    ? "上传中"
                    : uploaded
                      ? "已上传"
                      : localPreview
                        ? "本地预览"
                        : failed
                          ? "失败"
                          : ""}
                </span>
              </div>
              {failed?.error ? (
                <p className="mt-1 text-xs text-[var(--danger)]">{failed.error}</p>
              ) : null}
              <input
                accept={accept}
                aria-label={`选择${slot.label}`}
                className="sr-only"
                disabled={uploading || (isAuthenticated && !rightsAccepted)}
                id={`upload-input-${slot.role}`}
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
