import type { SiteLocale } from "@/lib/i18n/config";

export const guideSlugs = [
  "clothing-video-without-back-image",
  "choose-clothing-video-length",
  "why-ai-clothing-videos-deform",
  "check-clothing-images-match",
  "model-mannequin-flat-lay-for-ai-video",
  "plan-clothing-video-shots",
  "how-to-photograph-clothing-details",
  "choose-clothing-video-aspect-ratio",
  "review-clothing-video-before-publishing",
  "choose-background-for-clothing-video",
  "choose-clothing-video-cover-image",
  "when-to-reshoot-clothing-photos",
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
    metadataDescription: "Evidence-led guides for clothing photos, backgrounds, video format, cover images, shot planning, source triage, and quality review.",
    eyebrow: "AI Clothes Video · Practical guides",
    title: "Make better clothing videos before you press generate",
    intro: "Use these field guides to prepare one traceable SKU, choose the background and format, plan supported shots, select an honest cover, and review the result before publishing.",
    parentLabel: "Start with the three-image workflow",
    articleLabel: "Read guide",
    evidenceTitle: "The shared rule behind every guide",
    evidenceBody: "A product video should not claim more than the source images prove. Front, back, and detail images each define a different part of the available shot range.",
  },
  "zh-CN": {
    metadataTitle: "服装商品视频实用指南｜AI Clothes Video",
    metadataDescription: "从核对与重拍素材、选择背景、时长、画幅和封面，到规划分镜与发布前检查，了解如何制作更可控的 AI 服装商品视频。",
    eyebrow: "AI Clothes Video · 实用指南",
    title: "点击生成前，先把服装视频做对",
    intro: "用这些指南准备同一件 SKU、判断是否需要重拍、选择背景与格式、规划有证据的镜头，并在发布前检查成片和封面。",
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
  "how-to-photograph-clothing-details": {
    slug: "how-to-photograph-clothing-details",
    parentHref: "/three-images-to-clothing-video",
    ctaHref: "/workspace?mode=trial&preset=minimal_studio",
    relatedSlugs: [
      "check-clothing-images-match",
      "clothing-video-without-back-image",
    ],
    imageSrc: "/demo/cases/structured-blazer/detail.webp",
    en: {
      metadataTitle: "How to photograph clothing details for AI video | AI Clothes Video",
      title: "How to photograph clothing details for AI video",
      description: "Capture a useful clothing detail image for AI video. Choose one buyer question, keep a recognizable garment anchor, preserve color, and match the same SKU.",
      eyebrow: "Source guide · Detail evidence",
      directAnswer: "Photograph one visible product fact at a time, but keep enough surrounding garment structure to identify where the detail belongs. A sharp fabric patch with no recognizable anchor is not a reliable detail source.",
      imageAlt: "Close detail product image of a structured blazer showing lapel and button construction",
      imageCaption: "A useful detail image is close enough to inspect while retaining enough structure to match it to the main garment.",
      parentLabel: "See how detail evidence fits the three-image workflow",
      sections: [
        {
          heading: "Start with one buyer question",
          paragraphs: [
            ["A detail image should answer something a shopper may reasonably inspect: how a closure works, where a print sits, what the cuff looks like, or which visible texture defines the garment. Trying to capture every feature in one crop usually makes none of them clear."],
            ["The ", { href: "/three-images-to-clothing-video", label: "three-image workflow" }, " assigns the detail slot to visible evidence. It does not turn a generic texture sample into proof of every fabric property or hidden construction."],
          ],
          table: {
            headers: ["Buyer question", "Useful detail frame", "Avoid"],
            rows: [
              ["How is it fastened?", "Closure plus nearby seam or neckline", "A cropped button with no garment context"],
              ["Where is the print placed?", "Print plus a recognizable edge or panel", "A pattern swatch from another product"],
              ["What does the cuff or collar look like?", "Complete cuff or collar with its attachment", "A partial edge cut off by the frame"],
              ["What visible texture is present?", "Sharp surface detail plus a matching construction cue", "An extreme macro that hides color and location"],
            ],
          },
        },
        {
          heading: "Keep a recognizable garment anchor",
          paragraphs: [
            ["Move close enough for the feature to be readable, then leave one stable anchor in frame: a lapel edge, pocket opening, waist seam, zipper track, sleeve join, or print boundary. That anchor helps a reviewer match the crop to the front and back images."],
            ["If nobody can tell where the crop came from when the three images are placed side by side, widen the frame. The goal is product evidence, not the closest possible macro."],
          ],
        },
        {
          heading: "Protect color, sharpness, and construction",
          paragraphs: [
            ["Use even light, avoid colored reflections, and focus on the feature rather than the background. Strong filters, beauty retouching, fabric smoothing, and oversharpening can change the product fact you are trying to preserve."],
          ],
          bullets: [
            "Keep the complete feature inside the frame without cutting off its edges.",
            "Remove hands, tags, props, or hair when they cover the relevant construction.",
            "Use the same product color and version as the front and back images.",
            "Check that highlights do not erase stitching, texture, or hardware shape.",
            "Do not claim softness, weight, stretch, or composition from appearance alone.",
          ],
        },
        {
          heading: "Match the detail to the same SKU",
          paragraphs: [
            ["A beautiful close-up from a nearby colorway is still the wrong source. Compare button count, thread color, print order, seam placement, and hardware shape against the main product images before uploading."],
            ["Run the ", { href: "/guides/check-clothing-images-match", label: "same-SKU consistency checklist" }, " when the crop is hard to identify. If the detail cannot be confirmed, reshoot it instead of asking a prompt to reconcile the difference."],
          ],
        },
        {
          heading: "Plan only the close-up the image supports",
          paragraphs: [
            ["A detail image can support a restrained close-up of the visible feature when the corresponding template is available. It does not prove an unseen lining, reverse side, full fabric behavior, or another part of the garment."],
            ["The same evidence rule applies to missing views. If you also need real back construction, follow the ", { href: "/guides/clothing-video-without-back-image", label: "back-image capture checklist" }, " rather than trying to extract it from a detail crop."],
          ],
        },
      ],
      relatedHeading: "Complete and verify the source set",
      ctaTitle: "Is the detail both clear and traceable?",
      ctaBody: "Upload the matched front, back, and detail images, then start with one low-risk 8-second trial.",
      ctaLabel: "Test the verified detail image",
    },
    "zh-CN": {
      metadataTitle: "如何拍摄适合 AI 视频的服装细节图？｜AI Clothes Video",
      title: "如何拍摄适合 AI 视频的服装细节图？",
      description: "拍摄适合 AI 服装视频的细节素材：明确一个买家问题，保留可识别的服装结构锚点，维持真实颜色，并确认属于同一 SKU。",
      eyebrow: "素材指南 · 细节证据",
      directAnswer: "每张细节图只聚焦一个可见商品事实，同时保留足够的周边结构，让人能确认细节属于服装哪个位置。只有一块面料、却没有可识别锚点的微距图，并不是可靠素材。",
      imageAlt: "展示驳领与纽扣结构的西装细节商品图",
      imageCaption: "有效细节图既要足够近，便于检查，也要保留足够结构，能够和主商品图对应。",
      parentLabel: "查看细节证据在三图流程中的作用",
      sections: [
        {
          heading: "先确定一个买家问题",
          paragraphs: [
            ["细节图应该回答买家可能真正检查的问题：闭合方式是什么、印花位于哪里、袖口或领口是什么结构，或者哪一种可见纹理构成商品特征。一张图想同时拍清所有细节，通常会让每项信息都不够明确。"],
            ["在", { href: "/three-images-to-clothing-video", label: "三图生成流程" }, "中，细节图位置用于提供真实可见证据。它不会把一块普通纹理样本自动变成所有面料属性或隐藏结构的证明。"],
          ],
          table: {
            headers: ["买家问题", "有效细节画面", "需要避免"],
            rows: [
              ["服装如何闭合？", "闭合件加附近缝线或领口", "没有服装上下文的单颗纽扣"],
              ["印花位于哪里？", "印花加可识别边缘或拼片", "来自其他商品的图案样本"],
              ["袖口或领口是什么样？", "完整结构及其连接位置", "被画面裁掉一半的边缘"],
              ["有哪些可见纹理？", "清晰表面加可对应的结构线索", "隐藏颜色和位置的极端微距"],
            ],
          },
        },
        {
          heading: "保留一个可识别的服装锚点",
          paragraphs: [
            ["靠近到细节能够看清，然后在画面中保留一个稳定锚点，例如驳领边缘、口袋开口、腰线、拉链轨道、袖子接缝或印花边界。这样才能把细节图与正面、背面图对应起来。"],
            ["把三张图并排后，如果没有人能判断这张细节图来自哪里，就把画面拍宽一点。目标是提供商品证据，不是追求尽可能近的微距。"],
          ],
        },
        {
          heading: "保护真实颜色、清晰度与结构",
          paragraphs: [
            ["使用均匀光线，避免彩色反光，并把焦点放在商品结构而不是背景上。强滤镜、美颜修图、面料磨皮和过度锐化都可能改变你原本想保留的商品事实。"],
          ],
          bullets: [
            "让完整细节保持在画面内，不要切掉关键边缘。",
            "手、吊牌、道具或头发遮挡结构时应移开。",
            "必须与正面、背面图使用同一商品颜色和版本。",
            "检查高光是否抹掉缝线、纹理或五金形状。",
            "不要仅凭画面宣称柔软度、重量、弹性或成分。",
          ],
        },
        {
          heading: "确认细节来自同一件 SKU",
          paragraphs: [
            ["附近色号的漂亮特写仍然是错误素材。上传前要把纽扣数量、线色、印花顺序、缝线位置和五金形状与主商品图逐项对应。"],
            ["细节来源难以确认时，执行", { href: "/guides/check-clothing-images-match", label: "同款一致性检查" }, "。无法确认就重新拍摄，不要要求 prompt 自动协调差异。"],
          ],
        },
        {
          heading: "只规划素材真正支持的特写",
          paragraphs: [
            ["当对应模板可用时，细节图可以支持围绕真实可见特征的克制特写，但不能证明隐藏里布、反面结构、完整面料动态或服装其他位置。"],
            ["缺失视角也遵循同一规则。如果还要展示真实背部，请使用", { href: "/guides/clothing-video-without-back-image", label: "背面图补拍清单" }, "，不要尝试从局部细节图推断背面。"],
          ],
        },
      ],
      relatedHeading: "继续补齐并核对素材组",
      ctaTitle: "这张细节图既清楚又可追溯吗？",
      ctaBody: "上传核对完成的正面、背面和细节图，先生成一条低风险 8 秒试用视频。",
      ctaLabel: "验证这张细节素材",
    },
  },
  "choose-clothing-video-aspect-ratio": {
    slug: "choose-clothing-video-aspect-ratio",
    parentHref: "/three-images-to-clothing-video",
    ctaHref: "/workspace?mode=trial&preset=minimal_studio",
    relatedSlugs: [
      "choose-clothing-video-length",
      "plan-clothing-video-shots",
    ],
    imageSrc: "/demo/cases/burgundy-midi-dress/minimal-studio-poster.webp",
    en: {
      metadataTitle: "9:16, 1:1, or 16:9 clothing video aspect ratio | AI Clothes Video",
      title: "9:16, 1:1, or 16:9: which clothing video aspect ratio should you choose?",
      description: "Choose a clothing video aspect ratio by placement and composition. Compare 9:16, 1:1, and 16:9, protect garment details, and preview platform overlays.",
      eyebrow: "Format guide · Aspect ratio",
      directAnswer: "Choose the placement first: 9:16 for a vertical-first frame, 1:1 for a compact square placement, or 16:9 for a horizontal canvas. Then compose for that ratio before generation instead of relying on a destructive crop afterward.",
      imageAlt: "Vertical poster frame from an 8-second minimal-studio clothing product video",
      imageCaption: "A vertical frame works when the garment remains readable from neckline to hem and important details stay away from interface overlays.",
      parentLabel: "See how source images become a clothing product video",
      sections: [
        {
          heading: "Start with the final placement",
          paragraphs: [
            ["Aspect ratio is a distribution decision, not a style filter. The same garment may need different framing on a vertical short-video feed, a square product tile, or a horizontal page section. Decide where the primary version will appear before you generate it."],
            ["AI Clothes Video supports 9:16, 1:1, and 16:9 in the workspace. The ", { href: "/three-images-to-clothing-video", label: "three-image workflow" }, " still controls which garment views are available; changing the canvas cannot create missing product evidence."],
          ],
        },
        {
          heading: "Compare 9:16, 1:1, and 16:9",
          paragraphs: [
            ["Use these as composition starting points. Platform requirements and interface overlays change, so verify the current destination before publishing rather than treating any table as permanent platform policy."],
          ],
          table: {
            headers: ["Ratio", "Best starting use", "Composition pressure", "Check before export"],
            rows: [
              ["9:16", "Vertical-first short video and mobile viewing", "Limited side space; full garments can become narrow", "Keep neckline, hem, and selling detail clear of top and bottom overlays"],
              ["1:1", "Compact product placements and reusable social crops", "Less vertical room for long garments", "Confirm the full silhouette is not cut at head, sleeve, or hem"],
              ["16:9", "Horizontal page sections, presentations, and wider viewing", "Extra side space can weaken a centered product", "Use intentional negative space without shrinking the garment too far"],
            ],
          },
        },
        {
          heading: "Compose instead of cropping later",
          paragraphs: [
            ["A late crop can remove cuffs, hems, a back closure, or the exact detail a shot was meant to show. It can also enlarge a low-resolution region and shift the garment away from the intended focal point."],
            ["Choose the ratio in the workspace, then inspect every source image inside that shape. If a long dress becomes too small in 16:9 or a wide pose is clipped in 9:16, adjust the planned shot rather than assuming post-production will repair it."],
          ],
          bullets: [
            "Keep the complete product fact for the shot inside the frame.",
            "Leave breathing room around hems, sleeves, and moving edges.",
            "Reserve safe space for captions, controls, or commerce overlays.",
            "Do not place essential details at the extreme edge of the canvas.",
          ],
        },
        {
          heading: "Keep aspect ratio separate from video length",
          paragraphs: [
            ["Ratio answers where and how the frame will be viewed. Length answers how many buyer questions the video needs to cover. A 9:16 video is not automatically short, and a 16:9 video does not need more shots."],
            ["Use the ", { href: "/guides/choose-clothing-video-length", label: "8-, 16-, 24-, and 32-second decision guide" }, " for duration, then use the ", { href: "/guides/plan-clothing-video-shots", label: "shot-list worksheet" }, " to confirm each segment still has identifiable source evidence."],
          ],
        },
        {
          heading: "Preview the real destination",
          paragraphs: [
            ["Before publishing, test the exported video in the actual product page or platform draft. Check the mobile and desktop presentation, poster frame, captions, controls, and any interface area that may cover the garment."],
            ["If one version must serve several placements, preserve a clear central product zone. For important campaigns, generate or edit placement-specific versions instead of forcing one crop to perform every job."],
          ],
        },
      ],
      relatedHeading: "Plan the format and shot structure",
      ctaTitle: "Know where the first version will appear?",
      ctaBody: "Choose 9:16, 1:1, or 16:9 in the workspace and validate one focused shot before building longer versions.",
      ctaLabel: "Choose the video aspect ratio",
    },
    "zh-CN": {
      metadataTitle: "服装视频选 9:16、1:1 还是 16:9？｜AI Clothes Video",
      title: "服装视频选 9:16、1:1 还是 16:9？",
      description: "根据发布位置和构图选择服装视频画幅，对比 9:16、1:1 与 16:9，保护服装关键细节，并预览平台界面遮挡。",
      eyebrow: "格式指南 · 视频画幅",
      directAnswer: "先确定发布位置：竖屏优先画面可选 9:16，紧凑方形位置可选 1:1，横向展示可选 16:9。应在生成前按目标画幅构图，不要依赖生成后的破坏性裁切。",
      imageAlt: "8 秒极简影棚服装商品视频的竖屏封面帧",
      imageCaption: "竖屏画面要确保服装从领口到下摆仍清晰可读，并让关键细节避开界面遮挡区域。",
      parentLabel: "查看素材图如何组成服装商品视频",
      sections: [
        {
          heading: "先确定最终发布位置",
          paragraphs: [
            ["画幅比例是分发决策，不是风格滤镜。同一件服装放在竖屏短视频信息流、方形商品位置或横向页面区块时，所需构图不同。生成前先决定哪个位置是主要版本。"],
            ["AI Clothes Video 工作台支持 9:16、1:1 和 16:9。", { href: "/three-images-to-clothing-video", label: "三图生成流程" }, "仍然决定可以展示哪些服装视角；改变画布不能创造缺失的商品证据。"],
          ],
        },
        {
          heading: "对比 9:16、1:1 和 16:9",
          paragraphs: [
            ["把下面内容作为构图起点。平台要求和界面遮挡会变化，发布前必须核对目标位置的最新规则，不能把任何尺寸表当作永久平台政策。"],
          ],
          table: {
            headers: ["比例", "适合的起始用途", "构图压力", "导出前检查"],
            rows: [
              ["9:16", "竖屏优先短视频与移动观看", "横向空间有限，完整长款服装可能显得过窄", "让领口、下摆和卖点避开上下界面遮挡"],
              ["1:1", "紧凑商品位置与可复用社交媒体裁切", "长款服装的纵向空间较少", "确认头部、袖子和下摆没有被切掉"],
              ["16:9", "横向页面区块、演示与宽屏观看", "多余侧边空间可能削弱居中商品", "合理利用留白，不要把服装缩得过小"],
            ],
          },
        },
        {
          heading: "按画幅构图，不要事后硬裁",
          paragraphs: [
            ["后期强行裁切可能切掉袖口、下摆、背部闭合结构，或恰好删掉镜头原本要展示的细节；还可能放大低分辨率区域，让服装偏离原定视觉重点。"],
            ["先在工作台选择比例，再检查每张素材放进该画幅后的效果。如果长裙在 16:9 中过小，或宽幅姿势在 9:16 中被切掉，应调整计划镜头，而不是假设后期一定能补救。"],
          ],
          bullets: [
            "镜头要表达的完整商品信息必须保留在画面内。",
            "下摆、袖子和运动边缘周围要留出呼吸空间。",
            "为字幕、控件或电商界面预留安全区域。",
            "关键细节不要贴在画布最边缘。",
          ],
        },
        {
          heading: "把画幅和视频时长分开决定",
          paragraphs: [
            ["画幅回答画面在哪里、如何被观看；时长回答视频需要处理几个买家问题。9:16 不代表一定短，16:9 也不代表必须增加镜头。"],
            ["时长可参考", { href: "/guides/choose-clothing-video-length", label: "8、16、24、32 秒选择指南" }, "，然后用", { href: "/guides/plan-clothing-video-shots", label: "分镜清单" }, "确认每个片段仍能指出明确素材证据。"],
          ],
        },
        {
          heading: "在真实发布位置预览",
          paragraphs: [
            ["发布前，把导出视频放进真实商品页或平台草稿中测试。检查移动端与桌面端展示、封面帧、字幕、控件，以及任何可能遮挡服装的界面区域。"],
            ["如果一个版本必须用于多个位置，就保留清晰的中央商品安全区。重要活动更适合生成或编辑不同发布位置的专用版本，不要强迫一个裁切承担所有任务。"],
          ],
        },
      ],
      relatedHeading: "继续规划格式与镜头结构",
      ctaTitle: "已经确定第一个版本的发布位置了吗？",
      ctaBody: "在工作台选择 9:16、1:1 或 16:9，先验证一个聚焦镜头，再制作更长版本。",
      ctaLabel: "选择服装视频画幅",
    },
  },
  "review-clothing-video-before-publishing": {
    slug: "review-clothing-video-before-publishing",
    parentHref: "/three-images-to-clothing-video",
    ctaHref: "/workspace?mode=trial&preset=minimal_studio",
    relatedSlugs: [
      "why-ai-clothing-videos-deform",
      "choose-clothing-video-aspect-ratio",
    ],
    imageSrc: "/demo/red-dress-poster.webp",
    en: {
      metadataTitle: "AI clothing video quality checklist before publishing | AI Clothes Video",
      title: "How to review an AI clothing video before publishing",
      description: "Use an AI clothing video quality checklist after generation. Review garment facts, continuity, crop, audio, rights, claims, and the real publishing placement.",
      eyebrow: "Publishing checklist · Human review",
      directAnswer: "Watch the complete video at normal speed and frame by frame, compare it with the source images, then preview it in the real destination. Automated QA reduces risk; it does not replace the seller who knows the SKU.",
      imageAlt: "Poster frame from a completed clothing product video ready for human review",
      imageCaption: "A good poster frame is only the start. Review the complete motion, transitions, audio, crop, and product claims before publishing.",
      parentLabel: "Review the complete three-image generation workflow",
      sections: [
        {
          heading: "Automated QA is a gate, not final approval",
          paragraphs: [
            ["AI Clothes Video performs post-generation quality checks before a deliverable is released, but automated sampling cannot understand every commercial fact about your SKU. A result can pass a technical check and still contain a subtle color, trim, or product-claim problem that only the seller recognizes."],
            ["The ", { href: "/three-images-to-clothing-video", label: "three-image workflow" }, " reduces unsupported shots; the final human review decides whether the video is accurate enough for its actual listing or campaign."],
          ],
        },
        {
          heading: "Compare garment facts with every source image",
          paragraphs: [
            ["Open the front, back, and detail images beside the video. Watch once at normal speed for overall coherence, then pause around motion peaks and transitions where drift is easier to miss."],
          ],
          bullets: [
            "Color, silhouette, length, neckline, sleeves, waist, and hem stay consistent.",
            "Prints, logos, buttons, pockets, zippers, ties, and seams do not move or disappear.",
            "Front, back, and detail shots still look like the same SKU and version.",
            "No unsupported body part, garment panel, background object, or accessory appears.",
            "The final frame remains usable and does not end on a distorted transition.",
          ],
        },
        {
          heading: "Check continuity, crop, and safe areas",
          paragraphs: [
            ["For multi-segment videos, inspect every join for a jump in garment scale, pose, lighting, background, or silhouette. Then review the selected canvas at the real display size."],
            ["Use the ", { href: "/guides/choose-clothing-video-aspect-ratio", label: "9:16, 1:1, and 16:9 guide" }, " to check whether hems, sleeves, captions, and important details remain clear of interface overlays. A technically valid frame can still be unusable when a commerce button covers the selling point."],
          ],
        },
        {
          heading: "Listen to audio and verify every claim",
          paragraphs: [
            ["Free trials are silent; paid generation includes audio by default. For a video with audio, listen on speakers and headphones for abrupt cuts, unexpected speech, clipping, or a mismatch with the brand context. Remove or replace audio that you cannot confidently publish."],
            ["Review every visible or spoken product statement. Do not imply an unseen material composition, performance property, fit guarantee, sustainability claim, or construction detail that the listing and source evidence cannot support."],
          ],
        },
        {
          heading: "Confirm rights and the destination preview",
          paragraphs: [
            ["Confirm the commercial-use rights for product images, logos, music, copy, and any recognizable adult model. Then load the video into the actual product page or platform draft without publishing it yet."],
          ],
          numberedItems: [
            "Preview the poster frame, first seconds, captions, controls, and autoplay behavior.",
            "Check mobile and desktop layouts where both are relevant.",
            "Confirm the video belongs to the correct SKU, color, locale, and listing.",
            "Record the approved version so an older draft is not uploaded by mistake.",
            "Keep a source-to-output audit trail for support, complaints, or takedown requests.",
          ],
        },
        {
          heading: "What to do when the video fails review",
          paragraphs: [
            ["Do not publish and hope viewers will ignore the problem. Identify whether the failure comes from mismatched sources, a missing view, an overambitious shot, the selected ratio, audio, or the final placement."],
            ["Use the guide to ", { href: "/guides/why-ai-clothing-videos-deform", label: "diagnose garment drift" }, ", replace the conflicting source or narrow the shot, then generate and review a new version. A failed human review is useful evidence for the next controlled attempt."],
          ],
        },
      ],
      relatedHeading: "Resolve issues before publishing",
      ctaTitle: "Ready to validate a controlled first version?",
      ctaBody: "Generate one low-risk 8-second trial, compare it with the source set, and apply the publishing checklist before wider use.",
      ctaLabel: "Create a version to review",
    },
    "zh-CN": {
      metadataTitle: "AI 服装视频发布前质量检查清单｜AI Clothes Video",
      title: "AI 服装视频发布前要检查什么？",
      description: "生成后使用 AI 服装视频质量清单，检查商品信息、连续性、裁切、音频、授权、商品陈述和真实发布位置。",
      eyebrow: "发布清单 · 人工复核",
      directAnswer: "先以正常速度观看完整视频，再逐帧检查关键位置，把成片与源图片对照，并放进真实发布位置预览。自动质检可以降低风险，但不能替代真正了解 SKU 的卖家。",
      imageAlt: "等待人工发布检查的服装商品视频封面帧",
      imageCaption: "好看的封面帧只是开始。发布前还要检查完整运动、转场、音频、裁切和商品陈述。",
      parentLabel: "回顾完整三图生成流程",
      sections: [
        {
          heading: "自动质检是门禁，不是最终批准",
          paragraphs: [
            ["AI Clothes Video 会在可交付前执行生成后质检，但自动抽帧无法理解你这件 SKU 的所有商业事实。成片可能通过技术检查，却仍有细微颜色、辅料或商品陈述问题，只有卖家自己能够识别。"],
            ["", { href: "/three-images-to-clothing-video", label: "三图生成流程" }, "会减少没有素材依据的镜头；最终人工复核则决定视频是否足够准确，可以用于真实商品页或推广活动。"],
          ],
        },
        {
          heading: "用每张源图片核对商品事实",
          paragraphs: [
            ["把正面、背面和细节图放在视频旁边。先按正常速度看一遍整体连续性，再停在运动峰值和转场附近，因为这些位置更容易隐藏细节漂移。"],
          ],
          bullets: [
            "颜色、版型、衣长、领口、袖子、腰线与下摆保持一致。",
            "印花、Logo、纽扣、口袋、拉链、系带与缝线没有移动或消失。",
            "正面、背面与细节镜头仍然像同一件 SKU 和同一版本。",
            "没有出现无素材依据的人体部位、服装拼片、背景物体或配件。",
            "最后一帧仍可使用，没有停在变形的转场中间。",
          ],
        },
        {
          heading: "检查连续性、裁切和安全区域",
          paragraphs: [
            ["多片段视频要检查每个拼接点，看服装尺度、姿势、灯光、背景或版型是否突然跳变。然后按真实显示尺寸检查所选画布。"],
            ["使用", { href: "/guides/choose-clothing-video-aspect-ratio", label: "9:16、1:1 与 16:9 画幅指南" }, "确认下摆、袖子、字幕和关键细节没有被界面遮挡。技术上有效的画面，也可能因为电商按钮盖住卖点而无法使用。"],
          ],
        },
        {
          heading: "试听音频并核对所有商品陈述",
          paragraphs: [
            ["免费试用没有音频，付费生成默认包含音频。有音频的视频要分别用扬声器和耳机试听，检查突兀剪切、意外人声、爆音或与品牌场景不符的内容。无法确认可发布的音频应移除或替换。"],
            ["检查所有画面和语音中的商品陈述。不要暗示素材与商品资料无法证明的面料成分、性能、合身保证、可持续性或隐藏结构。"],
          ],
        },
        {
          heading: "确认授权并在真实位置预览",
          paragraphs: [
            ["确认商品图片、Logo、音乐、文案和可识别成年模特都具备商业使用权。然后先把视频放进真实商品页或平台草稿，不要立即发布。"],
          ],
          numberedItems: [
            "预览封面帧、开头几秒、字幕、控件和自动播放行为。",
            "同时涉及移动端与桌面端时，分别检查布局。",
            "确认视频对应正确的 SKU、颜色、语言和商品页面。",
            "记录已批准版本，避免误传旧草稿。",
            "保留素材到成片的证据链，用于客服、投诉或下架请求。",
          ],
        },
        {
          heading: "人工检查不通过时怎么办",
          paragraphs: [
            ["不要抱着观众不会注意的侥幸心理发布。先判断问题来自素材冲突、缺失视角、镜头过度、画幅选择、音频还是最终发布位置。"],
            ["可以用", { href: "/guides/why-ai-clothing-videos-deform", label: "服装漂移诊断指南" }, "定位原因，更换冲突素材或收窄镜头，再生成并检查新版本。一次未通过的人工复核，是下一次可控尝试的有效证据。"],
          ],
        },
      ],
      relatedHeading: "发布前继续解决问题",
      ctaTitle: "准备验证一个可控的首版视频了吗？",
      ctaBody: "先生成一条低风险 8 秒试用视频，与源素材对照，并在扩大使用前执行发布检查清单。",
      ctaLabel: "生成一个待检查版本",
    },
  },
  "choose-background-for-clothing-video": {
    slug: "choose-background-for-clothing-video",
    parentHref: "/three-images-to-clothing-video",
    ctaHref: "/workspace?mode=trial&preset=minimal_studio",
    relatedSlugs: [
      "model-mannequin-flat-lay-for-ai-video",
      "plan-clothing-video-shots",
    ],
    imageSrc: "/demo/cases/structured-blazer/front.webp",
    en: {
      metadataTitle: "White or lifestyle background for clothing video | AI Clothes Video",
      title: "White background or lifestyle scene: which works for a clothing video?",
      description: "Choose a clothing video background by the job of the shot. Compare clean product views, flat lays, and lifestyle scenes without confusing atmosphere with garment evidence.",
      eyebrow: "Source decision · Background",
      directAnswer: "Use a clean or white background when the shot must make the garment easy to inspect. Use a real lifestyle scene when context is part of the message and you have permission to use it. In either case, the background cannot supply missing garment details.",
      imageAlt: "Structured blazer product image on a clean neutral background",
      imageCaption: "A clean background reduces visual competition and keeps the garment silhouette easy to inspect.",
      parentLabel: "See how every source image receives a defined role",
      sections: [
        {
          heading: "Give the background one clear job",
          paragraphs: [
            ["A background can isolate the product, show scale, suggest a use occasion, or establish a visual mood. Problems begin when one image is expected to do all four jobs. Decide what the shot must communicate before choosing a source."],
            ["In the ", { href: "/three-images-to-clothing-video", label: "three-image clothing video workflow" }, ", front, back, and detail images remain the evidence for the garment itself. Background choice changes presentation; it does not expand which clothing views are proven."],
          ],
        },
        {
          heading: "Compare clean, flat-lay, and lifestyle sources",
          paragraphs: [
            ["There is no universally best background. Choose the least complicated source that answers the buyer question without hiding the product."],
          ],
          table: {
            headers: ["Source", "Best use", "Main advantage", "Main risk"],
            rows: [
              ["White or neutral background", "Silhouette, construction, marketplace-style product view", "Low visual competition", "Weak context for occasion or scale"],
              ["Flat lay", "Outline, arrangement, visible front details", "Garment can fill the frame", "Does not prove worn fit or drape"],
              ["Real lifestyle scene", "Occasion, mood, environment", "Adds recognizable context", "Props, people, lighting, or clutter can obscure the garment"],
            ],
          },
        },
        {
          heading: "Treat a scene image as atmosphere, not product proof",
          paragraphs: [
            ["A scene image may guide background, lighting, and mood only. It should not be used to infer a different collar, fabric, print, accessory, body shape, storefront, or hidden garment view. Strong brand or real-store backgrounds also need actual source evidence and usage rights."],
            ["If the scene includes another garment, crop or replace it before use. Otherwise the model receives two competing answers about what the product looks like. Run the ", { href: "/guides/check-clothing-images-match", label: "same-SKU consistency check" }, " whenever a scene and product image appear to disagree."],
          ],
        },
        {
          heading: "Keep backgrounds consistent across a sequence",
          paragraphs: [
            ["A single good frame can still produce a weak multi-shot video if the floor line, light direction, color cast, scale, or camera height jumps between segments. Decide whether the background should stay continuous or whether a deliberate scene change adds new information."],
            ["The ", { href: "/guides/model-mannequin-flat-lay-for-ai-video", label: "model, mannequin, and flat-lay comparison" }, " helps separate source format from background choice. Then map the selected source to one job with the ", { href: "/guides/plan-clothing-video-shots", label: "shot-list guide" }, "."],
          ],
          bullets: [
            "Match the dominant light direction and avoid strong color contamination.",
            "Keep the garment large enough to inspect in the final canvas.",
            "Remove props that overlap the neckline, sleeves, waist, or hem.",
            "Do not use background cleanup to redraw product edges or construction.",
          ],
        },
        {
          heading: "Choose the simpler first test",
          paragraphs: [
            ["For a new SKU, start with the background that makes comparison with the source easiest. A restrained clean-background shot is often a better diagnostic than a complex scene because garment drift is easier to spot."],
            ["Once the product remains stable, test a scene only when it answers a different buyer question. Also verify the chosen ", { href: "/guides/choose-clothing-video-aspect-ratio", label: "video aspect ratio" }, " because a wide scene can become cluttered or lose the garment when cropped vertically."],
          ],
        },
      ],
      relatedHeading: "Prepare the source format and shot",
      ctaTitle: "Ready to test the simplest useful background?",
      ctaBody: "Upload one matched source set and validate a clean, low-risk 8-second shot before adding scene complexity.",
      ctaLabel: "Test a clean-background shot",
    },
    "zh-CN": {
      metadataTitle: "服装视频用白底还是场景背景？｜AI Clothes Video",
      title: "服装视频用白底还是场景背景？",
      description: "根据镜头任务选择服装视频背景，对比白底、平铺和真实场景素材，并明确场景氛围不能替代服装商品证据。",
      eyebrow: "素材决策 · 背景",
      directAnswer: "需要清楚检查服装时，优先使用白色或干净背景；需要表达使用场景、且拥有真实可用场景素材时，可以选择生活方式背景。无论选哪种，背景都不能补充素材中缺失的服装细节。",
      imageAlt: "干净中性背景上的结构感西装商品图",
      imageCaption: "干净背景可以减少视觉干扰，让服装轮廓和结构更容易检查。",
      parentLabel: "了解三图流程如何定义每张素材的角色",
      sections: [
        {
          heading: "先给背景一个明确任务",
          paragraphs: [
            ["背景可以隔离商品、说明尺度、暗示穿着场合或建立视觉氛围。问题通常来自要求一张图同时完成所有任务。选择素材前，先确定这个镜头必须传达什么。"],
            ["在", { href: "/three-images-to-clothing-video", label: "三张服装图生成视频流程" }, "中，正面、背面和细节图仍然是服装本身的证据。背景只改变展示方式，不能扩大已经得到证明的服装视角。"],
          ],
        },
        {
          heading: "对比白底、平铺和真实场景",
          paragraphs: [
            ["没有一种背景永远最好。应选择能回答买家问题、同时最少遮挡商品的素材。"],
          ],
          table: {
            headers: ["素材", "适合任务", "主要优势", "主要风险"],
            rows: [
              ["白色或中性背景", "版型、结构、平台型商品展示", "视觉干扰少", "缺少穿着场合和尺度语境"],
              ["平铺", "轮廓、摆放方式、正面可见细节", "服装可以充分占据画面", "不能证明真实上身与垂坠"],
              ["真实生活场景", "场合、氛围、环境", "提供可识别语境", "道具、人物、光线和杂物可能遮挡服装"],
            ],
          },
        },
        {
          heading: "场景图只提供氛围，不提供商品事实",
          paragraphs: [
            ["场景图只能用于背景、光线和氛围参考，不能用来推断另一种领口、面料、印花、配饰、人物体型、真实店铺或隐藏服装视角。强品牌场景和真实店铺背景也必须有真实素材依据与使用授权。"],
            ["如果场景里出现另一件服装，应先裁掉或更换场景，否则模型会收到两个互相竞争的商品答案。场景图和商品图不一致时，先执行", { href: "/guides/check-clothing-images-match", label: "同款一致性检查" }, "。"],
          ],
        },
        {
          heading: "让一组镜头的背景保持连续",
          paragraphs: [
            ["单帧看起来不错，不代表多镜头成片稳定。如果地平线、光线方向、色偏、商品尺度或机位高度在片段间突然变化，背景会比商品更抢注意力。应提前决定背景保持连续，还是场景切换确实增加了新信息。"],
            ["先用", { href: "/guides/model-mannequin-flat-lay-for-ai-video", label: "真人、人台与平铺素材对比" }, "区分素材形态，再用", { href: "/guides/plan-clothing-video-shots", label: "分镜清单" }, "把选定素材对应到一个镜头任务。"],
          ],
          bullets: [
            "匹配主要光线方向，避免强烈彩色反光污染服装颜色。",
            "确保服装在最终画幅中足够大，可以检查关键结构。",
            "移除遮挡领口、袖子、腰线或下摆的道具。",
            "不要借背景清理重新绘制服装边缘或结构。",
          ],
        },
        {
          heading: "第一次先测试更简单的背景",
          paragraphs: [
            ["新 SKU 更适合从容易和源图对照的背景开始。克制的干净背景镜头通常比复杂场景更适合诊断，因为服装漂移更容易被发现。"],
            ["商品稳定后，只有场景能回答不同买家问题时再测试。还要核对", { href: "/guides/choose-clothing-video-aspect-ratio", label: "视频画幅" }, "，因为宽场景裁成竖屏后可能变得拥挤，或者让服装缩得过小。"],
          ],
        },
      ],
      relatedHeading: "继续准备素材形态与镜头",
      ctaTitle: "准备先测试最简单有效的背景了吗？",
      ctaBody: "上传一组同款素材，先验证一条干净背景的低风险 8 秒镜头，再增加场景复杂度。",
      ctaLabel: "测试干净背景镜头",
    },
  },
  "choose-clothing-video-cover-image": {
    slug: "choose-clothing-video-cover-image",
    parentHref: "/three-images-to-clothing-video",
    ctaHref: "/workspace?mode=trial&preset=minimal_studio",
    relatedSlugs: [
      "review-clothing-video-before-publishing",
      "choose-clothing-video-aspect-ratio",
    ],
    imageSrc: "/demo/red-dress-poster.webp",
    en: {
      metadataTitle: "Choose a clothing product video cover image | AI Clothes Video",
      title: "How to choose a cover image for a clothing product video",
      description: "Choose a clothing product video thumbnail that stays truthful, readable at small sizes, safe to crop, and representative of the motion viewers will see.",
      eyebrow: "Publishing guide · Cover image",
      directAnswer: "Choose the clearest truthful frame, not automatically the most dramatic one. The garment should remain recognizable at thumbnail size, important details must survive the target crop, and the cover must not promise a view or styling that the video does not deliver.",
      imageAlt: "Cover frame showing a red dress centered against a restrained background",
      imageCaption: "A useful cover keeps the garment recognizable before the viewer presses play.",
      parentLabel: "See how the complete video is built from source evidence",
      sections: [
        {
          heading: "Treat the cover as a product promise",
          paragraphs: [
            ["A cover has one job before playback: help the viewer recognize the product and understand what the video is about. A dramatic transition frame may attract attention while showing a stretched sleeve, hidden hem, motion blur, or an angle that appears for only a fraction of a second."],
            ["The ", { href: "/three-images-to-clothing-video", label: "three-image workflow" }, " limits the video to supported garment evidence. Apply the same rule to the cover: it should represent the SKU and a view the complete video can actually support."],
          ],
        },
        {
          heading: "Score candidate frames on four criteria",
          paragraphs: [
            ["Pause on several stable moments and compare them side by side. Do not choose from memory after watching at full speed."],
          ],
          table: {
            headers: ["Criterion", "Pass condition", "Reject when"],
            rows: [
              ["Product truth", "Color, silhouette, trim, and visible construction match the source", "A detail moves, disappears, or is invented"],
              ["Small-size readability", "The garment remains identifiable without zooming", "The product becomes a tiny shape or merges into the background"],
              ["Crop safety", "Neckline, sleeves, and hem survive the intended placement", "A key selling detail sits at an edge or under an overlay"],
              ["Video representation", "The frame reflects the actual opening or main story", "The cover suggests a model, view, or scene the video barely contains"],
            ],
          },
        },
        {
          heading: "Avoid motion peaks and transition frames",
          paragraphs: [
            ["The middle of a turn, zoom, garment sway, or stitched transition is often the least stable point. Check fingers, edges, prints, buttons, waistlines, and hems at full resolution before approving a frame."],
            ["A generated cover is only a candidate. Compare it with the complete output and use the ", { href: "/guides/review-clothing-video-before-publishing", label: "pre-publish quality checklist" }, " before treating it as final. A clean cover cannot compensate for a video that fails later."],
          ],
          bullets: [
            "Reject blur that hides product construction rather than indicating intentional motion.",
            "Reject frames captured between two different poses or backgrounds.",
            "Reject a flattering crop that removes the feature named in the listing.",
            "Keep the approved cover tied to the correct SKU, color, locale, and video version.",
          ],
        },
        {
          heading: "Test the real thumbnail size and crop",
          paragraphs: [
            ["A frame that looks strong on a desktop monitor can become unreadable in a compact product tile. Preview it at the actual destination size, with the play icon, duration badge, price block, captions, and interface overlays visible."],
            ["Use the ", { href: "/guides/choose-clothing-video-aspect-ratio", label: "aspect-ratio guide" }, " to protect the product when the same cover is adapted to 9:16, 1:1, or 16:9. If one crop removes essential information, create a placement-specific cover instead of forcing a universal version."],
          ],
        },
        {
          heading: "Keep text and claims outside the product evidence",
          paragraphs: [
            ["If the publishing platform adds text, keep it short and separate from the garment. Do not place unverified material, fit, performance, sustainability, or discount claims on the cover. Text should describe the real listing, not fill gaps in the visual evidence."],
            ["Confirm commercial rights for the source image, visible adult model, logo, typeface, and any graphic element. Save the approved cover with the final video so an older draft is not published by mistake."],
          ],
        },
      ],
      relatedHeading: "Validate the cover and final placement",
      ctaTitle: "Need a truthful frame to evaluate?",
      ctaBody: "Generate one focused 8-second version, compare its stable frames with the source images, and test the cover at the real destination size.",
      ctaLabel: "Create a cover candidate",
    },
    "zh-CN": {
      metadataTitle: "服装商品视频封面图怎么选？｜AI Clothes Video",
      title: "服装商品视频封面图怎么选？",
      description: "选择真实、缩小后仍清晰、适合目标裁切并能代表完整成片的服装商品视频封面，不要只挑最夸张的一帧。",
      eyebrow: "发布指南 · 封面图",
      directAnswer: "应选择最清楚、最真实的一帧，而不是默认选择动作最夸张的一帧。服装在缩略图尺寸下仍要可识别，关键细节必须经得起目标裁切，封面也不能承诺成片中没有真正展示的视角或造型。",
      imageAlt: "克制背景中居中展示红色连衣裙的视频封面帧",
      imageCaption: "有效封面要让观众在播放前就能识别正在展示的服装。",
      parentLabel: "了解完整视频如何从素材证据构建",
      sections: [
        {
          heading: "把封面当作商品承诺",
          paragraphs: [
            ["封面在播放前只有一个任务：让观众识别商品，并理解视频要展示什么。戏剧化转场帧可能更显眼，却可能带有拉长的袖子、被遮挡的下摆、运动模糊，或只出现极短时间的角度。"],
            ["", { href: "/three-images-to-clothing-video", label: "三图生成流程" }, "会把成片限制在素材支持的服装证据内，封面也应遵守同一原则：它必须代表真实 SKU 和完整视频确实能够支持的视角。"],
          ],
        },
        {
          heading: "用四项标准比较候选帧",
          paragraphs: [
            ["暂停在几个稳定时刻，把候选帧并排比较。不要只凭看完视频后的印象选择。"],
          ],
          table: {
            headers: ["标准", "通过条件", "应淘汰的情况"],
            rows: [
              ["商品真实性", "颜色、版型、辅料与可见结构符合源图", "细节移动、消失或被创造"],
              ["小尺寸可读性", "无需放大也能识别服装", "商品缩成小块或与背景融在一起"],
              ["裁切安全", "领口、袖子和下摆在目标位置中保留", "关键卖点贴边或被界面遮挡"],
              ["代表完整成片", "封面符合真实开头或主要叙事", "暗示成片几乎没有的人物、视角或场景"],
            ],
          },
        },
        {
          heading: "避开动作峰值和转场中间帧",
          paragraphs: [
            ["转身、缩放、衣摆摆动或片段拼接的中间位置，往往是最不稳定的时刻。批准封面前，要按完整分辨率检查手指、边缘、印花、纽扣、腰线和下摆。"],
            ["系统生成的封面只能视为候选。应与完整成片对照，并执行", { href: "/guides/review-clothing-video-before-publishing", label: "发布前质量检查" }, "。干净封面无法弥补成片后半段的失败。"],
          ],
          bullets: [
            "淘汰掩盖商品结构、而非表达合理运动的模糊帧。",
            "淘汰两个姿势或两种背景之间的过渡帧。",
            "淘汰为了显瘦或好看而切掉商品页主卖点的裁切。",
            "把批准封面绑定到正确 SKU、颜色、语言和视频版本。",
          ],
        },
        {
          heading: "按真实缩略图尺寸和裁切预览",
          paragraphs: [
            ["在桌面大图上清楚的画面，放进紧凑商品卡片后可能无法识别。要按真实发布尺寸预览，并同时显示播放图标、时长标签、价格区域、字幕和界面遮挡。"],
            ["使用", { href: "/guides/choose-clothing-video-aspect-ratio", label: "画幅选择指南" }, "检查同一封面适配 9:16、1:1 或 16:9 后是否仍保留商品。如果一种裁切会删掉必要信息，应制作对应位置的专用封面，不要强迫一个版本通用。"],
          ],
        },
        {
          heading: "文案与商品证据分开处理",
          paragraphs: [
            ["发布平台需要叠加文字时，应保持简短，并避开服装。不要在封面上添加未经证明的面料、合身、性能、可持续性或折扣声明。文字应该对应真实商品页，而不是补足视觉证据空缺。"],
            ["确认源图片、可识别成年模特、Logo、字体和图形元素都具备商业使用权。将批准封面与最终视频一同归档，避免误发旧草稿。"],
          ],
        },
      ],
      relatedHeading: "继续检查封面与发布位置",
      ctaTitle: "需要一帧真实候选封面吗？",
      ctaBody: "先生成一条聚焦的 8 秒版本，把稳定帧与源图对照，再按真实发布尺寸检查封面。",
      ctaLabel: "生成封面候选版本",
    },
  },
  "when-to-reshoot-clothing-photos": {
    slug: "when-to-reshoot-clothing-photos",
    parentHref: "/three-images-to-clothing-video",
    ctaHref: "/workspace?mode=trial&preset=minimal_studio",
    relatedSlugs: [
      "check-clothing-images-match",
      "how-to-photograph-clothing-details",
    ],
    imageSrc: "/demo/cases/knit-cardigan/detail.webp",
    en: {
      metadataTitle: "When to reshoot clothing photos for AI video | AI Clothes Video",
      title: "When should you reshoot clothing photos before making an AI video?",
      description: "Decide whether a clothing photo can be re-exported or cropped, or whether missing, obscured, contradictory, or inaccurate product evidence requires a reshoot.",
      eyebrow: "Source triage · Reshoot decision",
      directAnswer: "Reshoot when the missing information is a real product fact: an unseen back, covered closure, unreadable print, wrong colorway, contradictory construction, or detail with no identifiable location. Re-export or recrop only when the evidence already exists and the problem is technical.",
      imageAlt: "Close product image showing knit cardigan texture and button detail",
      imageCaption: "A useful reshoot restores missing product evidence; it does not merely create a sharper file.",
      parentLabel: "Review the evidence required by the three-image workflow",
      sections: [
        {
          heading: "Separate a file problem from an evidence problem",
          paragraphs: [
            ["A file can be inconvenient while still containing the right garment fact. It can also be sharp and polished while proving the wrong color, version, or view. Before scheduling photography, state exactly what the planned shot needs to know."],
            ["The ", { href: "/three-images-to-clothing-video", label: "three-image workflow" }, " assigns front, back, and detail roles. If a role has no trustworthy image, resolution enhancement and stronger prompts cannot create that missing evidence."],
          ],
        },
        {
          heading: "Fix technical delivery problems without reshooting",
          paragraphs: [
            ["Keep the original capture when the product fact is visible and accurate. Make only changes that preserve the garment rather than redesigning it."],
          ],
          table: {
            headers: ["Problem", "Possible fix", "Boundary"],
            rows: [
              ["Wrong file format or oversized export", "Re-export from the original", "Do not recompress until text and texture disappear"],
              ["Too much empty space", "Recrop while retaining the complete required view", "Do not cut sleeves, neckline, waist, or hem"],
              ["Slight exposure imbalance", "Apply restrained global correction", "Do not change the product color or local fabric structure"],
              ["Distracting background edge", "Use a clean crop or a better existing original", "Do not redraw garment boundaries"],
            ],
          },
        },
        {
          heading: "Reshoot when the product fact is absent or unreliable",
          paragraphs: [
            ["A reshoot is necessary when no existing file can answer the buyer question. Trying to repair these cases with generative editing moves the uncertainty into the source set and makes later QA harder."],
          ],
          bullets: [
            "The required front, back, side, or detail view was never photographed.",
            "Hair, hands, outerwear, tags, props, or cropping cover the relevant construction.",
            "Images show different colorways, trims, prints, samples, or production revisions.",
            "White balance or reflections make the true product color impossible to determine.",
            "Blur, compression, glare, or shallow focus removes the exact detail the shot needs.",
            "A close-up has no recognizable garment anchor, so its location cannot be verified.",
          ],
        },
        {
          heading: "Plan the smallest reshoot that closes the gap",
          paragraphs: [
            ["Do not repeat an entire campaign shoot when one controlled evidence image is missing. Record the SKU, color, sample version, required view, visible construction, lighting reference, and crop before taking the replacement."],
            ["For a missing close-up, follow the ", { href: "/guides/how-to-photograph-clothing-details", label: "clothing detail photography guide" }, ". For a missing rear view, use the ", { href: "/guides/clothing-video-without-back-image", label: "back-image capture checklist" }, " instead of substituting another front angle."],
          ],
          numberedItems: [
            "Name the buyer question the replacement image must answer.",
            "Match the exact SKU, colorway, trim, and production version.",
            "Recreate neutral light without colored reflections or beauty filters.",
            "Show the complete required structure with a small safety margin.",
            "Place the new image beside the existing set and verify agreement.",
          ],
        },
        {
          heading: "Run one final source-set decision",
          paragraphs: [
            ["Use the ", { href: "/guides/check-clothing-images-match", label: "same-SKU checklist" }, " after every replacement. If all images agree, move to a low-risk test. If two sources still contradict each other, stop and identify which file represents the product currently being sold."],
            ["A small reshoot costs time, but repeated generation from unreliable inputs costs time without resolving the source of the problem. The goal is not perfect photography; it is a source set that makes each planned product fact auditable."],
          ],
        },
      ],
      relatedHeading: "Repair or replace the source set",
      ctaTitle: "Does every planned view now have evidence?",
      ctaBody: "Upload the corrected matched set and use one low-risk 8-second trial to confirm that the reshoot closed the actual gap.",
      ctaLabel: "Test the corrected source set",
    },
    "zh-CN": {
      metadataTitle: "制作 AI 视频前，什么情况下应该重拍服装图？｜AI Clothes Video",
      title: "制作 AI 视频前，什么情况下应该重拍服装图？",
      description: "判断服装图只需重新导出或裁切，还是因为视角缺失、遮挡、冲突或商品信息不可靠而必须重拍。",
      eyebrow: "素材分诊 · 重拍决策",
      directAnswer: "缺少的是真实商品事实时就应该重拍，例如没有背面、闭合结构被挡住、印花不可读、色号错误、结构互相矛盾，或细节图无法确认位置。只有证据已经存在、问题纯属技术交付时，才适合重新导出或裁切。",
      imageAlt: "展示针织开衫纹理与纽扣细节的近距离商品图",
      imageCaption: "有效重拍要补回缺失的商品证据，而不只是得到一个更清晰的文件。",
      parentLabel: "查看三图流程需要哪些素材证据",
      sections: [
        {
          heading: "先区分文件问题和证据问题",
          paragraphs: [
            ["文件可能不方便使用，但仍包含正确商品事实；也可能非常清晰精致，却展示错误色号、版本或视角。安排重拍前，先写清楚计划镜头必须知道什么。"],
            ["", { href: "/three-images-to-clothing-video", label: "三图生成流程" }, "会给正面、背面和细节图分配角色。如果某个角色没有可信图片，提高分辨率和加强提示词都不能创造缺失证据。"],
          ],
        },
        {
          heading: "纯技术交付问题可以不重拍",
          paragraphs: [
            ["商品事实清楚且准确时，应保留原始拍摄，只做不会重新设计服装的处理。"],
          ],
          table: {
            headers: ["问题", "可用处理", "边界"],
            rows: [
              ["格式不合适或导出文件过大", "从原始文件重新导出", "不要压缩到文字与纹理消失"],
              ["空白区域过多", "保留完整所需视角后重新裁切", "不要切掉袖子、领口、腰线或下摆"],
              ["轻微整体曝光不平衡", "进行克制的全局校正", "不要改变商品颜色或局部面料结构"],
              ["背景边缘干扰", "使用干净裁切或更好的现有原图", "不要重新绘制服装边界"],
            ],
          },
        },
        {
          heading: "商品事实缺失或不可靠时必须重拍",
          paragraphs: [
            ["没有任何现有文件能回答买家问题时，就需要重拍。用生成式编辑修补这些情况，只会把不确定性提前放进源素材，让后续质检更困难。"],
          ],
          bullets: [
            "需要的正面、背面、侧面或细节视角从未拍摄。",
            "头发、手、外套、吊牌、道具或裁切遮挡关键结构。",
            "图片来自不同色号、辅料、印花、样衣或生产版本。",
            "白平衡或反光导致真实商品颜色无法判断。",
            "模糊、压缩、眩光或浅景深删掉镜头需要的细节。",
            "局部特写没有可识别结构锚点，无法确认具体位置。",
          ],
        },
        {
          heading: "只补拍真正缺失的那一张",
          paragraphs: [
            ["缺少一张受控证据图时，不必重新拍完整活动素材。拍摄替代图前，记录 SKU、颜色、样衣版本、所需视角、必须可见的结构、光线参考和裁切范围。"],
            ["缺少局部素材时，按", { href: "/guides/how-to-photograph-clothing-details", label: "服装细节拍摄指南" }, "补拍；缺少背面时，使用", { href: "/guides/clothing-video-without-back-image", label: "背面图拍摄清单" }, "，不要用另一张正面角度替代。"],
          ],
          numberedItems: [
            "写明替代图片必须回答的买家问题。",
            "匹配准确 SKU、色号、辅料与生产版本。",
            "还原中性光线，避免彩色反光和美颜滤镜。",
            "完整展示所需结构，并保留少量安全边距。",
            "把新图与现有素材并排，确认它们彼此一致。",
          ],
        },
        {
          heading: "对新素材组做最后一次判断",
          paragraphs: [
            ["每次更换图片后，都要重新执行", { href: "/guides/check-clothing-images-match", label: "同款一致性清单" }, "。全部图片一致后再做低风险测试；如果两张素材仍然冲突，应先确认哪张才代表当前正在销售的商品。"],
            ["小规模重拍会占用时间，但从不可靠输入反复生成同样会耗时，而且不会解决根源。目标不是完美摄影，而是让每个计划展示的商品事实都有可核对素材。"],
          ],
        },
      ],
      relatedHeading: "继续修复或替换素材组",
      ctaTitle: "每个计划视角现在都有证据了吗？",
      ctaBody: "上传修正后的同款素材组，用一条低风险 8 秒试用视频确认重拍确实补上了缺口。",
      ctaLabel: "测试修正后的素材组",
    },
  },
} as const satisfies Record<GuideSlug, GuideArticle>;

export function isGuideSlug(value: string): value is GuideSlug {
  return guideSlugs.includes(value as GuideSlug);
}

export function guidePath(slug: GuideSlug) {
  return `/guides/${slug}` as const;
}
