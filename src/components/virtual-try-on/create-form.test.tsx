// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VirtualTryOnCreateForm } from "./create-form";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  randomUUID: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/components/workspace/upload-panel", () => ({
  UploadPanel: ({
    slots,
    onUploaded,
    onUploadingChange,
    rightsAccepted,
    onRightsAcceptedChange,
    disabled,
  }: {
    slots: Array<{ role: string }>;
    onUploaded: (asset: { assetId: string; fileName: string; intendedRole: "front" | "back" | "detail"; status: "uploaded" }) => void;
    onUploadingChange: (value: boolean) => void;
    rightsAccepted: boolean;
    onRightsAcceptedChange: (value: boolean) => void;
    disabled?: boolean;
  }) => (
    <div data-disabled={String(Boolean(disabled))} data-slots={slots.map((slot) => slot.role).join(",")} data-testid="upload-panel">
      {slots.map((slot) => (
        <button
          key={slot.role}
          disabled={disabled}
          onClick={() => onUploaded({ assetId: `asset-${slot.role}`, fileName: `${slot.role}.jpg`, intendedRole: slot.role as "front" | "back" | "detail", status: "uploaded" })}
          type="button"
        >
          upload {slot.role}
        </button>
      ))}
      <button disabled={disabled} onClick={() => onUploadingChange(true)} type="button">start upload</button>
      <button disabled={disabled} onClick={() => onUploadingChange(false)} type="button">finish upload</button>
      <label>
        rights
        <input checked={rightsAccepted} disabled={disabled} onChange={(event) => onRightsAcceptedChange(event.target.checked)} type="checkbox" />
      </label>
    </div>
  ),
}));

describe("VirtualTryOnCreateForm", () => {
  beforeEach(() => {
    mocks.randomUUID.mockReset();
    mocks.randomUUID.mockReturnValueOnce("request-1").mockReturnValueOnce("request-2").mockReturnValue("request-3");
    vi.stubGlobal("crypto", { randomUUID: mocks.randomUUID });
    mocks.push.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("switches the upload slots between front only and front/back/detail without a side slot", () => {
    render(<VirtualTryOnCreateForm language="en" />);

    expect(screen.getByTestId("upload-panel")).toHaveAttribute("data-slots", "front");
    expect(screen.queryByText("upload side")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Front, side, and back" }));

    expect(screen.getByTestId("upload-panel")).toHaveAttribute("data-slots", "front,back,detail");
    expect(screen.queryByText("upload side")).not.toBeInTheDocument();
  });

  it("keeps the three-view submission disabled until every required source and rights attestation are ready", () => {
    render(<VirtualTryOnCreateForm language="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Front, side, and back" }));

    const submit = screen.getByRole("button", { name: "Create appearance pack" });
    expect(submit).toBeDisabled();
    expect(screen.getByText("Add front, back, and detail images.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "upload front" }));
    fireEvent.click(screen.getByRole("button", { name: "upload back" }));
    fireEvent.click(screen.getByRole("button", { name: "upload detail" }));
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "rights" }));
    expect(submit).toBeEnabled();
  });

  it("submits uploaded assets with a stable idempotency key and opens the returned detail page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ jobId: "job-1", packId: "pack-1", status: "queued" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<VirtualTryOnCreateForm language="en" />);

    fireEvent.click(screen.getByRole("button", { name: "upload front" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "rights" }));
    fireEvent.change(screen.getByLabelText("Product name or SKU (optional)"), { target: { value: "LINEN-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Create appearance pack" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("/api/virtual-try-on", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Idempotency-Key": "request-1" }),
      body: JSON.stringify({ mode: "front_only", skuName: "LINEN-01", sourceAssetIds: { front: "asset-front" } }),
    }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/virtual-try-on/job-1"));
  });

  it("keeps the idempotency key for a 503 retry and never renders the server error", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "internal-r2-key" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-2", packId: "pack-2", status: "queued" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<VirtualTryOnCreateForm language="en" />);

    fireEvent.click(screen.getByRole("button", { name: "upload front" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "rights" }));
    fireEvent.click(screen.getByRole("button", { name: "Create appearance pack" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable"));
    expect(screen.queryByText("internal-r2-key")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create appearance pack" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/virtual-try-on/job-2"));
    expect(fetchMock.mock.calls.map((call) => new Headers(call[1].headers).get("Idempotency-Key"))).toEqual(["request-1", "request-1"]);
  });

  it("replaces the idempotency key after an insufficient-credit response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 402 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-3", packId: "pack-3", status: "queued" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<VirtualTryOnCreateForm language="en" />);

    fireEvent.click(screen.getByRole("button", { name: "upload front" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "rights" }));
    fireEvent.click(screen.getByRole("button", { name: "Create appearance pack" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Not enough credits"));
    fireEvent.click(screen.getByRole("button", { name: "Create appearance pack" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/virtual-try-on/job-3"));

    expect(fetchMock.mock.calls.map((call) => new Headers(call[1].headers).get("Idempotency-Key"))).toEqual(["request-1", "request-2"]);
  });

  it("locks UploadPanel controls while the creation request is in flight", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveRequest = resolve; })));
    render(<VirtualTryOnCreateForm language="en" />);

    fireEvent.click(screen.getByRole("button", { name: "upload front" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "rights" }));
    fireEvent.click(screen.getByRole("button", { name: "Create appearance pack" }));

    await waitFor(() => expect(screen.getByTestId("upload-panel")).toHaveAttribute("data-disabled", "true"));
    expect(screen.getByRole("button", { name: "upload front" })).toBeDisabled();
    resolveRequest?.(new Response(JSON.stringify({ jobId: "job-4" }), { status: 201 }));
  });
});
