import type { SiteLocale } from "@/lib/i18n/config";

export const guideSlugs = [
  "clothing-video-without-back-image",
  "choose-clothing-video-length",
  "why-ai-clothing-videos-deform",
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
    metadataDescription: "Practical, evidence-led guides for preparing clothing images, choosing video length, and reducing garment drift in AI product videos.",
    eyebrow: "AI Clothes Video · Practical guides",
    title: "Make better clothing videos before you press generate",
    intro: "Use these field guides to prepare one traceable SKU, choose only the shots your images can support, and review the result with realistic expectations.",
    parentLabel: "Start with the three-image workflow",
    articleLabel: "Read guide",
    evidenceTitle: "The shared rule behind every guide",
    evidenceBody: "A product video should not claim more than the source images prove. Front, back, and detail images each define a different part of the available shot range.",
  },
  "zh-CN": {
    metadataTitle: "服装商品视频实用指南｜AI Clothes Video",
    metadataDescription: "从服装素材准备、视频时长选择到减少细节漂移，了解如何用三张同款图片制作更可控的 AI 商品视频。",
    eyebrow: "AI Clothes Video · 实用指南",
    title: "点击生成前，先把服装视频做对",
    intro: "用这些指南核对同一件 SKU 的素材、选择图片真正支持的镜头，并以合理预期检查生成结果。",
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
      metadataTitle: "8, 16, or 24 seconds: choose a clothing product video length | AI Clothes Video",
      title: "Should a clothing product video be 8, 16, or 24 seconds?",
      description: "Choose clothing product video length by the number of buyer questions you need to answer. Compare the shot structure, source-image pressure, and best use for 8-, 16-, and 24-second videos.",
      eyebrow: "Decision guide · Video length",
      directAnswer: "Choose 8 seconds for one clear product idea, 16 seconds for a main view plus one useful supplement, and 24 seconds only when three distinct shots have real source evidence. Longer is not automatically better.",
      imageAlt: "Poster frame from a real 8-second minimal-studio clothing video workflow",
      imageCaption: "A real 8-second workflow result from a traceable synthetic source set. One focused shot can be enough when the objective is clear.",
      parentLabel: "See how three images become one clothing video",
      sections: [
        {
          heading: "Start with the number of questions, not the number of seconds",
          paragraphs: [
            ["Before asking whether a longer video looks more professional, ask how many buyer questions this asset must answer. A single hero movement may be enough for product-page motion testing. Showing the overall shape, real back, and a visible construction detail needs more shots and more complete evidence."],
            ["AI Clothes Video builds public lengths from independent 8-second shots: 8 seconds uses one shot, 16 seconds uses two, and 24 seconds uses three. The ", { href: "/three-images-to-clothing-video", label: "three-image workflow" }, " explains how source roles constrain each shot."],
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
            ],
          },
        },
        {
          heading: "Choose the shortest length that completes the job",
          paragraphs: [
            ["For a first generation, begin with 8 seconds and inspect whether the material and motion are suitable. Move to 16 or 24 seconds only when you can name the purpose and source image for every added shot. This keeps the video informative instead of merely longer."],
          ],
        },
      ],
      relatedHeading: "Make the next shot evidence-led",
      ctaTitle: "Start by validating one focused shot",
      ctaBody: "Upload three matched images and create an 8-second trial before choosing a longer paid structure.",
      ctaLabel: "Choose a video length in the workspace",
    },
    "zh-CN": {
      metadataTitle: "服装商品视频做 8 秒、16 秒还是 24 秒？｜AI Clothes Video",
      title: "服装商品视频做 8 秒、16 秒还是 24 秒？",
      description: "按需要回答的购买问题选择服装商品视频时长，对比 8、16、24 秒的镜头结构、素材压力和适用场景。",
      eyebrow: "决策指南 · 视频时长",
      directAnswer: "只有一个明确商品信息时选 8 秒；主展示加一个有效补充时选 16 秒；只有三个不同镜头都有真实素材依据时才选 24 秒。更长不等于更好。",
      imageAlt: "真实 8 秒极简棚拍服装视频工作流海报帧",
      imageCaption: "来自可追溯合成素材组的真实 8 秒工作流结果。目标明确时，一个聚焦镜头已经足够。",
      parentLabel: "了解三张图片如何组成一条服装视频",
      sections: [
        {
          heading: "先数要回答的问题，不要先数秒数",
          paragraphs: [
            ["先别问更长的视频是否更专业，而要问这条素材需要回答几个购买问题。测试商品页主图动效时，一个镜头可能已经足够；同时展示整体、真实背面和可见工艺细节，则需要更多镜头和更完整的素材依据。"],
            ["AI Clothes Video 的公开时长由独立的 8 秒镜头组成：8 秒使用一个镜头，16 秒使用两个，24 秒使用三个。", { href: "/zh/three-images-to-clothing-video", label: "三图生成流程" }, "会说明素材角色如何限制每个镜头。"],
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
            ],
          },
        },
        {
          heading: "选择刚好完成任务的最短时长",
          paragraphs: [
            ["第一次生成可以先做 8 秒，检查素材和运动是否合适。只有在你能说清每个新增镜头的目的与对应图片时，再升级到 16 或 24 秒。这样视频增加的是信息，而不只是长度。"],
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
            ["Motion should serve product information. For a new SKU, validate one low-risk shot before stacking several high-motion shots. The ", { href: "/guides/choose-clothing-video-length", label: "8-, 16-, and 24-second guide" }, " explains how every added shot should have its own evidence and job."],
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
            ["运动必须服务商品信息。新的 SKU 应先验证一个低风险镜头，再叠加多个大运动镜头。", { href: "/zh/guides/choose-clothing-video-length", label: "8、16 和 24 秒选择指南" }, "说明了每个新增镜头为什么都需要自己的素材依据和任务。"],
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
} as const satisfies Record<GuideSlug, GuideArticle>;

export function isGuideSlug(value: string): value is GuideSlug {
  return guideSlugs.includes(value as GuideSlug);
}

export function guidePath(slug: GuideSlug) {
  return `/guides/${slug}` as const;
}
