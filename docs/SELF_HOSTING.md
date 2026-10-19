# 网页版自部署

需要 Node.js 22.18+、npm 和自己的 Cloudflare 账号。此版本是单人信息册，没有公开注册入口。每份部署拥有独立数据库和账号。

## 1. 获取源码

```sh
git clone https://github.com/GboyCode/Folio.git
cd Folio
npm ci
```

将 `wrangler.example.jsonc` 复制为 `wrangler.jsonc`。PowerShell 用 `Copy-Item wrangler.example.jsonc wrangler.jsonc`；macOS/Linux 用 `cp wrangler.example.jsonc wrangler.jsonc`。实际配置已被 Git 忽略，不要提交自己的账号、资源 ID 或凭据。

## 2. 创建数据库

```sh
npx wrangler login
npx wrangler d1 create folio
```

将返回的 `database_id` 填入 `wrangler.jsonc`。`DB` 绑定名必须保留；数据库若改名，也需同步修改 package.json 中的 `db:local` / `db:remote` 命令。多账号用户请在自己的配置中填入目标 `account_id`。

```sh
npm run db:remote
npm run deploy
```

终端会给出 `https://folio.<你的子域>.workers.dev`。此时还没有账号，无法登录；下一步初始化即可。

## 3. 初始化自己的账号

把下方网址替换为上一步输出的网址；用户名可以自行指定。

```sh
node scripts/provision-account.mjs --username admin --url https://folio.YOUR-SUBDOMAIN.workers.dev
npx wrangler d1 execute folio --remote --file .secrets/account.sql
```

随机初始密码仅写入本机 `.secrets/登录信息.txt` 与 `.secrets/credentials.json`，不会显示在终端，也不会打包到网站。SQL 仅包含加盐密码哈希。首次登录后可在数据隐私页修改登录密码。初始化使用 `INSERT OR IGNORE`，重复运行不会覆盖数据库中的现有账号。

这些文件需要妥善保管；不要提交 Git、发送到 Issues 或放入公开网站目录。账号初始化与卡包加密是两件事；需要密文存储时，请在界面里主动开启密码加密。

## 4. 自定义域名（可选）

在自己 Cloudflare 托管的域名下，向 `wrangler.jsonc` 添加：

```json
"routes": [{ "pattern": "wallet.example.com", "custom_domain": true }]
```

再运行 `npm run deploy`。Cloudflare 为 Worker 配置自定义域名和 HTTPS。使用自定义域名后，如不再需要 workers.dev，可将 `workers_dev` 改为 `false` 后重新部署。不要使用作者的产品官网域名作为你的资料库域名。

## 本地完整运行

复制配置模板后即可使用其中的占位数据库 ID 进行本地模拟，不需要连接生产数据库：

```sh
npm run db:local
node scripts/provision-account.mjs --local --username admin
npx wrangler d1 execute folio --local --file .secrets/local-account.sql
npm run build
npm run preview:cloud -- --local
```

打开 `http://localhost:5173`，账号密码在 `.secrets/local-登录信息.txt`。界面与 API 必须同源；普通 Vite 静态预览不提供登录服务。本地数据库保存在 `.wrangler/`，与远程 D1 隔离。

## 升级与备份

升级前从应用中导出备份，再执行 `git pull`、`npm ci`、`npm run db:remote`、`npm run deploy`。保留原 D1 绑定，不要创建替代数据库或重置账号。更换域名不需要重建数据库，但需要重新登录。

Cloudflare 的额度和计费以自己的控制台为准。本仓库没有连接作者的数据库、API 密钥或个人账号。

## 部署静态产品页

`site/public/` 可部署到任意静态托管服务。Cloudflare 用户可修改 `site/wrangler.jsonc` 中的 Worker 名称和域名后执行 `npm run site:deploy`。产品页独立于信息册，不绑定 D1，也没有登录或用户数据接口。
