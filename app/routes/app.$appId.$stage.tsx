import type {
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import {
  getAppById,
  getVersionsByStage,
} from "~/lib/config.server";
import { getGitHubDownloadUrl, formatDate } from "~/lib/utils";
import type { AppConfig, AppVersion, VersionStage } from "~/lib/types";
import { STAGE_CONFIG } from "~/lib/types";
import { DownloadButton } from "~/components/DownloadButton";

const VALID_STAGES: VersionStage[] = ["alpha", "beta", "rc", "pre", "release"];

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.app || !data?.stageInfo) {
    return [{ title: "版本未找到" }];
  }
  return [
    { title: `${data.app.name} ${data.stageInfo.name} - App 快速体验` },
    {
      name: "description",
      content: `下载 ${data.app.name} 的 ${data.stageInfo.name} 版本`,
    },
  ];
};

interface LoaderData {
  app: AppConfig;
  stage: VersionStage;
  stageInfo: (typeof STAGE_CONFIG)[VersionStage];
  versions: AppVersion[];
}

export function loader({ params }: LoaderFunctionArgs): LoaderData {
  const { appId, stage } = params;

  if (!appId || !stage) {
    throw new Response("Missing parameters", { status: 400 });
  }

  if (!VALID_STAGES.includes(stage as VersionStage)) {
    throw new Response("Invalid stage", { status: 400 });
  }

  const app = getAppById(appId);
  if (!app) {
    throw new Response("App not found", { status: 404 });
  }

  const typedStage = stage as VersionStage;
  const versions = getVersionsByStage(appId, typedStage);
  const stageInfo = STAGE_CONFIG[typedStage];

  return { app, stage: typedStage, stageInfo, versions };
}

export default function StageVersions() {
  const { app, stageInfo, versions } = useLoaderData<LoaderData>();
  const isInternal = stageInfo.group === "internal";

  return (
    <>
      {/* 页面头部 */}
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div
              className={`h-4 w-4 rounded-full bg-gradient-to-r ${stageInfo.color}`}
            />
            <div>
              <h1 className="text-2xl font-bold text-white">
                {app.name} - {stageInfo.name}
              </h1>
              <p className="mt-1 text-slate-400">{stageInfo.description}</p>
            </div>
          </div>

          {/* iOS 内测申请提示 */}
          {isInternal && (
            <div className="mt-6 rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="text-sm text-slate-300">
                    <strong className="text-amber-400">iOS 用户注意：</strong>
                    内测版本需要通过 TestFlight 安装，请先申请体验资格。
                  </p>
                  <Link
                    to={`/app/${app.id}/apply`}
                    className="mt-2 inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    立即申请
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
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 版本列表 */}
      <section className="pb-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">版本列表</h2>
            <span className="text-sm text-slate-500">
              共 {versions.length} 个版本
            </span>
          </div>

          {versions.length > 0 ? (
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div
                  key={version.version}
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-lg border border-slate-700/40 p-6 transition-all duration-300 hover:border-slate-600/50"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* 最新版本标签 */}
                  {index === 0 && (
                    <div className="absolute top-4 right-4">
                      <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
                        最新
                      </span>
                    </div>
                  )}

                  {/* 版本头部 */}
                  <div className="flex items-start justify-between pr-20">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-semibold text-white">
                          v{version.version}
                        </h4>
                        <span
                          className={`inline-flex items-center rounded-full bg-gradient-to-r ${stageInfo.color} px-2 py-0.5 text-xs font-medium text-white`}
                        >
                          {stageInfo.name}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {formatDate(version.date)}
                      </p>
                    </div>
                  </div>

                  {/* 更新日志 */}
                  <div className="mt-4">
                    <h5 className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      更新内容
                    </h5>
                    <div className="mt-2 text-sm text-slate-300 whitespace-pre-line">
                      {version.changelog}
                    </div>
                  </div>

                  {/* 下载按钮 */}
                  <div className="mt-5 flex flex-wrap gap-3">
                    {/* Android 下载 */}
                    {version.android && (
                      <DownloadButton
                        downloadUrl={getGitHubDownloadUrl(
                          app.github,
                          version.android.tag,
                          version.android.asset
                        )}
                        btnText="下载 APK"
                        variant="emerald"
                        icon={
                          <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85a.637.637 0 00-.83.22l-1.88 3.24a11.463 11.463 0 00-8.94 0L5.65 5.67a.643.643 0 00-.87-.2c-.28.18-.37.54-.22.83L6.4 9.48A10.78 10.78 0 001 18h22a10.78 10.78 0 00-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z"
                            />
                          </svg>
                        }
                      />
                    )}
                    {/* {国内加速下载} */}
                    {version?.android?.cdnUrl &&(
                      <DownloadButton
                        downloadUrl={version?.android?.cdnUrl}
                        btnText="香港加速Apk"
                        variant="emerald"
                      />
                    )}
                    {/* iOS 下载/申请 */}
                    {version.ios && (
                      <>
                        {version.ios.testflight && isInternal ? (
                          <Link
                            to={`/app/${app.id}/apply?version=${version.version}`}
                            className="inline-flex items-center gap-2 rounded-lg bg-slate-500/20 px-4 py-2.5 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-slate-500/30 hover:text-slate-200"
                          >
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                              <path
                                fill="currentColor"
                                d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
                              />
                            </svg>
                            <span>申请 TestFlight</span>
                            <svg
                              className="h-4 w-4 opacity-60"
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
                          </Link>
                        ) : (
                          <DownloadButton
                            downloadUrl={getGitHubDownloadUrl(
                              app.github,
                              version.ios.tag,
                              version.ios.asset
                            )}
                            btnText="下载 IPA"
                            variant="slate"
                            icon={
                              <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                  fill="currentColor"
                                  d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
                                />
                              </svg>
                            }
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800">
                <svg
                  className="h-8 w-8 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <p className="mt-4 text-slate-400">该阶段暂无版本</p>
              <p className="mt-1 text-sm text-slate-500">请关注后续更新</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
