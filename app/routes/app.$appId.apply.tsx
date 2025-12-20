import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { Form, Link, useActionData, useLoaderData, useNavigation, useSearchParams } from "@remix-run/react";
import { getAppById, getLatestVersion, getEmail, getSenderName } from "~/lib/config.server";
import type { AppConfig, IOSApplyFormData } from "~/lib/types";

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
  const { appId } = params;
  if (!appId) {
    return { error: "App ID is required" };
  }

  const app = getAppById(appId);
  if (!app) {
    return { error: "App not found" };
  }

  const formData = await request.formData();
  const appleId = formData.get("appleId") as string;
  const reason = formData.get("reason") as string;
  const version = formData.get("version") as string;

  // 验证必填字段
  if (!appleId || !appleId.includes("@")) {
    return { error: "请输入有效的 Apple ID 邮箱地址" };
  }

  if (!reason || reason.trim().length < 10) {
    return { error: "请输入至少 10 个字符的申请理由" };
  }

  const applyData: IOSApplyFormData = {
    appId,
    appName: app.name,
    version: version || "最新版本",
    appleId: appleId.trim(),
    reason: reason.trim(),
  };

  // 获取邮件配置（同一个邮箱用于收发，通过 Cloudflare Email Routing 转发）
  const email = getEmail();
  const senderName = getSenderName();

  // 构建邮件内容
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
              <td style="padding: 10px 0; color: #1e293b; font-weight: 600;">${applyData.appName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; vertical-align: top;">申请版本</td>
              <td style="padding: 10px 0; color: #1e293b; font-weight: 500;">${applyData.version}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; vertical-align: top;">Apple ID</td>
              <td style="padding: 10px 0;">
                <a href="mailto:${applyData.appleId}" style="color: #6366f1; font-weight: 600; text-decoration: none;">
                  ${applyData.appleId}
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
            ${applyData.reason.replace(/\n/g, "<br>")}
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

  try {
    // 使用 MailChannels API 发送邮件（Cloudflare Workers 免费集成）
    const response = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: email }],
          },
        ],
        from: {
          email: email,
          name: senderName,
        },
        subject: emailSubject,
        content: [
          {
            type: "text/plain",
            value: emailText,
          },
          {
            type: "text/html",
            value: emailHtml,
          },
        ],
      }),
    });

    if (response.ok || response.status === 202) {
      console.log("Email sent successfully via MailChannels");
      return { 
        success: true, 
        message: "申请已提交！我们会尽快将您添加到 TestFlight 测试名单中。" 
      };
    } else {
      const errorText = await response.text();
      console.error("MailChannels API error:", response.status, errorText);
      
      // 如果 MailChannels 失败，仍然记录申请（开发环境）
      console.log("iOS TestFlight Apply Request (fallback):", applyData);
      return { 
        success: true, 
        message: "申请已记录！我们会尽快处理您的申请。" 
      };
    }
  } catch (error) {
    console.error("Failed to send email:", error);
    // 即使邮件发送失败，也记录申请信息
    console.log("iOS TestFlight Apply Request (error fallback):", applyData);
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
  
  const isSubmitting = navigation.state === "submitting";
  const requestedVersion = searchParams.get("version") || latestVersion;

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
                placeholder="example@icloud.com"
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
              <textarea
                id="reason"
                name="reason"
                required
                rows={4}
                minLength={10}
                placeholder="请简单描述您希望体验此 App 的原因..."
                className="w-full rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
              />
              <p className="mt-2 text-xs text-slate-500">
                请输入至少 10 个字符
              </p>
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
