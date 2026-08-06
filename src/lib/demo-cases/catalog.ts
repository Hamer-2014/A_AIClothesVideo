import type { DemoCase } from "./types";

export const demoCases = [
  {
    slug: "burgundy-midi-dress",
    category: "dress",
    sourceType: "synthetic-demo",
    status: "published",
    title: {
      en: "Adult burgundy midi dress",
      "zh-CN": "成人深酒红中长连衣裙",
    },
    summary: {
      en: "A traceable three-view adult-model appearance pack with an approved 8-second workflow excerpt.",
      "zh-CN": "一套可追溯的成人模特正、侧、背定妆三视图，以及通过人工复核的 8 秒工作流精选片段。",
    },
    sourceNote: {
      en: "Synthetic garment input was converted into this appearance pack by the real virtual-try-on workflow. This is not a customer case or CSS animation.",
      "zh-CN": "合成服装输入经真实虚拟试穿链路生成这套定妆图；这不是客户案例，也不是 CSS 动效。",
    },
    boundaryNote: {
      en: "Only the approved front-facing 8-second shot is public. The 24-second version is not published because manual review found motion beyond the supported turn range.",
      "zh-CN": "公开版本仅使用通过人工复核的 8 秒正面镜头；24 秒完整版因转身动作超出素材支持范围，不用于公开展示。",
    },
    featuredImage: "/demo/cases/burgundy-midi-dress/appearance-front.webp",
    sourceAssets: [
      {
        role: "front",
        src: "/demo/cases/burgundy-midi-dress/appearance-front.webp",
        alt: {
          en: "Synthetic front appearance of an adult woman wearing a burgundy midi dress",
          "zh-CN": "成人女性穿深酒红中长连衣裙的合成正面定妆图",
        },
      },
      {
        role: "side",
        src: "/demo/cases/burgundy-midi-dress/appearance-side.webp",
        alt: {
          en: "Synthetic side appearance of an adult woman wearing a burgundy midi dress",
          "zh-CN": "成人女性穿深酒红中长连衣裙的合成侧面定妆图",
        },
      },
      {
        role: "back",
        src: "/demo/cases/burgundy-midi-dress/appearance-back.webp",
        alt: {
          en: "Synthetic back appearance of an adult woman wearing a burgundy midi dress",
          "zh-CN": "成人女性穿深酒红中长连衣裙的合成背面定妆图",
        },
      },
    ],
    featuredOutput: {
      videoSrc: "/demo/cases/burgundy-midi-dress/virtual-try-on-homepage-8s.mp4",
      posterSrc: "/demo/cases/burgundy-midi-dress/virtual-try-on-homepage-8s-poster.webp",
      presetId: "minimal_studio",
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
