import { describe, expect, it } from "vitest";

import { mvpShotTemplates } from "@/lib/templates/catalog";

import {
  createInMemoryShotTemplateStore,
  seedShotTemplates,
  updateShotTemplateStatus,
} from "./seed";

describe("shot template seed and status service", () => {
  it("seeds templates idempotently by template id and version", async () => {
    const store = createInMemoryShotTemplateStore();

    await seedShotTemplates({ store, templates: mvpShotTemplates });
    await seedShotTemplates({ store, templates: mvpShotTemplates });

    expect(store.listTemplates()).toHaveLength(mvpShotTemplates.length);
    expect(
      store.listTemplates().filter((template) => template.templateId === "front_pan"),
    ).toHaveLength(1);
    expect(
      store
        .listTemplates()
        .find((template) => template.templateId === "product_half_rotation"),
    ).toMatchObject({
      subjectKind: "product",
      consistencyRequirements: ["same_garment"],
      autoSelectAllowed: false,
    });
  });

  it("allows admin and operator to update template status", async () => {
    const store = createInMemoryShotTemplateStore();
    await seedShotTemplates({ store, templates: mvpShotTemplates });

    await updateShotTemplateStatus({
      store,
      actorRole: "operator",
      templateId: "front_pan",
      version: 1,
      status: "paused",
    });

    expect(
      store
        .listTemplates()
        .find((template) => template.templateId === "front_pan"),
    ).toMatchObject({ status: "paused" });
  });

  it("blocks unsupported roles from updating template status", async () => {
    const store = createInMemoryShotTemplateStore();
    await seedShotTemplates({ store, templates: mvpShotTemplates });

    await expect(
      updateShotTemplateStatus({
        store,
        actorRole: "viewer",
        templateId: "front_pan",
        version: 1,
        status: "paused",
      }),
    ).rejects.toThrow("Actor cannot update template status.");
  });
});
