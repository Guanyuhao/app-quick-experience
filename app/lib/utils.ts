/**
 * 共享工具函数（可在服务端和客户端使用）
 */

import type { GitHubConfig } from "./types";

/**
 * 生成 GitHub Release 下载链接
 */
export function getGitHubDownloadUrl(
  github: GitHubConfig,
  tag: string,
  asset: string
): string {
  return `https://github.com/${github.owner}/${github.repo}/releases/download/${tag}/${asset}`;
}

/**
 * 格式化日期显示
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

