mod fs_api;
mod lsp;

use fs_api::{
    default_workspace_root, list_directory, read_text_file, search_files, write_text_file,
    FsEntry, FsSearchHit,
};
use glyphterm_core::{FramePayload, SessionManager, TabInfo};
use parking_lot::Mutex;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

struct AppState {
    manager: Mutex<SessionManager>,
    workspace_root: Mutex<PathBuf>,
    lsp: lsp::LspState,
}

fn resolve_tab(state: &State<'_, AppState>, tab_id: Option<u64>) -> Result<u64, String> {
    let mgr = state.manager.lock();
    let id = tab_id.unwrap_or(mgr.active_id());
    if id == 0 || !mgr.list_tabs().iter().any(|t| t.id == id) {
        return Err("no active tab".into());
    }
    Ok(id)
}

#[tauri::command]
fn terminal_tab_new_local(
    state: State<'_, AppState>,
    cols: u16,
    rows: u16,
) -> Result<u64, String> {
    let id = state
        .manager
        .lock()
        .create_local(cols, rows)
        .map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn terminal_tab_new_ssh(
    state: State<'_, AppState>,
    host: String,
    user: String,
    port: Option<u16>,
    password: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<u64, String> {
    let port = port.unwrap_or(22);
    let pw = password.as_deref();
    state
        .manager
        .lock()
        .create_ssh(&host, port, &user, pw, cols, rows)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn terminal_tab_close(state: State<'_, AppState>, tab_id: u64) -> Result<(), String> {
    state
        .manager
        .lock()
        .close(tab_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn terminal_tab_switch(state: State<'_, AppState>, tab_id: u64) -> Result<(), String> {
    state
        .manager
        .lock()
        .set_active(tab_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn terminal_list_tabs(state: State<'_, AppState>) -> Result<Vec<TabInfo>, String> {
    Ok(state.manager.lock().list_tabs())
}

#[tauri::command]
fn terminal_write(
    state: State<'_, AppState>,
    data: String,
    tab_id: Option<u64>,
) -> Result<(), String> {
    let id = resolve_tab(&state, tab_id)?;
    state
        .manager
        .lock()
        .session_mut(id)
        .map_err(|e| e.to_string())?
        .write_input(data.as_bytes())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn terminal_resize(
    state: State<'_, AppState>,
    cols: u16,
    rows: u16,
    tab_id: Option<u64>,
) -> Result<(), String> {
    let id = resolve_tab(&state, tab_id)?;
    state
        .manager
        .lock()
        .session_mut(id)
        .map_err(|e| e.to_string())?
        .resize(cols, rows)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn terminal_selection_start(
    state: State<'_, AppState>,
    col: u16,
    row: u16,
    tab_id: Option<u64>,
) -> Result<(), String> {
    let id = resolve_tab(&state, tab_id)?;
    state
        .manager
        .lock()
        .session_mut(id)
        .map_err(|e| e.to_string())?
        .selection_start(col, row);
    Ok(())
}

#[tauri::command]
fn terminal_selection_update(
    state: State<'_, AppState>,
    col: u16,
    row: u16,
    tab_id: Option<u64>,
) -> Result<(), String> {
    let id = resolve_tab(&state, tab_id)?;
    state
        .manager
        .lock()
        .session_mut(id)
        .map_err(|e| e.to_string())?
        .selection_update(col, row);
    Ok(())
}

#[tauri::command]
fn terminal_selection_clear(
    state: State<'_, AppState>,
    tab_id: Option<u64>,
) -> Result<(), String> {
    let id = resolve_tab(&state, tab_id)?;
    state
        .manager
        .lock()
        .session_mut(id)
        .map_err(|e| e.to_string())?
        .selection_clear();
    Ok(())
}

#[tauri::command]
fn workspace_get_root(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state
        .workspace_root
        .lock()
        .to_string_lossy()
        .into_owned())
}

#[tauri::command]
fn workspace_set_root(state: State<'_, AppState>, path: String) -> Result<String, String> {
    let canon = PathBuf::from(&path)
        .canonicalize()
        .map_err(|e| format!("invalid workspace path: {e}"))?;
    if !canon.is_dir() {
        return Err("workspace must be a directory".into());
    }
    *state.workspace_root.lock() = canon.clone();
    Ok(canon.to_string_lossy().into_owned())
}

#[tauri::command]
fn fs_list_dir(state: State<'_, AppState>, path: Option<String>) -> Result<Vec<FsEntry>, String> {
    let root = state.workspace_root.lock().clone();
    let p = path.unwrap_or_else(|| root.to_string_lossy().into_owned());
    list_directory(&root, &p)
}

#[tauri::command]
fn fs_read_text(state: State<'_, AppState>, path: String) -> Result<String, String> {
    let root = state.workspace_root.lock().clone();
    read_text_file(&root, &path)
}

#[tauri::command]
fn fs_write_text(
    state: State<'_, AppState>,
    path: String,
    content: String,
) -> Result<(), String> {
    let root = state.workspace_root.lock().clone();
    write_text_file(&root, &path, &content)
}

#[tauri::command]
fn fs_search_files(
    state: State<'_, AppState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<FsSearchHit>, String> {
    let root = state.workspace_root.lock().clone();
    search_files(&root, &query, limit.unwrap_or(50))
}

#[tauri::command]
fn lsp_rust_start(
    app: AppHandle,
    state: State<'_, AppState>,
    workspace_root: Option<String>,
) -> Result<lsp::LspStartResult, String> {
    let root = workspace_root.unwrap_or_else(|| {
        state
            .workspace_root
            .lock()
            .to_string_lossy()
            .into_owned()
    });
    lsp::start_rust_lsp(&app, &state.lsp, root)
}

#[tauri::command]
fn lsp_rust_stop(state: State<'_, AppState>) -> Result<(), String> {
    lsp::stop_lsp(&state.lsp);
    Ok(())
}

#[tauri::command]
fn lsp_rust_status(state: State<'_, AppState>) -> Result<Option<u16>, String> {
    Ok(*state.lsp.port.lock())
}

#[derive(serde::Deserialize)]
struct AiBlockEmit {
    tab_id: u64,
    block_json: String,
}

#[tauri::command]
fn terminal_emit_ai_block(app: AppHandle, payload: AiBlockEmit) -> Result<(), String> {
    app.emit(
        "terminal-ai-block",
        serde_json::json!({
            "tabId": payload.tab_id,
            "blockJson": payload.block_json,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn terminal_copy_selection(
    state: State<'_, AppState>,
    tab_id: Option<u64>,
) -> Result<String, String> {
    let id = resolve_tab(&state, tab_id)?;
    Ok(state
        .manager
        .lock()
        .session_mut(id)
        .map_err(|e| e.to_string())?
        .selection_copy_text())
}

fn spawn_frame_loop(app: AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_millis(16));
            let payloads: Vec<FramePayload> = {
                let state = app.state::<AppState>();
                let mut mgr = state.manager.lock();
                mgr.drain_dirty_frames()
                    .into_iter()
                    .map(|(tab_id, frame)| FramePayload { tab_id, frame })
                    .collect()
            };
            for payload in payloads {
                let _ = app.emit("terminal-frame", &payload);
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            manager: Mutex::new(SessionManager::new()),
            workspace_root: Mutex::new(default_workspace_root()),
            lsp: lsp::LspState::default(),
        })
        .setup(|app| {
            spawn_frame_loop(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            terminal_tab_new_local,
            terminal_tab_new_ssh,
            terminal_tab_close,
            terminal_tab_switch,
            terminal_list_tabs,
            terminal_write,
            terminal_resize,
            terminal_selection_start,
            terminal_selection_update,
            terminal_selection_clear,
            terminal_copy_selection,
            workspace_get_root,
            workspace_set_root,
            fs_list_dir,
            fs_read_text,
            fs_write_text,
            fs_search_files,
            lsp_rust_start,
            lsp_rust_stop,
            lsp_rust_status,
            terminal_emit_ai_block,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
