import { describe, expect, it } from "vitest";

import { getAdminSessionFromAuthSession } from "./admin-session";

describe("admin session helper", () => {
  it("returns an admin actor for allowlisted emails", () => {
    expect(
      getAdminSessionFromAuthSession(
        {
          user: {
            id: "user-1",
            email: "ADMIN@example.com",
          },
        },
        "admin@example.com",
      ),
    ).toEqual({
      userId: "user-1",
      email: "ADMIN@example.com",
      role: "admin",
    });
  });

  it("blocks non-allowlisted users", () => {
    expect(
      getAdminSessionFromAuthSession(
        {
          user: {
            id: "user-1",
            email: "user@example.com",
          },
        },
        "admin@example.com",
      ),
    ).toBeNull();
  });
});
