import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { WorkerConfig } from "./config.js";
import { sendStitchCallback } from "./callback.js";
import {
  extractCoverFrame as defaultExtractCoverFrame,
  buildConcatList,
  extractQaFrames as defaultExtractQaFrames,
  listExtractedQaFrames as defaultListExtractedQaFrames,
  stitchSegments as defaultStitchSegments,
} from "./ffmpeg.js";
import type { StitchResult } from "./http.js";
import type { StitchPayload } from "./payload.js";
import { createR2Transfer, type ObjectTransferInput } from "./r2.js";

interface RunStitchJobDeps {
  payload: StitchPayload;
  config: WorkerConfig;
  createWorkDir?: () => Promise<string>;
  writeTextFile?: (filePath: string, contents: string) => Promise<void>;
  downloadObject?: (input: Required<Pick<ObjectTransferInput, "key" | "destinationPath">>) => Promise<void>;
  uploadObject?: (input: Required<Pick<ObjectTransferInput, "key" | "sourcePath" | "contentType">>) => Promise<void>;
  stitchSegments?: typeof defaultStitchSegments;
  extractCoverFrame?: typeof defaultExtractCoverFrame;
  extractQaFrames?: typeof defaultExtractQaFrames;
  listExtractedQaFrames?: typeof defaultListExtractedQaFrames;
  sendCallback?: typeof sendStitchCallback;
  cleanupWorkDir?: (workDir: string) => Promise<void>;
}

async function defaultCreateWorkDir() {
  return mkdtemp(path.join(tmpdir(), "stitch-worker-"));
}

function normalizedPath(...parts: string[]) {
  return path.join(...parts).replaceAll("\\", "/");
}

function frameKey(prefix: string, index: number) {
  return `${prefix.replace(/\/+$/, "")}/${index}.jpg`;
}

function frameCountForPostQaMode(mode: StitchPayload["postQaMode"]) {
  switch (mode) {
    case "off":
      return 0;
    case "standard":
      return 5;
    case "strict":
      return 6;
    case "lite":
      return 3;
  }
}

export async function runStitchJob({
  payload,
  config,
  createWorkDir = defaultCreateWorkDir,
  writeTextFile = writeFile,
  stitchSegments = defaultStitchSegments,
  extractCoverFrame = defaultExtractCoverFrame,
  extractQaFrames = defaultExtractQaFrames,
  listExtractedQaFrames = defaultListExtractedQaFrames,
  sendCallback = sendStitchCallback,
  cleanupWorkDir = (workDir) => rm(workDir, { recursive: true, force: true }),
  downloadObject,
  uploadObject,
}: RunStitchJobDeps): Promise<StitchResult> {
  const transfer = downloadObject && uploadObject ? null : createR2Transfer(config);
  const download = downloadObject ?? transfer?.downloadObject;
  const upload = uploadObject ?? transfer?.uploadObject;

  if (!download || !upload) {
    throw new Error("R2 transfer functions are not configured.");
  }

  const workDir = await createWorkDir();
  const frameDirectory = normalizedPath(workDir, "frames");
  const coverPath = normalizedPath(workDir, "cover.webp");
  const outputPath = normalizedPath(workDir, "final.mp4");
  const concatListPath = normalizedPath(workDir, "segments.txt");
  const frameCount = frameCountForPostQaMode(payload.postQaMode);

  try {
    await mkdir(frameDirectory, { recursive: true });
    const segmentPaths = payload.segmentKeys.map((_, index) =>
      normalizedPath(workDir, `segment-${index}.mp4`),
    );

    await Promise.all(
      payload.segmentKeys.map((key, index) =>
        download({ key, destinationPath: segmentPaths[index] as string }),
      ),
    );
    await writeTextFile(concatListPath, buildConcatList(segmentPaths));
    await stitchSegments({ concatListPath, outputPath });

    const warnings: string[] = [];
    let generatedCoverKey: string | null = null;
    if (payload.coverKey) {
      try {
        await extractCoverFrame({
          videoPath: outputPath,
          coverPath,
        });
        generatedCoverKey = payload.coverKey;
      } catch (error) {
        warnings.push(
          `cover_generation_failed: ${
            error instanceof Error ? error.message : "Unknown cover error"
          }`,
        );
      }
    }

    if (frameCount > 0) {
      await extractQaFrames({
        videoPath: outputPath,
        frameDirectory,
        frameCount,
      });
    }
    const localFramePaths =
      frameCount > 0
        ? await listExtractedQaFrames({
            frameDirectory,
            frameCount,
          })
        : [];
    const frameKeys = payload.frameKeyPrefix
      ? localFramePaths.map((_, index) => frameKey(payload.frameKeyPrefix as string, index))
      : [];

    await upload({
      key: payload.finalVideoKey,
      sourcePath: outputPath,
      contentType: "video/mp4",
    });

    if (generatedCoverKey) {
      await upload({
        key: generatedCoverKey,
        sourcePath: coverPath,
        contentType: "image/webp",
      });
    }

    await Promise.all(
      frameKeys.map((key, index) =>
        upload({
          key,
          sourcePath: localFramePaths[index] as string,
          contentType: "image/jpeg",
        }),
      ),
    );

    const result: StitchResult = {
      stitchJobId: payload.stitchJobId,
      status: "succeeded",
      finalVideoKey: payload.finalVideoKey,
      coverKey: generatedCoverKey,
      frameKeys,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
    await sendCallback({
      callbackUrl: payload.callbackUrl,
      workerSecret: config.callbackSecret,
      result,
    });

    return result;
  } catch (error) {
    const failedResult: StitchResult = {
      stitchJobId: payload.stitchJobId,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown stitch error",
    };
    await sendCallback({
      callbackUrl: payload.callbackUrl,
      workerSecret: config.callbackSecret,
      result: failedResult,
    });
    throw error;
  } finally {
    await cleanupWorkDir(workDir);
  }
}
