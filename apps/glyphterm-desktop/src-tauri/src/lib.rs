use glyphterm_core::TerminalSession;
use parking_lot::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

struct AppState {
    session: Mutex<Option<TerminalSession>>,
}

#[tauri::command]
fn terminal_start(state: State<'_, AppState>, cols: u16, rows: u16) -> Result<(), String> {
    let session = TerminalSession::spawn(cols, rows).map_err(|e| e.to_string())?;
    *state.session.lock() = Some(session);
    Ok(())
}

#[tauri::command]
fn terminal_write(state: State<'_, AppState>, data: String) -> Result<(), String> {
    let mut guard = state.session.lock();
    let session = guard.as_mut().ok_or("terminal not started")?;
    session
        .write_input(data.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn terminal_resize(state: State<'_, AppState>, cols: u16, rows: u16) -> Result<(), String> {
    let mut guard = state.session.lock();
    let session = guard.as_mut().ok_or("terminal not started")?;
    session.resize(cols, rows).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn terminal_selection_start(
    state: State<'_, AppState>,
    col: u16,
    row: u16,
) -> Result<(), String> {
    let mut guard = state.session.lock();
    let session = guard.as_mut().ok_or("terminal not started")?;
    session.selection_start(col, row);
    Ok(())
}

#[tauri::command]
fn terminal_selection_update(
    state: State<'_, AppState>,
    col: u16,
    row: u16,
) -> Result<(), String> {
    let mut guard = state.session.lock();
    let session = guard.as_mut().ok_or("terminal not started")?;
    session.selection_update(col, row);
    Ok(())
}

#[tauri::command]
fn terminal_selection_clear(state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.session.lock();
    let session = guard.as_mut().ok_or("terminal not started")?;
    session.selection_clear();
    Ok(())
}

#[tauri::command]
fn terminal_copy_selection(state: State<'_, AppState>) -> Result<String, String> {
    let guard = state.session.lock();
    let session = guard.as_ref().ok_or("terminal not started")?;
    Ok(session.selection_copy_text())
}

fn spawn_frame_loop(app: AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_millis(16));
            let state = app.state::<AppState>();
            let mut guard = state.session.lock();
            let Some(session) = guard.as_mut() else {
                continue;
            };
            session.poll();
            if session.is_dirty() {
                let frame = session.frame();
                session.clear_dirty();
                drop(guard);
                let _ = app.emit("terminal-frame", &frame);
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            session: Mutex::new(None),
        })
        .setup(|app| {
            spawn_frame_loop(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            terminal_start,
            terminal_write,
            terminal_resize,
            terminal_selection_start,
            terminal_selection_update,
            terminal_selection_clear,
            terminal_copy_selection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
