//! Local PTY backend.

use anyhow::{Context, Result};
use glyphgrid::Grid;
use glyphvt::Parser;
use glyphwidth::WidthPolicy;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::mpsc::{self, Receiver};
use std::thread;

pub struct LocalBackend {
    pub grid: Grid,
    pub parser: Parser,
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    pty_rx: Receiver<Vec<u8>>,
    pub dirty: bool,
}

impl LocalBackend {
    pub fn spawn(cols: u16, rows: u16) -> Result<Self> {
        let grid = Grid::new(cols, rows, WidthPolicy::default());
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .context("open pty")?;

        let shell = std::env::var("SHELL").unwrap_or_else(|_| default_shell());
        let cmd = CommandBuilder::new(&shell);
        let _child = pair.slave.spawn_command(cmd).context("spawn shell")?;

        let mut reader = pair.master.try_clone_reader().context("clone pty reader")?;
        let writer = pair.master.take_writer().context("pty writer")?;
        let master: Box<dyn MasterPty + Send> = pair.master;

        let (tx, pty_rx) = mpsc::channel();
        thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        if tx.send(buf[..n].to_vec()).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        Ok(Self {
            grid,
            parser: Parser::new(),
            writer,
            master,
            pty_rx,
            dirty: true,
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
        self.writer.write_all(data).context("write pty")?;
        self.writer.flush().context("flush pty")?;
        self.dirty = true;
        Ok(())
    }

    pub fn resize(&mut self, cols: u16, rows: u16) -> Result<()> {
        self.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .context("resize pty")?;
        self.grid.resize(cols, rows);
        self.dirty = true;
        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn default_shell() -> String {
    "powershell.exe".into()
}

#[cfg(not(target_os = "windows"))]
fn default_shell() -> String {
    "/bin/zsh".into()
}
