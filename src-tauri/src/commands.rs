/****************************************************************************
 *  commands.rs - Tauri 命令实现
 *
 *  @brief  实现视频信息获取和下载的核心逻辑
 *  @note   使用 tokio 异步运行时，支持 yt-dlp 后台调用
 *****************************************************************************/

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::process::Stdio;
use tauri::command;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/***************************************************************************
 * 数据结构定义
 ***************************************************************************/

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoInfo {
    pub id: String,
    pub title: String,
    pub duration: f64,              // 视频时长（秒）
    pub thumbnail: String,          // 缩略图URL
    pub formats: Vec<VideoFormat>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoFormat {
    pub format_id: String,
    pub height: Option<i64>,        // 分辨率高度
    pub width: Option<i64>,         // 分辨率宽度
    pub ext: String,                // 文件扩展名
    pub filesize: Option<i64>,      // 文件大小（字节）
    pub vcodec: Option<String>,     // 视频编码
    pub acodec: Option<String>,     // 音频编码
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadConfig {
    pub url: String,
    pub args: Vec<String>,          // yt-dlp 命令行参数
}

/***************************************************************************
 * 公共函数 - 获取 yt-dlp 可执行文件路径
 ***************************************************************************/

fn get_ytdlp_path() -> Result<PathBuf, String> {
    let ytdlp_names = if cfg!(target_os = "windows") {
        vec!["yt-dlp.exe", "yt-dlp_x86.exe", "yt-dlp.exe_x86.exe"]
    } else {
        vec!["yt-dlp", "yt-dlp_linux", "yt-dlp_macos"]
    };

    // 1. 尝试从 PATH 环境变量查找
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            for name in &ytdlp_names {
                let path = dir.join(name);
                if path.exists() && path.is_file() {
                    return Ok(path);
                }
            }
        }
    }

    // 2. 尝试 common 安装路径
    #[cfg(target_os = "macos")]
    {
        let homebrew_paths = vec![
            "/opt/homebrew/bin/yt-dlp",
            "/usr/local/bin/yt-dlp",
            "/opt/homebrew/bin/yt-dlp",
        ];
        for path in homebrew_paths {
            let path = PathBuf::from(path);
            if path.exists() {
                return Ok(path);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let linux_paths = vec![
            "/usr/bin/yt-dlp",
            "/usr/local/bin/yt-dlp",
            "/snap/bin/yt-dlp",
        ];
        for path in linux_paths {
            let path = PathBuf::from(path);
            if path.exists() {
                return Ok(path);
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let windows_paths = vec![
            "C:\\ProgramData\\chocolatey\\bin\\yt-dlp.exe",
            "C:\\Program Files\\yt-dlp\\yt-dlp.exe",
            "C:\\Program Files (x86)\\yt-dlp\\yt-dlp.exe",
        ];
        for path in windows_paths {
            let path = PathBuf::from(path);
            if path.exists() {
                return Ok(path);
            }
        }
    }

    // 3. 尝试 sidecar 模式（与可执行文件同目录）
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            for name in &ytdlp_names {
                let path = exe_dir.join(name);
                if path.exists() {
                    return Ok(path);
                }
                // 尝试 resources 目录
                let resources_path = exe_dir.join("../").join("Resources").join(name);
                if resources_path.exists() {
                    return Ok(resources_path);
                }
            }
        }
    }

    Err("未找到 yt-dlp 可执行文件。请确保 yt-dlp 已安装并在 PATH 中。".to_string())
}

/***************************************************************************
 * 格式化 yt-dlp 错误信息
 *
 * @param stderr - yt-dlp 标准错误输出
 * @return String - 格式化后的错误信息，包含解决建议
 ***************************************************************************/

fn format_ytdlp_error(stderr: &str) -> String {
    let base_error = format!("yt-dlp 执行失败: {}", stderr);

    // 检测特定错误类型并提供解决方案
    if stderr.contains("Sign in to confirm you're not a bot") {
        format!(
            "{}\n\n🔧 解决方案:\n\
            1. 确保您的 Chrome 浏览器已登录 YouTube\n\
            2. 尝试使用不同的视频链接\n\
            3. 在高级设置中调整反检测选项\n\
            4. 如果问题持续，请等待一段时间后重试",
            base_error
        )
    } else if stderr.contains("429") || stderr.contains("Too Many Requests") {
        format!(
            "{}\n\n🔧 解决方案:\n\
            1. 在高级设置中增加请求间隔时间\n\
            2. 等待几分钟后重试\n\
            3. 尝试使用代理连接",
            base_error
        )
    } else if stderr.contains("cookies") || stderr.contains("login") {
        format!(
            "{}\n\n🔧 解决方案:\n\
            1. 确保浏览器中已登录相应账号\n\
            2. 检查浏览器 Cookie 权限\n\
            3. 尝试手动导出 Cookie 文件",
            base_error
        )
    } else if stderr.contains("Impersonate target") && stderr.contains("not available") {
        format!(
            "{}\n\n🔧 解决方案:\n\
            1. 请运行: /opt/homebrew/bin/python3.10 -m pip install curl_cffi\n\
            2. 或重新安装: /opt/homebrew/bin/python3.10 -m pip install --upgrade 'yt-dlp[curl-cffi]'\n\
            3. 详细说明请参考项目文档",
            base_error
        )
    } else if stderr.contains("ERROR: [youtube]") {
        format!(
            "{}\n\n🔧 解决方案:\n\
            1. 检查视频链接是否正确\n\
            2. 尝试刷新网页获取最新链接\n\
            3. 视频可能受地区限制或已被删除",
            base_error
        )
    } else {
        base_error
    }
}

/***************************************************************************
 * Tauri 命令 - 获取视频信息
 *
 * @param url - 视频URL（支持YouTube、Bilibili等yt-dlp支持的网站）
 * @return VideoInfo - 包含标题、时长、缩略图、可用格式等信息
 ***************************************************************************/

#[command]
pub async fn get_video_info(url: String) -> Result<VideoInfo, String> {
    println!("开始获取视频信息: {}", url);

    let ytdlp_path = get_ytdlp_path()?;
    println!("使用 yt-dlp 路径: {:?}", ytdlp_path);

    // 构建命令: yt-dlp --dump-json <url> (添加反检测参数)
    let output = Command::new(&ytdlp_path)
        .args(&[
            "--dump-json",
            "--no-warnings",
            "--flat-playlist",
            "--impersonate",
            "chrome",
            "--user-agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "--cookies-from-browser",
            "chrome",
            &url
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("无法执行 yt-dlp: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format_ytdlp_error(&stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = stdout.lines().collect();

    if lines.is_empty() {
        return Err("无法获取视频信息: 无响应数据".to_string());
    }

    // 尝试解析JSON，如果是播放列表，取第一条
    for line in lines {
        if let Ok(json) = serde_json::from_str::<Value>(line) {
            return parse_video_info(json);
        }
    }

    Err("无法解析视频信息".to_string())
}

/***************************************************************************
 * 解析视频信息JSON
 ***************************************************************************/

fn parse_video_info(json: Value) -> Result<VideoInfo, String> {
    println!("解析视频信息: {}", json["title"].as_str().unwrap_or("未知"));

    let id = json["id"]
        .as_str()
        .unwrap_or("unknown")
        .to_string();

    let title = json["title"]
        .as_str()
        .unwrap_or("无标题")
        .to_string();

    let duration = json["duration"].as_f64().unwrap_or(0.0);

    let thumbnail = json["thumbnail"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let formats = parse_formats(&json);

    Ok(VideoInfo {
        id,
        title,
        duration,
        thumbnail,
        formats,
    })
}

fn parse_formats(json: &Value) -> Vec<VideoFormat> {
    let mut formats = Vec::new();

    if let Some(format_array) = json["formats"].as_array() {
        for format in format_array {
            let format_id = format["format_id"]
                .as_str()
                .unwrap_or("unknown")
                .to_string();

            let height = format["height"].as_i64();
            let width = format["width"].as_i64();
            let ext = format["ext"]
                .as_str()
                .unwrap_or("unknown")
                .to_string();
            let filesize = format["filesize"].as_i64();
            let vcodec = format["vcodec"]
                .as_str()
                .map(|s| s.to_string());
            let acodec = format["acodec"]
                .as_str()
                .map(|s| s.to_string());

            formats.push(VideoFormat {
                format_id,
                height,
                width,
                ext,
                filesize,
                vcodec,
                acodec,
            });
        }
    } else if let Some(format) = json["format"].as_object() {
        // 单个格式的情况
        let format_id = format["format_id"]
            .as_str()
            .unwrap_or("unknown")
            .to_string();
        let ext = format["ext"]
            .as_str()
            .unwrap_or("unknown")
            .to_string();

        formats.push(VideoFormat {
            format_id,
            height: None,
            width: None,
            ext,
            filesize: format["filesize"].as_i64(),
            vcodec: None,
            acodec: None,
        });
    }

    formats
}

/***************************************************************************
 * Tauri 命令 - 下载视频
 *
 * @param url - 视频URL
 * @param args - yt-dlp 命令行参数
 * @return Result<(), String> - 成功或错误消息
 ***************************************************************************/

#[command]
pub async fn download_video(url: String, args: Vec<String>) -> Result<(), String> {
    println!("开始下载视频: {}", url);
    println!("参数: {:?}", args);

    let ytdlp_path = get_ytdlp_path()?;
    println!("使用 yt-dlp 路径: {:?}", ytdlp_path);

    // 创建子进程
    let mut child = Command::new(&ytdlp_path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("无法启动下载进程: {}", e))?;

    let stdout = child.stdout.take().ok_or("无法捕获标准输出")?;
    let stderr = child.stderr.take().ok_or("无法捕获标准错误")?;

    let reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    // 异步读取标准输出（yt-dlp 进度信息）
    // 注意：暂时注释掉事件发送，因为需要 AppHandle 引用
    // 将来可以通过参数传递 AppHandle 来实现实时进度
    tokio::spawn(async move {
        let mut lines = reader;
        while let Ok(Some(line)) = lines.next_line().await {
            if !line.trim().is_empty() {
                println!("[yt-dlp] {}", line);

                // 解析进度信息（暂时不发送事件）
                // if let Some(progress) = parse_progress_line(&line) {
                //     // 需要 AppHandle 来发送事件
                // }
            }
        }
    });

    // 异步读取标准错误
    tokio::spawn(async move {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            if !line.trim().is_empty() {
                eprintln!("[yt-dlp-err] {}", line);
            }
        }
    });

    // 等待进程结束
    let status = child
        .wait()
        .await
        .map_err(|e| format!("等待下载进程失败: {}", e))?;

    if status.success() {
        println!("下载完成");
        Ok(())
    } else {
        Err("下载失败: 进程返回非零退出码".to_string())
    }
}

/***************************************************************************
 * 解析 yt-dlp 进度输出
 *
 * 格式示例:
 * [download]  42.0% of 125.89MiB at  5.82MiB/s ETA 00:12
 *
 * @param line - yt-dlp 输出的一行文本
 * @return Option<serde_json::Value> - 解析后的进度信息（如果行包含进度）
 ***************************************************************************/

fn parse_progress_line(line: &str) -> Option<serde_json::Value> {
    if !line.contains("[download]") || !line.contains("%") {
        return None;
    }

    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 6 {
        return None;
    }

    // 查找百分比（包含%的字段）
    let percent_part = parts.iter().find(|p| p.contains('%'))?;
    let percent = percent_part.trim_end_matches('%').parse::<f64>().ok()?;

    // 查找速度（包含 MiB/s 或 KiB/s 的字段）
    let mut speed = "".to_string();
    for (i, part) in parts.iter().enumerate() {
        if *part == "at" && i + 1 < parts.len() {
            speed = parts[i + 1].to_string();
            if i + 2 < parts.len() {
                speed.push_str(" ");
                speed.push_str(parts[i + 2]);
            }
            break;
        }
    }

    // 查找 ETA
    let mut eta = "".to_string();
    for (i, part) in parts.iter().enumerate() {
        if *part == "ETA" && i + 1 < parts.len() {
            eta = parts[i + 1].to_string();
            break;
        }
    }

    Some(serde_json::json!({
        "percent": percent,
        "speed": speed,
        "eta": eta,
    }))
}
