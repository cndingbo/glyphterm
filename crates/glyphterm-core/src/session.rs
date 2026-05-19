//! Local PTY session backed by [`glyphgrid`] + [`glyphvt`].

use crate::frame::{CellView, Frame, SelectionView};
use anyhow::{Context, Result};
use glyphgrid::Grid;
use glyphvt::{apply, Parser};
use glyphwidth::WidthPolicy;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::mpsc::{self, Receiver};
use std::thread;

pub struct TerminalSession {
    grid: Grid,
    parser: Parser,
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    pty_rx: Receiver<Vec<u8>>,
    dirty: bool,
}

impl TerminalSession {
    pub fn spawn(cols: u16, rows: u16) -> Result<Self> {
        let policy = WidthPolicy::default();
        let grid = Grid::new(cols, rows, policy);

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

    /// Drain PTY output into the grid. Returns whether the grid changed.
    pub fn poll(&mut self) -> bool {
        let mut changed = false;
        while let Ok(chunk) = self.pty_rx.try_recv() {
            let actions = self.parser.feed(&chunk);
            if !actions.is_empty() {
                apply(&mut self.grid, &actions);
                changed = true;
            }
        }
        if changed {
            self.dirty = true;
        }
        changed
    }

    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    pub fn clear_dirty(&mut self) {
        self.dirty = false;
    }

    pub fn write_input(&mut self, data: &[u8]) -> Result<()> {
        self.grid.selection_clear();
        self.writer.write_all(data).context("write pty")?;
        self.writer.flush().context("flush pty")?;
        self.dirty = true;
        Ok(())
    }

    pub fn selection_start(&mut self, col: u16, row: u16) {
        self.grid.selection_start(col, row);
        self.dirty = true;
    }

    pub fn selection_update(&mut self, col: u16, row: u16) {
        self.grid.selection_update(col, row);
        self.dirty = true;
    }

    pub fn selection_clear(&mut self) {
        self.grid.selection_clear();
        self.dirty = true;
    }

    pub fn selection_copy_text(&self) -> String {
        self.grid.selection_text()
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

    pub fn frame(&self) -> Frame {
        let cells = self
            .grid
            .iter_cells()
            .map(|c| CellView {
                ch: if c.wide_continuation {
                    String::new()
                } else {
                    c.ch.to_string()
                },
                fg: c.fg,
                bg: c.bg,
                bold: c.bold,
                wide_continuation: c.wide_continuation,
            })
            .collect();

        let selection = {
            let sel = self.grid.selection();
            if sel.active {
                let (c0, r0, c1, r1) = sel.bounds();
                Some(SelectionView {
                    start_col: c0,
                    start_row: r0,
                    end_col: c1,
                    end_row: r1,
                })
            } else {
                None
            }
        };

        Frame {
            cols: self.grid.cols,
            rows: self.grid.rows,
            cursor_col: self.grid.cursor.col,
            cursor_row: self.grid.cursor.row,
            scrollback_lines: self.grid.scrollback_len(),
            cells,
            selection,
        }
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
