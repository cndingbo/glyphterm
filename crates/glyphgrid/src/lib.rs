//! Terminal cell grid: 2-column CJK, continuation cells, cursor.

use glyphwidth::{measure, WidthPolicy};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Cell {
    pub ch: char,
    pub fg: u32,
    pub bg: u32,
    /// Second column of a wide character.
    pub wide_continuation: bool,
}

#[derive(Debug, Clone)]
pub struct Grid {
    pub cols: u16,
    pub rows: u16,
    pub cursor_col: u16,
    pub cursor_row: u16,
    cells: Vec<Cell>,
    policy: WidthPolicy,
}

impl Grid {
    pub fn new(cols: u16, rows: u16, policy: WidthPolicy) -> Self {
        let len = cols as usize * rows as usize;
        Self {
            cols,
            rows,
            cursor_col: 0,
            cursor_row: 0,
            cells: vec![Cell::default(); len],
            policy,
        }
    }

    fn index(&self, col: u16, row: u16) -> Option<usize> {
        if col >= self.cols || row >= self.rows {
            return None;
        }
        Some(row as usize * self.cols as usize + col as usize)
    }

    /// Write UTF-8 at cursor; advances cursor by display width.
    pub fn write_str(&mut self, text: &str) {
        for cluster in measure(text, self.policy) {
            for ch in cluster.text.chars() {
                self.put_char(ch);
            }
            if cluster.cols == 2 {
                self.mark_continuation();
            }
        }
    }

    fn put_char(&mut self, ch: char) {
        if let Some(i) = self.index(self.cursor_col, self.cursor_row) {
            self.cells[i] = Cell {
                ch,
                fg: 0xffffff,
                bg: 0x000000,
                wide_continuation: false,
            };
        }
        if self.cursor_col + 1 < self.cols {
            self.cursor_col += 1;
        }
    }

    fn mark_continuation(&mut self) {
        if self.cursor_col > 0 {
            let prev_col = self.cursor_col - 1;
            if let Some(i) = self.index(prev_col, self.cursor_row) {
                if self.cursor_col < self.cols {
                    if let Some(ci) = self.index(self.cursor_col, self.cursor_row) {
                        self.cells[ci] = Cell {
                            ch: ' ',
                            fg: 0,
                            bg: 0,
                            wide_continuation: true,
                        };
                        self.cursor_col += 1;
                    }
                }
                let _ = i;
            }
        }
    }

    pub fn cell(&self, col: u16, row: u16) -> Option<&Cell> {
        self.index(col, row).map(|i| &self.cells[i])
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
        assert_eq!(g.cursor_col, 2);
    }
}
