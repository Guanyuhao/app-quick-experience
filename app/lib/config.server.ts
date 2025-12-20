/**
 * 配置加载器和工具函数
 * .server.ts 后缀确保代码只在服务端运行
 */

import type {
  AppConfig,
  AppsConfigFile,
  AppVersion,
  VersionStage,
} from "./types";
import appsConfig from "../config/apps.json";

// 重新导出共享工具函数
export { getGitHubDownloadUrl, formatDate } from "./utils";

// 类型断言配置文件
const config = appsConfig as AppsConfigFile;

/**
 * 获取所有 App 列表
 */
export function getAllApps(): AppConfig[] {
  return config.apps;
}

/**
 * 根据 ID 获取单个 App
 */
export function getAppById(appId: string): AppConfig | undefined {
  return config.apps.find((app) => app.id === appId);
}

/**
 * 获取 App 的指定阶段版本列表
 */
export function getVersionsByStage(
  appId: string,
  stage: VersionStage
): AppVersion[] {
  const app = getAppById(appId);
  if (!app) return [];
  return app.versions[stage] || [];
}

/**
 * 获取 App 的最新版本（按阶段）
 */
export function getLatestVersion(
  appId: string,
  stage: VersionStage
): AppVersion | undefined {
  const versions = getVersionsByStage(appId, stage);
  return versions[0]; // 假设版本按最新排序
}

/**
 * 获取 App 任意阶段的最新版本
 */
export function getLatestVersionAnyStage(appId: string): {
  version: AppVersion;
  stage: VersionStage;
} | null {
  const app = getAppById(appId);
  if (!app) return null;

  const stages: VersionStage[] = ["release", "pre", "rc", "beta", "alpha"];

  for (const stage of stages) {
    const versions = app.versions[stage];
    if (versions && versions.length > 0) {
      return { version: versions[0], stage };
    }
  }

  return null;
}

/**
 * 获取收件邮箱地址（通知邮箱，通过 Cloudflare Email Routing 转发）
 */
export function getEmail(): string {
  return config.settings.email;
}

/**
 * 获取发件邮箱地址
 * 优先使用 senderEmail，如果未配置则使用 email
 * 注意：使用自定义域名需要先在 Resend 验证
 */
export function getSenderEmail(): string {
  return config.settings.senderEmail || config.settings.email;
}

/**
 * 获取发件人名称
 */
export function getSenderName(): string {
  return config.settings.senderName || "App 快速体验平台";
}

/**
 * 检查 App 在指定阶段是否有版本
 */
export function hasVersionsInStage(
  appId: string,
  stage: VersionStage
): boolean {
  const versions = getVersionsByStage(appId, stage);
  return versions.length > 0;
}

/**
 * 获取 App 所有有版本的阶段
 */
export function getActiveStages(appId: string): VersionStage[] {
  const app = getAppById(appId);
  if (!app) return [];

  const stages: VersionStage[] = ["alpha", "beta", "rc", "pre", "release"];
  return stages.filter((stage) => app.versions[stage]?.length > 0);
}
