# YouTuDown

> 4K YouTube 视频下载器 - 支持自定义时间段下载

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2.0-blue" alt="Tauri">
  <img src="https://img.shields.io/badge/React-18.3-orange" alt="React">
  <img src="https://img.shields.io/badge/Rust-2021-red" alt="Rust">
  <img src="https://img.shields.io/badge/macOS-10.15+-silver" alt="macOS">
</p>

## 功能特性

✨ **核心功能**
- ✅ 支持 4K、1080p、720p 等多种分辨率下载
- ✅ **自定义时间段下载** - 只下载视频的指定片段
- ✅ 基于 yt-dlp，支持 1000+ 视频网站（YouTube、Bilibili、Twitter等）
- ✅ 原生 macOS 界面风格，符合 Apple 设计语言
- ✅ 实时下载进度显示（速度、剩余时间、完成百分比）
- ✅ 字幕下载支持（多语言可选）

🎯 **技术特点**
- 📦 **轻量级** - 基于 Tauri，相比 Electron 体积减少 90%+
- ⚡ **高性能** - Rust 后端，异步 I/O，充分利用系统性能
- 🔒 **安全可靠** - macOS 沙箱机制，最小化权限申请
- 🎨 **原生体验** - 毛玻璃效果、圆角设计、原生控件

## 快速开始

### 前置依赖

- **Node.js** (v18 或更高)
  ```bash
  brew install node
  ```

- **Rust** (stable channel)
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

- **yt-dlp**
  ```bash
  brew install yt-dlp
  ```

### 安装步骤

1. **克隆仓库**
   ```bash
   cd youtudown
   ```

2. **安装前端依赖**
   ```bash
   npm install
   ```

3. **运行开发模式**
   ```bash
   npm run tauri dev
   ```

4. **构建生产版本**
   ```bash
   npm run tauri build
   ```

## 使用指南

### 基本下载流程

1. **粘贴视频URL** - 支持 YouTube、Bilibili、Twitter 等
   ```
   https://www.youtube.com/watch?v=示例ID
   ```

2. **获取视频信息** - 点击"获取信息"按钮，自动解析标题、时长、缩略图

3. **配置下载选项**
   - **时间段**（可选）：输入开始时间和结束时间，只下载指定片段
   - **质量选择**：4K、1080p、720p 或自动最佳
   - **字幕**：勾选并指定语言代码（如 `en,zh-CN`）
   - **下载目录**：选择保存位置

4. **开始下载** - 实时查看进度、速度、剩余时间

### 高级功能

#### 时间段下载（核心功能）

YouTuDown 支持使用 yt-dlp 原生的 `--download-sections` 功能：

- **格式**：输入时间格式 `HH:MM:SS` 或 `MM:SS` 或 `秒数`
- **示例**：
  - 下载 1:30 - 3:45 的片段
  - 输入：`00:01:30` → `00:03:45`
- **技术实现**：内嵌在 Rust 后端的 `commands.rs` 中

#### 质量选择算法

```rust
// 质量选择映射
if quality == "4k" {
    args.push("-f", "bestvideo[height<=2160]+bestaudio/best");
} else if quality == "1080p" {
    args.push("-f", "bestvideo[height<=1080]+bestaudio/best");
}
```

## 技术架构

### 项目结构

```
youtudown/
├── src/                          # 前端代码（React + TypeScript）
│   ├── App.tsx                   # 主组件
│   ├── App.css                   # 原生 macOS 样式
│   └── main.tsx                  # 入口文件
├── src-tauri/                    # 后端代码（Rust）
│   ├── src/
│   │   ├── main.rs               # Tauri 应用入口
│   │   └── commands.rs           # 核心命令实现
│   ├── Cargo.toml                # Rust 依赖
│   └── tauri.conf.json           # Tauri 配置
└── package.json                  # npm 依赖
```

### 核心模块

#### 1. 视频信息获取（Rust）

文件：`src-tauri/src/commands.rs`

```rust
#[command]
pub async fn get_video_info(url: String) -> Result<VideoInfo, String> {
    // 调用 yt-dlp --dump-json
    // 解析返回的 JSON 数据
    // 提取：标题、时长、缩略图、可用格式
}
```

#### 2. 下载执行引擎（Rust）

文件：`src-tauri/src/commands.rs`

```rust
#[command]
pub async fn download_video(url: String, args: Vec<String>) -> Result<(), String> {
    // 使用 tokio::process::Command 异步执行 yt-dlp
    // 实时捕获标准输出，解析进度
    // 通过 Tauri Events 推送到前端
}
```

#### 3. 时间段参数生成（TypeScript）

文件：`src/App.tsx`

```typescript
// 时间段选择映射到 yt-dlp 参数
if (startTime || endTime) {
    const start = formatTime(startTime);
    const end = formatTime(endTime);
    args.push('--download-sections', `*${start}-${end}`);
}
```

### 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| **前端** | React 18.3 + TypeScript | UI 构建与状态管理 |
| **样式** | CSS3 + macOS 原生设计 | 原生风格界面 |
| **后端** | Rust 1.70+ | 系统调用、进程管理 |
| **框架** | Tauri 2.0 | 跨平台桌面应用框架 |
| **视频下载** | yt-dlp | 核心下载引擎 |
| **异步** | Tokio | 异步 I/O 和进程管理 |

## 设计亮点

### 1. 原生 macOS 美学

```css
/* App.css */
.header {
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(16px);  /* 毛玻璃效果 */
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.section {
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;  /* 柔和圆角 */
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05),
              0 8px 24px rgba(0, 0, 0, 0.08);
}
```

### 2. 异步性能优化

使用 Rust 的 `tokio` 运行时实现：
- 异步进程执行（非阻塞）
- 实时输出流捕获
- 高效的事件驱动架构

### 3. 错误处理与恢复

```rust
// 多重 yt-dlp 查找策略
fn get_ytdlp_path() -> Result<PathBuf, String> {
    // 1. PATH 环境变量
    // 2. 常见安装路径（Homebrew、系统目录）
    // 3. Sidecar 模式（与可执行文件同目录）
}
```

## 构建与部署

### 开发模式

```bash
# 启动 Vite 开发服务器（端口 1420）
npm run dev

# 启动 Tauri 应用
npm run tauri dev
```

### 生产构建

```bash
# 构建前端
npm run build

# 构建 Tauri 应用（macOS .dmg）
npm run tauri build

# 输出位置
# src-tauri/target/release/bundle/dmg/
```

### 代码质量

- ✅ TypeScript 严格模式
- ✅ ESLint + Prettier
- ✅ Rust clippy（推荐）
- ✅ 遵循 Tauri 安全最佳实践

## 已知问题与解决方案

### 1. macOS 权限问题

**问题**：无法写入下载目录

**解决**：
- 应用首次启动时请求用户选择目录
- 使用 `tauri-plugin-dialog` 的 `open()` API

### 2. yt-dlp 未找到

**问题**：`未找到 yt-dlp 可执行文件`

**解决**：
```bash
# 安装 yt-dlp
brew install yt-dlp

# 验证
which yt-dlp
```

### 3. 视频无法下载

**问题**：某些视频提示不可用

**原因**：
- 地区限制
- 需要登录（会员内容）
- 版权保护

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发环境设置

1. Fork 仓库
2. 创建特性分支
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. 提交更改
   ```bash
   git commit -m 'Add: 新功能'
   ```
4. 推送分支
   ```bash
   git push origin feature/amazing-feature
   ```
5. 创建 Pull Request

### 代码规范

- Rust：使用 `cargo fmt` 和 `cargo clippy`
- TypeScript：使用项目配置的 ESLint 和 Prettier
- Commit 信息：遵循 Conventional Commits

## 许可证

MIT License

## 致谢

- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - 强大的视频下载工具
- [Tokio](https://tokio.rs/) - Rust 异步运行时

## 版本历史

### v0.1.0 (2025-01-12)
- ✨ 初始版本发布
- 支持 4K/1080p/720p 下载
- 时间段下载功能
- 原生 macOS UI
- 实时进度显示
- 字幕下载支持

---

<p align="center">
  🎬 用 Rust 和 Tauri 打造的极致 4K 下载体验
</p>
