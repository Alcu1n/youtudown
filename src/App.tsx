import React, { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import './App.css';

/**
 * 核心数据结构定义
 */
interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  formats: VideoFormat[];
}

interface VideoFormat {
  format_id: string;
  height?: number;
  width?: number;
  ext: string;
  filesize?: number;
}

interface DownloadConfig {
  url: string;
  quality: string;
  startTime?: number;
  endTime?: number;
  downloadSubtitles: boolean;
  subtitleLangs: string[];
  outputPath: string;
}

interface AdvancedConfig {
  impersonate: string;
  cookiesFromBrowser: string;
  sleepInterval: number;
  retries: number;
  userAgent: string;
}

/**
 * 主应用组件
 */
function App(): JSX.Element {
  const [url, setUrl] = useState<string>('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [quality, setQuality] = useState<string>('best');
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number | undefined>(undefined);
  const [downloadSubtitles, setDownloadSubtitles] = useState<boolean>(false);
  const [subtitleLangs, setSubtitleLangs] = useState<string>('en');
  const [outputPath, setOutputPath] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadSpeed, setDownloadSpeed] = useState<string>('');
  const [downloadEta, setDownloadEta] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 高级配置状态
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [advancedConfig, setAdvancedConfig] = useState<AdvancedConfig>({
    impersonate: 'chrome',
    cookiesFromBrowser: 'chrome',
    sleepInterval: 2,
    retries: 3,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  /**
   * 从 localStorage 加载/保存配置
   */
  const loadConfig = useCallback(() => {
    try {
      const saved = localStorage.getItem('youtudown-advanced-config');
      if (saved) {
        const config = JSON.parse(saved);
        setAdvancedConfig(prev => ({ ...prev, ...config }));
      }
    } catch (error) {
      console.warn('加载配置失败:', error);
    }
  }, []);

  const saveConfig = useCallback((config: AdvancedConfig) => {
    try {
      localStorage.setItem('youtudown-advanced-config', JSON.stringify(config));
    } catch (error) {
      console.warn('保存配置失败:', error);
    }
  }, []);

  /**
   * 应用预设配置
   */
  const applyPreset = useCallback((preset: 'conservative' | 'balanced' | 'aggressive') => {
    let newConfig: AdvancedConfig;

    switch (preset) {
      case 'conservative':
        newConfig = {
          impersonate: 'chrome',
          cookiesFromBrowser: 'chrome',
          sleepInterval: 5,
          retries: 5,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };
        break;
      case 'balanced':
        newConfig = {
          impersonate: 'chrome',
          cookiesFromBrowser: 'chrome',
          sleepInterval: 2,
          retries: 3,
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };
        break;
      case 'aggressive':
        newConfig = {
          impersonate: 'chrome-120',
          cookiesFromBrowser: 'chrome',
          sleepInterval: 1,
          retries: 2,
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };
        break;
    }

    setAdvancedConfig(newConfig);
    saveConfig(newConfig);
  }, [saveConfig]);

  // 初始化时加载配置
  React.useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  /**
   * 获取视频信息
   */
  const handleGetVideoInfo = useCallback(async () => {
    if (!url) {
      setErrorMsg('请输入视频URL');
      return;
    }

    setErrorMsg('');
    try {
      const info: VideoInfo = await invoke('get_video_info', { url });
      setVideoInfo(info);
      // 设置结束时间为视频时长
      setEndTime(info.duration);
    } catch (error) {
      setErrorMsg(`获取视频信息失败: ${error}`);
    }
  }, [url]);

  /**
   * 选择下载目录
   */
  const handleSelectOutputPath = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择下载目录',
      });
      if (selected && typeof selected === 'string') {
        setOutputPath(selected);
      }
    } catch (error) {
      setErrorMsg(`选择目录失败: ${error}`);
    }
  }, []);

  /**
   * 格式化时间显示
   */
  const formatTime = useCallback((seconds: number): string => {
    if (seconds === undefined || seconds === null) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }, []);

  /**
   * 格式化文件大小
   */
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }, []);

  /**
   * 构建 yt-dlp 命令参数
   */
  const buildCommandArgs = useCallback((): string[] => {
    const args: string[] = [];

    // 基本参数
    args.push('--no-warnings');
    args.push('--progress');

    // 高级反检测参数
    args.push('--impersonate', advancedConfig.impersonate);
    args.push('--user-agent', advancedConfig.userAgent);
    args.push('--cookies-from-browser', advancedConfig.cookiesFromBrowser);
    args.push('--sleep-interval', advancedConfig.sleepInterval.toString());
    args.push('--retries', advancedConfig.retries.toString());

    // 质量选择
    if (quality === '4k') {
      args.push('-f', 'bestvideo[height<=2160]+bestaudio/best');
    } else if (quality === '1080p') {
      args.push('-f', 'bestvideo[height<=1080]+bestaudio/best');
    } else if (quality === '720p') {
      args.push('-f', 'bestvideo[height<=720]+bestaudio/best');
    } else {
      // best
      args.push('-f', 'bestvideo+bestaudio/best');
    }

    // 时间段下载（核心功能）
    if (videoInfo && (startTime > 0 || (endTime && endTime < videoInfo.duration))) {
      const start = formatTime(startTime);
      const end = endTime ? formatTime(endTime) : formatTime(videoInfo.duration);
      args.push('--download-sections', `*${start}-${end}`);
      console.log(`下载时间段: ${start} - ${end}`);
    }

    // 字幕下载
    if (downloadSubtitles && subtitleLangs) {
      args.push('--write-subs');
      args.push('--sub-langs', subtitleLangs);
      args.push('--sub-format', 'srt');
    }

    // 输出路径
    if (outputPath) {
      args.push('-o', `${outputPath}/%(title)s.%(ext)s`);
    } else {
      args.push('-o', '%(title)s.%(ext)s');
    }

    // URL
    args.push(url);

    return args;
  }, [quality, videoInfo, startTime, endTime, downloadSubtitles, subtitleLangs, outputPath, url, formatTime, advancedConfig]);

  /**
   * 开始下载
   */
  const handleDownload = useCallback(async () => {
    if (!url) {
      setErrorMsg('请输入视频URL');
      return;
    }

    if (!outputPath) {
      setErrorMsg('请选择下载目录');
      return;
    }

    setErrorMsg('');
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const args = buildCommandArgs();
      console.log('yt-dlp 参数:', args);

      await invoke('download_video', {
        url,
        args,
      });

      setErrorMsg('下载完成！');
    } catch (error) {
      setErrorMsg(`下载失败: ${error}`);
    } finally {
      setIsDownloading(false);
    }
  }, [url, outputPath, buildCommandArgs]);

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">YouTuDown</h1>
        <p className="subtitle">4K YouTube视频下载器</p>
      </header>

      <main className="main">
        {/* URL 输入区域 */}
        <section className="section">
          <h2 className="section-title">视频URL</h2>
          <div className="input-group">
            <input
              type="text"
              className="input"
              placeholder="粘贴YouTube视频URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGetVideoInfo();
              }}
            />
            <button className="button button-primary" onClick={handleGetVideoInfo}>
              获取信息
            </button>
          </div>
        </section>

        {/* 错误信息 */}
        {errorMsg && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {errorMsg}
          </div>
        )}

        {/* 视频信息预览 */}
        {videoInfo && (
          <section className="section">
            <h2 className="section-title">视频信息</h2>
            <div className="video-preview">
              {videoInfo.thumbnail && (
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  className="thumbnail"
                />
              )}
              <div className="video-details">
                <h3 className="video-title">{videoInfo.title}</h3>
                <div className="video-meta">
                  <span className="meta-item">
                    <strong>时长:</strong> {formatTime(videoInfo.duration || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* 时间段选择 */}
            <div className="time-range-section">
              <h3 className="subsection-title">下载时间段（可选）</h3>
              <div className="time-range">
                <div className="time-input-group">
                  <label className="time-label">开始时间</label>
                  <input
                    type="text"
                    className="time-input"
                    value={formatTime(startTime || 0)}
                    onChange={(e) => {
                      // 解析时间字符串
                      const timeStr = e.target.value;
                      const parts = timeStr.split(':');
                      let seconds = 0;
                      if (parts.length === 3) {
                        seconds =
                          parseInt(parts[0]) * 3600 +
                          parseInt(parts[1]) * 60 +
                          parseInt(parts[2]);
                      } else if (parts.length === 2) {
                        seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                      } else {
                        seconds = parseInt(parts[0]);
                      }
                      setStartTime(seconds);
                    }}
                  />
                </div>
                <div className="time-input-group">
                  <label className="time-label">结束时间</label>
                  <input
                    type="text"
                    className="time-input"
                    value={formatTime(endTime || videoInfo.duration || 0)}
                    onChange={(e) => {
                      const timeStr = e.target.value;
                      const parts = timeStr.split(':');
                      let seconds = 0;
                      if (parts.length === 3) {
                        seconds =
                          parseInt(parts[0]) * 3600 +
                          parseInt(parts[1]) * 60 +
                          parseInt(parts[2]);
                      } else if (parts.length === 2) {
                        seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                      } else {
                        seconds = parseInt(parts[0]);
                      }
                      setEndTime(seconds);
                    }}
                  />
                </div>
              </div>
              <p className="time-hint">留空或设置为完整时长以下载完整视频</p>
            </div>

            {/* 质量选择 */}
            <div className="quality-section">
              <h3 className="subsection-title">质量选择</h3>
              <select
                className="select"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
              >
                <option value="best">自动（选择最佳）</option>
                <option value="4k">4K (2160p)</option>
                <option value="1080p">1080p 全高清</option>
                <option value="720p">720p 高清</option>
              </select>
            </div>

            {/* 字幕选项 */}
            <div className="subtitle-section">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={downloadSubtitles}
                  onChange={(e) => setDownloadSubtitles(e.target.checked)}
                />
                下载字幕
              </label>
              {downloadSubtitles && (
                <input
                  type="text"
                  className="input"
                  placeholder="语言代码（如: en,zh-CN）多语言用逗号分隔"
                  value={subtitleLangs}
                  onChange={(e) => setSubtitleLangs(e.target.value)}
                />
              )}
            </div>
          </section>
        )}

        {/* 高级配置 */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">高级配置</h2>
            <button
              className="button button-ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '收起 ▲' : '展开 ▼'}
            </button>
          </div>

          {showAdvanced && (
            <div className="advanced-config">
              {/* 预设配置 */}
              <div className="preset-section">
                <h3 className="subsection-title">快速预设</h3>
                <div className="preset-buttons">
                  <button
                    className="button button-secondary"
                    onClick={() => applyPreset('conservative')}
                  >
                    保守模式
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => applyPreset('balanced')}
                  >
                    平衡模式
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => applyPreset('aggressive')}
                  >
                    激进模式
                  </button>
                </div>
              </div>

              {/* 浏览器伪装 */}
              <div className="config-row">
                <label className="label">浏览器伪装</label>
                <select
                  className="select"
                  value={advancedConfig.impersonate}
                  onChange={(e) => {
                    const newConfig = { ...advancedConfig, impersonate: e.target.value };
                    setAdvancedConfig(newConfig);
                    saveConfig(newConfig);
                  }}
                >
                  <option value="chrome">Chrome</option>
                  <option value="chrome-120">Chrome 120</option>
                  <option value="firefox">Firefox</option>
                  <option value="safari">Safari</option>
                  <option value="edge">Edge</option>
                </select>
              </div>

              {/* Cookie 来源 */}
              <div className="config-row">
                <label className="label">Cookie 来源</label>
                <select
                  className="select"
                  value={advancedConfig.cookiesFromBrowser}
                  onChange={(e) => {
                    const newConfig = { ...advancedConfig, cookiesFromBrowser: e.target.value };
                    setAdvancedConfig(newConfig);
                    saveConfig(newConfig);
                  }}
                >
                  <option value="chrome">Chrome</option>
                  <option value="firefox">Firefox</option>
                  <option value="safari">Safari</option>
                  <option value="edge">Edge</option>
                </select>
              </div>

              {/* 请求间隔 */}
              <div className="config-row">
                <label className="label">请求间隔 (秒)</label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  max="10"
                  value={advancedConfig.sleepInterval}
                  onChange={(e) => {
                    const newConfig = { ...advancedConfig, sleepInterval: parseInt(e.target.value) || 2 };
                    setAdvancedConfig(newConfig);
                    saveConfig(newConfig);
                  }}
                />
              </div>

              {/* 重试次数 */}
              <div className="config-row">
                <label className="label">重试次数</label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  max="10"
                  value={advancedConfig.retries}
                  onChange={(e) => {
                    const newConfig = { ...advancedConfig, retries: parseInt(e.target.value) || 3 };
                    setAdvancedConfig(newConfig);
                    saveConfig(newConfig);
                  }}
                />
              </div>

              <div className="config-help">
                <p><strong>提示:</strong></p>
                <ul>
                  <li>保守模式: 更高的请求间隔和重试次数，适合严格网络环境</li>
                  <li>平衡模式: 推荐设置，适合大多数用户</li>
                  <li>激进模式: 更快的下载速度，但可能被检测</li>
                  <li>确保选择的浏览器中已登录相应账号</li>
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* 下载配置 */}
        {videoInfo && (
          <section className="section">
            <h2 className="section-title">下载设置</h2>
            <div className="download-settings">
              <div className="output-path-group">
                <label className="label">下载目录</label>
                <div className="path-input-group">
                  <input
                    type="text"
                    className="input"
                    placeholder="选择下载目录..."
                    value={outputPath}
                    readOnly
                  />
                  <button
                    className="button button-secondary"
                    onClick={handleSelectOutputPath}
                  >
                    选择目录
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 下载按钮和进度 */}
        {videoInfo && (
          <section className="section">
            <button
              className="button button-primary button-download"
              onClick={handleDownload}
              disabled={isDownloading || !outputPath}
            >
              {isDownloading ? '下载中...' : '开始下载'}
            </button>

            {isDownloading && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                <div className="progress-info">
                  <span>{downloadProgress}%</span>
                  {downloadSpeed && <span>速度: {downloadSpeed}</span>}
                  {downloadEta && <span>剩余时间: {downloadEta}</span>}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
