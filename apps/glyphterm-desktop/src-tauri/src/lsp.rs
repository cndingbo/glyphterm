//! JSON-RPC bridge: rust-analyzer (stdio) ↔ local WebSocket for Monaco LSP client.

use parking_lot::Mutex;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tungstenite::{accept, Message};

const HEADER_SEP: &[u8; 4] = b"\r\n\r\n";

pub struct LspState {
    pub child: Mutex<Option<Child>>,
    pub port: Mutex<Option<u16>>,
    pub running: AtomicBool,
}

impl Default for LspState {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
            port: Mutex::new(None),
            running: AtomicBool::new(false),
        }
    }
}

#[derive(serde::Serialize)]
pub struct LspStartResult {
    pub port: u16,
    pub server: String,
}

fn find_rust_analyzer() -> Option<String> {
    if let Ok(p) = which::which("rust-analyzer") {
        return Some(p.to_string_lossy().into_owned());
    }
    let home = std::env::var_os("HOME")?;
    let candidates = [
        format!("{}/.cargo/bin/rust-analyzer", home.to_string_lossy()),
        format!("{}/.local/bin/rust-analyzer", home.to_string_lossy()),
    ];
    for c in candidates {
        if std::path::Path::new(&c).is_file() {
            return Some(c);
        }
    }
    None
}

fn read_lsp_message(stream: &mut impl Read) -> std::io::Result<Option<String>> {
    let mut header = Vec::new();
    let mut buf = [0u8; 1];
    loop {
        stream.read_exact(&mut buf)?;
        header.push(buf[0]);
        if header.len() >= 4 && header.ends_with(HEADER_SEP) {
            break;
        }
        if header.len() > 8192 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "LSP header too large",
            ));
        }
    }
    let header_str = String::from_utf8_lossy(&header);
    let mut content_length = 0usize;
    for line in header_str.lines() {
        if let Some(rest) = line.strip_prefix("Content-Length:") {
            content_length = rest.trim().parse().unwrap_or(0);
        }
    }
    if content_length == 0 {
        return Ok(None);
    }
    let mut body = vec![0u8; content_length];
    stream.read_exact(&mut body)?;
    Ok(Some(String::from_utf8(body).map_err(|e| {
        std::io::Error::new(std::io::ErrorKind::InvalidData, e)
    })?))
}

fn write_lsp_message(stream: &mut impl Write, json: &str) -> std::io::Result<()> {
    let header = format!("Content-Length: {}\r\n\r\n", json.len());
    stream.write_all(header.as_bytes())?;
    stream.write_all(json.as_bytes())?;
    stream.flush()
}

fn bridge_stdio_to_ws(
    child_stdout: impl Read + Send + 'static,
    child_stdin: impl Write + Send + 'static,
    listener: TcpListener,
    running: Arc<AtomicBool>,
) {
    let Ok((tcp, _)) = listener.accept() else {
        running.store(false, Ordering::SeqCst);
        return;
    };
    let Ok(mut ws) = accept(tcp) else {
        running.store(false, Ordering::SeqCst);
        return;
    };

    let (to_ws_tx, to_ws_rx) = mpsc::channel::<String>();
    let (to_child_tx, to_child_rx) = mpsc::channel::<String>();

    let running_out = running.clone();
    thread::spawn(move || {
        let mut stdout = child_stdout;
        while running_out.load(Ordering::SeqCst) {
            match read_lsp_message(&mut stdout) {
                Ok(Some(msg)) => {
                    if to_ws_tx.send(msg).is_err() {
                        break;
                    }
                }
                Ok(None) => continue,
                Err(_) => break,
            }
        }
        running_out.store(false, Ordering::SeqCst);
    });

    let running_in = running.clone();
    thread::spawn(move || {
        let mut stdin = child_stdin;
        while running_in.load(Ordering::SeqCst) {
            match to_child_rx.recv_timeout(Duration::from_millis(200)) {
                Ok(msg) => {
                    if write_lsp_message(&mut stdin, &msg).is_err() {
                        break;
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
        running_in.store(false, Ordering::SeqCst);
    });

    while running.load(Ordering::SeqCst) {
        if let Ok(msg) = to_ws_rx.try_recv() {
            if ws.send(Message::Text(msg.into())).is_err() {
                break;
            }
        }
        match ws.read() {
            Ok(Message::Text(text)) => {
                if to_child_tx.send(text.to_string()).is_err() {
                    break;
                }
            }
            Ok(Message::Close(_)) | Err(_) => break,
            Ok(_) => {}
        }
    }

    running.store(false, Ordering::SeqCst);
}

pub fn stop_lsp(state: &LspState) {
    state.running.store(false, Ordering::SeqCst);
    if let Some(mut child) = state.child.lock().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    *state.port.lock() = None;
}

pub fn start_rust_lsp(
    app: &AppHandle,
    state: &LspState,
    workspace_root: String,
) -> Result<LspStartResult, String> {
    stop_lsp(state);

    let analyzer = find_rust_analyzer().ok_or_else(|| {
        "rust-analyzer not found. Install: rustup component add rust-analyzer".to_string()
    })?;

    let root = std::path::Path::new(&workspace_root);
    if !root.is_dir() {
        return Err("workspace root is not a directory".into());
    }

    let mut child = Command::new(&analyzer)
        .current_dir(root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("failed to spawn rust-analyzer: {e}"))?;

    let stdin = child.stdin.take().ok_or("no stdin")?;
    let stdout = child.stdout.take().ok_or("no stdout")?;

    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    state.running.store(true, Ordering::SeqCst);
    *state.port.lock() = Some(port);
    *state.child.lock() = Some(child);

    let app_bg = app.clone();
    let running = Arc::new(AtomicBool::new(true));

    thread::spawn(move || {
        bridge_stdio_to_ws(stdout, stdin, listener, running);
        let st = app_bg.state::<crate::AppState>();
        stop_lsp(&st.lsp);
        let _ = app_bg.emit("lsp-rust-stopped", ());
    });

    Ok(LspStartResult {
        port,
        server: "rust-analyzer".into(),
    })
}
