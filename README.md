# 诗泉 · 背诗

基于「[诗泉 API](https://poetry.palemoky.com/)」的手机端古诗词背诵练习 H5 应用（移动优先）。

本仓库是 **核心闭环 MVP**：`今日一诗 → 通读 → 挖空默写 → 结果与错句 → 次日复习`。

## 功能范围（MVP）

- **首页**：今日一诗、简体/繁体切换、开始背诵、收藏、换一首、今日任务进度、待复习列表
- **练习**：挖空默写（启蒙 / 标准 / 挑战三档难度）、开始今日练习
- **答题**：逐句挖空、候选字选择、提交判定、连对提示
- **结果**：正确率环、答对/用时/连对/涉及诗作、错句回顾
- **收藏**：收藏夹、错句本、待复习（1/3/7/15/30 天记忆曲线，全本地计算）
- **我的**：学习数据、打卡日历、API 服务状态、繁体模式开关、导出学习记录

## 运行方式

### 方式一：本地静态服务（推荐，无跨域问题）

需要 [Node.js](https://nodejs.org/)（≥18）：

```bash
node server.mjs
```

然后浏览器打开 <http://localhost:5173>。

`server.mjs` 会把 `/api/**` 与 `/health` 反向代理到 `https://poetry.palemoky.com`，前端直连本站接口，无需处理跨域。

### 方式二：直接打开文件

直接双击 `index.html` 也能打开界面；此时前端无法直连 API，会自动走 CORS 代理回退（`allorigins.win`），
若代理不可用会进入离线模式，只读本地已收藏/已缓存内容。

## 在手机上安装运行（PWA）

本应用是 H5/PWA，「安装」= 在手机浏览器里「添加到主屏幕」，装完像 App 一样全屏独立运行。

### 步骤 A：让手机访问到应用

**同一 WiFi（最快，适合本机测试）**

1. 电脑上启动：`node server.mjs`
2. 查电脑局域网 IP：`ipconfig` → 找到「IPv4 地址」（形如 `192.168.1.100`）
3. 手机连**同一个 WiFi**，浏览器打开 `http://<电脑IP>:5173`

> `server.mjs` 已监听所有网卡（0.0.0.0），局域网可直接访问；API 由服务器代理，无跨域问题。
> 若手机打不开，检查 Windows 防火墙是否放行了 5173 端口。

**部署到公网（永久、任何网络都能访问）**

推荐用 Vercel（自带 `/api` 反向代理，无跨域），见下文「部署到 Vercel」一节。

### 步骤 B：添加到主屏幕

- **Android（Chrome / Edge）**：打开页面 → 右上角菜单 `⋮` → 「添加到主屏幕 / 安装应用」
- **iPhone（Safari）**：打开页面 → 底部「分享」按钮 → 「添加到主屏幕」

### 步骤 C：生成 PNG 图标（可选，让主屏幕图标更好看）

Chrome 的「安装应用」提示与 iOS 主屏幕图标，优先使用 PNG（192 / 512）。运行：

```bash
python generate_icons.py
```

会生成 `assets/icon-192.png` 与 `assets/icon-512.png`（需 Pillow：`pip install Pillow`）。

> 注：`localhost` 或 HTTPS 下才会启用 Service Worker（离线缓存 + 安装提示）；局域网 `http://IP` 因非安全上下文，SW 不生效，但「添加到主屏幕」仍可用。

## 部署到 Vercel

本仓库已包含 `vercel.json`，配置了反向代理：`/api/**` 与 `/health` 由 Vercel 转发到 `https://poetry.palemoky.com`。
前端请求走同源 `/api`，因此**没有跨域问题**，也不需要自建后端。

### 方式一：网页端导入（最简单）

1. 打开 <https://vercel.com>，用 GitHub 账号登录
2. 点 **Add New… → Project**
3. 在「Import Git Repository」里选中 `yongshen/poetry`，点 **Import**
4. 配置页几乎不用改：
   - Framework Preset 选 **Other**（纯静态站）
   - Build Command 留空
   - Output Directory 留空（默认根目录）
5. 点 **Deploy**，几十秒后得到地址 `https://poetry-xxxx.vercel.app`

之后每次 `git push` 到 GitHub，Vercel 会自动重新部署。

### 方式二：Vercel CLI

```bash
npm i -g vercel
vercel login
vercel          # 首次：选择项目、确认配置
vercel --prod   # 发布到生产环境
```

### 部署后验证

- 打开 `https://你的域名.vercel.app/`，首页应正常显示「今日一诗」
- 打开 `https://你的域名.vercel.app/api/stats`，应返回诗泉的统计数据（证明代理生效）
- 手机浏览器打开同一地址 → 「添加到主屏幕」即可安装为 App

> 说明：`server.mjs` 是本地开发用的，Vercel 上不会运行它，代理由 `vercel.json` 的 rewrites 承担。

## 数据来源

- 诗泉 API：<https://poetry.palemoky.com/>（7 个接口 + `lang` 全局参数）
- 语料源自开源项目 [chinese-poetry](https://github.com/chinese-poetry/chinese-poetry)

## 已知接口约束（开发时已规避）

1. **无诗词详情接口**：详情页数据由列表 / 随机结果透传，不能按 id 分享链接。
2. **无作者作品集接口**：诗人页只能随机抽代表作。
3. **无译文 / 注释 / 拼音 / 音频**：产品定位为「背诗训练器」而非「读诗理解」。
4. **`dynasty` 字段疑似有误**：抽样中宋代诗人（朱熹、文天祥、梅尧臣等）的诗词均被标为「唐」。
   本 MVP 已规避：卡片默认展示「体裁格律」而非朝代。
5. **`authors` 按 id 升序返回**：前 20 位是冷门诗人，MVP 未做诗人名录页，后续接入时需预置名家榜单。
6. **无用户体系**：收藏、错句本、打卡、复习进度全部存设备本地（`localStorage`），换设备不同步。
