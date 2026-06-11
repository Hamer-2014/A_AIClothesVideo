import {
  GetObjectCommand,
  PutObjectCommand,
  type GetObjectCommandInput,
  type PutObjectCommandInput,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { createR2Client, getR2Config } from "./r2-client";

type SignedUrlCommand =
  | PutObjectCommand
  | GetObjectCommand;

type SignedUrlSigner = (
  client: S3Client,
  command: SignedUrlCommand,
  options: { expiresIn: number },
) => Promise<string>;

const defaultSigner: SignedUrlSigner = (client, command, options) =>
  getSignedUrl(client, command, options);

function contentDispositionFor(filename: string) {
  const fallbackName = filename
    .replace(/[\u0000-\u001f\u007f"\\]+/g, "")
    .replace(/[^\x20-\x7e]/g, "_");

  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function createUploadSignedUrl({
  bucket = getR2Config().bucket,
  key,
  contentType,
  expiresIn = 300,
  client = createR2Client(),
  signer = defaultSigner,
}: {
  bucket?: string;
  key: string;
  contentType: string;
  expiresIn?: number;
  client?: S3Client;
  signer?: SignedUrlSigner;
}) {
  const input: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  };
  const command = new PutObjectCommand(input);
  const url = await signer(client, command, { expiresIn });

  return {
    url,
    headers: {
      "content-type": contentType,
    },
  };
}

export async function createDownloadSignedUrl({
  bucket = getR2Config().bucket,
  key,
  filename,
  expiresIn = 900,
  client = createR2Client(),
  signer = defaultSigner,
}: {
  bucket?: string;
  key: string;
  filename?: string;
  expiresIn?: number;
  client?: S3Client;
  signer?: SignedUrlSigner;
}) {
  const input: GetObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    ...(filename
      ? {
          ResponseContentDisposition: contentDispositionFor(filename),
        }
      : {}),
  };
  const command = new GetObjectCommand(input);

  return signer(client, command, { expiresIn });
}
