import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { Outlet, useLoaderData, useLocation, useNavigate } from "@remix-run/react";
import { getAppById } from "~/lib/config.server";
import type { AppConfig } from "~/lib/types";

interface LoaderData {
  app: AppConfig;
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

  return { app };
}

export function headers() {
  // 设置缓存头，优化性能
  return {
    "Cache-Control": "public, max-age=60, s-maxage=300",
  };
}

export default function AppLayout() {
  const { app } = useLoaderData<LoaderData>();
  const location = useLocation();
  const navigate = useNavigate();

  // 判断是否在 app/${appId} 页面（不需要返回按钮）
  const isIndexPage = location.pathname === `/app/${app.id}`;
  const showBackButton = !isIndexPage;

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* 背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* 顶部导航 */}
        {showBackButton && (
          <header className="border-b border-slate-800/50 backdrop-blur-xl">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                  type="button"
                >
                  <svg
                    className="h-5 w-5"
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
                  <span>上一级</span>
                </button>
              </div>
            </div>
          </header>
        )}

        {/* 子路由内容 */}
        <Outlet context={{ app }} />
      </div>
    </div>
  );
}
