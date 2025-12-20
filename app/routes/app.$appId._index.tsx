import type {
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { getAppById, getActiveStages, getLatestVersion } from "~/lib/config.server";
import type { AppConfig, AppVersion, VersionStage } from "~/lib/types";
import { STAGE_CONFIG, STAGE_GROUPS } from "~/lib/types";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.app) {
    return [{ title: "App 未找到" }];
  }
  return [
    { title: `${data.app.name} - App 快速体验` },
    { name: "description", content: data.app.description },
  ];
};

interface LoaderData {
  app: AppConfig;
  activeStages: VersionStage[];
  latestVersions: Record<VersionStage, AppVersion | undefined>;
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

  const activeStages = getActiveStages(appId);
  const latestVersions: Record<VersionStage, AppVersion | undefined> = {
    alpha: getLatestVersion(appId, "alpha"),
    beta: getLatestVersion(appId, "beta"),
    rc: getLatestVersion(appId, "rc"),
    pre: getLatestVersion(appId, "pre"),
    release: getLatestVersion(appId, "release"),
  };

  return { app, activeStages, latestVersions };
}

export function headers() {
  // 设置缓存头，优化性能
  return {
    "Cache-Control": "public, max-age=60, s-maxage=300",
  };
}

export default function AppDetailIndex() {
  const { app, activeStages, latestVersions } = useLoaderData<LoaderData>();

  return (
    <>
      {/* App 信息头部 */}
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-6">
            {/* App 图标 */}
            <div className="flex-shrink-0">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5">
                <div className="flex h-full w-full items-center justify-center rounded-3xl bg-slate-900">
                  {app.icon ? (
                    <img
                      src={app.icon}
                      alt={app.name}
                      className="h-20 w-20 rounded-2xl object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.nextElementSibling?.classList.remove(
                          "hidden"
                        );
                      }}
                    />
                  ) : null}
                  <span
                    className={`text-4xl font-bold text-white ${app.icon ? "hidden" : ""}`}
                  >
                    {app.name.charAt(0)}
                  </span>
                </div>
              </div>
            </div>

            {/* App 信息 */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white">{app.name}</h1>
              <p className="mt-2 text-lg text-slate-400">{app.description}</p>

              {/* 平台支持 */}
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-2 text-emerald-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85a.637.637 0 00-.83.22l-1.88 3.24a11.463 11.463 0 00-8.94 0L5.65 5.67a.643.643 0 00-.87-.2c-.28.18-.37.54-.22.83L6.4 9.48A10.78 10.78 0 001 18h22a10.78 10.78 0 00-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z"
                    />
                  </svg>
                  <span className="text-sm">Android</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
                    />
                  </svg>
                  <span className="text-sm">iOS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 版本阶段 */}
      <section className="pb-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-semibold text-white mb-6">
            选择版本阶段
          </h2>

          <div className="space-y-8">
            {(Object.keys(STAGE_GROUPS) as Array<keyof typeof STAGE_GROUPS>).map(
              (groupKey) => {
                const group = STAGE_GROUPS[groupKey];

                return (
                  <div key={groupKey}>
                    <h3 className="text-sm font-medium uppercase tracking-wider text-slate-500 mb-4">
                      {group.name}
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {group.stages.map((stage) => {
                        const stageInfo = STAGE_CONFIG[stage];
                        const latestVersion = latestVersions[stage];
                        const isActive = activeStages.includes(stage);

                        return (
                          <Link
                            key={stage}
                            to={`/app/${app.id}/${stage}`}
                            prefetch="intent"
                            className={`group relative overflow-hidden rounded-xl border p-5 transition-all duration-300 ${
                              isActive
                                ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700/50 hover:border-slate-600/50 hover:scale-[1.02]"
                                : "bg-slate-900/40 border-slate-800/50 opacity-50 pointer-events-none"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`h-3 w-3 rounded-full bg-gradient-to-r ${stageInfo.color}`}
                                  />
                                  <span className="font-semibold text-white">
                                    {stageInfo.name}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm text-slate-400">
                                  {stageInfo.description}
                                </p>
                                {latestVersion && (
                                  <p className="mt-3 text-xs text-slate-500">
                                    最新: v{latestVersion.version}
                                  </p>
                                )}
                              </div>
                              {isActive && (
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
                              )}
                            </div>
                            {!isActive && (
                              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
                                <span className="text-sm text-slate-500">
                                  暂无版本
                                </span>
                              </div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      </section>
    </>
  );
}

