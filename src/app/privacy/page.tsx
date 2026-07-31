import { PolicyPage } from "@/components/public/policy-page";
import { getServerSession } from "@/lib/auth/server";
import { getRequestLocale } from "@/lib/i18n/server";

const content = {
  en: {
    title: "Privacy Policy",
    intro: "This Privacy Policy explains how AI Clothes Video handles your uploaded materials, generated results, and account data.",
    sections: [
      ["Uploaded images", "We use your clothing product images, back views, detail images, scene references, and generated results to create video jobs, show history, provide downloads, troubleshoot, and meet compliance obligations. Upload only material you have the right to use."],
      ["Model processing", "The generation workflow sends necessary images, material analysis, user-provided text, and final video prompts to model providers for analysis, storyboard generation, video generation, and quality checks. We do not expose API keys, internal safety signals, or full provider debugging data to regular users."],
      ["Cloudflare R2", "Uploaded images, video segments, final videos, covers, and quality-check frames are stored in Cloudflare R2. Source images used for task previews and model processing are served through a public custom domain. Anyone who obtains a source-image URL can access and share it until the object is deleted and any CDN cache expires. Other file downloads may continue to use authenticated application routes or short-lived signed URLs."],
      ["Retention", "Uploaded originals and final videos are normally retained for about 180 days; video segments and ordinary quality-check frames for about 30 days. Files connected to incidents or appeals may be retained longer for troubleshooting. Billing, order, and required audit records are retained as needed for compliance and reconciliation."],
      ["Deletion", "You may request deletion of job materials or account data. Deletion is normally marked in the database first, then an asynchronous cleanup removes R2 files. Completed orders, credit ledgers, and safety audit records may need to be retained."],
      ["Notices and complaints", "Upload authorization declarations retain the declaration version, text snapshot, linked material, and a de-identified request summary. Rights notices retain the reporter contact, rights type, redacted content reference, explanation, status, and audit record. Closed complaints and declarations no longer linked to active materials are de-identified after a three years retention period; public reference numbers, status, and necessary audit relationships may remain."],
    ],
  },
  "zh-CN": {
    title: "隐私政策",
    intro: "本隐私政策说明 AI Clothes Video 如何处理你上传的素材、生成结果和账号数据。",
    sections: [
      ["上传的图片", "我们使用服装商品图、背面图、细节图、场景参考和生成结果来创建视频任务、展示历史、提供下载、排查问题并履行合规义务。请只上传你有权使用的素材。"],
      ["模型处理", "生成工作流会向模型提供商发送必要图片、素材分析、用户提供的文本和最终视频提示词，用于分析、分镜、视频生成和质检。普通用户不会看到 API 密钥、内部安全信号或完整的提供商调试数据。"],
      ["Cloudflare R2", "上传图片、视频分段、最终视频、封面和质检帧存储在 Cloudflare R2。用于任务预览和模型处理的源图片通过公共自定义域提供；任何获得源图片 URL 的人都可以访问和转发，直至对象删除且 CDN 缓存失效。其他文件下载仍可能通过已鉴权的应用接口或短时效签名 URL 提供。"],
      ["保留期限", "上传原图和最终视频通常保留约 180 天；视频分段和普通质检帧通常保留约 30 天。与事故或申诉有关的文件可能为排查问题而保留更久。账单、订单和必要审计记录会按合规与对账需要保留。"],
      ["删除", "你可以申请删除任务素材或账号数据。系统通常先在数据库中标记删除，再由异步清理移除 R2 文件。已完成订单、点数账本和安全审计记录可能需要继续保留。"],
      ["通知与投诉", "上传授权声明会保留声明版本、文本快照、关联素材和去标识化请求摘要。权利通知会保留举报人联系方式、权利类型、脱敏内容引用、说明、状态和审计记录。已关闭且不再关联活跃素材的投诉与声明会在三年保留期后去标识化；公开编号、状态和必要审计关系可能继续保留。"],
    ],
  },
} as const;

export default async function PrivacyPage() {
  const [session, locale] = await Promise.all([getServerSession(), getRequestLocale()]);
  const copy = content[locale];
  return <PolicyPage intro={copy.intro} language={locale} sections={copy.sections} sourcePage="privacy" title={copy.title} user={session?.user ?? null} />;
}
