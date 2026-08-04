// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VirtualTryOnPackDetail } from "./pack-detail";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const detail = (status: string, mode: "front_only" | "three_view" = "three_view") => ({
  job: { id: "job-1", mode, status, queueHealth: "normal" as "normal" | "delayed" },
  pack: { id: "pack-1", version: 1, status, lockedAt: status === "locked" ? new Date("2026-08-01T00:00:00.000Z") : null },
  views: mode === "three_view"
    ? [
      { id: "asset-front", view: "front" as const, status: "completed" },
      { id: "asset-side", view: "side" as const, status: "completed" },
      { id: "asset-back", view: "back" as const, status: "completed" },
    ]
    : [{ id: "asset-front", view: "front" as const, status: "completed" }],
  bridge: status === "ready" || status === "locked"
    ? { kind: "virtual_tryon_appearance_pack" as const, appearancePackId: "pack-1", version: 1, mode, provenance: "generated_apimart_gpt_image_2", videoGeneration: status === "locked" ? "enabled" as const : "requires_lock" as const }
    : null,
});

describe("VirtualTryOnPackDetail", () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); router.push.mockReset(); });

  it("polls a non-terminal task and stops polling a terminal task", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...detail("generating"), videoBridge: null }) });
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<VirtualTryOnPackDetail initialDetail={detail("queued")} language="en" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(fetchMock).toHaveBeenCalledWith("/api/virtual-try-on/job-1", expect.objectContaining({ cache: "no-store" }));

    unmount();
    render(<VirtualTryOnPackDetail initialDetail={detail("ready")} language="en" />);
    fetchMock.mockClear();
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts its polling request when unmounted", () => {
    const abort = vi.spyOn(AbortController.prototype, "abort");
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    const { unmount } = render(<VirtualTryOnPackDetail initialDetail={detail("generating")} language="en" />);
    unmount();
    expect(abort).toHaveBeenCalled();
  });

  it("uses protected preview URLs for every ready three-view asset and locks the pack", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ packId: "pack-1", status: "locked", lockedAt: "2026-08-01T00:00:00.000Z" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<VirtualTryOnPackDetail initialDetail={detail("ready")} language="en" />);

    expect(screen.getByAltText("Front appearance view")).toHaveAttribute("src", "/api/virtual-try-on/job-1/assets/asset-front/download?preview=1");
    expect(screen.getByAltText("Side appearance view")).toHaveAttribute("src", "/api/virtual-try-on/job-1/assets/asset-side/download?preview=1");
    expect(screen.getByAltText("Back appearance view")).toHaveAttribute("src", "/api/virtual-try-on/job-1/assets/asset-back/download?preview=1");
    fireEvent.click(screen.getByRole("button", { name: "Lock appearance pack" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/virtual-try-on/job-1/lock", expect.objectContaining({ method: "POST", body: JSON.stringify({ packId: "pack-1" }) })));
    expect(await screen.findByText("Appearance pack locked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lock appearance pack" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create 8-sec video" })).toBeEnabled();
  });

  it("orders a three-view result grid from front to side to back", () => {
    const initialDetail = detail("locked");
    initialDetail.views.reverse();
    render(<VirtualTryOnPackDetail initialDetail={initialDetail} language="en" />);
    expect(screen.getAllByRole("img").map((image) => image.getAttribute("alt"))).toEqual([
      "Front appearance view",
      "Side appearance view",
      "Back appearance view",
    ]);
  });

  it("renders a safe conflict error when locking fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409 }));
    render(<VirtualTryOnPackDetail initialDetail={detail("ready", "front_only")} language="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Lock appearance pack" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could no longer be locked");
  });

  it("shows a safe warning when a queued job has not been claimed", () => {
    const initialDetail = detail("queued", "front_only");
    initialDetail.job.queueHealth = "delayed";

    render(<VirtualTryOnPackDetail initialDetail={initialDetail} language="en" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Generation has not started on schedule");
    expect(screen.getByRole("alert")).not.toHaveTextContent(/cron|secret|internal\/virtual-try-on/i);
  });

  it("creates a 24-second video from a locked pack and opens the video job", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "bridge-request-123" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ videoJobId: "video-job-1", status: "asset_analysis_queued", replayed: false }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<VirtualTryOnPackDetail initialDetail={detail("locked")} language="en" />);

    expect(screen.queryByRole("button", { name: "40 sec" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "24 sec" }));
    expect(screen.getByText("190 credits reserved at video confirmation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "1:1" }));
    fireEvent.change(screen.getByLabelText("Video style"), { target: { value: "social_lifestyle" } });
    fireEvent.click(screen.getByRole("button", { name: "Create 24-sec video" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/virtual-try-on/job-1/video", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ packId: "pack-1", idempotencyKey: "bridge-request-123", durationSeconds: 24, aspectRatio: "1:1", presetId: "social_lifestyle" }),
    })));
    expect(router.push).toHaveBeenCalledWith("/jobs/video-job-1");
  });

  it("keeps the selected specs and shows a safe retryable bridge error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "appearance_pack_source_rights_revoked" }) }));
    render(<VirtualTryOnPackDetail initialDetail={detail("locked", "front_only")} language="en" />);
    fireEvent.click(screen.getByRole("button", { name: "32 sec" }));
    fireEvent.click(screen.getByRole("button", { name: "Create 32-sec video" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("source rights are no longer active");
    expect(screen.getByRole("button", { name: "Create 32-sec video" })).toBeEnabled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("hides results and video actions for failed delivery", () => {
    render(<VirtualTryOnPackDetail initialDetail={detail("failed_released")} language="en" />);
    expect(screen.getAllByText("Appearance pack was not delivered").length).toBeGreaterThan(0);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continue to video generation/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create another appearance pack" })).toHaveAttribute("href", "/virtual-try-on");
  });
});
