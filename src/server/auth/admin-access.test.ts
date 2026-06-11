import { describe, expect, it } from "vitest";

import {
  canRolePerformAdminAction,
  isEmailAllowedForAdmin,
  parseAdminAllowlist,
} from "./admin-access";

describe("admin access helpers", () => {
  it("parses comma separated allowlists case-insensitively", () => {
    expect(
      parseAdminAllowlist(" Admin@Example.com, operator@example.com ,, "),
    ).toEqual(["admin@example.com", "operator@example.com"]);
  });

  it("checks whether an email is admin-allowlisted", () => {
    expect(
      isEmailAllowedForAdmin("ADMIN@example.com", "admin@example.com"),
    ).toBe(true);
    expect(isEmailAllowedForAdmin("user@example.com", "admin@example.com")).toBe(
      false,
    );
  });

  it("allows admin but blocks operator from sensitive configuration actions", () => {
    expect(canRolePerformAdminAction("admin", "provider_key:update")).toBe(true);
    expect(canRolePerformAdminAction("operator", "provider_key:update")).toBe(
      false,
    );
    expect(canRolePerformAdminAction("operator", "job:retry_segment")).toBe(true);
    expect(canRolePerformAdminAction("operator", "job:reopen_post_qa")).toBe(true);
  });
});
