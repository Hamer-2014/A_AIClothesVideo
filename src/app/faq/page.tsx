import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { getServerSession } from "@/lib/auth/server";

const faqs = [
  {
    question: "需要上传什么图片",
    answer:
      "至少需要一张清晰的服装正面图，推荐补充背面图、侧面图、细节图和场景图。素材越完整，可用镜头越多。",
  },
  {
    question: "为什么不能生成背面",
    answer:
      "如果没有背面图，系统不能凭空编造背面结构、开衩、拉链、印花或版型，所以背面展示、转身、正背切换和 360 展示都会被禁用。",
  },
  {
    question: "多久生成",
    answer:
      "MVP 生成时间会受时长、素材、模型排队和质检影响。8 秒通常比 16/24 秒更快；如果供应商排队或质检重试，等待时间会变长。",
  },
  {
    question: "试用和付费有什么区别",
    answer:
      "免费试用限 1 条 8 秒、低分辨率、无音频、带水印视频，只开放低风险镜头。付费生成支持 8/16/24 秒，高分辨率、无水印，并默认包含音频。",
  },
];

export default async function FaqPage() {
  const session = await getServerSession();

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader user={session?.user ?? null} />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">FAQ</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          先把生成边界讲清楚，再开始试用。别拿一张正面图要求 360 展示，这种愿望很美，产品不会硬装能做到。
        </p>
        <div className="mt-8 space-y-4">
          {faqs.map((item) => (
            <section
              className="rounded-lg border border-[var(--line)] bg-white p-5"
              key={item.question}
            >
              <h2 className="text-base font-medium">{item.question}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                {item.answer}
              </p>
            </section>
          ))}
        </div>
      </article>
      <PublicFooter />
    </main>
  );
}
