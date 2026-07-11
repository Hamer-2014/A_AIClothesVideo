import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveTurbopackRoot } from "./turbopack-root";

describe("resolveTurbopackRoot", () => {
  it("keeps the repository directory for the main checkout", () => {
    const repository = path.resolve("tmp", "a_runwaytools");

    expect(resolveTurbopackRoot(repository)).toBe(repository);
  });

  it("returns the shared repository for a named worktree", () => {
    const repository = path.resolve("tmp", "a_runwaytools");
    const worktree = path.join(repository, ".worktree", "feature-name");

    expect(resolveTurbopackRoot(worktree)).toBe(repository);
  });
});
