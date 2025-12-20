import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { Form, Link, useActionData, useLoaderData, useNavigation, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import { getAppById, getLatestVersion, getEmail, getSenderEmail, getSenderName } from "~/lib/config.server";
import type { AppConfig, IOSApplyFormData } from "~/lib/types";

// ========== 快速输入预设理由 ==========
const QUICK_REASONS = [
  { label: "🎮 尝鲜体验", text: "对新功能非常感兴趣，希望能够抢先体验并提供反馈建议。" },
  { label: "🐛 协助测试", text: "愿意协助团队进行功能测试，发现并报告潜在问题，帮助提升产品质量。" },
  { label: "💡 产品建议", text: "作为目标用户，希望深度体验产品并提供有价值的产品改进建议。" },
  { label: "📱 多设备测试", text: "拥有多款 iOS 设备，可以帮助测试不同设备上的兼容性和表现。" },
  { label: "🔄 版本对比", text: "之前使用过旧版本，希望体验新版本的改进并进行对比反馈。" },
];

// ========== 安全工具函数 ==========

/**
 * HTML 转义 - 防止 XSS 攻击
 */
function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return str.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

/**
 * 验证邮箱格式
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * 清理用户输入 - 移除潜在危险字符
 */
function sanitizeInput(str: string, maxLength: number = 1000): string {
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // 移除控制字符
}

// ========== 路由处理 ==========

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.app) {
    return [{ title: "App 未找到" }];
  }
  return [
    { title: `申请体验 ${data.app.name} - TestFlight` },
    { name: "description", content: `申请体验 ${data.app.name} iOS 内测版本` },
  ];
};

interface LoaderData {
  app: AppConfig;
  latestVersion: string | null;
}

export function loader({ params }: LoaderFunctionArgs): LoaderData {
  const { appId } = params;
  if (!appId) {
    throw new Response("App ID is required", { status: 400 });
  }

  const app = getAppById(appId);
  if (!app) {
    throw new Response("App not found", { status: 404 });
  }

  // 获取最新的内测版本
  const alphaVersion = getLatestVersion(appId, "alpha");
  const betaVersion = getLatestVersion(appId, "beta");
  const latestVersion = alphaVersion?.version || betaVersion?.version || null;

  return { 
    app, 
    latestVersion,
  };
}

interface ActionData {
  success?: boolean;
  error?: string;
  message?: string;
}

export async function action({ request, params, context }: ActionFunctionArgs): Promise<ActionData> {
  // ===== CSRF 防护：验证请求来源 =====
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");
  const url = new URL(request.url);
  
  // 在生产环境中验证来源
  if (origin && !origin.includes(url.hostname) && url.hostname !== "localhost") {
    console.error("CSRF attempt detected:", { origin, referer, host: url.hostname });
    return { error: "非法请求来源" };
  }

  const { appId } = params;
  if (!appId || !/^[a-z0-9-]+$/.test(appId)) {
    return { error: "无效的 App ID" };
  }

  const app = getAppById(appId);
  if (!app) {
    return { error: "App not found" };
  }

  const formData = await request.formData();
  
  // ===== Honeypot 检查 - 防止机器人 =====
  const honeypot = formData.get("website");
  if (honeypot) {
    // 机器人会填写这个隐藏字段，静默拒绝
    console.warn("Honeypot triggered - possible bot submission");
    return { success: true, message: "申请已提交！" }; // 假装成功
  }

  const rawAppleId = formData.get("appleId");
  const rawReason = formData.get("reason");
  const rawVersion = formData.get("version");

  // ===== 输入验证 =====
  if (typeof rawAppleId !== "string" || typeof rawReason !== "string") {
    return { error: "无效的表单数据" };
  }

  const appleId = sanitizeInput(rawAppleId, 254);
  const reason = sanitizeInput(rawReason, 1000);
  const version = typeof rawVersion === "string" ? sanitizeInput(rawVersion, 50) : "";

  // 邮箱格式验证
  if (!isValidEmail(appleId)) {
    return { error: "请输入有效的 Apple ID 邮箱地址" };
  }

  // 理由长度验证
  if (reason.length < 10) {
    return { error: "请输入至少 10 个字符的申请理由" };
  }

  if (reason.length > 1000) {
    return { error: "申请理由不能超过 1000 个字符" };
  }

  const applyData: IOSApplyFormData = {
    appId,
    appName: app.name,
    version: version || "最新版本",
    appleId,
    reason,
  };

  // 获取邮件配置
  const notifyEmail = getEmail();      // 收件邮箱（通知）
  const senderEmail = getSenderEmail(); // 发件邮箱（可能是 Resend 测试域名）
  const senderName = getSenderName();

  // ===== 构建邮件内容（对用户输入进行 HTML 转义防止 XSS）=====
  const safeAppleId = escapeHtml(applyData.appleId);
  const safeReason = escapeHtml(applyData.reason).replace(/\n/g, "<br>");
  const safeVersion = escapeHtml(applyData.version);
  const safeAppName = escapeHtml(applyData.appName);

  const emailSubject = `[${app.name}] iOS TestFlight 体验申请 - ${applyData.appleId}`;
  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <h2 style="color: #1a1a2e; border-bottom: 2px solid #6366f1; padding-bottom: 10px; margin-top: 0;">
          🍎 iOS TestFlight 体验申请
        </h2>
        
        <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #64748b; width: 100px; vertical-align: top;">应用名称</td>
              <td style="padding: 10px 0; color: #1e293b; font-weight: 600;">${safeAppName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; vertical-align: top;">申请版本</td>
              <td style="padding: 10px 0; color: #1e293b; font-weight: 500;">${safeVersion}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; vertical-align: top;">Apple ID</td>
              <td style="padding: 10px 0;">
                <a href="mailto:${safeAppleId}" style="color: #6366f1; font-weight: 600; text-decoration: none;">
                  ${safeAppleId}
                </a>
              </td>
            </tr>
          </table>
        </div>
        
        <div style="margin: 20px 0;">
          <h3 style="color: #374151; font-size: 14px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
            申请理由
          </h3>
          <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; color: #475569; line-height: 1.8;">
            ${safeReason}
          </div>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
          <p style="margin: 5px 0;">📧 此邮件由 App 快速体验平台自动发送</p>
          <p style="margin: 5px 0;">🕐 申请时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</p>
        </div>
      </div>
    </div>
  `;

  const emailText = `
iOS TestFlight 体验申请

应用名称: ${applyData.appName}
申请版本: ${applyData.version}
Apple ID: ${applyData.appleId}

申请理由:
${applyData.reason}

---
申请时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
  `.trim();

  // 获取 Resend API Key
  const env = context.cloudflare?.env as { RESEND_API_KEY?: string } | undefined;
  const resendApiKey = env?.RESEND_API_KEY;

  if (!resendApiKey) {
    console.log("RESEND_API_KEY not configured, logging request:", applyData);
    return { 
      success: true, 
      message: "申请已记录！我们会尽快处理您的申请。" 
    };
  }

  try {
    // 使用 Resend API 发送邮件
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [notifyEmail],
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.log("Email sent successfully via Resend");
      return { 
        success: true, 
        message: "申请已提交！我们会尽快将您添加到 TestFlight 测试名单中。" 
      };
    } else {
      const errorData = await response.json();
      console.error("Resend API error:", response.status, errorData);
      // 即使发送失败，也记录申请信息
      console.log("申请信息（邮件发送失败）:", applyData);
      return { 
        success: true,
        message: "申请已记录！我们会尽快处理您的申请。"
      };
    }
  } catch (error) {
    // 网络错误时，记录申请信息并返回成功（开发环境友好）
    console.error("Failed to send email:", error);
    console.log("申请信息（网络错误，已记录）:", JSON.stringify(applyData, null, 2));
    
    // 在开发环境或网络问题时，仍然返回成功，确保用户体验
    return { 
      success: true,
      message: "申请已记录！我们会尽快处理您的申请。"
    };
  }
}

export default function ApplyForm() {
  const { app, latestVersion } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [reason, setReason] = useState("");
  
  const isSubmitting = navigation.state === "submitting";
  const requestedVersion = searchParams.get("version") || latestVersion;

  // 处理快速输入点击
  const handleQuickReason = (text: string) => {
    setReason((prev) => {
      // 如果已有内容，追加；否则直接设置
      if (prev.trim()) {
        return prev.trim() + "\n" + text;
      }
      return text;
    });
  };

  return (
    <section className="py-12">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 mb-4">
            <svg className="h-8 w-8 text-slate-300" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">
            申请 TestFlight 体验
          </h1>
          <p className="mt-2 text-slate-400">
            填写以下信息，我们会尽快将您添加到 {app.name} 的内测名单中
          </p>
        </div>

        {/* 成功提示 */}
        {actionData?.success && (
          <div className="mb-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm text-emerald-400 font-medium">
                  提交成功！
                </p>
                <p className="mt-1 text-sm text-emerald-300/80">
                  {actionData.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {actionData?.error && (
          <div className="mb-8 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-red-400">{actionData.error}</p>
            </div>
          </div>
        )}

        {/* 表单 */}
        {!actionData?.success && (
          <Form method="post" className="space-y-6">
            {/* 隐藏的版本字段 */}
            <input type="hidden" name="version" value={requestedVersion || ""} />

            {/* App 信息展示 */}
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5">
                  <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-900">
                    <span className="text-lg font-bold text-white">
                      {app.name.charAt(0)}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-white">{app.name}</p>
                  <p className="text-sm text-slate-400">
                    申请版本: {requestedVersion || "最新版本"}
                  </p>
                </div>
              </div>
            </div>

            {/* Honeypot 字段 - 防机器人，对用户不可见 */}
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                type="text"
                id="website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {/* Apple ID 输入 */}
            <div>
              <label
                htmlFor="appleId"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Apple ID 邮箱 <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                id="appleId"
                name="appleId"
                required
                maxLength={254}
                placeholder="example@icloud.com"
                autoComplete="email"
                className="w-full rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
              <p className="mt-2 text-xs text-slate-500">
                请填写您的 Apple ID 邮箱，我们将使用此邮箱邀请您加入 TestFlight
              </p>
            </div>

            {/* 申请理由 */}
            <div>
              <label
                htmlFor="reason"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                申请理由 <span className="text-red-400">*</span>
              </label>
              
              {/* 快速输入按钮 */}
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-2">快速选择：</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_REASONS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleQuickReason(item.text)}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:bg-indigo-500/20 hover:border-indigo-500/50 hover:text-indigo-300 transition-all duration-200"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                id="reason"
                name="reason"
                required
                rows={4}
                minLength={10}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请简单描述您希望体验此 App 的原因..."
                className="w-full rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
              />
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>请输入 10-1000 个字符</span>
                <span className={reason.length > 900 ? "text-amber-400" : ""}>
                  {reason.length}/1000
                </span>
              </div>
            </div>

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3.5 text-sm font-medium text-white transition-all duration-200 hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  提交中...
                </span>
              ) : (
                "提交申请"
              )}
            </button>

            {/* 说明 */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4">
              <h4 className="text-sm font-medium text-slate-300 mb-2">
                申请说明
              </h4>
              <ul className="text-xs text-slate-500 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-slate-600">•</span>
                  提交申请后，我们会在 1-3 个工作日内处理
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-600">•</span>
                  通过审核后，您将收到 Apple 发送的 TestFlight 邀请邮件
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-600">•</span>
                  请确保您的设备已安装 TestFlight 应用
                </li>
              </ul>
            </div>
          </Form>
        )}

        {/* 成功后的返回按钮 */}
        {actionData?.success && (
          <div className="text-center">
            <Link
              to={`/app/${app.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-3 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              返回 App 页面
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
