export const videoDurations = [8, 16, 24, 40] as const;

export type VideoDuration = (typeof videoDurations)[number];

export type VideoSpec = {
  durationSeconds: VideoDuration;
  segmentCount: 1 | 2 | 3 | 5;
  creditCost: number;
  trialAllowed: boolean;
  releaseStage: "active" | "beta";
  paidPostQaMode: "standard";
  trialPostQaMode: "lite" | null;
};

export const videoSpecs: Record<VideoDuration, VideoSpec> = {
  8: {
    durationSeconds: 8,
    segmentCount: 1,
    creditCost: 70,
    trialAllowed: true,
    releaseStage: "active",
    paidPostQaMode: "standard",
    trialPostQaMode: "lite",
  },
  16: {
    durationSeconds: 16,
    segmentCount: 2,
    creditCost: 130,
    trialAllowed: false,
    releaseStage: "active",
    paidPostQaMode: "standard",
    trialPostQaMode: null,
  },
  24: {
    durationSeconds: 24,
    segmentCount: 3,
    creditCost: 190,
    trialAllowed: false,
    releaseStage: "active",
    paidPostQaMode: "standard",
    trialPostQaMode: null,
  },
  40: {
    durationSeconds: 40,
    segmentCount: 5,
    creditCost: 310,
    trialAllowed: false,
    releaseStage: "beta",
    paidPostQaMode: "standard",
    trialPostQaMode: null,
  },
};

export function isVideoDuration(value: unknown): value is VideoDuration {
  return (
    typeof value === "number" &&
    videoDurations.includes(value as VideoDuration)
  );
}

export function getVideoSpec(durationSeconds: VideoDuration) {
  return videoSpecs[durationSeconds];
}

export function isVideoDurationEnabled(
  durationSeconds: VideoDuration,
  env: Record<string, string | undefined> = process.env,
) {
  return (
    durationSeconds !== 40 ||
    env.VIDEO_DURATION_40_ENABLED?.trim().toLowerCase() === "true"
  );
}
