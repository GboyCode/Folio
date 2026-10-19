# Windows 离线版

下载地址：https://github.com/GboyCode/Folio/releases/latest

支持 Windows 10/11 x64。Tauri 使用系统 WebView2；缺失时安装器需要联网安装运行时，安装完成后日常资料管理不需要联网。

## 使用与数据

- 可以选择程序安装盘符；数据目录可在「数据隐私」中另行选择。
- 初次运行建立空资料库，不需要在线账号。
- 默认资料位于 `%LOCALAPPDATA%\me.ryanlin.folio\data`，也可选择自己的文件夹。
- `folio.wallet.json` 保存卡包或加密信封。选目录时不会静默覆盖已有卡包。
- `%APPDATA%\me.ryanlin.folio` 保存数据目录指针、显示名称、头像和关闭行为等应用偏好；偏好不是加密卡包的一部分。
- 可设置关闭时退出或最小化到系统托盘，以及开机自启动。
- 应用更新保留数据目录与个人偏好。请定期导出备份。
- 与网页端通过 JSON 导入/导出迁移，不自动同步。
- 加密默认未启用。开启后需输入密码解锁，丢失密码无法恢复。

## 从源码构建

安装 Node.js 22.18+、Rust stable（MSVC 工具链，至少 1.90）、Visual Studio Build Tools 的「使用 C++ 的桌面开发」（含 Windows SDK）和 WebView2。开发依赖体积与最终安装包体积不同。

```powershell
npm ci
npm run desktop:dev
```

构建安装包：

```powershell
npm run desktop:test
npm run desktop:build
```

输出：`src-tauri/target/release/bundle/nsis/Folio_<版本>_x64-setup.exe`。

`desktop:build` 自动生成安装器模板、图标及 x86 绘图 DLL，并执行前端和 Rust 构建。仅支持在 Windows 上构建当前定制 NSIS 安装器。原生安装器实现与 Tauri 来源说明见 `src-tauri/installer/README.md`。

发行包不包含运行时卡包、头像、历史备份、开发缓存或作者的资料目录。当前发行包没有代码签名；可核对 Release 中的 `SHA256SUMS.txt`。检查更新入口尚未连接更新服务，更新请使用 GitHub Releases。
