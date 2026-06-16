// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UploadPanel, type UploadedAssetItem } from "./upload-panel";

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
      />,
    );

    const file = new File(["front"], "very-long-front-product-photo-name-that-should-not-break-layout.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(screen.getByLabelText("选择正面图"), {
      target: { files: [file] },
    });

    expect(screen.getByAltText("正面图预览")).toHaveAttribute("src", "blob:front-preview");
    expect(screen.queryByRole("button", { name: "上传已选择图片" })).not.toBeInTheDocument();
    expect(screen.getByText(file.name)).toHaveClass("truncate");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/uploads/presign",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
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

  it("uses a vertical canvas with the front slot above the supporting images", () => {
    render(
      <UploadPanel
        assets={[]}
        onUploaded={vi.fn()}
        onUploadingChange={vi.fn()}
        onRemoveUploaded={vi.fn()}
      />,
    );

    expect(screen.getByTestId("upload-panel-canvas")).toBeInTheDocument();
    const primaryRow = screen.getByTestId("upload-primary-row");
    const secondaryGrid = screen.getByTestId("upload-secondary-grid");
    expect(primaryRow).toBeInTheDocument();
    expect(secondaryGrid).toBeInTheDocument();
    expect(primaryRow.compareDocumentPosition(secondaryGrid)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByTestId("upload-panel-canvas").className).toContain("space-y-4");
    expect(screen.getByTestId("upload-panel-canvas").className).not.toContain("lg:grid-cols");
    expect(screen.getByTestId("upload-slot-front")).toHaveAttribute(
      "data-primary-slot",
      "true",
    );
    expect(screen.getAllByTestId("upload-secondary-slot")).toHaveLength(4);
    expect(screen.getByLabelText("选择正面图")).toBeInTheDocument();
    expect(screen.getByLabelText("选择场景图")).toBeInTheDocument();
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
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "删除正面图" }));

    expect(onRemoveUploaded).toHaveBeenCalledWith("asset-front");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:front-preview");
  });
});
