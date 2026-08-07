import type { SiteLocale } from "@/lib/i18n/config";

export const guideSlugs = [
  "clothing-video-without-back-image",
  "choose-clothing-video-length",
  "why-ai-clothing-videos-deform",
  "check-clothing-images-match",
  "model-mannequin-flat-lay-for-ai-video",
  "plan-clothing-video-shots",
] as const;

export type GuideSlug = (typeof guideSlugs)[number];

export type GuideTextPart = string | {
  href: string;
  label: string;
};

export interface GuideTable {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
}

export interface GuideSection {
  heading: string;
  paragraphs: readonly (readonly GuideTextPart[])[];
  bullets?: readonly string[];
  numberedItems?: readonly string[];
  table?: GuideTable;
}

export interface LocalizedGuide {
  metadataTitle: string;
  title: string;
  description: string;
  eyebrow: string;
  directAnswer: string;
  imageAlt: string;
  imageCaption: string;
  parentLabel: string;
  sections: readonly GuideSection[];
  relatedHeading: string;
  ctaTitle: string;
  ctaBody: string;
  ctaLabel: string;
}

export interface GuideArticle {
  slug: GuideSlug;
  parentHref: "/three-images-to-clothing-video";
  ctaHref: "/workspace?mode=trial&preset=minimal_studio";
  relatedSlugs: readonly GuideSlug[];
  imageSrc: string;
  en: LocalizedGuide;
  "zh-CN": LocalizedGuide;
}

export const guideIndexCopy = {
  en: {
    metadataTitle: "Clothing product video guides | AI Clothes Video",
    metadataDescription: "Practical, evidence-led guides for matching clothing images, choosing source formats and video length, planning shots, and reducing garment drift.",
    eyebrow: "AI Clothes Video · Practical guides",
    title: "Make better clothing videos before you press generate",
    intro: "Use these field guides to match one traceable SKU, choose the right source format, plan only the shots your images can support, and review the result with realistic expectations.",
    parentLabel: "Start with the three-image workflow",
    articleLabel: "Read guide",
    evidenceTitle: "The shared rule behind every guide",
    evidenceBody: "A product video should not claim more than the source images prove. Front, back, and detail images each define a different part of the available shot range.",
  },
  "zh-CN": {
    metadataTitle: "服装商品视频实用指南｜AI Clothes Video",
    metadataDescription: "从核对同款素材、选择图片形态、规划分镜和视频时长到减少细节漂移，了解如何制作更可控的 AI 服装商品视频。",
    eyebrow: "AI Clothes Video · 实用指南",
    title: "点击生成前，先把服装视频做对",
    intro: "用这些指南核对同一件 SKU、选择合适的素材形态、规划图片真正支持的镜头，并以合理预期检查生成结果。",
    parentLabel: "先了解三图生成流程",
    articleLabel: "阅读指南",
    evidenceTitle: "所有指南共用的一条原则",
    evidenceBody: "商品视频不能展示超过源图片证据的内容。正面、背面和细节图分别决定不同的可用镜头范围。",
  },
} satisfies Record<SiteLocale, {
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  intro: string;
  parentLabel: string;
  articleLabel: string;
  evidenceTitle: string;
  evidenceBody: string;
}>;

export const guideArticles = {
  "clothing-video-without-back-image": {
    slug: "clothing-video-without-back-image",
    parentHref: "/three-images-to-clothing-video",
    ctaHref: "/workspace?mode=trial&preset=minimal_studio",
    relatedSlugs: [
      "choose-clothing-video-length",
      "why-ai-clothing-videos-deform",
    ],
    imageSrc: "/demo/cases/burgundy-midi-dress/back.webp",
    en: {
      metadataTitle: "Can you make a clothing video without a back image? | AI Clothes Video",
      title: "Can you make a clothing video without a back image?",
      description: "A front image cannot prove a garment's back construction. Learn which shots need a real back image, how the three-image workflow handles missing evidence, and how to capture a usable back view.",
      eyebrow: "Material guide · Back-view evidence",
      directAnswer: "Not if the video needs to show the real back. Without a back image, do not generate a back view, front-to-back transition, model turn, or 360-degree rotation. Capture the missing evidence first.",
      imageAlt: "Synthetic back product image of an adult burgundy midi dress",
      imageCaption: "A traceable synthetic back image from the same SKU set. Back construction must come from an actual back view, not a front-image guess.",
      parentLabel: "See how the three-image workflow defines available shots",
      sections: [
        {
          heading: "Why a front image cannot stand in for the back",
          paragraphs: [
            ["A front product image can prove the visible neckline, silhouette, print, and construction. It cannot prove whether the back has a zipper, vent, tie, cutout, graphic, or a different seam layout. An AI model may create a visually plausible answer, but plausible is not the same as the garment you sell."],
            ["For a product video, that distinction matters. An invented belt, missing opening, or shifted print can create the wrong buyer expectation. The ", { href: "/three-images-to-clothing-video", label: "three-image clothing video workflow" }, " assigns a role to every image so each shot has identifiable source evidence."],
          ],
          bullets: [
            "Front image: proves the overall front silhouette and visible graphics.",
            "Back image: proves the actual back construction and supports back-facing shots.",
            "Detail image: proves visible fabric, collar, cuff, hardware, or print details.",
          ],
        },
        {
          heading: "Can the public workflow accept only two images?",
          paragraphs: [
            ["No. AI Clothes Video currently asks you to choose a three-image protocol and upload three valid images of the same garment. The recommended product-view protocol uses front, back, and detail images."],
            ["“Do not show the back without evidence” and “submit only two images” are different product behaviors. The first is a generation boundary; the second is not a public capability today. If the back image is missing, complete the source set instead of using an unrelated image to fill the slot."],
            ["Review the ", { href: "/faq", label: "material and authorization questions" }, " or compare your source set with the ", { href: "/examples", label: "traceable clothing examples" }, " before uploading."],
          ],
        },
        {
          heading: "How to capture a usable clothing back image",
          paragraphs: [
            ["You do not need a complex new campaign shoot, but the replacement image must make the product evidence clearer rather than introduce another contradiction."],
          ],
          numberedItems: [
            "Use the exact same SKU, color, trim, and product version as the front image.",
            "Show the complete back construction without hair, arms, outerwear, or props covering key areas.",
            "Keep zippers, ties, vents, seams, and graphics sharp enough to inspect.",
            "Avoid filters or aggressive retouching that changes color or removes real construction.",
            "Keep the garment scale reasonably close to the front image so the two views are easier to compare.",
            "Confirm that you hold the necessary image, likeness, and commercial-use rights.",
          ],
        },
        {
          heading: "Requests to avoid even after you add a back image",
          paragraphs: [
            ["One back image does not automatically make every motion safe. Continuous 360-degree rotation and large model turns require more complete views and stricter consistency checks. A style choice cannot override those source requirements."],
            ["When the material supports only a stable product view, a restrained push-in, pan, or small framing change communicates the item more honestly than an unsupported dramatic move. Read ", { href: "/guides/why-ai-clothing-videos-deform", label: "why AI clothing videos drift or deform" }, " to understand how shot motion changes the risk."],
          ],
        },
        {
          heading: "Complete the evidence before generating",
          paragraphs: [
            ["Place the front, back, and detail images side by side. If you can already see a color, pattern, trim, or silhouette mismatch, do not expect generation to reconcile it. Replace the conflicting image first, then start with a low-risk shot and review the complete video."],
          ],
        },
      ],
      relatedHeading: "Continue preparing this SKU",
      ctaTitle: "Have front, back, and detail images ready?",
      ctaBody: "Start with one low-risk 8-second trial and see which shots your matched source set can support.",
      ctaLabel: "Start with three matched images",
    },
    "zh-CN": {
      metadataTitle: "没有背面图可以生成服装视频吗？｜AI Clothes Video",
      title: "没有背面图可以生成服装视频吗？",
      description: "正面图无法证明服装背部结构。了解哪些镜头必须有真实背面图、三图流程如何处理缺失素材，以及怎样补拍合格的背面图。",
      eyebrow: "素材指南 · 背面证据",
      directAnswer: "如果视频需要展示真实背面，就不可以。没有背面图时，不应生成背面展示、正背切换、真人转身或 360 度旋转；请先补齐缺失素材。",
      imageAlt: "成人深酒红中长连衣裙合成背面商品图",
      imageCaption: "同一 SKU 素材组中的可追溯合成背面图。背部结构必须来自真实背面视角，不能由正面图猜测。",
      parentLabel: "了解三图流程如何决定可用镜头",
      sections: [
        {
          heading: "为什么正面图不能代替背面图",
          paragraphs: [
            ["正面商品图只能证明已经看见的领口、轮廓、图案和结构。它无法证明背部有没有拉链、开衩、系带、露背、印花或不同的拼接。AI 可以生成一种视觉上合理的答案，但合理不等于你正在销售的真实商品。"],
            ["商品视频里的这种差异不能当作小误差。多出一条腰带、少一个开口或印花位置错误，都可能让买家形成错误预期。", { href: "/three-images-to-clothing-video", label: "三张同款服装图生成流程" }, "会给每张图分配明确角色，让每个镜头都能找到素材依据。"],
          ],
          bullets: [
            "正面图：证明整体正面轮廓与可见图案。",
            "背面图：证明真实背部结构并支持背面镜头。",
            "细节图：证明已拍到的面料、领口、袖口、辅料或印花。",
          ],
        },
        {
          heading: "当前公开流程可以只传两张图吗",
          paragraphs: [
            ["不可以。AI Clothes Video 当前要求先选择一种三图协议，再上传三张同款有效素材；推荐的商品展示协议使用正面、背面和细节图。"],
            ["“没有证据时不展示背面”和“只传两张图也能提交”是两种不同能力。前者是生成边界，后者目前不是公开能力。缺少背面图时，应补齐素材，而不是用无关图片占位。"],
            ["上传前可以先查看", { href: "/faq", label: "素材与授权常见问题" }, "，再对照", { href: "/examples", label: "可追溯服装素材案例" }, "检查自己的图片。"],
          ],
        },
        {
          heading: "怎样补拍一张合格的服装背面图",
          paragraphs: [
            ["不必重新做复杂棚拍，但补拍图片必须让商品证据更清楚，不能带来新的矛盾。"],
          ],
          numberedItems: [
            "使用完全相同的 SKU、颜色、辅料和商品版本。",
            "拍到完整背部结构，不要让头发、手臂、外套或道具遮挡关键区域。",
            "让拉链、系带、开衩、缝线和印花清晰可辨。",
            "避免改变颜色或抹掉真实结构的强滤镜与过度修图。",
            "尽量保持服装主体尺度与正面图接近，方便核对两个视角。",
            "确认拥有图片、肖像和商业宣传所需的授权。",
          ],
        },
        {
          heading: "补了背面图也不该强求的镜头",
          paragraphs: [
            ["一张背面图不代表所有运动都安全。连续 360 度旋转和真人大幅转身需要更完整视角与更严格的一致性检查，风格选择不能绕过这些素材要求。"],
            ["如果素材只支持稳定商品展示，克制的慢推、平移或小范围景别变化，比没有依据的大动作更符合商品信息准确性的目标。继续阅读", { href: "/zh/guides/why-ai-clothing-videos-deform", label: "AI 服装视频为什么会漂移或变形" }, "，可以进一步理解镜头运动带来的风险。"],
          ],
        },
        {
          heading: "先补齐证据，再开始生成",
          paragraphs: [
            ["把正面、背面和细节图并排检查。如果肉眼已经能看出颜色、印花、辅料或版型不一致，就不要指望生成阶段自动修正。先替换冲突素材，再从低风险镜头开始，并完整预览最终视频。"],
          ],
        },
      ],
      relatedHeading: "继续准备这个 SKU",
      ctaTitle: "正面、背面和细节图都准备好了吗？",
      ctaBody: "先生成一条低风险 8 秒试用视频，看看同款素材能够支持哪些镜头。",
      ctaLabel: "用三张同款素材开始生成",
    },
  },
  "choose-clothing-video-length": {
    slug: "choose-clothing-video-length",
    parentHref: "/three-images-to-clothing-video",
    ctaHref: "/workspace?mode=trial&preset=minimal_studio",
    relatedSlugs: [
      "clothing-video-without-back-image",
      "why-ai-clothing-videos-deform",
    ],
    imageSrc: "/demo/cases/burgundy-midi-dress/minimal-studio-poster.webp",
    en: {
      metadataTitle: "8, 16, 24, or 32 seconds: choose a clothing product video length | AI Clothes Video",
      title: "Should a clothing product video be 8, 16, 24, or 32 seconds?",
      description: "Choose clothing product video length by the number of buyer questions you need to answer. Compare the shot structure, source-image pressure, and best use for 8-, 16-, 24-, and 32-second videos.",
      eyebrow: "Decision guide · Video length",
      directAnswer: "Choose 8 seconds for one clear product idea, 16 seconds for a main view plus one useful supplement, 24 seconds when three distinct shots have evidence, and 32 seconds only when a fourth shot answers another real buyer question. Longer is not automatically better.",
      imageAlt: "Poster frame from a real 8-second minimal-studio clothing video workflow",
      imageCaption: "A real 8-second workflow result from a traceable synthetic source set. One focused shot can be enough when the objective is clear.",
      parentLabel: "See how three images become one clothing video",
      sections: [
        {
          heading: "Start with the number of questions, not the number of seconds",
          paragraphs: [
            ["Before asking whether a longer video looks more professional, ask how many buyer questions this asset must answer. A single hero movement may be enough for product-page motion testing. Showing the overall shape, real back, and a visible construction detail needs more shots and more complete evidence."],
            ["AI Clothes Video builds public lengths from independent 8-second shots: 8 seconds uses one shot, 16 seconds uses two, 24 seconds uses three, and 32 seconds uses four. The ", { href: "/three-images-to-clothing-video", label: "three-image workflow" }, " explains how source roles constrain each shot."],
          ],
        },
        {
          heading: "8 seconds: validate one core view",
          paragraphs: [
            ["An 8-second video is best when one product idea deserves the viewer's full attention. It is also the clearest way to test a new SKU before committing to a longer structure."],
          ],
          bullets: [
            "Test whether a clean front view benefits from restrained motion.",
            "Create a short product-page asset or an internal review sample.",
            "Validate whether the source set and selected shot preserve the garment.",
            "Use the free trial: one low-resolution, silent, watermarked 8-second video with low-risk shots.",
          ],
        },
        {
          heading: "16 seconds: cover a standard product story",
          paragraphs: [
            ["A 16-second video combines two 8-second shots. It works well when a primary view needs one meaningful supplement: overall view plus an uploaded detail, front plus an evidence-backed back, or a stable product view plus a restrained social treatment."],
            ["The second shot must still earn its place. If there is no back image, do not turn it into a back view or front-to-back transition. Read what to do ", { href: "/guides/clothing-video-without-back-image", label: "when the back image is missing" }, " before choosing the sequence."],
          ],
        },
        {
          heading: "24 seconds: give every shot a distinct job",
          paragraphs: [
            ["A 24-second video uses three 8-second shots and suits a well-documented SKU that genuinely needs a broader explanation. A useful structure is: establish the overall silhouette, add a real second view, then show a detail that appears in the uploaded source."],
            ["Do not repeat the same move three times just to fill the duration. Repetition does not add product information, while every extra generated segment and transition adds another place to inspect for drift."],
          ],
        },
        {
          heading: "32 seconds: use four shots only when each adds evidence",
          paragraphs: [
            ["A 32-second video combines four 8-second shots. Use it when a well-documented SKU needs a fourth evidence-backed answer, such as a second construction detail, a supported side view, or a restrained alternate treatment that is materially different from the first three shots."],
            ["Do not stretch a three-shot story by repeating motion. If you cannot name the buyer question and source evidence for the fourth shot, 24 seconds is the stronger choice."],
          ],
        },
        {
          heading: "A practical length decision table",
          paragraphs: [
            ["Use this as a starting rule, then confirm current credit and delivery details on the ", { href: "/pricing", label: "pricing page" }, "."],
          ],
          table: {
            headers: ["Goal", "Suggested length", "Shot structure"],
            rows: [
              ["Quick product test or one hero view", "8 seconds", "1 focused shot"],
              ["Standard single-SKU product introduction", "16 seconds", "Main view + 1 useful supplement"],
              ["Overall, second view, and detail all have evidence", "24 seconds", "3 shots with different jobs"],
              ["Four buyer questions have distinct source evidence", "32 seconds", "4 evidence-backed shots"],
            ],
          },
        },
        {
          heading: "Choose the shortest length that completes the job",
          paragraphs: [
            ["For a first generation, begin with 8 seconds and inspect whether the material and motion are suitable. Move to 16, 24, or 32 seconds only when you can name the purpose and source image for every added shot. This keeps the video informative instead of merely longer."],
          ],
        },
      ],
      relatedHeading: "Make the next shot evidence-led",
      ctaTitle: "Start by validating one focused shot",
      ctaBody: "Upload three matched images and create an 8-second trial before choosing a longer paid structure.",
      ctaLabel: "Choose a video length in the workspace",
    },
    "zh-CN": {
      metadataTitle: "服装商品视频做 8 秒、16 秒、24 秒还是 32 秒？｜AI Clothes Video",
      title: "服装商品视频做 8 秒、16 秒、24 秒还是 32 秒？",
      description: "按需要回答的购买问题选择服装商品视频时长，对比 8、16、24、32 秒的镜头结构、素材压力和适用场景。",
      eyebrow: "决策指南 · 视频时长",
      directAnswer: "只有一个明确商品信息时选 8 秒；主展示加一个有效补充时选 16 秒；三个镜头都有素材依据时选 24 秒；只有第四个镜头还能回答新的购买问题时才选 32 秒。更长不等于更好。",
      imageAlt: "真实 8 秒极简棚拍服装视频工作流海报帧",
      imageCaption: "来自可追溯合成素材组的真实 8 秒工作流结果。目标明确时，一个聚焦镜头已经足够。",
      parentLabel: "了解三张图片如何组成一条服装视频",
      sections: [
        {
          heading: "先数要回答的问题，不要先数秒数",
          paragraphs: [
            ["先别问更长的视频是否更专业，而要问这条素材需要回答几个购买问题。测试商品页主图动效时，一个镜头可能已经足够；同时展示整体、真实背面和可见工艺细节，则需要更多镜头和更完整的素材依据。"],
            ["AI Clothes Video 的公开时长由独立的 8 秒镜头组成：8 秒使用一个镜头，16 秒使用两个，24 秒使用三个，32 秒使用四个。", { href: "/zh/three-images-to-clothing-video", label: "三图生成流程" }, "会说明素材角色如何限制每个镜头。"],
          ],
        },
        {
          heading: "8 秒：先验证一个核心画面",
          paragraphs: [
            ["8 秒适合把注意力集中在一个商品信息上，也适合在投入更长结构前先验证新的 SKU。"],
          ],
          bullets: [
            "测试干净正面图是否适合克制运动。",
            "制作简短商品页素材或内部审核样片。",
            "验证素材与所选镜头是否能保持服装主体。",
            "使用免费试用：1 条 8 秒、低清、无音频、带水印且只开放低风险镜头的视频。",
          ],
        },
        {
          heading: "16 秒：覆盖常规商品介绍",
          paragraphs: [
            ["16 秒由两个 8 秒镜头组成，适合主展示加一个真正有用的补充：整体加已上传细节、正面加有素材依据的背面，或者稳定商品镜头加克制的社媒氛围。"],
            ["第二个镜头也必须有存在理由。没有背面图时，不要把它安排成背面或正背切换；选择前先看", { href: "/zh/guides/clothing-video-without-back-image", label: "缺少背面图该怎么办" }, "。"],
          ],
        },
        {
          heading: "24 秒：让三个镜头各有任务",
          paragraphs: [
            ["24 秒由三个 8 秒镜头组成，适合素材完整且确实需要更广解释的 SKU。一个清楚的结构是：先建立整体轮廓，再补充真实第二视角，最后展示源图片中已经出现的细节。"],
            ["不要为了填满时长，把同一个动作重复三遍。重复不会增加商品信息，每增加一个生成片段和转场，却会增加一个需要检查漂移的位置。"],
          ],
        },
        {
          heading: "32 秒：四个镜头都必须增加有效信息",
          paragraphs: [
            ["32 秒由四个 8 秒镜头组成，适合素材依据充分、且确实需要回答第四个购买问题的 SKU，例如补充第二个工艺细节、有依据的侧面视角，或与前三个镜头明显不同的克制展示方式。"],
            ["不要用重复动作把三镜头结构硬拖到四镜头。如果说不清第四个镜头要回答什么、依据哪张素材，24 秒反而是更强的选择。"],
          ],
        },
        {
          heading: "一张实用的时长选择表",
          paragraphs: [
            ["先用这张表判断，再到", { href: "/zh/pricing", label: "价格页面" }, "确认当前点数与交付规格。"],
          ],
          table: {
            headers: ["目标", "建议时长", "镜头结构"],
            rows: [
              ["快速测款或一个主展示", "8 秒", "1 个聚焦镜头"],
              ["常规单 SKU 商品介绍", "16 秒", "主展示 + 1 个有效补充"],
              ["整体、第二视角和细节都有依据", "24 秒", "3 个职责不同的镜头"],
              ["四个购买问题都有独立素材依据", "32 秒", "4 个有依据的镜头"],
            ],
          },
        },
        {
          heading: "选择刚好完成任务的最短时长",
          paragraphs: [
            ["第一次生成可以先做 8 秒，检查素材和运动是否合适。只有在你能说清每个新增镜头的目的与对应图片时，再升级到 16、24 或 32 秒。这样视频增加的是信息，而不只是长度。"],
          ],
        },
      ],
      relatedHeading: "让下一个镜头也有素材依据",
      ctaTitle: "先验证一个聚焦镜头",
      ctaBody: "上传三张同款图片，先生成 8 秒试用视频，再决定是否需要更长的付费结构。",
      ctaLabel: "进入工作台选择视频时长",
    },
  },
  "why-ai-clothing-videos-deform": {
    slug: "why-ai-clothing-videos-deform",
    parentHref: "/three-images-to-clothing-video",
    ctaHref: "/workspace?mode=trial&preset=minimal_studio",
    relatedSlugs: [
      "clothing-video-without-back-image",
      "choose-clothing-video-length",
    ],
    imageSrc: "/demo/cases/burgundy-midi-dress/detail.webp",
    en: {
      metadataTitle: "Why AI clothing videos deform: four causes and checks | AI Clothes Video",
      title: "Why do AI clothing videos deform or drift?",
      description: "Understand why silhouettes, prints, cuffs, and hems drift in AI clothing videos. Check source consistency, missing views, shot motion, and complete frames before publishing.",
      eyebrow: "Quality guide · Garment consistency",
      directAnswer: "Drift usually grows when source images contradict each other, a shot asks for an unseen view, motion exceeds the available evidence, or the final review checks only a good-looking frame. Reduce the uncertainty at each step; do not expect a prompt to erase it.",
      imageAlt: "Synthetic neckline and waist detail image of an adult burgundy midi dress",
      imageCaption: "A traceable detail image establishes the real neckline, waist seam, and visible fabric. Those features become review points in the generated video.",
      parentLabel: "See the source-evidence rules in the three-image workflow",
      sections: [
        {
          heading: "Cause 1: the source images do not show the same SKU",
          paragraphs: [
            ["A common failure begins before generation. The front is black while the back is dark blue; the detail comes from another production run; button, print, or hem positions disagree; or one image has been retouched so heavily that its color no longer matches."],
            ["When multiple images give different answers for the same construction, continuous frames are more likely to drift between them. Put all three sources side by side and compare color, graphics, neckline, sleeves, waist, trim, and hem. The ", { href: "/examples", label: "traceable source examples" }, " show how image roles should remain auditable."],
          ],
        },
        {
          heading: "Cause 2: the requested shot shows something the images do not",
          paragraphs: [
            ["A model asked to turn a front image into a back view must invent the hidden construction. The same problem appears when a fabric close-up has no detail image, a rotation has no side view, or a person is introduced without model material."],
            ["A stronger prompt does not create evidence. The ", { href: "/three-images-to-clothing-video", label: "three-image protocol" }, " narrows shot permissions before style influences the result. If the missing evidence is specifically the back, follow the ", { href: "/guides/clothing-video-without-back-image", label: "back-image preparation guide" }, " first."],
          ],
          bullets: [
            "No back image: no back view, turn, or front-to-back transition.",
            "No detail image: no unsupported collar, cuff, print, or texture close-up.",
            "No continuous multi-view evidence: no forced 360-degree rotation.",
            "No person or scene source: no invented model performance or lifestyle claim.",
          ],
        },
        {
          heading: "Cause 3: the camera or subject motion exceeds the evidence",
          paragraphs: [
            ["Large motion usually requires more unseen intermediate states. A slow push, restrained pan, or small framing change can rely mostly on visible features. A major turn, strong perspective change, or continuous rotation asks the model to preserve more angles, construction, and human state."],
            ["Motion should serve product information. For a new SKU, validate one low-risk shot before stacking several high-motion shots. The ", { href: "/guides/choose-clothing-video-length", label: "8-, 16-, 24-, and 32-second guide" }, " explains how every added shot should have its own evidence and job."],
          ],
        },
        {
          heading: "Cause 4: the review checks a poster, not the video",
          paragraphs: [
            ["One attractive first frame does not prove that the entire video is accurate. Drift may appear only in the middle of a move, near a transition, or during the final frames. Review the complete output and pause around every structural change."],
          ],
          bullets: [
            "Does the main garment color stay stable?",
            "Do prints, buttons, zippers, and seams stay in place?",
            "Do the neckline, cuff, shoulder, and hem change shape suddenly?",
            "Do front and back shots still look like the same SKU?",
            "Do stitched segments introduce a silhouette or background jump?",
          ],
        },
        {
          heading: "A 60-second pre-upload check",
          paragraphs: [
            ["Before creating a task, confirm that every planned shot can point to a specific source image. If any answer is unclear, replace the image, capture the missing view, or lower the motion risk. Do not leave a source contradiction for generation to solve by chance."],
          ],
          numberedItems: [
            "Confirm all three images show the same SKU, color, and version.",
            "Place front, back, and detail images in the correct roles.",
            "Check that critical construction is sharp, visible, and not cropped.",
            "Match detail-image print, hardware, and fabric back to the main image.",
            "Remove any requested angle or detail that has no source evidence.",
            "Confirm model likeness and commercial-use authorization when a person appears.",
          ],
        },
        {
          heading: "More controllable does not mean pixel-identical",
          paragraphs: [
            ["Evidence checks, shot limits, and post-generation frame review can reduce unsupported changes, but generative video remains uncertain. Products that require extremely exact fit, material, or brand-detail reproduction still need human review and may require traditional production as the final safeguard."],
          ],
        },
      ],
      relatedHeading: "Reduce uncertainty before the next generation",
      ctaTitle: "Ready to test one matched source set?",
      ctaBody: "Start with a low-risk 8-second trial, then review the complete motion against the three source images.",
      ctaLabel: "Generate from three matched images",
    },
    "zh-CN": {
      metadataTitle: "AI 服装视频为什么会变形？4 个原因与检查方法｜AI Clothes Video",
      title: "AI 服装视频为什么会变形或漂移？",
      description: "了解 AI 服装视频中的版型、印花、袖口和下摆为什么会漂移，并在发布前检查素材一致性、缺失视角、镜头运动和连续画面。",
      eyebrow: "质量指南 · 服装一致性",
      directAnswer: "素材互相矛盾、镜头要求未拍到的角度、运动超过图片依据，或者审核只看一张好看的画面，都会放大漂移。要在每个环节减少不确定性，不能指望提示词把它抹掉。",
      imageAlt: "成人深酒红中长连衣裙合成领口与腰线细节图",
      imageCaption: "可追溯细节图确定真实领口、腰线与可见面料，这些特征也应成为生成视频的检查点。",
      parentLabel: "查看三图流程中的素材证据规则",
      sections: [
        {
          heading: "原因一：输入图片并非同一件 SKU",
          paragraphs: [
            ["很多问题在生成前已经发生：正面是黑色款，背面是深蓝色款；细节来自不同批次；纽扣、印花或下摆位置互相矛盾；或者一张图被过度修饰，颜色已经无法对应。"],
            ["多张图片对同一结构给出不同答案时，连续画面更容易在答案之间漂移。请把三张素材并排放大，检查颜色、图案、领口、袖型、腰线、辅料和下摆。", { href: "/zh/examples", label: "可追溯素材案例" }, "展示了不同图片角色应如何保留核对依据。"],
          ],
        },
        {
          heading: "原因二：镜头要求展示图片中没有的内容",
          paragraphs: [
            ["让模型从正面图转到背面，它只能猜测隐藏结构。没有细节图却要求面料微距、没有侧面图却要求旋转，或没有真人素材却加入人物，也会遇到同样问题。"],
            ["更强硬的提示词不能创造证据。", { href: "/zh/three-images-to-clothing-video", label: "三图协议" }, "会在风格影响结果前先限制镜头权限；如果缺少的是背面证据，请先按", { href: "/zh/guides/clothing-video-without-back-image", label: "背面图准备指南" }, "补齐素材。"],
          ],
          bullets: [
            "没有背面图：不做背面、转身或正背切换。",
            "没有细节图：不做无依据的领口、袖口、印花或材质特写。",
            "没有连续多视角依据：不强求 360 度旋转。",
            "没有真人或场景素材：不虚构模特动作或生活方式场景。",
          ],
        },
        {
          heading: "原因三：镜头或主体运动超过素材依据",
          paragraphs: [
            ["大幅运动通常需要补全更多看不见的中间状态。慢推、克制平移或小范围景别变化主要依赖已经可见的特征；大幅转身、强透视变化和连续旋转，则要求模型维持更多角度、结构与人物状态。"],
            ["运动必须服务商品信息。新的 SKU 应先验证一个低风险镜头，再叠加多个大运动镜头。", { href: "/zh/guides/choose-clothing-video-length", label: "8、16、24 和 32 秒选择指南" }, "说明了每个新增镜头为什么都需要自己的素材依据和任务。"],
          ],
        },
        {
          heading: "原因四：审核只看封面，没有看完整视频",
          paragraphs: [
            ["一张好看的首帧不能证明整段视频准确。漂移可能只出现在动作中段、转场附近或最后几帧。请完整播放结果，并在每次结构变化附近暂停检查。"],
          ],
          bullets: [
            "服装主色是否保持稳定？",
            "印花、纽扣、拉链与缝线位置是否稳定？",
            "领口、袖口、肩线和下摆是否突然改变形状？",
            "正面与背面镜头是否仍像同一件 SKU？",
            "多个片段拼接时是否出现版型或背景跳变？",
          ],
        },
        {
          heading: "上传前 60 秒检查",
          paragraphs: [
            ["创建任务前，确认每个计划镜头都能指出对应的源图片。如果任何答案不清楚，请换图、补拍缺失视角或降低运动风险，不要把素材矛盾留给生成阶段碰运气。"],
          ],
          numberedItems: [
            "确认三张图片属于同一 SKU、同一颜色和同一版本。",
            "把正面、背面和细节图放进正确的素材位置。",
            "检查关键结构是否清晰可见且没有被裁掉。",
            "把细节图中的印花、辅料和面料与主图逐项对应。",
            "移除任何没有素材依据的角度或细节要求。",
            "真人出镜时确认肖像与商业使用授权。",
          ],
        },
        {
          heading: "更可控不等于逐像素不变",
          paragraphs: [
            ["素材检查、镜头限制和生成后抽帧可以减少无依据变化，但生成式视频仍有不确定性。对版型、材质或品牌细节精确度要求极高的商品，仍需要人工复核，并可能需要传统制作作为最终保障。"],
          ],
        },
      ],
      relatedHeading: "在下一次生成前继续减少不确定性",
      ctaTitle: "准备验证一组同款素材了吗？",
      ctaBody: "先生成一条低风险 8 秒试用视频，再用三张源图片核对完整运动。",
      ctaLabel: "用三张同款素材开始生成",
    },
  },
  "check-clothing-images-match": {
    slug: "check-clothing-images-match",
    parentHref: "/three-images-to-clothing-video",
    ctaHref: "/workspace?mode=trial&preset=minimal_studio",
    relatedSlugs: [
      "why-ai-clothing-videos-deform",
      "model-mannequin-flat-lay-for-ai-video",
    ],
    imageSrc: "/demo/cases/structured-blazer/front.webp",
    en: {
      metadataTitle: "Clothing product image consistency checklist | AI Clothes Video",
      title: "How do you check whether clothing images show the same SKU?",
      description: "Use a practical clothing product image consistency checklist before making an AI video. Compare color, silhouette, print placement, trim, crop, and source rights.",
      eyebrow: "Source checklist · SKU consistency",
      directAnswer: "Place every source image side by side and verify the product facts, not just the filename. Color, silhouette, print placement, hardware, and construction must describe the same SKU before you plan motion.",
      imageAlt: "Front product image of a structured blazer used for a same-SKU consistency check",
      imageCaption: "A clean front image establishes visible product facts. Back and detail images should confirm this exact color, construction, trim, and version.",
      parentLabel: "See where each source image fits in the three-image workflow",
      sections: [
        {
          heading: "The same filename does not prove the same product",
          paragraphs: [
            ["Two images can share a product code and still show different colors, samples, production runs, or retouched versions. AI video generation has to reconcile everything visible in the frame, so a small source disagreement can become a moving color shift, changing button, or unstable hem."],
            ["The ", { href: "/three-images-to-clothing-video", label: "three-image workflow" }, " treats front, back, and detail images as evidence for one garment. Before uploading, your job is to confirm that those pieces of evidence agree."],
          ],
        },
        {
          heading: "Run a five-point same-SKU check",
          paragraphs: [
            ["Open the images at a similar scale and compare fixed product facts. Do not rely on an overall impression; inspect the places most likely to reveal a nearby colorway or sample version."],
          ],
          bullets: [
            "Color and material: compare neutral areas, highlights, knit density, sheen, and wash effects.",
            "Silhouette and proportions: check length, shoulder width, waist position, sleeve shape, and hem.",
            "Print and panel placement: match repeats, logo position, stripes, seams, and color blocking.",
            "Trim and hardware: count buttons, pockets, zippers, snaps, ties, labels, and decorative pieces.",
            "Construction details: compare neckline, cuffs, vents, pleats, lining, and back closures.",
          ],
        },
        {
          heading: "Separate photography differences from product differences",
          paragraphs: [
            ["Lighting, white balance, camera distance, and pose can make a matching garment look different. A warm studio light may shift color; a close detail crop may enlarge a print; a model pose may change the apparent hemline. These are photography differences, not automatic proof of a mismatch."],
            ["Look for facts that should not move with the camera: the number of buttons, the order of stripes, the location of a seam, or the shape of a zipper pull. If those disagree, replace the image. If only exposure or crop differs, choose the clearest set and keep the planned motion restrained."],
          ],
        },
        {
          heading: "What to do when one source image conflicts",
          paragraphs: [
            ["Do not ask the prompt to choose the correct version. A text instruction cannot erase conflicting visual evidence. Resolve the source set before generation."],
          ],
          numberedItems: [
            "Identify the exact conflicting fact, such as color, button count, print position, or length.",
            "Check the product record or original shoot folder to determine which image belongs to the active SKU.",
            "Replace the outlier with a front, back, or detail image from the same product version.",
            "If no replacement exists, capture the missing view instead of filling the slot with a similar item.",
            "Repeat the side-by-side check and confirm the required image and likeness rights.",
          ],
        },
        {
          heading: "Match the source set before choosing shots",
          paragraphs: [
            ["Once the three images agree, decide what each one can actually support. A real back view can support back-facing options; a visible detail can support a restrained close-up. The guide to ", { href: "/guides/why-ai-clothing-videos-deform", label: "why clothing videos deform or drift" }, " explains what happens when sources disagree, while the ", { href: "/guides/model-mannequin-flat-lay-for-ai-video", label: "model, mannequin, and flat-lay comparison" }, " helps you choose the right source format."],
            ["For a visual benchmark, compare the traceable sets on the ", { href: "/examples", label: "source examples page" }, ". Your own SKU still needs its own evidence check."],
          ],
        },
      ],
      relatedHeading: "Continue improving the source set",
      ctaTitle: "Do all three images describe one garment?",
      ctaBody: "Upload the verified front, back, and detail set, then start with one low-risk 8-second trial.",
      ctaLabel: "Test a matched source set",
    },
    "zh-CN": {
      metadataTitle: "服装商品图同款一致性检查清单｜AI Clothes Video",
      title: "如何检查服装图片是不是同一件 SKU？",
      description: "生成 AI 服装视频前，用清单核对商品图的颜色、版型、印花位置、辅料、裁切和素材授权，排除不同色号或版本混用。",
      eyebrow: "素材清单 · 同款一致性",
      directAnswer: "把所有素材图并排放大，核对真实商品信息，而不是只看文件名。颜色、版型、印花位置、辅料和结构都必须指向同一件 SKU，再开始规划运动镜头。",
      imageAlt: "用于同款一致性检查的结构感西装正面商品图",
      imageCaption: "清晰正面图用于确认可见商品信息。背面和细节图应继续证明同一颜色、结构、辅料与商品版本。",
      parentLabel: "查看每张素材图在三图流程中的作用",
      sections: [
        {
          heading: "文件名相同，不代表商品一定相同",
          paragraphs: [
            ["两张图片可能使用同一个货号，却来自不同颜色、样衣、生产批次或修图版本。AI 视频需要同时协调画面中的所有信息，源图里一个不起眼的矛盾，到了连续画面里可能变成颜色跳变、纽扣变化或下摆漂移。"],
            ["在", { href: "/three-images-to-clothing-video", label: "三图生成流程" }, "中，正面、背面和细节图共同为同一件服装提供证据。上传前必须先确认这些证据彼此一致。"],
          ],
        },
        {
          heading: "用五项清单核对同一件 SKU",
          paragraphs: [
            ["把图片调整到接近的显示尺度，逐项检查固定商品信息。不要只凭整体感觉，要重点看最容易暴露相似款、不同色号或不同样衣版本的位置。"],
          ],
          bullets: [
            "颜色与材质：比较中性区域、高光、针织密度、光泽和水洗效果。",
            "版型与比例：检查衣长、肩宽、腰线、袖型和下摆。",
            "印花与拼片位置：对应图案循环、Logo、条纹、缝线和撞色区域。",
            "辅料与五金：清点纽扣、口袋、拉链、按扣、系带、标签和装饰件。",
            "结构细节：比较领口、袖口、开衩、褶裥、里布和背部闭合方式。",
          ],
        },
        {
          heading: "区分拍摄差异和商品差异",
          paragraphs: [
            ["灯光、白平衡、拍摄距离和姿势会让同一件衣服看起来不同。暖色棚灯可能改变颜色，细节近拍会放大图案，模特姿势也会改变下摆的视觉位置。这些属于拍摄差异，不能直接判定为不同款。"],
            ["优先核对不会随相机变化的事实：纽扣数量、条纹顺序、缝线位置或拉链头形状。如果这些信息冲突，应更换图片；如果只是曝光或裁切不同，就选择更清晰的一组，并降低镜头运动幅度。"],
          ],
        },
        {
          heading: "发现一张图冲突时怎么办",
          paragraphs: [
            ["不要在 prompt 里要求模型自行选择正确版本。文字指令无法消除互相冲突的视觉证据，应在生成前先修正素材组。"],
          ],
          numberedItems: [
            "指出具体冲突项，例如颜色、纽扣数量、印花位置或衣长。",
            "检查商品资料或原始拍摄文件夹，确认哪张图属于当前销售 SKU。",
            "用同一商品版本的正面、背面或细节图替换异常图片。",
            "没有替代图时补拍缺失视角，不要用相似款凑满上传位置。",
            "再次并排核对，并确认图片、肖像和商业使用授权。",
          ],
        },
        {
          heading: "素材一致后再选择镜头",
          paragraphs: [
            ["三张图一致后，再决定每张图实际能支持什么。真实背面图可以支持背面相关选项，清晰细节图可以支持克制的局部特写。可以继续阅读", { href: "/guides/why-ai-clothing-videos-deform", label: "AI 服装视频为什么会变形" }, "，了解素材冲突如何影响连续画面；也可以对比", { href: "/guides/model-mannequin-flat-lay-for-ai-video", label: "真人模特、人台和平铺素材" }, "的适用边界。"],
            ["需要视觉参照时，可查看", { href: "/examples", label: "可追溯素材案例" }, "。但示例不能替代对自己 SKU 的逐项检查。"],
          ],
        },
      ],
      relatedHeading: "继续改善素材组",
      ctaTitle: "三张图都在描述同一件服装吗？",
      ctaBody: "上传核对完成的正面、背面和细节图，先生成一条低风险 8 秒试用视频。",
      ctaLabel: "验证一组同款素材",
    },
  },
  "model-mannequin-flat-lay-for-ai-video": {
    slug: "model-mannequin-flat-lay-for-ai-video",
    parentHref: "/three-images-to-clothing-video",
    ctaHref: "/workspace?mode=trial&preset=minimal_studio",
    relatedSlugs: [
      "check-clothing-images-match",
      "plan-clothing-video-shots",
    ],
    imageSrc: "/demo/cases/knit-cardigan/front.webp",
    en: {
      metadataTitle: "Model vs mannequin vs flat lay for AI clothing video | AI Clothes Video",
      title: "Model, mannequin, or flat lay: which clothing photos work for AI video?",
      description: "Compare model, mannequin, and flat-lay clothing photos for AI video by garment evidence, occlusion, fit information, rights, and the shots each format can support.",
      eyebrow: "Source comparison · Presentation format",
      directAnswer: "There is no universal winner. Model photos show fit and drape, mannequin images isolate structure, and flat lays show outline and visible details. Choose the format that answers the buyer question and keep all three sources consistent.",
      imageAlt: "Front product image of a knit cardigan prepared as a traceable clothing source",
      imageCaption: "The useful source format is the one that clearly proves the garment facts needed by the planned shot.",
      parentLabel: "See the accepted source roles in the three-image workflow",
      sections: [
        {
          heading: "Choose evidence before you choose a look",
          paragraphs: [
            ["Sellers often ask which presentation style produces the most impressive AI video. That starts from the wrong decision. First decide whether the video needs to prove fit, construction, outline, or a visible detail; then choose images that contain that evidence."],
            ["Whichever format you use, the ", { href: "/three-images-to-clothing-video", label: "three-image workflow" }, " still requires a consistent source set and applies shot permissions from the visible material. A style preset cannot invent a hidden view."],
          ],
        },
        {
          heading: "Compare the three source formats",
          paragraphs: [
            ["Each format removes one uncertainty and introduces another. Use the trade-offs rather than treating the options as a quality ranking."],
          ],
          table: {
            headers: ["Source format", "Strongest evidence", "Main limitation", "Safer starting use"],
            rows: [
              ["Model photo", "Fit, drape, scale, and styling on a person", "Hands, hair, pose, and body can occlude the garment; likeness rights apply", "Stable framing or restrained motion using the visible pose"],
              ["Mannequin photo", "Garment shape and construction with fewer body distractions", "Pins, clips, hollow areas, or hidden back structure may still be missing", "Product-focused push-in, pan, or front/back sequence when both views exist"],
              ["Flat lay", "Outline, print placement, and visible details on one plane", "Weak evidence for worn fit, depth, and natural drape", "Slow pan, crop change, or detail-led product motion"],
            ],
          },
        },
        {
          heading: "When model photos are the right source",
          paragraphs: [
            ["Use model images when fit, proportion, and drape are central to the buyer question. The source should show the garment clearly, with key areas unobstructed and the same adult model across views used in one task."],
            ["Model images also carry extra responsibilities. Confirm likeness and commercial-use rights, avoid mixing different people in one source set, and do not infer an unseen pose or body angle. Review the ", { href: "/faq", label: "material and authorization guidance" }, " before using a campaign image."],
          ],
        },
        {
          heading: "When mannequin or flat-lay images are more useful",
          paragraphs: [
            ["A mannequin set can be stronger when buyers need to inspect tailoring, closures, seams, or a clean silhouette without pose changes. A flat lay can be stronger for graphic placement, knit texture, accessories, or simple outline-led content."],
            ["Neither format proves worn fit. Do not turn a flat lay into an unsupported model performance or assume a mannequin front view proves the back. If a view is missing, follow the ", { href: "/guides/clothing-video-without-back-image", label: "back-image evidence rule" }, " and capture it first."],
          ],
        },
        {
          heading: "Build one coherent set",
          paragraphs: [
            ["Mixing formats can work only when every image still describes the same product version and each role is clear. For example, a model front, clean product back, and macro detail may answer complementary questions, but color, trim, and construction must match."],
            ["Run the ", { href: "/guides/check-clothing-images-match", label: "same-SKU image checklist" }, " before upload. Then use the ", { href: "/guides/plan-clothing-video-shots", label: "shot-list planning guide" }, " to map each source to one useful buyer question."],
          ],
        },
      ],
      relatedHeading: "Choose and verify the source format",
      ctaTitle: "Have one coherent three-image set?",
      ctaBody: "Upload the source format that best proves your product facts and start with a restrained 8-second trial.",
      ctaLabel: "Try the selected source set",
    },
    "zh-CN": {
      metadataTitle: "真人模特、人台还是平铺图适合 AI 服装视频？｜AI Clothes Video",
      title: "真人模特、人台还是平铺图：哪种素材适合 AI 服装视频？",
      description: "从商品证据、遮挡、上身效果、授权和可支持镜头，对比真人模特、人台和平铺服装图，选择适合 AI 商品视频的素材。",
      eyebrow: "素材对比 · 展示形态",
      directAnswer: "没有一种素材永远最好。真人图适合证明上身效果与垂坠，人台图更集中展示结构，平铺图擅长轮廓与可见细节。应根据买家问题选择，并确保三张素材一致。",
      imageAlt: "作为可追溯服装素材准备的针织开衫正面商品图",
      imageCaption: "真正有用的素材形态，是能清楚证明计划镜头所需服装信息的那一种。",
      parentLabel: "查看三图流程接受的素材角色",
      sections: [
        {
          heading: "先选择证据，再选择画面风格",
          paragraphs: [
            ["很多卖家先问哪种素材能生成最有冲击力的视频，这个问题的起点就偏了。应该先确认视频要证明上身效果、服装结构、整体轮廓还是某个可见细节，再选择包含相应证据的图片。"],
            ["无论使用哪种形态，", { href: "/three-images-to-clothing-video", label: "三图生成流程" }, "都要求素材组保持一致，并根据真实可见内容决定镜头权限。风格预设不能创造被遮挡或缺失的视角。"],
          ],
        },
        {
          heading: "对比三种素材形态",
          paragraphs: [
            ["每种形态都会减少一种不确定性，同时带来另一种限制。请根据取舍选择，而不是把它们简单排成质量高低。"],
          ],
          table: {
            headers: ["素材形态", "最强证据", "主要限制", "更稳妥的起始用途"],
            rows: [
              ["真人模特图", "上身比例、垂坠、尺度和穿搭效果", "手、头发、姿势和身体可能遮挡服装，并涉及肖像授权", "沿用可见姿势的稳定构图或克制运动"],
              ["人台图", "减少人物干扰，集中展示版型与结构", "别针、夹子、中空区域或背部结构仍可能不可见", "有对应视角时做商品慢推、平移或正背序列"],
              ["平铺图", "同一平面上的轮廓、印花位置和可见细节", "无法充分证明上身比例、厚度与自然垂坠", "慢速平移、裁切变化或细节导向运动"],
            ],
          },
        },
        {
          heading: "什么时候适合使用真人模特图",
          paragraphs: [
            ["当买家重点关心上身比例、版型和垂坠时，真人素材更有价值。图片应清楚展示服装，关键区域不能被遮挡；同一任务使用的多个真人视角也应保持同一位成年模特。"],
            ["真人素材还带来额外责任：确认肖像与商业使用授权，不要在同一素材组混用不同人物，也不要推断图片中没有的姿势或身体角度。使用活动拍摄图片前，先阅读", { href: "/faq", label: "素材与授权说明" }, "。"],
          ],
        },
        {
          heading: "什么时候人台图或平铺图更有用",
          paragraphs: [
            ["如果买家需要查看剪裁、闭合方式、缝线或干净轮廓，人台素材可能更直接；如果重点是印花位置、针织纹理、配件或简单轮廓，平铺图可能更清楚。"],
            ["但这两种形态都不能证明真实上身效果。不要把平铺图强行变成没有依据的真人表演，也不要因为有人台正面图就假设背面结构。缺少视角时，应遵守", { href: "/guides/clothing-video-without-back-image", label: "背面素材证据规则" }, "并先补拍。"],
          ],
        },
        {
          heading: "组成一组逻辑一致的素材",
          paragraphs: [
            ["只有当每张图仍指向同一商品版本、角色也清楚时，混合素材形态才可能有效。例如真人正面、干净商品背面和微距细节可以回答互补问题，但颜色、辅料与结构必须一致。"],
            ["上传前先执行", { href: "/guides/check-clothing-images-match", label: "同款图片检查清单" }, "，再用", { href: "/guides/plan-clothing-video-shots", label: "分镜规划指南" }, "把每张素材对应到一个有用的买家问题。"],
          ],
        },
      ],
      relatedHeading: "继续选择并核对素材形态",
      ctaTitle: "已经准备好一组逻辑一致的三张图了吗？",
      ctaBody: "上传最能证明商品信息的素材形态，先生成一条运动克制的 8 秒试用视频。",
      ctaLabel: "试用选定的素材组",
    },
  },
  "plan-clothing-video-shots": {
    slug: "plan-clothing-video-shots",
    parentHref: "/three-images-to-clothing-video",
    ctaHref: "/workspace?mode=trial&preset=minimal_studio",
    relatedSlugs: [
      "choose-clothing-video-length",
      "check-clothing-images-match",
    ],
    imageSrc: "/demo/cases/burgundy-midi-dress/front.webp",
    en: {
      metadataTitle: "How to plan a clothing product video shot list | AI Clothes Video",
      title: "How to plan a clothing product video shot list",
      description: "Plan a clothing product video shot list by mapping each buyer question to a real source image, a restrained camera move, and an 8-second segment.",
      eyebrow: "Shot planning · Buyer questions",
      directAnswer: "Give each 8-second shot one buyer question, one identifiable source image, and one restrained motion. If you cannot point to the evidence for a shot, remove it or capture the missing view.",
      imageAlt: "Front product image of a burgundy midi dress used to plan a clothing video shot list",
      imageCaption: "Start a shot list with a buyer question and a source image, not with a dramatic camera move.",
      parentLabel: "See how the three-image workflow limits available shots",
      sections: [
        {
          heading: "Start with buyer questions, not camera moves",
          paragraphs: [
            ["A useful product video helps a shopper inspect something specific: overall silhouette, back construction, visible texture, print placement, or fit. Writing “cinematic orbit” first gives the model a motion request but gives the buyer no reason for that motion."],
            ["In the ", { href: "/three-images-to-clothing-video", label: "three-image workflow" }, ", available shots come from the source roles and template rules. Build the shot list inside those boundaries, then choose a style preset for tone."],
          ],
        },
        {
          heading: "Map each question to source evidence",
          paragraphs: [
            ["Use this map as a planning gate. The source column must name an image that actually contains the information; a prompt is not a substitute for a missing view."],
          ],
          table: {
            headers: ["Buyer question", "Required source evidence", "Lower-risk shot idea"],
            rows: [
              ["What is the overall front silhouette?", "Clear front image of the same SKU", "Stable hero frame with a slow push-in"],
              ["What does the real back look like?", "Unobstructed back image", "Back-facing product frame or a permitted front/back sequence"],
              ["Where are the visible details?", "Sharp detail image matching the main product", "Restrained close-up or small pan across the visible detail"],
              ["How does it fit or drape?", "Authorized adult model image showing that fit", "Small framing change that preserves the visible pose"],
            ],
          },
        },
        {
          heading: "Use one job per 8-second segment",
          paragraphs: [
            ["Treat each 8-second segment as one information job. An 8-second video answers one question; 16 seconds can answer two; 24 seconds can answer three; 32 seconds can answer four only when the source set supports four distinct jobs."],
            ["The ", { href: "/guides/choose-clothing-video-length", label: "video length guide" }, " helps you decide how many questions the SKU needs to answer. Do not stretch one weak idea across extra segments or repeat the same motion to make the video look longer."],
          ],
        },
        {
          heading: "Set a motion budget for every shot",
          paragraphs: [
            ["Motion should reveal existing evidence, not force the model to invent intermediate views. A slow push-in changes scale; a small pan changes framing. A large turn, orbit, or perspective shift asks for substantially more unseen structure."],
            ["Start with the smallest motion that communicates the product fact. Increase movement only when the required angles are present, the relevant template is enabled, and the result can be reviewed for drift."],
          ],
          bullets: [
            "Front-only evidence: prefer stable framing, a slow push-in, or a limited pan.",
            "Front and real back evidence: consider only the back or transition options allowed by the current rules.",
            "Detail evidence: keep the crop on the detail that is actually visible.",
            "Incomplete multi-angle evidence: do not request a continuous 360-degree reconstruction.",
          ],
        },
        {
          heading: "Write and review the shot list",
          paragraphs: [
            ["Before generation, use a short worksheet. After generation, review the complete motion rather than only the cover frame. Remove a shot if its product value is unclear or its evidence cannot be named."],
          ],
          numberedItems: [
            "Write one buyer question for the segment.",
            "Name the front, back, detail, or authorized model image that answers it.",
            "Choose an enabled template whose permissions match that evidence.",
            "Specify the smallest useful movement and avoid unsupported angles.",
            "Check the result against the source set, including transitions and final frames.",
          ],
        },
        {
          heading: "Fix source conflicts before finalizing the plan",
          paragraphs: [
            ["A clean shot list cannot repair mismatched inputs. Run the ", { href: "/guides/check-clothing-images-match", label: "same-SKU consistency checklist" }, " before assigning shots. If the source set conflicts, replace the image first; if a view is missing, narrow the plan."],
          ],
        },
      ],
      relatedHeading: "Continue planning the product video",
      ctaTitle: "Can every planned shot name its evidence?",
      ctaBody: "Upload the verified source set and validate the first buyer question with one low-risk 8-second trial.",
      ctaLabel: "Build the first evidence-led shot",
    },
    "zh-CN": {
      metadataTitle: "如何规划服装商品视频分镜清单？｜AI Clothes Video",
      title: "如何规划服装商品视频分镜清单？",
      description: "把每个买家问题对应到真实素材图、克制的镜头运动和独立 8 秒片段，规划有证据依据的服装商品视频分镜。",
      eyebrow: "分镜规划 · 买家问题",
      directAnswer: "每个 8 秒镜头只回答一个买家问题，并明确对应一张真实素材图和一种克制运动。如果无法指出镜头证据，就删掉该镜头或先补拍缺失视角。",
      imageAlt: "用于规划服装商品视频分镜的深酒红中长连衣裙正面商品图",
      imageCaption: "规划分镜时应先写买家问题和对应素材，而不是先追求夸张的镜头运动。",
      parentLabel: "查看三图流程如何限制可用镜头",
      sections: [
        {
          heading: "先写买家问题，不要先写镜头运动",
          paragraphs: [
            ["有用的商品视频会帮助买家检查一项具体信息：整体版型、背部结构、可见纹理、印花位置或上身效果。如果一开始只写“电影感环绕”，模型得到的是运动要求，买家却未必从运动中获得商品信息。"],
            ["在", { href: "/three-images-to-clothing-video", label: "三图生成流程" }, "中，可用镜头由素材角色和模板规则共同决定。应先在这些边界内规划分镜，再用风格预设调整画面基调。"],
          ],
        },
        {
          heading: "把每个问题映射到素材证据",
          paragraphs: [
            ["把这张表当作分镜门禁。素材一栏必须能指出真正包含该信息的图片；文字 prompt 不能代替缺失视角。"],
          ],
          table: {
            headers: ["买家问题", "需要的素材证据", "较低风险的镜头思路"],
            rows: [
              ["正面整体版型是什么样？", "同一 SKU 的清晰正面图", "稳定主画面配合缓慢推进"],
              ["真实背面是什么样？", "无遮挡的背面图", "背面商品画面或规则允许的正背序列"],
              ["可见细节在哪里？", "与主商品一致的清晰细节图", "克制特写或沿可见细节小幅平移"],
              ["上身比例或垂坠如何？", "展示对应效果且已授权的成年模特图", "保留现有姿势的小幅构图变化"],
            ],
          },
        },
        {
          heading: "每个 8 秒片段只承担一项任务",
          paragraphs: [
            ["把每个 8 秒片段看成一个信息任务。8 秒回答一个问题，16 秒可以回答两个，24 秒可以回答三个；只有素材确实支持四项不同任务时，32 秒才有意义。"],
            ["可以用", { href: "/guides/choose-clothing-video-length", label: "视频时长选择指南" }, "判断这个 SKU 需要回答几个问题。不要为了显得更长，把一个薄弱想法拉成多个片段，也不要重复同一种运动。"],
          ],
        },
        {
          heading: "给每个镜头设置运动预算",
          paragraphs: [
            ["运动应该揭示已经存在的证据，而不是逼迫模型编造中间视角。慢推主要改变尺度，小幅平移主要改变构图；大幅转身、环绕或透视变化则需要补全更多未显示结构。"],
            ["先选择能表达商品信息的最小运动。只有相关角度已经存在、对应模板已启用，并且结果能接受漂移检查时，才考虑增加运动。"],
          ],
          bullets: [
            "只有正面证据：优先稳定构图、慢推或有限平移。",
            "有正面和真实背面证据：只考虑当前规则允许的背面或切换选项。",
            "有细节证据：让裁切始终围绕真正可见的细节。",
            "多角度证据不完整：不要要求连续 360 度重建。",
          ],
        },
        {
          heading: "写出并检查分镜清单",
          paragraphs: [
            ["生成前用一份简短工作表确认分镜；生成后检查完整运动，而不是只看封面帧。如果某个镜头的商品价值说不清，或者找不到素材证据，就应移除。"],
          ],
          numberedItems: [
            "为当前片段写一个买家问题。",
            "指出回答该问题的正面、背面、细节或已授权模特图。",
            "选择权限与素材证据一致的已启用模板。",
            "写出最小有效运动，并排除没有依据的角度。",
            "用源素材检查生成结果，包括转场和最后几帧。",
          ],
        },
        {
          heading: "最终确定前先解决素材冲突",
          paragraphs: [
            ["清楚的分镜也无法修复互相矛盾的输入。分配镜头前先执行", { href: "/guides/check-clothing-images-match", label: "同款一致性检查" }, "。素材冲突时先换图，缺少视角时就缩小分镜范围。"],
          ],
        },
      ],
      relatedHeading: "继续规划商品视频",
      ctaTitle: "每个计划镜头都能指出素材证据吗？",
      ctaBody: "上传核对完成的素材组，用一条低风险 8 秒试用视频验证第一个买家问题。",
      ctaLabel: "创建第一个有证据的镜头",
    },
  },
} as const satisfies Record<GuideSlug, GuideArticle>;

export function isGuideSlug(value: string): value is GuideSlug {
  return guideSlugs.includes(value as GuideSlug);
}

export function guidePath(slug: GuideSlug) {
  return `/guides/${slug}` as const;
}
