# App 快速体验平台

基于 Remix + Cloudflare Workers 构建的 App 分发平台。

## 功能

- 📱 多 App 管理
- 📦 多阶段版本（内测/公测/正式）
- 📧 iOS TestFlight 申请（Resend 邮件通知）
- 🌐 Cloudflare Workers 边缘部署

## 快速开始

```bash
pnpm install
pnpm run dev
```

## 配置

### 1. App 配置

编辑 `app/config/apps.json`

### 2. Resend API Key

1. 注册 [Resend](https://resend.com)（免费 3000 封/月）
2. 创建 API Key
3. 添加并验证域名 `chatone.info`
4. 本地开发：创建 `.dev.vars`
   ```
   RESEND_API_KEY=re_xxxxxxxx
   ```
5. 生产部署：在 Cloudflare Dashboard 设置 Secret

## 部署

```bash
pnpm run deploy
```

## 开发环境用真实邮箱
```json
"settings": {
    "email": "xxx@qq.com",
    "senderEmail": "onboarding@resend.dev",
}
```