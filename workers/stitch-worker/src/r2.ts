import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { WorkerConfig } from "./config";

export interface ObjectTransferInput {
  key: string;
  sourcePath?: string;
  destinationPath?: string;
  contentType?: string;
}

export function createR2Client(config: WorkerConfig) {
  return new S3Client({
    region: "auto",
    endpoint: config.r2Endpoint,
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  });
}

export function createR2Transfer(config: WorkerConfig) {
  const client = createR2Client(config);

  return {
    async downloadObject({ key, destinationPath }: ObjectTransferInput) {
      if (!destinationPath) {
        throw new Error("downloadObject requires destinationPath.");
      }

      const response = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      );

      if (!(response.Body instanceof Readable)) {
        throw new Error(`R2 object body is not readable: ${key}.`);
      }

      await pipeline(response.Body, createWriteStream(destinationPath));
    },
    async uploadObject({ key, sourcePath, contentType }: ObjectTransferInput) {
      if (!sourcePath) {
        throw new Error("uploadObject requires sourcePath.");
      }

      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: await readFile(sourcePath),
          ContentType: contentType ?? "application/octet-stream",
        }),
      );
    },
  };
}
