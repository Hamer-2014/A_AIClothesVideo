import Link from "next/link";

import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { getServerSession } from "@/lib/auth/server";
import { localizeHref } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";

const content = {
  en: {
    title: "Frequently asked questions",
    intro: "Understand the generation boundaries before starting a trial. A single front image cannot support a 360-degree view.",
    more: "To see how source evidence limits shot selection, read",
    moreLink: "how three images define available shots",
    faqs: [
      ["Which images should I upload?", "The public workflow requires three valid images of the same garment for the selected protocol. The recommended set is front, back, and detail. Product rotation and model turn are Paid Beta modes with their own front, side, and back requirements."],
      ["Why can't I generate a back view?", "Without a back image, the system cannot invent back construction, vents, zippers, graphics, or silhouette. Back views, turns, front-to-back transitions, and 360-degree display remain unavailable."],
      ["How long does generation take?", "Timing depends on video length, material, provider queues, and QA. An 8-second video is usually faster than a 16- or 24-second video. Provider queues or QA retries increase the wait."],
      ["What is the difference between trial and paid generation?", "The free trial is one low-resolution, silent, watermarked 8-second video using low-risk shots. Paid generation supports 8, 16, and 24 seconds with high resolution, no watermark, and audio by default."],
      ["What authorization is required for models or minors?", "Identifiable models require likeness and commercial-promotion authorization. Anyone under 18 also requires authorization from a parent or guardian. The uploader must actively confirm the declaration."],
      ["How do I submit a takedown request?", "Use the takedown page to provide the right type, a locatable content reference, and an explanation. The system returns an RR- reference after saving the case for administrator review. A complaint does not automatically remove content."],
    ],
  },
  "zh-CN": {
    title: "常见问题",
    intro: "先把生成边界讲清楚，再开始试用。只有一张正面图时，产品不会硬生成 360 度展示。",
    more: "进一步了解素材证据如何限制镜头，请查看",
    moreLink: "三张图如何决定可用镜头",
    faqs: [
      ["需要上传什么图片", "公开生成流程要求按所选协议上传三张同款有效素材。默认推荐正面主图、背面图和细节图；商品旋转与真人模特转身付费 Beta 分别要求对应的正面、侧面和背面素材。"],
      ["为什么不能生成背面", "如果没有背面图，系统不能凭空编造背面结构、开衩、拉链、印花或版型，所以背面展示、转身、正背切换和 360 展示都会被禁用。"],
      ["多久生成", "生成时间会受时长、素材、模型排队和质检影响。8 秒通常比 16/24 秒更快；如果供应商排队或质检重试，等待时间会变长。"],
      ["试用和付费有什么区别", "免费试用限 1 条 8 秒、低分辨率、无音频、带水印视频，只开放低风险镜头。付费生成支持 8/16/24 秒，高分辨率、无水印，并默认包含音频。"],
      ["真人或儿童模特需要什么授权", "真人模特素材需要模特本人的肖像权和商业宣传授权。未满 18 周岁的模特还需要监护人授权。上传者必须主动确认声明，平台不会预先勾选。"],
      ["如何提交侵权删除请求", "通过侵权删除申请页面提交权利类型、可定位的内容引用和说明。系统在案件保存后返回 RR- 编号，管理员核验后处理；投诉不会自动删除内容。"],
    ],
  },
} as const;

export default async function FaqPage() {
  const [session, locale] = await Promise.all([getServerSession(), getRequestLocale()]);
  const copy = content[locale];

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader language={locale} sourcePage="faq" user={session?.user ?? null} />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{copy.intro}</p>
        <div className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line-strong)]">
          {copy.faqs.map(([question, answer]) => <section className="py-6" key={question}><h2 className="text-base font-medium">{question}</h2><p className="mt-3 text-sm leading-7 text-[var(--muted)]">{answer}</p></section>)}
        </div>
        <p className="mt-8 text-sm leading-6 text-[var(--muted)]">{copy.more} <Link className="font-semibold text-[var(--brand)] hover:text-[var(--action-hover)]" href={localizeHref("/three-images-to-clothing-video", locale)}>{copy.moreLink}</Link>.</p>
      </article>
      <PublicFooter language={locale} />
    </main>
  );
}
