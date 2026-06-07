import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";

import { createR2Client, getR2Config } from "./r2-client";

type UploadClient = Pick<S3Client, "send">;

function bodyFromArrayBuffer(buffer: ArrayBuffer) {
  return Buffer.from(buffer);
}

export async function transferRemoteFileToR2({
  url,
  key,
  contentType,
  bucket = getR2Config().bucket,
  client = createR2Client(),
  fetch: fetchImpl = fetch,
}: {
  url: string;
  key: string;
  contentType?: string;
  bucket?: string;
  client?: UploadClient;
  fetch?: typeof fetch;
}) {
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error(`Remote file download failed with status ${response.status}.`);
  }

  const resolvedContentType =
    contentType ?? response.headers.get("content-type") ?? "application/octet-stream";
  const body = bodyFromArrayBuffer(await response.arrayBuffer());

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: resolvedContentType,
    }),
  );

  return {
    key,
    contentType: resolvedContentType,
  };
}
