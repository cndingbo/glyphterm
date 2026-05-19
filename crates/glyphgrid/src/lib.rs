//! Terminal cell grid with wide-character (CJK) support.

use glyphwidth::{measure, ClusterWidth, WidthPolicy};

/// Default foreground / background (24-bit RGB).
pub const DEFAULT_FG: u32 = 0xF5F3EE;
pub const DEFAULT_BG: u32 = 0x08090B;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Cell {
    pub ch: char,
    pub fg: u32,
    pub bg: u32,
    pub bold: bool,
    pub wide_continuation: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Cursor {
    pub col: u16,
    pub row: u16,
}

#[derive(Debug, Clone)]
pub struct Grid {
    pub cols: u16,
    pub rows: u16,
    pub cursor: Cursor,
    cells: Vec<Cell>,
    policy: WidthPolicy,
    pub fg: u32,
    pub bg: u32,
    pub bold: bool,
    /// When true, writing past the last column wraps to the next row.
    pub auto_wrap: bool,
}

impl Grid {
    pub fn new(cols: u16, rows: u16, policy: WidthPolicy) -> Self {
        let len = cols as usize * rows as usize;
        Self {
            cols,
            rows,
            cursor: Cursor::default(),
            cells: vec![Cell::default(); len],
            policy,
            fg: DEFAULT_FG,
            bg: DEFAULT_BG,
            bold: false,
            auto_wrap: true,
        }
    }

    pub fn policy(&self) -> WidthPolicy {
        self.policy
    }

    pub fn set_cursor(&mut self, col: u16, row: u16) {
        self.cursor.col = col.min(self.cols.saturating_sub(1));
        self.cursor.row = row.min(self.rows.saturating_sub(1));
    }

    pub fn set_pen(&mut self, fg: u32, bg: u32, bold: bool) {
        self.fg = fg;
        self.bg = bg;
        self.bold = bold;
    }

    fn index(&self, col: u16, row: u16) -> Option<usize> {
        if col >= self.cols || row >= self.rows {
            return None;
        }
        Some(row as usize * self.cols as usize + col as usize)
    }

    fn put_cell(&mut self, col: u16, row: u16, ch: char, wide_continuation: bool) {
        if let Some(i) = self.index(col, row) {
            self.cells[i] = Cell {
                ch,
                fg: self.fg,
                bg: self.bg,
                bold: self.bold,
                wide_continuation,
            };
        }
    }

    fn clear_cell(&mut self, col: u16, row: u16) {
        if let Some(i) = self.index(col, row) {
            self.cells[i] = Cell {
                ch: ' ',
                ..Cell::default()
            };
        }
    }

    /// Write UTF-8 at the cursor using the grid width policy.
    pub fn write_str(&mut self, text: &str) {
        for cluster in measure(text, self.policy) {
            if cluster.cols == 0 {
                for ch in cluster.text.chars() {
                    self.write_char(ch);
                }
                continue;
            }
            self.write_cluster(&cluster);
        }
    }

    fn write_cluster(&mut self, cluster: &ClusterWidth) {
        let width = cluster.cols as u16;
        if width == 0 {
            return;
        }

        let ch = cluster
            .text
            .chars()
            .next()
            .unwrap_or(' ');

        if width == 1 {
            self.write_char(ch);
            return;
        }

        // Wide character (typically 2 columns).
        if self.cursor.col + 1 >= self.cols && self.auto_wrap {
            self.line_feed();
        }

        self.put_cell(self.cursor.col, self.cursor.row, ch, false);

        if self.cursor.col + 1 < self.cols {
            self.cursor.col += 1;
            self.put_cell(self.cursor.col, self.cursor.row, ' ', true);
            self.advance_cursor();
        } else if self.auto_wrap {
            // Second half wraps to next line (common terminal behavior).
            self.line_feed();
            self.put_cell(0, self.cursor.row, ' ', true);
            self.cursor.col = 1;
        }
    }

    fn write_char(&mut self, ch: char) {
        if ch == '\n' {
            self.line_feed();
            return;
        }
        if ch == '\r' {
            self.cursor.col = 0;
            return;
        }
        if ch == '\t' {
            let next = (self.cursor.col / 8 + 1) * 8;
            self.cursor.col = next.min(self.cols.saturating_sub(1));
            return;
        }
        if ch == '\x08' {
            self.backspace();
            return;
        }

        if self.cursor.col >= self.cols && self.auto_wrap {
            self.line_feed();
        }

        if self.cursor.col < self.cols {
            self.put_cell(self.cursor.col, self.cursor.row, ch, false);
            self.advance_cursor();
        }
    }

    fn advance_cursor(&mut self) {
        if self.cursor.col + 1 < self.cols {
            self.cursor.col += 1;
        } else if self.auto_wrap {
            self.line_feed();
        }
    }

    pub fn line_feed(&mut self) {
        if self.cursor.row + 1 < self.rows {
            self.cursor.row += 1;
        }
        self.cursor.col = 0;
    }

    pub fn carriage_return(&mut self) {
        self.cursor.col = 0;
    }

    pub fn backspace(&mut self) {
        if self.cursor.col == 0 {
            return;
        }
        let prev = self.cursor.col - 1;
        if self
            .cell(prev, self.cursor.row)
            .is_some_and(|c| c.wide_continuation)
        {
            if prev > 0 {
                self.clear_cell(prev - 1, self.cursor.row);
            }
            self.clear_cell(prev, self.cursor.row);
            self.cursor.col = prev.saturating_sub(1);
        } else {
            self.clear_cell(prev, self.cursor.row);
            self.cursor.col = prev;
        }
    }

    pub fn erase_line_from_cursor(&mut self) {
        for c in self.cursor.col..self.cols {
            self.clear_cell(c, self.cursor.row);
        }
    }

    pub fn erase_line_to_cursor(&mut self) {
        for c in 0..=self.cursor.col.min(self.cols.saturating_sub(1)) {
            self.clear_cell(c, self.cursor.row);
        }
    }

    pub fn erase_line(&mut self) {
        for c in 0..self.cols {
            self.clear_cell(c, self.cursor.row);
        }
    }

    pub fn erase_display_from_cursor(&mut self) {
        let (c0, r0) = (self.cursor.col, self.cursor.row);
        for r in r0..self.rows {
            let start = if r == r0 { c0 } else { 0 };
            for c in start..self.cols {
                self.clear_cell(c, r);
            }
        }
    }

    pub fn clear_screen(&mut self) {
        self.cells.fill(Cell::default());
        self.cursor = Cursor::default();
    }

    pub fn resize(&mut self, cols: u16, rows: u16) {
        let mut next = vec![Cell::default(); cols as usize * rows as usize];
        let copy_cols = cols.min(self.cols);
        let copy_rows = rows.min(self.rows);
        for r in 0..copy_rows {
            for c in 0..copy_cols {
                if let Some(i) = self.index(c, r) {
                    let ni = r as usize * cols as usize + c as usize;
                    next[ni] = self.cells[i];
                }
            }
        }
        self.cols = cols;
        self.rows = rows;
        self.cells = next;
        self.cursor.col = self.cursor.col.min(cols.saturating_sub(1));
        self.cursor.row = self.cursor.row.min(rows.saturating_sub(1));
    }

    pub fn cell(&self, col: u16, row: u16) -> Option<&Cell> {
        self.index(col, row).map(|i| &self.cells[i])
    }

    /// Render grid rows to plain text (for debugging / tests).
    pub fn dump_plain(&self) -> String {
        let mut out = String::new();
        for r in 0..self.rows {
            for c in 0..self.cols {
                if let Some(cell) = self.cell(c, r) {
                    if !cell.wide_continuation {
                        out.push(cell.ch);
                    }
                }
            }
            if r + 1 < self.rows {
                out.push('\n');
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use glyphwidth::WidthPolicy;

    #[test]
    fn write_cjk_advances_two_cols() {
        let mut g = Grid::new(80, 24, WidthPolicy::default());
        g.write_str("中");
        assert_eq!(g.cursor.col, 2);
    }

    #[test]
    fn write_mixed_line() {
        let mut g = Grid::new(40, 5, WidthPolicy::default());
        g.write_str("中文ABC");
        assert_eq!(g.cursor.col, 7);
    }

    #[test]
    fn newline_resets_column() {
        let mut g = Grid::new(80, 24, WidthPolicy::default());
        g.write_str("hi\n");
        assert_eq!(g.cursor.col, 0);
        assert_eq!(g.cursor.row, 1);
    }

    #[test]
    fn backspace_wide_char() {
        let mut g = Grid::new(80, 24, WidthPolicy::default());
        g.write_str("中");
        g.backspace();
        assert_eq!(g.cursor.col, 0);
        assert!(g.cell(0, 0).unwrap().ch == ' ');
    }

    #[test]
    fn resize_preserves_content() {
        let mut g = Grid::new(10, 3, WidthPolicy::default());
        g.write_str("AB");
        g.resize(20, 5);
        assert_eq!(g.cell(0, 0).unwrap().ch, 'A');
        assert_eq!(g.cell(1, 0).unwrap().ch, 'B');
    }
}
