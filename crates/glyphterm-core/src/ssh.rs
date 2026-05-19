//! SSH PTY backend via libssh2.

use anyhow::{Context, Result};
use glyphgrid::Grid;
use glyphvt::Parser;
use glyphwidth::WidthPolicy;
use ssh2::Session;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver};
use std::thread;
use std::time::Duration;

pub struct SshBackend {
    pub grid: Grid,
    pub parser: Parser,
    stdin_tx: std::sync::mpsc::Sender<Vec<u8>>,
    pty_rx: Receiver<Vec<u8>>,
    pub dirty: bool,
    pub label: String,
    resize_tx: std::sync::mpsc::Sender<(u16, u16)>,
}

impl SshBackend {
    pub fn connect(
        host: &str,
        port: u16,
        user: &str,
        password: Option<&str>,
        cols: u16,
        rows: u16,
    ) -> Result<Self> {
        let label = format!("{user}@{host}");
        let addr = format!("{host}:{port}");
        let tcp = TcpStream::connect(&addr).context("tcp connect")?;
        tcp.set_read_timeout(Some(Duration::from_millis(50)))
            .ok();
        tcp.set_write_timeout(Some(Duration::from_secs(10)))
            .ok();

        let mut sess = Session::new().context("ssh session")?;
        sess.set_tcp_stream(tcp);
        sess.handshake().context("ssh handshake")?;

        if let Some(pw) = password {
            sess.userauth_password(user, pw)
                .context("ssh password auth")?;
        } else {
            sess.userauth_agent(user).or_else(|_| {
                sess.userauth_pubkey_file(user, None, &default_key_path(), None)
            })
            .context("ssh auth (agent or ~/.ssh/id_ed25519)")?;
        }

        if !sess.authenticated() {
            anyhow::bail!("ssh authentication failed");
        }

        let mut channel = sess.channel_session().context("open channel")?;
        channel.request_pty("xterm-256color", None, Some((cols as u32, rows as u32, 0, 0)))?;
        channel.shell().context("ssh shell")?;

        let (out_tx, pty_rx) = mpsc::channel();
        let (stdin_tx, stdin_rx) = std::sync::mpsc::channel::<Vec<u8>>();
        let (resize_tx, resize_rx) = std::sync::mpsc::channel();

        thread::spawn(move || {
            let _sess = sess;
            let mut channel = channel;
            let mut buf = [0u8; 8192];
            loop {
                while let Ok((c, r)) = resize_rx.try_recv() {
                    let _ = channel.request_pty(
                        "xterm-256color",
                        None,
                        Some((c as u32, r as u32, 0, 0)),
                    );
                }
                while let Ok(data) = stdin_rx.try_recv() {
                    let _ = channel.write_all(&data);
                    let _ = channel.flush();
                }
                match channel.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        if out_tx.send(buf[..n].to_vec()).is_err() {
                            break;
                        }
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(10));
                    }
                    Err(_) => break,
                }
            }
        });

        Ok(Self {
            grid: Grid::new(cols, rows, WidthPolicy::default()),
            parser: Parser::new(),
            stdin_tx,
            pty_rx,
            dirty: true,
            label,
            resize_tx,
        })
    }

    pub fn poll(&mut self) -> bool {
        let mut changed = false;
        while let Ok(chunk) = self.pty_rx.try_recv() {
            let actions = self.parser.feed(&chunk);
            if !actions.is_empty() {
                glyphvt::apply(&mut self.grid, &actions);
                changed = true;
            }
        }
        if changed {
            self.dirty = true;
        }
        changed
    }

    pub fn write_input(&mut self, data: &[u8]) -> Result<()> {
        self.stdin_tx
            .send(data.to_vec())
            .context("ssh stdin channel closed")?;
        self.dirty = true;
        Ok(())
    }

    pub fn resize(&mut self, cols: u16, rows: u16) -> Result<()> {
        self.resize_tx.send((cols, rows)).ok();
        self.grid.resize(cols, rows);
        self.dirty = true;
        Ok(())
    }
}

fn default_key_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_default();
    PathBuf::from(home).join(".ssh").join("id_ed25519")
}
