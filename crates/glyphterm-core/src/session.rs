//! Unified terminal session (local PTY or SSH).

use crate::frame::{CellView, Frame, SelectionView};
use crate::local::LocalBackend;
use crate::ssh::SshBackend;
use anyhow::Result;

pub enum SessionBackend {
    Local(LocalBackend),
    Ssh(SshBackend),
}

pub struct TerminalSession {
    backend: SessionBackend,
    pub title: String,
}

impl TerminalSession {
    pub fn spawn_local(cols: u16, rows: u16) -> Result<Self> {
        Ok(Self {
            title: "local".into(),
            backend: SessionBackend::Local(LocalBackend::spawn(cols, rows)?),
        })
    }

    pub fn spawn_ssh(
        host: &str,
        port: u16,
        user: &str,
        password: Option<&str>,
        cols: u16,
        rows: u16,
    ) -> Result<Self> {
        let ssh = SshBackend::connect(host, port, user, password, cols, rows)?;
        let title = ssh.label.clone();
        Ok(Self {
            title,
            backend: SessionBackend::Ssh(ssh),
        })
    }

    pub fn is_ssh(&self) -> bool {
        matches!(self.backend, SessionBackend::Ssh(_))
    }

    fn grid_mut(&mut self) -> &mut glyphgrid::Grid {
        match &mut self.backend {
            SessionBackend::Local(b) => &mut b.grid,
            SessionBackend::Ssh(b) => &mut b.grid,
        }
    }

    fn grid(&self) -> &glyphgrid::Grid {
        match &self.backend {
            SessionBackend::Local(b) => &b.grid,
            SessionBackend::Ssh(b) => &b.grid,
        }
    }

    pub fn poll(&mut self) -> bool {
        match &mut self.backend {
            SessionBackend::Local(b) => b.poll(),
            SessionBackend::Ssh(b) => b.poll(),
        }
    }

    pub fn is_dirty(&self) -> bool {
        match &self.backend {
            SessionBackend::Local(b) => b.dirty,
            SessionBackend::Ssh(b) => b.dirty,
        }
    }

    pub fn clear_dirty(&mut self) {
        match &mut self.backend {
            SessionBackend::Local(b) => b.dirty = false,
            SessionBackend::Ssh(b) => b.dirty = false,
        }
    }

    pub fn write_input(&mut self, data: &[u8]) -> Result<()> {
        self.grid_mut().selection_clear();
        match &mut self.backend {
            SessionBackend::Local(b) => b.write_input(data),
            SessionBackend::Ssh(b) => b.write_input(data),
        }
    }

    pub fn selection_start(&mut self, col: u16, row: u16) {
        self.grid_mut().selection_start(col, row);
        self.mark_dirty();
    }

    pub fn selection_update(&mut self, col: u16, row: u16) {
        self.grid_mut().selection_update(col, row);
        self.mark_dirty();
    }

    pub fn selection_clear(&mut self) {
        self.grid_mut().selection_clear();
        self.mark_dirty();
    }

    pub fn selection_copy_text(&self) -> String {
        self.grid().selection_text()
    }

    pub fn resize(&mut self, cols: u16, rows: u16) -> Result<()> {
        match &mut self.backend {
            SessionBackend::Local(b) => b.resize(cols, rows),
            SessionBackend::Ssh(b) => b.resize(cols, rows),
        }
    }

    fn mark_dirty(&mut self) {
        match &mut self.backend {
            SessionBackend::Local(b) => b.dirty = true,
            SessionBackend::Ssh(b) => b.dirty = true,
        }
    }

    pub fn frame(&self) -> Frame {
        let grid = self.grid();
        let cells = grid
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
            let sel = grid.selection();
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
            cols: grid.cols,
            rows: grid.rows,
            cursor_col: grid.cursor.col,
            cursor_row: grid.cursor.row,
            scrollback_lines: grid.scrollback_len(),
            cells,
            selection,
        }
    }
}
