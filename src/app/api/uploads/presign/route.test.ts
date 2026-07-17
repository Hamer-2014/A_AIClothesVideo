import { describe, expect, it, vi } from "vitest";

import type { CreateAttestationWithAssetsInput } from "@/server/compliance/rights-attestation";

import { handleUploadPresignRequest } from "./route";

describe("POST /api/uploads/presign", () => {
  it("returns 401 when the user is not authenticated", async () => {
    const response = await handleUploadPresignRequest(
      new Request("http://localhost/api/uploads/presign", {
        method: "POST",
        body: JSON.stringify({
          fileName: "dress.jpg",
          mimeType: "image/jpeg",
          fileSize: 1024,
        }),
      }),
      {
        getSession: async () => null,
      },
    );

    expect(response.status).toBe(401);
  });

  it("requires the current rights statement before creating assets", async () => {
    const createAttestationWithAssets = vi.fn();
    const response = await handleUploadPresignRequest(
      new Request("http://localhost/api/uploads/presign", {
        method: "POST",
        body: JSON.stringify({
          files: [
            {
              fileName: "front.jpg",
              mimeType: "image/jpeg",
              fileSize: 1024,
              intendedRole: "front",
            },
          ],
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createAttestationWithAssets,
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "rights_attestation_required",
    });
    expect(createAttestationWithAssets).not.toHaveBeenCalled();
  });

  it("rejects a stale rights statement version", async () => {
    const createAttestationWithAssets = vi.fn();
    const response = await handleUploadPresignRequest(
      new Request("http://localhost/api/uploads/presign", {
        method: "POST",
        body: JSON.stringify({
          fileName: "front.jpg",
          mimeType: "image/jpeg",
          fileSize: 1024,
          rightsAttestation: {
            accepted: true,
            version: "image_rights_v0",
          },
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createAttestationWithAssets,
      },
    ).catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(409);
    expect(await (response as Response).json()).toEqual({
      error: "rights_attestation_version_mismatch",
    });
    expect(createAttestationWithAssets).not.toHaveBeenCalled();
  });

  it("fails closed when compliance hashing is unavailable", async () => {
    const createAttestationWithAssets = vi
      .fn()
      .mockRejectedValue(new Error("compliance_hash_secret_required"));
    const response = await handleUploadPresignRequest(
      new Request("http://localhost/api/uploads/presign", {
        method: "POST",
        body: JSON.stringify({
          fileName: "front.jpg",
          mimeType: "image/jpeg",
          fileSize: 1024,
          rightsAttestation: {
            accepted: true,
            version: "image_rights_v1",
          },
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createAttestationWithAssets,
      },
    ).catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(503);
    expect(await (response as Response).json()).toEqual({
      error: "compliance_hash_secret_required",
    });
  });

  it("creates a pending asset with an attestation and returns a signed upload URL", async () => {
    const createAttestationWithAssets = vi.fn(
      async (input: CreateAttestationWithAssetsInput) => ({
        attestationId: "attestation-1",
        assets: input.files.map((file) => ({ id: file.id, key: file.key })),
      }),
    );
    const response = await handleUploadPresignRequest(
      new Request("http://localhost/api/uploads/presign", {
        method: "POST",
        headers: {
          "accept-language": "zh-CN,zh;q=0.9",
          "user-agent": "Vitest Browser",
          "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        },
        body: JSON.stringify({
          fileName: "dress.jpg",
          mimeType: "image/jpeg",
          fileSize: 1024,
          rightsAttestation: {
            accepted: true,
            version: "image_rights_v1",
          },
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createAttestationWithAssets,
        createUploadSignedUrl: async ({ key }) => ({
          url: `https://upload.example/${key}`,
          headers: { "content-type": "image/jpeg" },
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createAttestationWithAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        attestation: {
          accepted: true,
          version: "image_rights_v1",
        },
        scope: "upload",
        locale: "zh-CN",
        ipAddress: "203.0.113.10",
        userAgent: "Vitest Browser",
        files: [
          expect.objectContaining({
            fileName: "dress.jpg",
            detectedRole: "unknown",
            status: "pending_upload",
          }),
        ],
      }),
    );
    expect(body).toMatchObject({
      assetId: expect.any(String),
      uploadUrl: expect.stringContaining(
        "https://upload.example/users/user-1/assets/",
      ),
      headers: { "content-type": "image/jpeg" },
    });
    expect(body).not.toHaveProperty("key");
  });

  it("creates fixed-slot asset records for a batch presign request", async () => {
    const createAttestationWithAssets = vi.fn(
      async (input: CreateAttestationWithAssetsInput) => ({
        attestationId: "attestation-1",
        assets: input.files.map((file) => ({ id: file.id, key: file.key })),
      }),
    );
    const response = await handleUploadPresignRequest(
      new Request("http://localhost/api/uploads/presign", {
        method: "POST",
        body: JSON.stringify({
          rightsAttestation: {
            accepted: true,
            version: "image_rights_v1",
          },
          files: [
            {
              fileName: "front.jpg",
              mimeType: "image/jpeg",
              fileSize: 1024,
              intendedRole: "front",
            },
            {
              fileName: "back.jpg",
              mimeType: "image/jpeg",
              fileSize: 2048,
              intendedRole: "back",
            },
            {
              fileName: "detail.jpg",
              mimeType: "image/jpeg",
              fileSize: 4096,
              intendedRole: "detail",
            },
          ],
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createAttestationWithAssets,
        createUploadSignedUrl: async ({ key, contentType }) => ({
          url: `https://upload.example/${key}`,
          headers: { "content-type": contentType },
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.files).toHaveLength(3);
    expect(createAttestationWithAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [
          expect.objectContaining({
            fileName: "front.jpg",
            detectedRole: "front",
            status: "pending_upload",
          }),
          expect.objectContaining({
            fileName: "back.jpg",
            detectedRole: "back",
            status: "pending_upload",
          }),
          expect.objectContaining({
            fileName: "detail.jpg",
            detectedRole: "detail",
            status: "pending_upload",
          }),
        ],
      }),
    );
    expect(
      body.files.map((file: { intendedRole: string }) => file.intendedRole),
    ).toEqual(["front", "back", "detail"]);
  });
});
