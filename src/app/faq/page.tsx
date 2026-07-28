import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { getServerSession } from "@/lib/auth/server";

const faqs = [
  {
    question: "需要上传什么图片",
    answer:
      "公开生成流程要求按所选协议上传三张同款有效素材。默认推荐正面主图、背面图和细节图；商品旋转与真人模特转身付费 Beta 分别要求对应的正面、侧面和背面素材。",
  },
  {
    question: "为什么不能生成背面",
    answer:
      "如果没有背面图，系统不能凭空编造背面结构、开衩、拉链、印花或版型，所以背面展示、转身、正背切换和 360 展示都会被禁用。",
  },
  {
    question: "多久生成",
    answer:
      "生成时间会受时长、素材、模型排队和质检影响。8 秒通常比 16/24 秒更快；如果供应商排队或质检重试，等待时间会变长。",
  },
  {
    question: "试用和付费有什么区别",
    answer:
      "免费试用限 1 条 8 秒、低分辨率、无音频、带水印视频，只开放低风险镜头。付费生成支持 8/16/24 秒，高分辨率、无水印，并默认包含音频。",
  },
  {
    question: "真人或儿童模特需要什么授权",
    answer:
      "真人模特素材需要模特本人的肖像权和商业宣传授权。未满 18 周岁的模特还需要监护人授权。上传者必须主动确认声明，平台不会把复选框预先勾选。",
  },
  {
    question: "如何提交侵权删除请求",
    answer:
      "通过侵权删除申请页面提交权利类型、可定位的内容引用和说明。系统在案件保存后返回 RR- 编号，管理员核验后处理；投诉不会自动删除内容。",
  },
];

export default async function FaqPage() {
  const session = await getServerSession();

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader language="zh-CN" sourcePage="faq" user={session?.user ?? null} />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">常见问题</h1>
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
        <p className="mt-8 text-sm leading-6 text-[var(--muted)]">
          进一步了解素材证据如何限制镜头，请查看
          <a className="ml-1 font-semibold text-[var(--brand)] hover:text-[var(--action-hover)]" href="/three-images-to-clothing-video">
            三张图如何决定可用镜头
          </a>
          。
        </p>
      </article>
      <PublicFooter language="zh-CN" />
    </main>
  );
}
