import type { MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { AppCard } from "~/components/AppCard";
import {
  getAllApps,
  getLatestVersionAnyStage,
} from "~/lib/config.server";
import type { AppConfig, VersionStage } from "~/lib/types";

export const meta: MetaFunction = () => {
  return [
    { title: "App 快速体验 - 下载最新版本" },
    {
      name: "description",
      content: "快速下载和体验最新的 App 内测版本、公测版本和正式版本",
    },
  ];
};

interface LoaderData {
  apps: Array<{
    app: AppConfig;
    latestVersion: { version: string; stage: VersionStage } | null;
  }>;
}

export function loader(): LoaderData {
  const apps = getAllApps();

  return {
    apps: apps.map((app) => {
      const latest = getLatestVersionAnyStage(app.id);
      return {
        app,
        latestVersion: latest
          ? { version: latest.version.version, stage: latest.stage }
          : null,
      };
    }),
  };
}

export default function Index() {
  const { apps } = useLoaderData<LoaderData>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* 背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      {/* 主内容 */}
      <div className="relative z-10">
        {/* 顶部导航 */}
        <header className="border-b border-slate-800/50 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                </div>
                <span className="text-lg font-semibold text-white">
                  App 快速体验
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                  在线
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Hero 区域 */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                快速下载体验
              </span>
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                最新版本
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
              获取 Alpha、Beta、RC 等各阶段版本，抢先体验最新功能
            </p>

            {/* 版本阶段说明 */}
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <div className="flex items-center gap-2 rounded-full bg-slate-800/50 px-4 py-2 backdrop-blur">
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500" />
                <span className="text-sm text-slate-300">内测版</span>
                <span className="text-xs text-slate-500">Alpha / Beta</span>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-slate-800/50 px-4 py-2 backdrop-blur">
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
                <span className="text-sm text-slate-300">公测版</span>
                <span className="text-xs text-slate-500">RC / Pre</span>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-slate-800/50 px-4 py-2 backdrop-blur">
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500" />
                <span className="text-sm text-slate-300">正式版</span>
                <span className="text-xs text-slate-500">Release</span>
              </div>
            </div>
          </div>
        </section>

        {/* App 列表 */}
        <section className="pb-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">可用应用</h2>
              <span className="text-sm text-slate-500">
                共 {apps.length} 个应用
              </span>
            </div>

            {apps.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {apps.map(({ app, latestVersion }) => (
                  <AppCard
                    key={app.id}
                    app={app}
                    latestVersion={latestVersion ?? undefined}
                  />
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
                <p className="mt-4 text-slate-400">暂无可用应用</p>
                <p className="mt-1 text-sm text-slate-500">
                  请稍后再来查看
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 页脚 */}
        <footer className="border-t border-slate-800/50 py-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <p className="text-sm text-slate-500">
                © {new Date().getFullYear()} App 快速体验平台
              </p>
              <div className="flex items-center gap-4">
                <a
                  href="#"
                  className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
                >
                  使用帮助
                </a>
                <a
                  href="#"
                  className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
                >
                  反馈问题
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
