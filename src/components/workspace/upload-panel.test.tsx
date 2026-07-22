// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCaptureProtocol } from "@/lib/video/capture-protocols";
import { UploadPanel, type UploadedAssetItem } from "./upload-panel";

function UploadPanelHarness({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [rightsAccepted, setRightsAccepted] = useState(false);
  return (
    <UploadPanel
      assets={[]}
      isAuthenticated={isAuthenticated}
      onRemoveUploaded={() => {}}
      onUploaded={() => {}}
      onUploadingChange={() => {}}
      rightsAccepted={rightsAccepted}
      onRightsAcceptedChange={setRightsAccepted}
      slots={getCaptureProtocol("product_showcase").slots}
    />
  );
}

function renderUploadPanel({ isAuthenticated }: { isAuthenticated: boolean }) {
  return render(<UploadPanelHarness isAuthenticated={isAuthenticated} />);
}

describe("UploadPanel", () => {
  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:front-preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { randomUUID: () => "generated-id" },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("requires an explicit rights statement for authenticated uploads", () => {
    renderUploadPanel({ isAuthenticated: true });

    const checkbox = screen.getByRole("checkbox", {
      name: /我确认拥有或已获得/,
    });
    expect(checkbox).not.toBeChecked();
    expect(screen.getByLabelText("选择正面主图")).toBeDisabled();
    expect(screen.getByRole("link", { name: "服务条款" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: "隐私政策" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("keeps guest image selection local without treating it as consent", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderUploadPanel({ isAuthenticated: false });

    expect(screen.getByLabelText("选择正面主图")).toBeEnabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads a selected slot image immediately and shows the selected preview", async () => {
    const onUploaded = vi.fn();
    const onUploadingChange = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: [
              {
                assetId: "asset-front",
                uploadUrl: "https://upload.example/front",
                headers: { "Content-Type": "image/jpeg" },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ assetId: "asset-front" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    render(
      <UploadPanel
        assets={[]}
        onUploaded={onUploaded}
        onUploadingChange={onUploadingChange}
        onRemoveUploaded={vi.fn()}
        rightsAccepted
        onRightsAcceptedChange={vi.fn()}
        slots={getCaptureProtocol("product_showcase").slots}
      />,
    );

    const file = new File(["front"], "very-long-front-product-photo-name-that-should-not-break-layout.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(screen.getByLabelText("选择正面主图"), {
      target: { files: [file] },
    });

    expect(screen.getByAltText("正面主图预览")).toHaveAttribute("src", "blob:front-preview");
    expect(screen.queryByRole("button", { name: "上传已选择图片" })).not.toBeInTheDocument();
    expect(screen.getByText(file.name)).toHaveClass("truncate");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/uploads/presign",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            rightsAttestation: {
              accepted: true,
              version: "image_rights_v1",
            },
            files: [
              {
                fileName: file.name,
                mimeType: file.type,
                fileSize: file.size,
                intendedRole: "front",
              },
            ],
          }),
        }),
      );
      expect(onUploaded).toHaveBeenCalledWith({
        assetId: "asset-front",
        fileName: file.name,
        intendedRole: "front",
        status: "uploaded",
        previewUrl: "blob:front-preview",
      });
    });
    await waitFor(() => {
      expect(onUploadingChange).toHaveBeenLastCalledWith(false);
    });
  });

  it("keeps guest selections local-only without requesting upload presign", async () => {
    const onUploaded = vi.fn();
    const onUploadingChange = vi.fn();
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(
      <UploadPanel
        assets={[]}
        isAuthenticated={false}
        onUploaded={onUploaded}
        onUploadingChange={onUploadingChange}
        onRemoveUploaded={vi.fn()}
        rightsAccepted={false}
        onRightsAcceptedChange={vi.fn()}
        slots={getCaptureProtocol("product_showcase").slots}
      />,
    );

    const file = new File(["front"], "guest-front.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(screen.getByLabelText("选择正面主图"), {
      target: { files: [file] },
    });

    expect(screen.getByAltText("正面主图预览")).toHaveAttribute("src", "blob:front-preview");
    expect(screen.getByText("guest-front.jpg")).toBeInTheDocument();
    expect(screen.getByText("本地预览")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onUploaded).toHaveBeenCalledWith({
      assetId: "local-front",
      fileName: "guest-front.jpg",
      intendedRole: "front",
      status: "local",
      previewUrl: "blob:front-preview",
    });
    expect(onUploadingChange).toHaveBeenLastCalledWith(false);
  });

  it("renders exactly the three product showcase slots", () => {
    render(
      <UploadPanel
        assets={[]}
        onUploaded={vi.fn()}
        onUploadingChange={vi.fn()}
        onRemoveUploaded={vi.fn()}
        rightsAccepted
        onRightsAcceptedChange={vi.fn()}
        slots={getCaptureProtocol("product_showcase").slots}
      />,
    );

    expect(screen.getByTestId("upload-panel-canvas")).toBeInTheDocument();
    expect(screen.getAllByTestId("upload-slot")).toHaveLength(3);
    expect(screen.getByTestId("upload-slot-front")).toHaveAttribute(
      "data-primary-slot",
      "true",
    );
    expect(screen.getByLabelText("选择正面主图")).toBeInTheDocument();
    expect(screen.getByLabelText("选择背面图")).toBeInTheDocument();
    expect(screen.getByLabelText("选择细节图")).toBeInTheDocument();
    expect(screen.queryByLabelText("选择侧面图")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("选择场景图")).not.toBeInTheDocument();
  });

  it("renders front side back for the product rotation protocol", () => {
    render(
      <UploadPanel
        assets={[]}
        onUploaded={vi.fn()}
        onUploadingChange={vi.fn()}
        onRemoveUploaded={vi.fn()}
        rightsAccepted
        onRightsAcceptedChange={vi.fn()}
        slots={getCaptureProtocol("product_rotation").slots}
      />,
    );

    expect(screen.getByLabelText("选择商品正面")).toBeInTheDocument();
    expect(screen.getByLabelText("选择商品侧面")).toBeInTheDocument();
    expect(screen.getByLabelText("选择商品背面")).toBeInTheDocument();
    expect(screen.queryByLabelText("选择细节图")).not.toBeInTheDocument();
  });

  it("clears a selected uploaded slot when the user removes it", () => {
    const onRemoveUploaded = vi.fn();
    const asset: UploadedAssetItem = {
      assetId: "asset-front",
      fileName: "front.jpg",
      intendedRole: "front",
      status: "uploaded",
      previewUrl: "blob:front-preview",
    };

    render(
      <UploadPanel
        assets={[asset]}
        onUploaded={vi.fn()}
        onUploadingChange={vi.fn()}
        onRemoveUploaded={onRemoveUploaded}
        rightsAccepted
        onRightsAcceptedChange={vi.fn()}
        slots={getCaptureProtocol("product_showcase").slots}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "删除正面主图" }));

    expect(onRemoveUploaded).toHaveBeenCalledWith("asset-front");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:front-preview");
  });
});
