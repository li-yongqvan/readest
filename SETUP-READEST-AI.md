# readest-ai 体验版搭建指南

> 这是 [Readest](https://github.com/readest/readest) 的 fork，新增"选中即讲解"功能：
> 在书里拖选词句，侧栏自动调用 DeepSeek 给出结构化讲解（释义/翻译 + 上下文讲解），
> 支持"扩大上下文重讲"。本指南帮你在自己电脑上跑起来。
>
> 许可证：AGPL-3.0（与上游一致）。项目地图与决策记录见
> [li-yongqvan/readest-ai](https://github.com/li-yongqvan/readest-ai)。

## 你需要准备

- **Git**、**Node.js ≥ 20**、**pnpm**（`npm i -g pnpm`，仓库锁定 pnpm 11.1.1，版本不符时 Corepack 会自动处理）
- **自己的电子书**：一本 EPUB 或 PDF（导入用，仓库不带书）
- **自己的 DeepSeek API key**：到 [platform.deepseek.com](https://platform.deepseek.com) 注册充值（按 token 计费，读书查词用量极小，几元够用）
- 不需要 Rust 工具链（只有打包桌面版才需要，本指南走 web 开发版）

## 搭建（约 5–10 分钟）

```bash
# 1. 克隆（--recurse-submodules 必加，缺了子模块编译会 500）
git clone --recurse-submodules https://github.com/li-yongqvan/readest.git
cd readest

# 如果克隆时忘了 --recurse-submodules，补一句：
# git submodule update --init

# 2. 安装依赖
pnpm install

# 3. 拷贝 pdfjs 运行资源（不做这步导入 PDF 会报 "Failed to fetch … pdf.worker.min.mjs"）
cd apps/readest-app
pnpm setup-vendors

# 4. 启动开发版
pnpm dev-web
```

打开 **http://localhost:3000**，把自备的 EPUB/PDF 拖进书库导入。

## 配置 AI（一次性）

1. 随便打开一本书，点**右上角 ≡（View Options）→ 最底部 Settings（齿轮）**
2. 左侧选 **AI** 面板
3. 依次设置：
   - **Enable AI**：打开
   - **Provider**：选 **OpenAI Compatible**
   - **API Key**：粘贴你的 `sk-...`（只存在你本机，不上传、不同步）
   - **Base URL**：`https://api.deepseek.com`
   - **Model**：`deepseek-flash`（当前官方 ID；也可点刷新按钮从 `/models` 列表选）
4. 点 **Test Connection** 确认连通，关掉对话框

## 使用

- **拖选词句** → 右侧栏自动弹出"讲解（✨）"tab，几秒出结果
- 选区 ≤3 个英文单词（或 ≤6 个汉字）按词条讲；更长按整句讲（附中文翻译）
- 讲得不够满意 → 点卡片下方**"扩大上下文重讲"**，每点一次语境升一级（段落 → 前后段 → 整节），两级封顶
- 断网 / key 填错会给出区分的错误提示；跨页选区暂不支持（会提示单页内重选）

## 常见问题

| 现象 | 原因与解决 |
|---|---|
| 启动后页面 500 / 报模块解析错误 | 子模块没拉全：`git submodule update --init` 后重启 |
| 导入 PDF 报 `Failed to fetch … pdf.worker.min.mjs` | 没跑 `pnpm setup-vendors` |
| 3000 端口被占 | `pnpm dev-web -- -p 3001` 换端口 |
| 拖选后侧栏提示"请先启用 AI 并配置…" | AI 面板的 **Enable AI** 总开关没开，或 provider 没选 OpenAI Compatible |
| 报错"API key 无效" | key 填错或余额不足，到 platform.deepseek.com 检查 |
| 报错"网络异常" | 检查网络；公司代理需自行放行 `api.deepseek.com` |

## 反馈

遇到问题直接联系项目作者，或到 [li-yongqvan/readest-ai](https://github.com/li-yongqvan/readest-ai) 提 issue。
