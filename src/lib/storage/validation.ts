import { getImageExtension, type SupportedImageMimeType } from "./keys";

export const maxUploadImageBytes = 15 * 1024 * 1024;

export interface UploadFileInput {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export type UploadValidationResult =
  | {
      ok: true;
      extension: string;
      mimeType: SupportedImageMimeType;
    }
  | {
      ok: false;
      reason: "unsupported_file_type" | "file_too_large" | "invalid_file_size";
    };

export function validateUploadFile(input: UploadFileInput): UploadValidationResult {
  if (!Number.isInteger(input.fileSize) || input.fileSize <= 0) {
    return { ok: false, reason: "invalid_file_size" };
  }

  if (input.fileSize > maxUploadImageBytes) {
    return { ok: false, reason: "file_too_large" };
  }

  const extension = getImageExtension(input.mimeType);

  if (!extension) {
    return { ok: false, reason: "unsupported_file_type" };
  }

  return {
    ok: true,
    extension,
    mimeType: input.mimeType as SupportedImageMimeType,
  };
}
