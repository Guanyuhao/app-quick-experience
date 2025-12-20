/**
 * App 快速体验平台类型定义
 */

// 版本阶段类型
export type VersionStage = "alpha" | "beta" | "rc" | "pre" | "release";

// 阶段分组
export type StageGroup = "internal" | "public" | "release";

// 平台资源信息
export interface PlatformAsset {
  tag: string; // GitHub Release tag
  asset: string; // 文件名
}

// iOS 平台资源（额外包含 TestFlight 标记）
export interface IOSAsset extends PlatformAsset {
  testflight?: boolean; // 是否需要通过 TestFlight 申请
}

// 版本信息
export interface AppVersion {
  version: string;
  date: string;
  changelog: string;
  android?: PlatformAsset;
  ios?: IOSAsset;
}

// GitHub 仓库配置
export interface GitHubConfig {
  owner: string;
  repo: string;
}

// Gitee 仓库配置
export interface GiteeConfig {
  owner: string;
  repo: string;
}

export type CDNType = "cloudflare-ipv6" | "fastly" | "edgeone" | "gitee";

// App 配置
export interface AppConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  github: GitHubConfig;
  gitee?: GiteeConfig; // 可选，Gitee 仓库配置
  versions: {
    alpha: AppVersion[];
    beta: AppVersion[];
    rc: AppVersion[];
    pre: AppVersion[];
    release: AppVersion[];
  };
}

// 全局设置
export interface AppSettings {
  email: string;         // 收件邮箱（通过 Cloudflare Email Routing 转发）
  senderEmail?: string;  // 发件邮箱（需在 Resend 验证域名，不填则使用 email）
  senderName?: string;   // 发件人显示名称
}

// 完整配置文件结构
export interface AppsConfigFile {
  apps: AppConfig[];
  settings: AppSettings;
}

// iOS 申请表单数据
export interface IOSApplyFormData {
  appId: string;
  appName: string;
  version: string;
  appleId: string;
  reason: string;
}

// 阶段信息
export interface StageInfo {
  id: VersionStage;
  group: StageGroup;
  name: string;
  description: string;
  color: string;
}

// 阶段配置映射
export const STAGE_CONFIG: Record<VersionStage, StageInfo> = {
  alpha: {
    id: "alpha",
    group: "internal",
    name: "Alpha 内测",
    description: "早期内部测试版本，可能存在较多问题",
    color: "from-orange-500 to-red-500",
  },
  beta: {
    id: "beta",
    group: "internal",
    name: "Beta 内测",
    description: "功能完善的内测版本，稳定性较好",
    color: "from-yellow-500 to-orange-500",
  },
  rc: {
    id: "rc",
    group: "public",
    name: "RC 公测",
    description: "Release Candidate，接近正式版",
    color: "from-blue-500 to-cyan-500",
  },
  pre: {
    id: "pre",
    group: "public",
    name: "Pre 公测",
    description: "Pre-release 预发布版本",
    color: "from-purple-500 to-blue-500",
  },
  release: {
    id: "release",
    group: "release",
    name: "正式版",
    description: "稳定的正式发布版本",
    color: "from-emerald-500 to-green-500",
  },
};

// 阶段分组配置
export const STAGE_GROUPS: Record<
  StageGroup,
  { name: string; stages: VersionStage[] }
> = {
  internal: {
    name: "内测版本",
    stages: ["alpha", "beta"],
  },
  public: {
    name: "公测版本",
    stages: ["rc", "pre"],
  },
  release: {
    name: "正式版本",
    stages: ["release"],
  },
};

