import { Link } from "@remix-run/react";
import type { AppConfig, VersionStage } from "~/lib/types";
import { STAGE_CONFIG } from "~/lib/types";

interface AppCardProps {
  app: AppConfig;
  latestVersion?: {
    version: string;
    stage: VersionStage;
  };
}

export function AppCard({ app, latestVersion }: AppCardProps) {
  const stageInfo = latestVersion ? STAGE_CONFIG[latestVersion.stage] : null;

  return (
    <Link
      to={`/app/${app.id}`}
      prefetch="intent"
      className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 p-6 transition-all duration-300 hover:scale-[1.02] hover:border-slate-600/50 hover:shadow-2xl hover:shadow-indigo-500/10"
    >
      {/* 背景光效 */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex items-start gap-4">
        {/* App 图标 */}
        <div className="relative flex-shrink-0">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5">
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-900">
              {app.icon ? (
                <img
                  src={app.icon}
                  alt={app.name}
                  className="h-12 w-12 rounded-xl object-cover"
                  onError={(e) => {
                    // 如果图片加载失败，显示默认图标
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.classList.remove(
                      "hidden"
                    );
                  }}
                />
              ) : null}
              <span
                className={`text-2xl font-bold text-white ${app.icon ? "hidden" : ""}`}
              >
                {app.name.charAt(0)}
              </span>
            </div>
          </div>
          {/* 在线指示器 */}
          <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-slate-900 bg-emerald-500" />
        </div>

        {/* App 信息 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-white">
              {app.name}
            </h3>
            {stageInfo && (
              <span
                className={`inline-flex items-center rounded-full bg-gradient-to-r ${stageInfo.color} px-2 py-0.5 text-xs font-medium text-white`}
              >
                {stageInfo.name}
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-slate-400">
            {app.description}
          </p>
          {latestVersion && (
            <p className="mt-2 text-xs text-slate-500">
              最新版本: v{latestVersion.version}
            </p>
          )}
        </div>

        {/* 箭头指示器 */}
        <div className="flex-shrink-0 self-center">
          <svg
            className="h-5 w-5 text-slate-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>

      {/* 平台支持标识 */}
      <div className="relative mt-4 flex items-center gap-3 border-t border-slate-700/50 pt-4">
        <span className="text-xs text-slate-500">支持平台:</span>
        <div className="flex items-center gap-2">
          {/* Android */}
          <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1">
            <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85a.637.637 0 00-.83.22l-1.88 3.24a11.463 11.463 0 00-8.94 0L5.65 5.67a.643.643 0 00-.87-.2c-.28.18-.37.54-.22.83L6.4 9.48A10.78 10.78 0 001 18h22a10.78 10.78 0 00-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z"
              />
            </svg>
            <span className="text-xs text-emerald-400">Android</span>
          </div>
          {/* iOS */}
          <div className="flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-1">
            <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
              />
            </svg>
            <span className="text-xs text-slate-400">iOS</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

