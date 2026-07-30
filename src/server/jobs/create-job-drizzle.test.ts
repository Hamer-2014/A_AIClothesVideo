import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";

import { createDrizzleVideoJobCreationStore } from "./create-job";

describe("createDrizzleVideoJobCreationStore", () => {
  it("qualifies the outer asset id inside rights-attestation subqueries", async () => {
    const queries: string[] = [];
    const db = drizzle.mock({
      schema,
      logger: {
        logQuery(query) {
          queries.push(query);
        },
      },
    });
    const store = createDrizzleVideoJobCreationStore(
      db as unknown as NonNullable<
        Parameters<typeof createDrizzleVideoJobCreationStore>[0]
      >,
    );

    await expect(
      store.findOwnedAssets({
        userId: "demo-user",
        assetIds: ["00000000-0000-4000-8000-000000000001"],
      }),
    ).rejects.toThrow("Failed query");

    expect(queries).toHaveLength(1);
    expect(queries[0]).not.toContain('ara."asset_id" = "id"');
    expect(queries[0]).toContain('ara."asset_id" = "assets"."id"');
  });
});
