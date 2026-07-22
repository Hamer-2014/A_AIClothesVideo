import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { AuthEmailContent } from "@/lib/auth/email";

import {
  AuthEmailRateLimitError,
  type AuthEmailEventType,
  type AuthEmailEventStore,
  buildAuthEmailLockKeys,
  deliverRateLimitedAuthEmail,
  evaluateAuthEmailRateLimit,
  getAuthEmailRequestMeta,
  normalizeAuthEmail,
} from "./email-rate-limit";

interface MemoryEvent {
  id: string;
  email: string;
  type: "sign_in_otp" | "email_verification";
  status: "pending" | "sent" | "failed";
  ipAddress: string | null;
  userAgent: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

function createSerializedMemoryStore() {
  const events: MemoryEvent[] = [];
  let queue = Promise.resolve();
  let nextId = 1;

  async function serialized<T>(operation: () => T | Promise<T>) {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  const store: AuthEmailEventStore = {
    reserve(input) {
      return serialized(() => {
        const decision = evaluateAuthEmailRateLimit({
          email: input.email,
          ipAddress: input.ipAddress,
          now: input.now,
          attempts: events,
        });
        if (!decision.allowed) {
          throw new AuthEmailRateLimitError(decision.retryAfterSeconds);
        }

        const event: MemoryEvent = {
          id: `event-${nextId}`,
          email: input.email,
          type: input.type,
          status: "pending",
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          providerMessageId: null,
          errorMessage: null,
          createdAt: input.now,
        };
        nextId += 1;
        events.push(event);
        return { id: event.id };
      });
    },
    async markSent(input) {
      const event = events.find((candidate) => candidate.id === input.id);
      if (!event) throw new Error("auth_email_event_not_found");
      event.status = "sent";
      event.providerMessageId = input.providerMessageId;
    },
    async markFailed(input) {
      const event = events.find((candidate) => candidate.id === input.id);
      if (!event) throw new Error("auth_email_event_not_found");
      event.status = "failed";
      event.errorMessage = input.errorMessage;
    },
  };

  return {
    store,
    listEvents: () => events.map((event) => ({ ...event })),
  };
}

const content: AuthEmailContent = {
  subject: "AI Clothes Video login",
  html: "<p>login</p>",
  text: "login",
};

describe("auth email rate limit policy", () => {
  const now = new Date("2026-07-22T00:10:00.000Z");

  it("only accepts active OTP and email verification event types", () => {
    expectTypeOf<AuthEmailEventType>().toEqualTypeOf<
      "sign_in_otp" | "email_verification"
    >();
  });

  it("normalizes email before applying shared auth-email quotas", () => {
    expect(normalizeAuthEmail(" Seller@Example.COM ")).toBe(
      "seller@example.com",
    );
  });

  it("blocks the same email for 60 seconds", () => {
    expect(
      evaluateAuthEmailRateLimit({
        email: "seller@example.com",
        ipAddress: "203.0.113.10",
        now,
        attempts: [
          {
            email: "seller@example.com",
            ipAddress: "203.0.113.10",
            createdAt: new Date("2026-07-22T00:09:30.000Z"),
          },
        ],
      }),
    ).toEqual({ allowed: false, retryAfterSeconds: 30 });
  });

  it("blocks the sixth email attempt within one hour", () => {
    const attempts = Array.from({ length: 5 }, (_, index) => ({
      email: "seller@example.com",
      ipAddress: `203.0.113.${index + 1}`,
      createdAt: new Date(`2026-07-22T00:0${index}:00.000Z`),
    }));

    expect(
      evaluateAuthEmailRateLimit({
        email: "seller@example.com",
        ipAddress: "203.0.113.99",
        now,
        attempts,
      }),
    ).toEqual({ allowed: false, retryAfterSeconds: 3000 });
  });

  it("blocks the eleventh IP attempt within ten minutes", () => {
    const attempts = Array.from({ length: 10 }, (_, index) => ({
      email: `seller-${index}@example.com`,
      ipAddress: "203.0.113.10",
      createdAt: new Date(`2026-07-22T00:0${index}:30.000Z`),
    }));

    expect(
      evaluateAuthEmailRateLimit({
        email: "next@example.com",
        ipAddress: "203.0.113.10",
        now,
        attempts,
      }),
    ).toEqual({ allowed: false, retryAfterSeconds: 30 });
  });

  it("extracts the first forwarded IP and limits user-agent length", () => {
    const request = new Request("https://app.example/api/auth", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "user-agent": "a".repeat(600),
      },
    });

    expect(getAuthEmailRequestMeta(request)).toEqual({
      ipAddress: "203.0.113.10",
      userAgent: "a".repeat(500),
    });
  });

  it("builds deterministic lock keys for email and IP", () => {
    expect(
      buildAuthEmailLockKeys("seller@example.com", "203.0.113.10"),
    ).toEqual([
      "auth-email:email:seller@example.com",
      "auth-email:ip:203.0.113.10",
    ]);
  });
});

describe("rate-limited auth email delivery", () => {
  it("allows only one provider call for concurrent OTP and email verification attempts", async () => {
    const { store } = createSerializedMemoryStore();
    const send = vi.fn(async () => ({
      provider: "resend" as const,
      providerMessageId: "email-1",
    }));
    const now = new Date("2026-07-22T00:10:00.000Z");
    const request = new Request("https://app.example", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    const results = await Promise.allSettled([
      deliverRateLimitedAuthEmail({
        store,
        email: "seller@example.com",
        type: "sign_in_otp",
        content,
        request,
        now,
        send,
      }),
      deliverRateLimitedAuthEmail({
        store,
        email: "seller@example.com",
        type: "email_verification",
        content,
        request,
        now,
        send,
      }),
    ]);

    expect(send).toHaveBeenCalledTimes(1);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("records provider success", async () => {
    const memory = createSerializedMemoryStore();

    await deliverRateLimitedAuthEmail({
      store: memory.store,
      email: " Seller@Example.COM ",
      type: "sign_in_otp",
      content,
      now: new Date("2026-07-22T00:10:00.000Z"),
      send: async () => ({
        provider: "resend" as const,
        providerMessageId: "email-1",
      }),
    });

    expect(memory.listEvents()[0]).toMatchObject({
      email: "seller@example.com",
      status: "sent",
      providerMessageId: "email-1",
    });
  });

  it("records provider failures and keeps the original error", async () => {
    const memory = createSerializedMemoryStore();

    await expect(
      deliverRateLimitedAuthEmail({
        store: memory.store,
        email: "seller@example.com",
        type: "sign_in_otp",
        content,
        now: new Date("2026-07-22T00:10:00.000Z"),
        send: async () => {
          throw new Error("resend unavailable");
        },
      }),
    ).rejects.toThrow("resend unavailable");

    expect(memory.listEvents()[0]).toMatchObject({
      status: "failed",
      errorMessage: "resend unavailable",
    });
  });

  it("does not report a delivery failure after the provider already succeeded", async () => {
    const recordingError = new Error("database unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const store: AuthEmailEventStore = {
      reserve: async () => ({ id: "event-1" }),
      markSent: async () => {
        throw recordingError;
      },
      markFailed: vi.fn(),
    };

    await expect(
      deliverRateLimitedAuthEmail({
        store,
        email: "seller@example.com",
        type: "email_verification",
        content,
        send: async () => ({
          provider: "resend" as const,
          providerMessageId: "email-1",
        }),
      }),
    ).resolves.toEqual({
      provider: "resend",
      providerMessageId: "email-1",
    });
    expect(store.markFailed).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "auth_email_success_recording_failed",
      expect.objectContaining({ recordingError }),
    );
    consoleError.mockRestore();
  });

  it("preserves the provider error when failure recording also fails", async () => {
    const providerError = new Error("resend unavailable");
    const recordingError = new Error("database unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const store: AuthEmailEventStore = {
      reserve: async () => ({ id: "event-1" }),
      markSent: vi.fn(),
      markFailed: async () => {
        throw recordingError;
      },
    };

    await expect(
      deliverRateLimitedAuthEmail({
        store,
        email: "seller@example.com",
        type: "sign_in_otp",
        content,
        send: async () => {
          throw providerError;
        },
      }),
    ).rejects.toBe(providerError);
    expect(consoleError).toHaveBeenCalledWith(
      "auth_email_failure_recording_failed",
      expect.objectContaining({ recordingError }),
    );
    consoleError.mockRestore();
  });
});
