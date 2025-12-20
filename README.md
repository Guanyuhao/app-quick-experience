# App 快速体验平台

基于 Remix + Cloudflare Workers 构建的 App 分发平台。

## 功能

- 📱 多 App 管理
- 📦 多阶段版本（内测/公测/正式）
- 📧 iOS TestFlight 申请（MailChannels 邮件通知）
- 🌐 Cloudflare Workers 边缘部署

## 快速开始

```bash
pnpm install
pnpm run dev
```

## 配置

编辑 `app/config/apps.json`：

```json
{
  "apps": [...],
  "settings": {
    "email": "support@chatone.info",
    "senderName": "BooChat 体验平台"
  }
}
```

## 部署

```bash
pnpm run deploy
```

## SPF 配置

在 Cloudflare DNS 添加：

```
TXT @ "v=spf1 include:_spf.mx.cloudflare.net include:relay.mailchannels.net ~all"
```
