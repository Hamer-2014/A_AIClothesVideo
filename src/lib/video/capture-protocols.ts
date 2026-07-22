export const captureProtocolIds = [
  "product_showcase",
  "product_rotation",
  "model_turn",
] as const;

export type CaptureProtocolId = (typeof captureProtocolIds)[number];
export type CaptureProtocolSlotRole = "front" | "back" | "side" | "detail";

export interface CaptureProtocolSlot {
  role: CaptureProtocolSlotRole;
  label: string;
  hint: string;
}

export interface CaptureProtocol {
  id: CaptureProtocolId;
  label: string;
  shortLabel: string;
  description: string;
  availability: "recommended" | "beta";
  slots: readonly CaptureProtocolSlot[];
}

export const defaultCaptureProtocolId: CaptureProtocolId = "product_showcase";

export const captureProtocols: readonly CaptureProtocol[] = [
  {
    id: "product_showcase",
    label: "三图商品展示",
    shortLabel: "商品展示",
    description: "用正面、背面和细节图制作稳定的商品宣传视频。",
    availability: "recommended",
    slots: [
      { role: "front", label: "正面主图", hint: "清楚展示服装整体轮廓" },
      { role: "back", label: "背面图", hint: "展示背面结构与版型" },
      { role: "detail", label: "细节图", hint: "面料、领口、袖口或印花" },
    ],
  },
  {
    id: "product_rotation",
    label: "商品旋转",
    shortLabel: "商品旋转",
    description: "使用同一件无真人商品的正面、侧面和背面图。",
    availability: "beta",
    slots: [
      { role: "front", label: "商品正面", hint: "无真人，保持背景一致" },
      { role: "side", label: "商品侧面", hint: "同一商品的侧面视角" },
      { role: "back", label: "商品背面", hint: "同一商品的背面视角" },
    ],
  },
  {
    id: "model_turn",
    label: "真人模特转身",
    shortLabel: "模特转身",
    description: "使用同一模特穿同一件服装的三个连续视角。",
    availability: "beta",
    slots: [
      { role: "front", label: "模特正面", hint: "同一模特与同一套服装" },
      { role: "side", label: "模特侧面", hint: "人物、服装与光线一致" },
      { role: "back", label: "模特背面", hint: "同一人物的背面视角" },
    ],
  },
];

export function isCaptureProtocolId(value: unknown): value is CaptureProtocolId {
  return (
    typeof value === "string" &&
    captureProtocolIds.includes(value as CaptureProtocolId)
  );
}

export function getCaptureProtocol(value: unknown): CaptureProtocol {
  const protocolId = isCaptureProtocolId(value)
    ? value
    : defaultCaptureProtocolId;

  return (
    captureProtocols.find((protocol) => protocol.id === protocolId) ??
    captureProtocols[0]
  );
}
