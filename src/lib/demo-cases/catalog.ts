import type { DemoCase } from "./types";

export const demoCases = [
  {
    slug: "red-dress",
    category: "dress",
    sourceType: "internal-demo",
    status: "published",
    title: {
      en: "Red midi dress",
      "zh-CN": "红色中长连衣裙",
    },
    summary: {
      en: "An existing internal three-image workflow sample with a published result video.",
      "zh-CN": "现有内部三图工作流样例，已经有可公开查看的结果视频。",
    },
    sourceNote: {
      en: "Internal demo material. It is not a customer case.",
      "zh-CN": "内部演示素材，不是客户案例。",
    },
    boundaryNote: {
      en: "The historical provider, prompt, and Preset are not documented, so they remain undisclosed.",
      "zh-CN": "历史供应商、提示词和 Preset 没有完整记录，因此不做反推或虚构。",
    },
    featuredImage: "/demo/red-dress-front.webp",
    sourceAssets: [
      {
        role: "front",
        src: "/demo/red-dress-front.webp",
        alt: {
          en: "Front product image of a red midi dress",
          "zh-CN": "红色中长连衣裙正面商品图",
        },
      },
      {
        role: "back",
        src: "/demo/red-dress-back.webp",
        alt: {
          en: "Back product image of a red midi dress",
          "zh-CN": "红色中长连衣裙背面商品图",
        },
      },
      {
        role: "detail",
        src: "/demo/red-dress-detail.webp",
        alt: {
          en: "Detail product image of a red midi dress",
          "zh-CN": "红色中长连衣裙细节商品图",
        },
      },
    ],
    featuredOutput: {
      videoSrc: "/demo/red-dress-video.mp4",
      posterSrc: "/demo/red-dress-poster.webp",
      presetId: "unknown",
    },
  },
  {
    slug: "structured-blazer",
    category: "blazer",
    sourceType: "synthetic-demo",
    status: "source-ready",
    title: {
      en: "Cobalt structured blazer",
      "zh-CN": "钴蓝结构化西装外套",
    },
    summary: {
      en: "A synthetic front, back, and lapel-detail source set prepared for controlled Preset comparison.",
      "zh-CN": "为同源 Preset 对比准备的合成正面、背面与驳领细节素材。",
    },
    sourceNote: {
      en: "Synthetic product input generated with ImageGen. It is not a customer case.",
      "zh-CN": "使用 ImageGen 生成的合成商品输入，不是客户案例。",
    },
    boundaryNote: {
      en: "No person or scene image is provided. Social lifestyle must remain a restrained product treatment.",
      "zh-CN": "没有真人或场景图；社媒氛围 Preset 只能保持克制的商品展示。",
    },
    featuredImage: "/demo/cases/structured-blazer/front.webp",
    sourceAssets: [
      {
        role: "front",
        src: "/demo/cases/structured-blazer/front.webp",
        alt: {
          en: "Synthetic front product image of a cobalt structured blazer",
          "zh-CN": "钴蓝结构化西装外套合成正面商品图",
        },
      },
      {
        role: "back",
        src: "/demo/cases/structured-blazer/back.webp",
        alt: {
          en: "Synthetic back product image of a cobalt structured blazer",
          "zh-CN": "钴蓝结构化西装外套合成背面商品图",
        },
      },
      {
        role: "detail",
        src: "/demo/cases/structured-blazer/detail.webp",
        alt: {
          en: "Synthetic lapel and button detail of a cobalt structured blazer",
          "zh-CN": "钴蓝结构化西装外套合成驳领与纽扣细节图",
        },
      },
    ],
    featuredOutput: null,
  },
  {
    slug: "knit-cardigan",
    category: "cardigan",
    sourceType: "synthetic-demo",
    status: "source-ready",
    title: {
      en: "Sage rib-knit cardigan",
      "zh-CN": "鼠尾草绿罗纹针织开衫",
    },
    summary: {
      en: "A synthetic front, back, and knit-detail source set for clean marketplace motion.",
      "zh-CN": "用于电商主图动效的合成正面、背面与针织细节素材。",
    },
    sourceNote: {
      en: "Synthetic product input generated with ImageGen. It is not a customer case.",
      "zh-CN": "使用 ImageGen 生成的合成商品输入，不是客户案例。",
    },
    boundaryNote: {
      en: "The visible knit, neckline, buttons, and silhouette are the complete product evidence.",
      "zh-CN": "可见针织纹理、领口、纽扣与版型构成全部商品依据。",
    },
    featuredImage: "/demo/cases/knit-cardigan/front.webp",
    sourceAssets: [
      {
        role: "front",
        src: "/demo/cases/knit-cardigan/front.webp",
        alt: {
          en: "Synthetic front product image of a sage rib-knit cardigan",
          "zh-CN": "鼠尾草绿罗纹针织开衫合成正面商品图",
        },
      },
      {
        role: "back",
        src: "/demo/cases/knit-cardigan/back.webp",
        alt: {
          en: "Synthetic back product image of a sage rib-knit cardigan",
          "zh-CN": "鼠尾草绿罗纹针织开衫合成背面商品图",
        },
      },
      {
        role: "detail",
        src: "/demo/cases/knit-cardigan/detail.webp",
        alt: {
          en: "Synthetic neckline, button, and cuff detail of a sage rib-knit cardigan",
          "zh-CN": "鼠尾草绿罗纹针织开衫合成领口、纽扣与袖口细节图",
        },
      },
    ],
    featuredOutput: null,
  },
] as const satisfies readonly DemoCase[];

export function getDemoCase(slug: string) {
  return demoCases.find((item) => item.slug === slug) ?? null;
}
