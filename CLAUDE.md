# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

YouTuDown 是一个基于 Tauri + React 的 4K YouTube 视频下载器，支持自定义时间段下载功能。项目采用前后端分离架构：

- **前端**: React + TypeScript + Vite，提供原生 macOS 风格界面
- **后端**: Rust + Tauri 2.0，负责系统调用和 yt-dlp 集成
- **核心**: 基于 yt-dlp 的 `--download-sections` 实现时间段下载

## 开发命令

```bash
# 开发模式
npm run dev              # 启动 Vite 开发服务器 (端口 1420)
npm run tauri dev        # 启动 Tauri 应用

# 构建生产版本
npm run build            # 构建前端
npm run tauri build      # 构建完整应用 (.dmg 安装包)

# Rust 代码检查
~/.cargo/bin/cargo check  # 检查 Rust 代码语法和依赖

# 运行单个测试
~/.cargo/bin/cargo test <test_name>  # 运行指定测试
```

## 代码架构

### 前端结构 (src/)
- `App.tsx`: 主组件，包含视频信息获取、时间段选择、下载配置
- `App.css`: macOS 原生风格样式，毛玻璃效果 + 圆角设计
- `main.tsx`: React 入口点

### 后端结构 (src-tauri/)
- `src/main.rs`: Tauri 应用入口，注册命令处理
- `src/commands.rs`: 核心命令实现
  - `get_video_info()`: 异步获取视频信息（标题、时长、格式）
  - `download_video()`: 异步执行 yt-dlp 下载
  - `get_ytdlp_path()`: 多路径查找 yt-dlp 可执行文件

### 前后端通信
通过 Tauri Commands 实现：
```rust
// 后端命令定义
#[command]
pub async fn get_video_info(url: String) -> Result<VideoInfo, String>

#[command]
pub async fn download_video(url: String, args: Vec<String>) -> Result<(), String>
```

```typescript
// 前端调用
const info = await invoke('get_video_info', { url })
await invoke('download_video', { url, args })
```

## 核心功能实现

### 时间段下载算法
前端时间解析 (`src/App.tsx`):
```typescript
// 00:01:30 → 90 秒
const parts = timeStr.split(':');
if (parts.length === 3) {
  seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
}
```

yt-dlp 参数生成:
```typescript
// 构建时间段参数
args.push('--download-sections', `*${start}-${end}`);
```

### 质量选择映射
```typescript
if (quality === '4k') {
  args.push('-f', 'bestvideo[height<=2160]+bestaudio/best');
} else if (quality === '1080p') {
  args.push('-f', 'bestvideo[height<=1080]+bestaudio/best');
}
```

### yt-dlp 路径查找策略
`src-tauri/src/commands.rs` 实现多层级查找：
1. PATH 环境变量
2. Homebrew 路径 (`/opt/homebrew/bin/yt-dlp`)
3. 系统目录 (`/usr/bin/yt-dlp`, `/usr/local/bin/yt-dlp`)
4. Sidecar 模式（与可执行文件同目录）

## 重要数据结构

```rust
// 视频信息结构
pub struct VideoInfo {
    pub id: String,
    pub title: String,
    pub duration: f64,              // 秒
    pub thumbnail: String,
    pub formats: Vec<VideoFormat>,
}

pub struct VideoFormat {
    pub format_id: String,
    pub height: Option<i64>,
    pub width: Option<i64>,
    pub ext: String,
    pub filesize: Option<i64>,
}
```

## 配置要点

### Tauri 配置 (`src-tauri/tauri.conf.json`)
- 开发端口：1420
- 窗口大小：900x700
- 最小系统版本：macOS 10.15

### 依赖版本
- Tauri: 2.0.x
- React: 18.3.x
- Rust: 2021 edition
- Tokio: 异步运行时

## 常见开发任务

### 添加新 Tauri 命令
1. 在 `src-tauri/src/commands.rs` 添加函数
2. 在 `src-tauri/src/main.rs` 注册到 invoke_handler
3. 在 `src/App.tsx` 添加 TypeScript 类型定义
4. 使用 `invoke()` 调用新命令

### 修改时间段下载逻辑
- 前端时间解析：`src/App.tsx` formatTime 函数
- 参数生成：buildCommandArgs 函数
- 后端执行：`src-tauri/src/commands.rs` download_video

### 调试 yt-dlp 问题
1. 检查 `get_ytdlp_path()` 返回路径
2. 验证 yt-dlp 安装：`which yt-dlp`
3. 手动测试命令：`yt-dlp --dump-json <url>`

## 注意事项

1. **Tauri v2 配置兼容性**：当前使用最小化配置避免字段不兼容
2. **事件系统**：进度事件发送已注释，需要 AppHandle 引用
3. **图标配置**：暂时移除，需要创建图标文件
4. **权限配置**：capabilities 已简化，需要单独配置文件

## 项目状态

- ✅ 基础框架完成
- ✅ 核心时间段下载功能实现
- ✅ 前后端通信建立
- ⚠️  Tauri 配置需要完善（图标、权限）
- ⚠️  实时进度事件需要 AppHandle 支持