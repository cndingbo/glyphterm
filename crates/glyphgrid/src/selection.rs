//! Text selection on the visible grid.

use crate::Cell;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Selection {
    pub active: bool,
    pub anchor_col: u16,
    pub anchor_row: u16,
    pub end_col: u16,
    pub end_row: u16,
}

impl Selection {
    pub fn start(col: u16, row: u16) -> Self {
        Self {
            active: true,
            anchor_col: col,
            anchor_row: row,
            end_col: col,
            end_row: row,
        }
    }

    pub fn update(&mut self, col: u16, row: u16) {
        self.end_col = col;
        self.end_row = row;
    }

    /// Normalized inclusive bounds (col, row).
    pub fn bounds(&self) -> (u16, u16, u16, u16) {
        let (r0, r1) = if self.anchor_row <= self.end_row {
            (self.anchor_row, self.end_row)
        } else {
            (self.end_row, self.anchor_row)
        };
        let (c0, c1) = if self.anchor_row == self.end_row {
            let (a, b) = if self.anchor_col <= self.end_col {
                (self.anchor_col, self.end_col)
            } else {
                (self.end_col, self.anchor_col)
            };
            (a, b)
        } else if self.anchor_row < self.end_row {
            (self.anchor_col, self.end_col)
        } else {
            (self.end_col, self.anchor_col)
        };
        (c0, r0, c1, r1)
    }
}

/// Extract selected text from visible cells.
pub fn selection_text(
    cols: u16,
    rows: u16,
    cells: &[Cell],
    sel: &Selection,
) -> String {
    if !sel.active {
        return String::new();
    }
    let (c0, r0, c1, r1) = sel.bounds();
    let mut out = String::new();
    for r in r0..=r1.min(rows.saturating_sub(1)) {
        let col_start = if r == r0 { c0 } else { 0 };
        let col_end = if r == r1 {
            c1
        } else {
            cols.saturating_sub(1)
        };
        for c in col_start..=col_end.min(cols.saturating_sub(1)) {
            let idx = r as usize * cols as usize + c as usize;
            let Some(cell) = cells.get(idx) else {
                continue;
            };
            if cell.wide_continuation {
                continue;
            }
            if cell.ch != ' ' {
                out.push(cell.ch);
            }
        }
        if r < r1 {
            out.push('\n');
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Grid;
    use glyphwidth::WidthPolicy;

    #[test]
    fn extract_single_line() {
        let mut g = Grid::new(10, 3, WidthPolicy::default());
        g.write_str("hello");
        let mut sel = Selection::start(0, 0);
        sel.update(4, 0);
        let text = selection_text(g.cols, g.rows, g.cells(), &sel);
        assert_eq!(text, "hello");
    }
}
