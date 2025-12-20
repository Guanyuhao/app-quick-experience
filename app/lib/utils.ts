/**
 * 共享工具函数（可在服务端和客户端使用）
 */

import type { GitHubConfig, GiteeConfig, CDNType } from "./types";

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
// cloudflare Ipv6  https://v6.gh-proxy.org/${getGitHubDownloadUrl}
// Fastly CDN  https://cdn.gh-proxy.org/${getGitHubDownloadUrl}
// edgeone  https://gh-proxy.edgeone.app/${getGitHubDownloadUrl}
/**
 * 生成 Gitee Release 下载链接
 * 限制包大小为 100MB 不能用gh-proxy
 * 脚本要自己写api
 */
export function getGiteeDownloadUrl(
  gitee: GiteeConfig,
  tag: string,
  asset: string
): string {
  return `https://gitee.com/${gitee.owner}/${gitee.repo}/releases/download/${tag}/${asset}`;
}

/**
 * 生成 CDN 下载链接
 */
export function getCDNDownloadUrl(
  github: GitHubConfig,
  tag: string,
  asset: string,
  type: CDNType,
  gitee?: GiteeConfig
): string {
  switch (type) {
    case "cloudflare-ipv6":
      return `https://v6.gh-proxy.org/${getGitHubDownloadUrl(github, tag, asset)}`;
    case "fastly":
      return `https://cdn.gh-proxy.org/${getGitHubDownloadUrl(github, tag, asset)}`;
    case "edgeone":
      return `https://gh-proxy.edgeone.app/${getGitHubDownloadUrl(github, tag, asset)}`;
    case "gitee":
      if (!gitee) {
        throw new Error("Gitee 配置不存在");
      }
      return getGiteeDownloadUrl(gitee, tag, asset);
  }
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

