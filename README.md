<p align="center"><img src="src/assets/folio-icon.svg" width="72" alt="Folio"></p>

<h1 align="center">Folio</h1>
<p align="center">你的全球信息册，留在自己手中。</p>
<p align="center"><a href="https://folio.toagi.cc">产品官网</a> · <a href="https://github.com/GboyCode/Folio/releases/latest">Windows 下载</a> · <a href="docs/SELF_HOSTING.md">网页自部署</a> · <a href="LICENSE">MIT License</a></p>

Folio 将银行卡、U 卡、SIM 卡和地址集中整理，提供真实卡面预览、国家与地区筛选、点阵地图与旋转地球。支持 **Cloudflare 自部署网页版**与 **Tauri Windows 离线客户端**。

首次使用从空资料库开始。仓库和安装包不包含作者的个人记录、登录凭据或备份。内置图鉴是公开产品参考素材，不是用户数据。

| | 网页版 | Windows 离线版 |
|---|---|---|
| 运行方式 | 自部署到自己的 Cloudflare Workers + D1 | 下载并安装，无需账号 |
| 数据位置 | 自己的 D1 数据库 | 自选本地文件夹 |
| 多设备 | 登录自己的站点访问，或手动 WebDAV 同步 | 手动 WebDAV 同步、导入与导出备份 |
| 加密 | 可选客户端 AES-256-GCM 加密 | 可选本机 AES-256-GCM 加密 |
| 桌面能力 | 浏览器使用 | 托盘、关闭行为、开机自启动 |

**两版不会自动同步数据。** 可通过 WebDAV 手动上传、拉取，或通过 JSON 备份迁移，支持普通与加密备份。WebDAV 自动使用 `Folio_Backup` 文件夹，两端日常编辑仍各自保存，详见 [WebDAV 使用说明](docs/WEBDAV.md)。加密需要主动开启；未开启时资料以明文形式存储，不能将“本地保存”等同于“已加密”。

## 功能

- 卡片、号码、地址的新增、搜索、收藏、编辑与分类管理。
- 卡面图鉴、自定义卡面、国旗 SIM 预览与各国街区航拍风格地址预览。
- 平铺点阵地图可拖动收拢为地球；旋转连线与地区信息卡片联动。
- JSON 备份预览、合并、替换；可选密码加密。
- WebDAV 自定义网盘备份与恢复，支持 HTTPS 下载重定向；密码仅保留在当前会话。
- 名称与头像设置；手机、平板和桌面布局。
- Windows 本地数据目录可迁移；安装位置和数据位置可分别选择。

地址预览是预设示意图，不是实际住址的卫星照片。地图按地区代表点展示，不读取设备定位。

## 使用

**Windows 用户：** 在 [Releases](https://github.com/GboyCode/Folio/releases/latest) 下载 `Folio_0.1.10_x64-setup.exe`。支持 Windows 10/11 x64，需要 WebView2（缺失时安装器会下载运行时）。安装后日常资料管理可离线使用，WebDAV 同步需要联网。当前安装包未进行代码签名；下载来源与 SHA-256 校验值见 Release。

**在线演示：** [直接体验 Folio](https://folio.toagi.cc/demo/)，无需注册。真实界面预置 12 个国家和地区的虚构资料，可探索平铺地图、旋转地球和地区卡片。修改只在当前页面中有效，刷新即可重置；演示版不连接账号 API 或数据库，请勿输入真实资料。

**网页版：** 按 [自部署指南](docs/SELF_HOSTING.md) 创建自己的 D1 数据库、初始化独立账号并部署。产品官网提供介绍、下载和独立演示，不收集或托管你的卡包。

**本地开发：** Node.js 22.18+，执行 `npm ci`。完整本地网页登录需要 Worker API，步骤见自部署指南；Windows 构建依赖见 [桌面版指南](docs/DESKTOP_WINDOWS.md)。

```sh
npm test
npm run test:account
npm run build
```

## 项目结构

```text
src/                    共用 React 界面、图鉴和加密逻辑
src/cloud.tsx           网页登录与云端保存适配
src/desktop.tsx         Tauri 本地保存适配
src/demo.tsx            虚构数据与仅内存生效的演示适配
src-tauri/              Rust 后端、托盘、安装器
worker/ + migrations/   Cloudflare API 与数据库结构
site/                   静态产品官网
wrangler.example.jsonc  不含个人账号或资源 ID 的部署模板
```

`VITE_DESKTOP=true` 选择桌面入口。网页构建写入 `dist/`，桌面构建写入 `dist-desktop/`，两者独立发布。源码中的原生功能只在桌面模式启用。

产品官网与演示单独构建：`npm run site:build` 输出 `dist-site/`，其中 `/demo/` 使用 Vite 的 `demo` 模式，复用正式应用界面，排除登录 API 和 Service Worker。`npm run site:dev` 本地预览，`npm run site:deploy` 构建后部署官网 Worker；不改动自部署应用的数据库或网页版发布。

## 隐私与安全

启用加密后，卡包内容在当前设备加密，解密密码不上传；忘记密码无法恢复加密内容。头像、显示名称和桌面偏好独立保存，不属于加密卡包。普通 JSON 导出可能包含明文资料，请妥善保管。详情见 [安全说明](SECURITY.md)。

检查更新目前是预留入口，尚不提供自动更新；请从 GitHub Releases 下载新版安装包。

## 开源与版权

原创代码采用 [MIT License](LICENSE)，**Copyright (c) 2026 RyanLin**。使用、修改和分发时请保留版权与许可声明。

第三方卡面、商标、地图数据及组件保留各自权利与许可，不因本项目开源而改用 MIT。具体说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
