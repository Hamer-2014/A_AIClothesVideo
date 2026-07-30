import { PolicyPage } from "@/components/public/policy-page";
import { getServerSession } from "@/lib/auth/server";
import { getRequestLocale } from "@/lib/i18n/server";
import { SUPPORT_EMAIL } from "@/lib/support-email";

const content = {
  en: {
    title: "Terms of Service",
    intro: "Before using AI Clothes Video, confirm that you have the right to use uploaded materials and understand that generation depends on material quality, content review, and model services.",
    sections: [
      ["Your uploaded materials", "This service creates short promotional videos from clothing product images. Upload only product images, brand elements, and copy that you own or are authorized to use. You retain your rights and authorize us to process the materials for generation, quality checks, downloads, troubleshooting, and compliance review."],
      ["Prohibited content", "Do not upload or generate NSFW, pornographic, sexually suggestive, hateful, violent, fraudulent, unlawful, or infringing content. You may not use an unauthorized real person, trademark, copyrighted material, deepfake, face swap, or impersonated endorsement. Do not use prompts to bypass material rules, content review, or free-trial limits."],
      ["Likeness and minor authorization", "Before uploading material with an identifiable person, obtain their likeness and commercial promotional authorization. For anyone under 18, obtain authorization from a parent or guardian. Each server-side upload requires an active confirmation of the current authorization declaration; it is never preselected or accepted by us for you."],
      ["Free trial", "The free trial is limited to one 8-second video for a new user: low resolution, no audio, a watermark, and low-risk shots only. Without a back-view image we do not generate a back view. Without a detail image we do not generate a detail close-up."],
      ["Generation failures", "Video generation depends on material quality, model services, content review, and quality checks. We do not guarantee that every generation will be error-free or an exact reproduction. A provider failure, content block, unsuitable material, or failed quality check can prevent delivery."],
      ["Credits and refunds", "Credits are normally reserved when generation is confirmed and captured only after the final video passes quality checks and is deliverable. If a job fails, is not generated, or cannot be delivered, reserved credits are released or returned according to status. Delivery does not eliminate all commercial-use risk."],
      ["Rights notices", `Rights holders can submit a takedown request with a locatable content reference and rights explanation. The platform records a case number for administrator review. A notice does not automatically remove content, and bad-faith or incomplete requests may be rejected. Contact ${SUPPORT_EMAIL} for support and rights notices.`],
    ],
  },
  "zh-CN": {
    title: "服务条款",
    intro: "使用 AI Clothes Video 前，请确认你有权使用上传素材，并理解生成结果受素材质量、内容审核和模型服务影响。",
    sections: [
      ["你上传的素材", "本服务从服装商品图创建宣传短视频。只可上传你拥有或获授权使用的商品图、品牌元素和文案。你保留相关权利，并授权我们为生成、质检、下载、排障和合规审查处理这些素材。"],
      ["禁止内容", "不得上传或生成色情、性暗示、仇恨、暴力、欺诈、违法或侵权内容。不得未经授权使用真人、商标、版权材料、深度伪造、换脸或冒充背书。不得使用提示词绕过素材规则、内容审核或试用限制。"],
      ["肖像与未成年人授权", "上传包含可识别真人的素材前，应取得肖像与商业宣传授权。未满 18 周岁者还需父母或监护人授权。每次服务端上传都必须主动确认当前授权声明，平台不会替你预先选择或接受。"],
      ["免费试用", "新用户免费试用限 1 条 8 秒低清、无音频、带水印视频，仅使用低风险镜头。没有背面图不生成背面，没有细节图不生成细节特写。"],
      ["生成失败", "视频生成依赖素材质量、模型服务、内容审核和质检。我们不保证每次生成无错误或精确复刻。提供商故障、内容拦截、不适合的素材或质检失败都可能阻止交付。"],
      ["点数与退款", "确认生成时通常先预留点数，只有最终视频通过质检且可交付后才会扣除。任务失败、未生成或无法交付时，预留点数会按状态释放或退回。交付不代表消除全部商业使用风险。"],
      ["权利通知", `权利人可以提交包含可定位内容引用和权利说明的侵权删除申请。平台会记录案件编号供管理员审核。通知不会自动删除内容，恶意或不完整的申请可能被拒绝。支持与权利通知请联系 ${SUPPORT_EMAIL}。`],
    ],
  },
} as const;

export default async function TermsPage() {
  const [session, locale] = await Promise.all([getServerSession(), getRequestLocale()]);
  const copy = content[locale];
  return <PolicyPage intro={copy.intro} language={locale} sections={copy.sections} sourcePage="terms" title={copy.title} user={session?.user ?? null} />;
}
