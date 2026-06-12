import {
  createDrizzleVideoSegmentStore,
  defaultStoreProviderOutput,
  pollSubmittedSegment,
  submitQueuedSegment,
  type VideoSegmentStore,
} from "@/server/video/segments";
import {
  createDrizzleJobStore,
  type JobStore,
} from "@/server/jobs/state-machine";

export interface GenerationRefreshResult {
  jobId: string;
  submittedCount: number;
  polledCount: number;
}

export async function refreshGenerationForJob({
  jobStore = createDrizzleJobStore(),
  segmentStore = createDrizzleVideoSegmentStore(),
  jobId,
  storeProviderOutput = defaultStoreProviderOutput,
  submitSegment = submitQueuedSegment,
  pollSegment = pollSubmittedSegment,
}: {
  jobStore?: JobStore;
  segmentStore?: VideoSegmentStore;
  jobId: string;
  storeProviderOutput?: (input: {
    jobId: string;
    segmentId: string;
    outputUrl: string;
  }) => Promise<string>;
  submitSegment?: typeof submitQueuedSegment;
  pollSegment?: typeof pollSubmittedSegment;
}): Promise<GenerationRefreshResult> {
  const job = await jobStore.findJob(jobId);
  if (!job) {
    return { jobId, submittedCount: 0, polledCount: 0 };
  }

  const segments = await segmentStore.listSegmentsForJob(jobId);
  const hasPollableSegment = segments.some(
    (segment) => segment.status === "generating" && segment.providerTaskId,
  );
  if (
    job.status !== "segments_queued" &&
    job.status !== "segment_generating" &&
    !(job.status === "segment_failed" && hasPollableSegment)
  ) {
    return { jobId, submittedCount: 0, polledCount: 0 };
  }
  let submittedCount = 0;
  let polledCount = 0;

  for (const segment of segments) {
    if (job.status !== "segment_failed" && segment.status === "queued") {
      await submitSegment({
        jobStore,
        segmentStore,
        jobId,
        segmentId: segment.id,
      });
      submittedCount += 1;
    }
  }

  const latestSegments = await segmentStore.listSegmentsForJob(jobId);
  for (const segment of latestSegments) {
    if (segment.status === "generating" && segment.providerTaskId) {
      await pollSegment({
        jobStore,
        segmentStore,
        jobId,
        segmentId: segment.id,
        storeProviderOutput,
      });
      polledCount += 1;
    }
  }

  return { jobId, submittedCount, polledCount };
}
