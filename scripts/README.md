# Release Manager 使用文档

GitHub Release 发布与清理脚本，自动管理 `apps.json` 配置与 GitHub Release 的同步。

## 📋 目录

- [前置要求](#前置要求)
- [核心概念](#核心概念)
- [命令概览](#命令概览)
- [详细用法](#详细用法)
  - [publish - 发布版本](#publish---发布版本)
  - [cleanup - 清理废弃版本](#cleanup---清理废弃版本)
  - [normalize - 规范化配置](#normalize---规范化配置)
- [常见场景示例](#常见场景示例)
- [注意事项](#注意事项)

## 前置要求

1. **Python 3.8+**
2. **GitHub CLI (`gh`)**：已安装并完成认证
   ```bash
   gh auth login
   ```
3. **apps.json 配置**：确保 `app/config/apps.json` 中已配置 App 的 `github.owner` 和 `github.repo`

## 核心概念

### Tag 与 Version 的关系

- **基础 Tag**：一个基础 tag（如 `v1.0.0.alpha`）可以包含多个版本构建
- **Version**：每个版本有唯一标识（如 `1.0.0-alpha.1`、`1.0.0-alpha.2`）
- **Asset 命名**：统一格式为 `<appId>-<stage>.<index>.(apk|ipa)`

**示例**：
- Tag `v1.0.0.alpha` 下可以有：
  - `boochat-alpha.1.apk`
  - `boochat-alpha.2.apk`
  - `boochat-alpha.1.ipa`
  - `boochat-alpha.2.ipa`

### 版本格式

支持两种输入格式（脚本会自动识别）：
- `1.0.0-alpha.2`（推荐）
- `1.0.0.beta.2`

如果只输入 `1.0.0-alpha`（不带 index），脚本会自动递增该 stage 的最大 index。

## 命令概览

```bash
python3 scripts/release_manager.py [--config PATH] [--dry-run] <command> [options]
```

### 主要命令

| 命令 | 功能 | 使用场景 |
|------|------|----------|
| `publish` | 发布新版本到 GitHub Release | 日常发布 |
| `cleanup` | 清理废弃的 Release 或 Asset | 定期维护 |
| `normalize` | 规范化 apps.json 的 asset 命名 | 首次使用或迁移 |

## 详细用法

### publish - 发布版本

发布新版本到 GitHub Release，并自动更新 `apps.json`。

#### 基本用法

```bash
# 交互式发布（推荐首次使用）
python3 scripts/release_manager.py publish

# 命令行参数发布
python3 scripts/release_manager.py publish \
  --app boochat \
  --version 1.0.0-alpha.2 \
  --files "release/boochat/**/*.{apk,ipa}" \
  --notes "修复登录问题\n优化性能"
```

#### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `--app` | App id 或 name（不填则交互输入） | `--app boochat` |
| `--version` | 版本号（不填则交互输入） | `--version 1.0.0-alpha.2` |
| `--files` | 文件 glob 模式（支持 `**`） | `--files "release/**/*.{apk,ipa}"` |
| `--notes` | Release notes（支持 `\n` 换行） | `--notes "修复bug\n新功能"` |
| `--date` | 日期（默认今天，格式：YYYY-MM-DD） | `--date 2025-01-20` |
| `--ios-testflight` | iOS 标记为 TestFlight（默认交互询问） | `--ios-testflight` |
| `--tag-style` | Tag 风格：`dot`（默认）或 `dash` | `--tag-style dash` |
| `--cleanup` | 发布后清理废弃版本（默认开启） | `--cleanup` / `--no-cleanup` |
| `--normalize-assets` | 写回前规范化整个 apps.json（默认开启） | `--normalize-assets` / `--no-normalize-assets` |

#### 工作流程

1. **解析版本**：从输入版本或自动递增 index
2. **匹配文件**：根据 glob 模式查找 `.apk` / `.ipa` 文件
3. **重命名文件**：统一命名为 `<appId>-<stage>.<index>.(apk|ipa)`
4. **检查/创建 Release**：
   - 如果基础 tag（如 `v1.0.0.alpha`）不存在，创建新 release
   - 如果已存在，直接上传到该 release
5. **上传 Assets**：上传重命名后的文件
6. **清理废弃版本**（可选）：删除 apps.json 中不存在的 release/asset
7. **更新 apps.json**：写入新版本记录

#### 示例场景

**场景 1：发布 Alpha 版本（自动递增 index）**

```bash
# 当前 apps.json 中 alpha 最新是 1.0.0-alpha.1
# 脚本会自动创建 1.0.0-alpha.2
python3 scripts/release_manager.py publish \
  --app boochat \
  --version 1.0.0-alpha \
  --files "build/boochat-alpha-*.apk"
```

**场景 2：发布 Beta 版本（指定完整版本号）**

```bash
python3 scripts/release_manager.py publish \
  --app boochat \
  --version 1.0.0-beta.3 \
  --files "release/boochat/**/*.{apk,ipa}" \
  --notes "Beta 3 版本\n- 修复崩溃问题\n- 优化 UI"
```

**场景 3：只发布 Android（iOS 稍后发布）**

```bash
# 只匹配 .apk 文件
python3 scripts/release_manager.py publish \
  --app boochat \
  --version 1.0.0-alpha.2 \
  --files "release/boochat/**/*.apk"
```

**场景 4：使用 Dash 风格的 Tag**

```bash
# 创建 v1.0.0-alpha（而不是 v1.0.0.alpha）
python3 scripts/release_manager.py publish \
  --app boochat \
  --version 1.0.0-alpha.2 \
  --files "release/**/*.{apk,ipa}" \
  --tag-style dash
```

**场景 5：Dry-run 预览（推荐首次使用）**

```bash
python3 scripts/release_manager.py publish \
  --app boochat \
  --version 1.0.0-alpha.2 \
  --files "release/**/*.{apk,ipa}" \
  --dry-run
```

### cleanup - 清理废弃版本

清理 GitHub Release 中 `apps.json` 不存在的版本。

#### 基本用法

```bash
# 交互式清理（推荐）
python3 scripts/release_manager.py cleanup

# 指定 App 清理
python3 scripts/release_manager.py cleanup --app boochat

# 自动确认（危险，谨慎使用）
python3 scripts/release_manager.py cleanup --app boochat --yes
```

#### 清理规则

脚本会执行两层清理：

1. **删除整个 Release**：如果 `apps.json` 中完全没有该基础 tag（如 `v1.0.0.alpha`）
2. **删除单个 Asset**：如果基础 tag 还存在，但某个版本（如 `alpha.0`）不在 `apps.json` 中

#### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `--app` | App id 或 name（不填则用第一个 app） | `--app boochat` |
| `--yes` | 不再二次确认（危险） | `--yes` |
| `--cleanup-tag` | 删除 release 时同时删除 git tag | `--cleanup-tag` |
| `--cleanup-assets` | tag 存在时，删除 apps.json 不存在的 asset（默认开启） | `--cleanup-assets` / `--no-cleanup-assets` |

#### 示例场景

**场景 1：预览清理计划（Dry-run）**

```bash
python3 scripts/release_manager.py cleanup --app boochat --dry-run
```

**场景 2：清理废弃的 Release**

```bash
# 假设 apps.json 中已删除 v1.0.0.alpha 的所有记录
# 脚本会删除整个 v1.0.0.alpha release
python3 scripts/release_manager.py cleanup --app boochat
```

**场景 3：清理废弃的 Asset（保留 Release）**

```bash
# 假设 apps.json 中只有 alpha.1 和 alpha.3，没有 alpha.2
# 脚本会删除 alpha.2 的 asset，但保留 release
python3 scripts/release_manager.py cleanup --app boochat
```

**场景 4：彻底清理（包括 Git Tag）**

```bash
# 删除 release 时同时删除 git tag（更彻底，但更危险）
python3 scripts/release_manager.py cleanup \
  --app boochat \
  --cleanup-tag \
  --yes
```

### normalize - 规范化配置

规范化 `apps.json` 中所有 asset 的命名，统一为 `<appId>-<stage>.<index>.(apk|ipa)` 格式。

#### 基本用法

```bash
# 预览变更（推荐）
python3 scripts/release_manager.py normalize --dry-run

# 执行规范化
python3 scripts/release_manager.py normalize
```

#### 使用场景

- **首次使用脚本**：规范化历史配置
- **迁移命名规则**：从旧命名迁移到新命名
- **批量修复**：修复手动编辑导致的命名不一致

#### 示例

**场景：规范化所有 App 的配置**

```bash
# 先预览
python3 scripts/release_manager.py normalize --dry-run

# 确认无误后执行
python3 scripts/release_manager.py normalize
```

## 常见场景示例

### 场景 1：日常发布流程（推荐）

```bash
# 1. 构建完成后，发布新版本
python3 scripts/release_manager.py publish \
  --app boochat \
  --version 1.0.0-alpha.2 \
  --files "release/boochat/**/*.{apk,ipa}" \
  --notes "Alpha 2 版本\n- 新功能\n- 修复bug"

# 2. 定期清理（可选，脚本默认会自动清理）
python3 scripts/release_manager.py cleanup --app boochat
```

### 场景 2：快速发布（使用默认值）

```bash
# 交互式输入，适合快速发布
python3 scripts/release_manager.py publish
# 依次输入：app、version、files、notes
```

### 场景 3：批量规范化历史配置

```bash
# 1. 规范化 apps.json
python3 scripts/release_manager.py normalize

# 2. 清理 GitHub 上不符合规范的 release
python3 scripts/release_manager.py cleanup --app boochat --dry-run
python3 scripts/release_manager.py cleanup --app boochat
```

### 场景 4：发布多个版本到同一个 Tag

```bash
# 发布 alpha.2（会自动上传到 v1.0.0.alpha）
python3 scripts/release_manager.py publish \
  --app boochat \
  --version 1.0.0-alpha.2 \
  --files "release/boochat-alpha-2.apk"

# 稍后发布 alpha.3（同样上传到 v1.0.0.alpha）
python3 scripts/release_manager.py publish \
  --app boochat \
  --version 1.0.0-alpha.3 \
  --files "release/boochat-alpha-3.apk"
```

### 场景 5：修复错误发布的版本

```bash
# 1. 从 apps.json 删除错误版本记录
# （手动编辑 apps.json）

# 2. 清理 GitHub 上的错误版本
python3 scripts/release_manager.py cleanup --app boochat

# 3. 重新发布正确版本
python3 scripts/release_manager.py publish \
  --app boochat \
  --version 1.0.0-alpha.2 \
  --files "release/boochat-alpha-2-fixed.apk"
```

## 注意事项

### ⚠️ 安全提示

1. **首次使用建议 Dry-run**：使用 `--dry-run` 预览操作，确认无误后再执行
2. **清理操作需谨慎**：`cleanup` 会删除 GitHub Release，建议先预览
3. **备份 apps.json**：重要操作前建议备份配置文件

### 📝 文件命名规则

- **统一格式**：`<appId>-<stage>.<index>.(apk|ipa)`
- **示例**：
  - ✅ `boochat-alpha.1.apk`
  - ✅ `boochat-beta.2.ipa`
  - ❌ `boochat-1.0.0-alpha.1.apk`（旧格式，会被规范化）

### 🔍 Tag 风格兼容

脚本会自动探测仓库中已有的 tag 风格：
- **Dot 风格**：`v1.0.0.alpha`（默认）
- **Dash 风格**：`v1.0.0-alpha`

如果仓库已有 tag，脚本会使用相同风格；新建时默认使用 dot 风格（可通过 `--tag-style dash` 修改）。

### 📋 apps.json 结构要求

确保每个 App 配置包含：

```json
{
  "id": "boochat",
  "name": "BooChat",
  "github": {
    "owner": "Guanyuhao",
    "repo": "app-quick-experience"
  },
  "versions": {
    "alpha": [...],
    "beta": [...]
  }
}
```

### 🐛 常见问题

**Q: 脚本提示找不到 App？**  
A: 检查 `apps.json` 中 App 的 `id` 或 `name` 是否匹配（不区分大小写）

**Q: 上传失败？**  
A: 确认 `gh auth login` 已完成，且有该仓库的写入权限

**Q: 文件命名不符合规范？**  
A: 运行 `normalize` 命令规范化配置，或使用 `--normalize-assets` 自动规范化

**Q: Tag 已存在但上传失败？**  
A: 检查 tag 风格是否一致（dot/dash），脚本会自动探测但可能需要手动指定 `--tag-style`

## 快速参考

```bash
# 发布（最常用）
python3 scripts/release_manager.py publish --app boochat --version 1.0.0-alpha.2 --files "release/**/*.{apk,ipa}"

# 清理
python3 scripts/release_manager.py cleanup --app boochat

# 规范化
python3 scripts/release_manager.py normalize

# 预览（推荐）
python3 scripts/release_manager.py <command> --dry-run
```

