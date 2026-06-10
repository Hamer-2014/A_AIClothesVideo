import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  nextHandlerMock: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: vi.fn(() => mocks.nextHandlerMock),
}));

vi.mock("@/lib/auth/config", () => ({
  getAuth: mocks.getAuthMock,
}));

import { GET, POST } from "./route";

describe("better-auth route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports GET and POST handlers", () => {
    expect(GET).toEqual(expect.any(Function));
    expect(POST).toEqual(expect.any(Function));
  });

  it("returns 503 when auth is not configured", async () => {
    mocks.getAuthMock.mockImplementation(() => {
      throw new Error("BETTER_AUTH_SECRET is required for authentication.");
    });

    const response = await POST(
      new Request("http://localhost/api/auth/sign-in/social", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "auth_not_configured",
    });
  });

  it("rethrows downstream adapter/database errors", async () => {
    const databaseError = new Error(
      "invalid input syntax for type uuid: \"random-string-id\"",
    );

    mocks.getAuthMock.mockReturnValue({});
    mocks.nextHandlerMock.POST.mockRejectedValueOnce(databaseError);

    await expect(
      POST(
        new Request("http://localhost/api/auth/sign-in/social", {
          method: "POST",
        }),
      ),
    ).rejects.toBe(databaseError);
  });
});
