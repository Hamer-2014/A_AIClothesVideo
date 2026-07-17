import { describe, expect, it } from "vitest";

import {
  CURRENT_RIGHTS_ATTESTATION_VERSION,
  createInMemoryRightsAttestationStore,
  parseRightsAttestation,
  requireComplianceHashSecret,
  type AttestExistingAssetsStoreInput,
} from "./rights-attestation";

describe("rights attestation", () => {
  it("accepts only the current actively accepted statement", () => {
    expect(
      parseRightsAttestation({
        accepted: true,
        version: CURRENT_RIGHTS_ATTESTATION_VERSION,
      }),
    ).toEqual({
      accepted: true,
      version: "image_rights_v1",
    });
  });

  it("rejects a missing acceptance", () => {
    expect(() => parseRightsAttestation({ accepted: false })).toThrow(
      "rights_attestation_required",
    );
  });

  it("rejects a stale statement version", () => {
    expect(() =>
      parseRightsAttestation({ accepted: true, version: "image_rights_v0" }),
    ).toThrow("rights_attestation_version_mismatch");
  });

  it("fails closed without a hash secret outside local development", () => {
    expect(() => requireComplianceHashSecret("production", "")).toThrow(
      "compliance_hash_secret_required",
    );
    expect(requireComplianceHashSecret("development", "")).toBeNull();
  });

  it("creates an attestation, pending assets, and links atomically", async () => {
    const store = createInMemoryRightsAttestationStore({
      environment: "test",
      hashSecret: "hash-secret",
    });

    const result = await store.createAttestationWithAssets({
      userId: "user-1",
      attestation: {
        accepted: true,
        version: CURRENT_RIGHTS_ATTESTATION_VERSION,
      },
      scope: "upload",
      locale: "zh-CN",
      ipAddress: "203.0.113.10",
      userAgent: "Vitest Browser",
      files: [
        {
          id: "asset-1",
          key: "users/user-1/assets/asset-1/original.jpg",
          fileName: "front.jpg",
          mimeType: "image/jpeg",
          fileSize: 1024,
          detectedRole: "front",
          status: "pending_upload",
        },
      ],
    });

    expect(result.assets).toEqual([
      {
        id: "asset-1",
        key: "users/user-1/assets/asset-1/original.jpg",
      },
    ]);
    expect(store.listAttestations()).toEqual([
      expect.objectContaining({
        id: result.attestationId,
        userId: "user-1",
        version: "image_rights_v1",
        scope: "upload",
        ipHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        userAgentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ]);
    expect(store.listAssets()).toEqual([
      expect.objectContaining({ id: "asset-1", status: "pending_upload" }),
    ]);
    expect(store.listLinks()).toEqual([
      expect.objectContaining({
        assetId: "asset-1",
        rightsAttestationId: result.attestationId,
      }),
    ]);
  });

  it("rejects invalid existing-asset batches", async () => {
    const store = createInMemoryRightsAttestationStore();
    const baseInput = {
      userId: "user-1",
      version: CURRENT_RIGHTS_ATTESTATION_VERSION,
      statementSnapshot: "statement",
      locale: "zh-CN",
      ipHash: null,
      userAgentHash: null,
      acceptedAt: new Date("2026-07-11T00:00:00.000Z"),
    } as const;

    await expect(
      store.attestExistingAssets({ ...baseInput, assetIds: [] }),
    ).rejects.toThrow("invalid_asset_ids");
    await expect(
      store.attestExistingAssets({
        ...baseInput,
        assetIds: Array.from({ length: 9 }, (_, index) => `asset-${index}`),
      }),
    ).rejects.toThrow("invalid_asset_ids");
    await expect(
      store.attestExistingAssets({
        ...baseInput,
        assetIds: ["asset-1", "asset-1"],
      }),
    ).rejects.toThrow("invalid_asset_ids");
  });

  it("attests only active assets owned by the user and is idempotent", async () => {
    const store = createInMemoryRightsAttestationStore({
      existingAssets: [
        {
          id: "asset-1",
          userId: "user-1",
          status: "uploaded",
          deletedAt: null,
        },
        {
          id: "asset-deleted",
          userId: "user-1",
          status: "deleted",
          deletedAt: new Date("2026-07-10T00:00:00.000Z"),
        },
        {
          id: "asset-other-user",
          userId: "user-2",
          status: "uploaded",
          deletedAt: null,
        },
      ],
    });
    const input: AttestExistingAssetsStoreInput = {
      userId: "user-1",
      assetIds: ["asset-1"],
      version: CURRENT_RIGHTS_ATTESTATION_VERSION,
      statementSnapshot: "statement",
      locale: "zh-CN",
      ipHash: null,
      userAgentHash: null,
      acceptedAt: new Date("2026-07-11T00:00:00.000Z"),
    };

    const first = await store.attestExistingAssets(input);
    const second = await store.attestExistingAssets(input);

    expect(second).toEqual(first);
    expect(store.listAttestations()).toHaveLength(1);
    expect(store.listLinks()).toHaveLength(1);
    await expect(
      store.attestExistingAssets({
        ...input,
        assetIds: ["asset-deleted"],
      }),
    ).rejects.toThrow("rights_attestation_asset_not_found");
    await expect(
      store.attestExistingAssets({
        ...input,
        assetIds: ["asset-other-user"],
      }),
    ).rejects.toThrow("rights_attestation_asset_not_found");
  });
});
