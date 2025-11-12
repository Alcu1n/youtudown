/*****************************************************************************
 *  main.rs - Tauri 应用主入口
 *
 *  @brief  初始化并启动 YouTuDown Tauri 应用
 *  @details 配置应用生命周期、窗口事件和 Rust 命令
 *****************************************************************************/

use tauri::Manager;
use tauri::{AppHandle, Wry};

mod commands;

/***************************************************************************
 * 应用生命周期处理
 ***************************************************************************/
fn main() {
    tauri::Builder::default()
        // 注册 Tauri 命令
        .invoke_handler(tauri::generate_handler![
            commands::get_video_info,
            commands::download_video
        ])
        // 应用生命周期事件
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
                window.close_devtools();
            }
            Ok(())
        })
        // 窗口事件
        .on_window_event(|_app_handle, event| match event {
            tauri::WindowEvent::CloseRequested { .. } => {
                // 处理关闭逻辑
                println!("窗口关闭请求");
            }
            _ => {}
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用时发生错误");
}
