import type { JsonValue } from "@/lib/db/schema/common";
import type { JobStore } from "@/server/jobs/state-machine";
import { transitionJobStatus } from "@/server/jobs/state-machine";
import type { VideoSegmentStore } from "@/server/video/segments";

import type { PostQaMode } from "./jobs";
import type { PostQaStore } from "./resolve";

export type LocalizedPostQaRetryResult =
  | { requeued: true; segmentId: string; segmentIndex: number }
  | { requeued: false; reason: "retry_exhausted" | "segment_not_found" };

export async function retryLocalizedPostQaSegment({
  jobStore,
  segmentStore,
  postQaStore,
  jobId,
  segmentIndex,
  mode,
  frameKeys,
  resultJson,
}: {
  jobStore: JobStore;
  segmentStore: VideoSegmentStore;
  postQaStore: PostQaStore;
  jobId: string;
  segmentIndex: number;
  mode: PostQaMode;
  frameKeys: string[];
  resultJson: JsonValue;
}): Promise<LocalizedPostQaRetryResult> {
  const retryCount = await postQaStore.countResults({
    videoJobId: jobId,
    failureCategory: "localized_segment_retry",
  });
  if (retryCount >= 1) {
    return { requeued: false, reason: "retry_exhausted" };
  }

  const segment = await segmentStore.findSegmentByIndex({
    jobId,
    segmentIndex,
  });
  if (!segment) {
    return { requeued: false, reason: "segment_not_found" };
  }

  await postQaStore.createResult({
    videoJobId: jobId,
    status: "failed",
    mode,
    frameKeys,
    resultJson,
    failureCategory: "localized_segment_retry",
  });
  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus: "post_qa_failed",
    reason: "localized_segment_qa_failed",
    errorMessage: "localized_segment_retry",
    failureReason: "localized_segment_retry",
    eventSnapshot: { segmentId: segment.id, segmentIndex },
  });
  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus: "retrying",
    reason: "localized_segment_retry_started",
    eventSnapshot: { segmentId: segment.id, segmentIndex },
  });
  await segmentStore.updateSegment(segment.id, {
    status: "queued",
    providerTaskId: null,
    providerCallLogId: null,
    videoKey: null,
    lockedBy: null,
    lockedUntil: null,
    lastError: null,
    nextRetryAt: null,
  });
  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus: "segments_queued",
    reason: "localized_segment_requeued",
    errorMessage: null,
    failureReason: null,
    userVisibleStatus: "generating",
    eventSnapshot: { segmentId: segment.id, segmentIndex },
  });

  return { requeued: true, segmentId: segment.id, segmentIndex };
}
