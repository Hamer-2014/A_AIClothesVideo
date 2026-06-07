const mimeToExtension = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type SupportedImageMimeType = keyof typeof mimeToExtension;

export function getImageExtension(mimeType: string) {
  return mimeToExtension[mimeType as SupportedImageMimeType];
}

export function buildAssetOriginalKey(
  userId: string,
  assetId: string,
  mimeType: SupportedImageMimeType,
) {
  return `users/${userId}/assets/${assetId}/original.${getImageExtension(mimeType)}`;
}

export function buildAssetThumbKey(userId: string, assetId: string) {
  return `users/${userId}/assets/${assetId}/thumb.webp`;
}

export function buildSegmentVideoKey(jobId: string, segmentId: string) {
  return `jobs/${jobId}/segments/${segmentId}/video.mp4`;
}

export function buildFinalVideoKey(jobId: string) {
  return `jobs/${jobId}/stitched/final.mp4`;
}

export function buildQaFrameKey(jobId: string, frameIndex: number) {
  return `jobs/${jobId}/qa/frames/${frameIndex}.jpg`;
}

export function buildCoverKey(jobId: string) {
  return `jobs/${jobId}/covers/cover.webp`;
}
