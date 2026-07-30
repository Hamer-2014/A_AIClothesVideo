import { PolicyPage } from "@/components/public/policy-page";
import { getServerSession } from "@/lib/auth/server";
import { getRequestLocale } from "@/lib/i18n/server";
import { SUPPORT_EMAIL } from "@/lib/support-email";

const content = {
  en: {
    title: "Acceptable Use Policy",
    intro: "AI Clothes Video is for authorized clothing product promotion. Use it only for lawful, accurate product-video workflows.",
    sections: [
      ["You must not use the service for", "NSFW, pornographic, or sexually suggestive content; hate or violence; fraud or deception; deepfakes, face swaps, or impersonated endorsements; and unauthorized use of a real person, trademark, copyright, or other protected material."],
      ["Materials and product accuracy", "Upload only materials you are authorized to use. Do not ask the service to invent garment features that are not present in your source images. A missing back-view image cannot produce a back view, and a missing detail image cannot produce a detail close-up."],
      ["Enforcement", `We may block or remove prohibited requests, suspend access, and preserve information required for safety, fraud prevention, or legal compliance. For questions or rights notices, contact ${SUPPORT_EMAIL}.`],
    ],
  },
  "zh-CN": {
    title: "可接受使用政策",
    intro: "AI Clothes Video 用于已获授权的服装商品宣传。请仅用于合法、准确的商品视频工作流。",
    sections: [
      ["禁止用途", "不得用于色情或性暗示内容、仇恨或暴力、欺诈或误导、深度伪造、换脸或冒充背书，以及未经授权使用真人、商标、版权或其他受保护素材。"],
      ["素材与商品准确性", "只可上传你获授权使用的素材。不得要求服务编造源图中不存在的服装特征。缺少背面图不能生成背面，缺少细节图不能生成细节特写。"],
      ["执行", `我们可以拦截或移除禁止请求、暂停访问，并保留安全、反欺诈或法律合规所需的信息。问题或权利通知请联系 ${SUPPORT_EMAIL}。`],
    ],
  },
} as const;

export default async function AcceptableUsePage() {
  const [session, locale] = await Promise.all([getServerSession(), getRequestLocale()]);
  const copy = content[locale];
  return <PolicyPage intro={copy.intro} language={locale} sections={copy.sections} sourcePage="acceptable_use" title={copy.title} user={session?.user ?? null} />;
}
