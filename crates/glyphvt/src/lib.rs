//! VT100 / xterm subset parser — feeds [`glyphgrid::Grid`].

use glyphgrid::Grid;

/// Parsed terminal action.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Action {
    Print(String),
    Execute(u8),
    Csi(Vec<u8>),
}

/// Incremental UTF-8 / escape parser.
#[derive(Debug, Default)]
pub struct Parser {
    state: State,
    esc_buf: Vec<u8>,
    utf8_buf: Vec<u8>,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
enum State {
    #[default]
    Ground,
    Escape,
    Csi,
}

impl Parser {
    pub fn new() -> Self {
        Self::default()
    }

    /// Feed bytes; returns actions to apply.
    pub fn feed(&mut self, data: &[u8]) -> Vec<Action> {
        let mut out = Vec::new();
        for &b in data {
            self.feed_byte(b, &mut out);
        }
        self.flush_utf8(&mut out);
        out
    }

    fn feed_byte(&mut self, b: u8, out: &mut Vec<Action>) {
        match self.state {
            State::Ground => match b {
                0x1B => {
                    self.flush_utf8(out);
                    self.state = State::Escape;
                    self.esc_buf.clear();
                }
                0x07 => {
                    self.flush_utf8(out);
                    out.push(Action::Execute(b));
                }
                0x08 | 0x09 | 0x0A | 0x0D => {
                    self.flush_utf8(out);
                    out.push(Action::Execute(b));
                }
                _ => self.utf8_buf.push(b),
            },
            State::Escape => match b {
                b'[' => {
                    self.state = State::Csi;
                    self.esc_buf.clear();
                }
                _ => {
                    self.state = State::Ground;
                }
            },
            State::Csi => {
                if (0x40..=0x7E).contains(&b) {
                    self.esc_buf.push(b);
                    out.push(Action::Csi(self.esc_buf.clone()));
                    self.esc_buf.clear();
                    self.state = State::Ground;
                } else {
                    self.esc_buf.push(b);
                }
            }
        }
    }

    fn flush_utf8(&mut self, out: &mut Vec<Action>) {
        if self.utf8_buf.is_empty() {
            return;
        }
        if let Ok(s) = std::str::from_utf8(&self.utf8_buf) {
            out.push(Action::Print(s.to_string()));
        }
        self.utf8_buf.clear();
    }
}

/// Apply actions to a grid (subset of VT semantics).
pub fn apply(grid: &mut Grid, actions: &[Action]) {
    for action in actions {
        apply_one(grid, action);
    }
}

fn apply_one(grid: &mut Grid, action: &Action) {
    match action {
        Action::Print(s) => grid.write_str(s),
        Action::Execute(b) => match b {
            b'\n' | 0x0B | 0x0C => grid.line_feed(),
            b'\r' => grid.carriage_return(),
            b'\t' => grid.write_str("\t"),
            b'\x08' => grid.backspace(),
            _ => {}
        },
        Action::Csi(params) => apply_csi(grid, params),
    }
}

fn apply_csi(grid: &mut Grid, raw: &[u8]) {
    if raw.is_empty() {
        return;
    }
    let final_byte = raw[raw.len() - 1];
    let body = &raw[..raw.len() - 1];
    let args = parse_csi_args(body);

    match final_byte {
        b'H' | b'f' => {
            // CPR: row;col (1-based)
            let row = args.first().copied().unwrap_or(1).saturating_sub(1);
            let col = args.get(1).copied().unwrap_or(1).saturating_sub(1);
            grid.set_cursor(col as u16, row as u16);
        }
        b'J' => match args.first().copied().unwrap_or(0) {
            0 => grid.erase_display_from_cursor(),
            2 => grid.clear_screen(),
            _ => {}
        },
        b'K' => match args.first().copied().unwrap_or(0) {
            0 => grid.erase_line_from_cursor(),
            1 => grid.erase_line_to_cursor(),
            2 => grid.erase_line(),
            _ => {}
        },
        b'm' => apply_sgr(grid, &args),
        _ => {}
    }
}

fn apply_sgr(grid: &mut Grid, args: &[u16]) {
    let mut iter = args.iter().copied().peekable();
    while let Some(code) = iter.next() {
        match code {
            0 => grid.set_pen(glyphgrid::DEFAULT_FG, glyphgrid::DEFAULT_BG, false),
            1 => {
                let fg = grid.fg;
                let bg = grid.bg;
                grid.set_pen(fg, bg, true);
            }
            30..=37 => {
                let fg = ansi_color(code - 30);
                grid.set_pen(fg, grid.bg, grid.bold);
            }
            39 => grid.set_pen(glyphgrid::DEFAULT_FG, grid.bg, grid.bold),
            40..=47 => {
                let bg = ansi_color(code - 40);
                grid.set_pen(grid.fg, bg, grid.bold);
            }
            49 => grid.set_pen(grid.fg, glyphgrid::DEFAULT_BG, grid.bold),
            _ => {}
        }
    }
}

fn ansi_color(idx: u16) -> u32 {
    const PALETTE: [u32; 8] = [
        0x000000, 0xCD3131, 0x0DBC79, 0xE5E510, 0x2472C8, 0xBC3FBC, 0x11A8CD, 0xE5E5E5,
    ];
    PALETTE.get(idx as usize).copied().unwrap_or(0xFFFFFF)
}

fn parse_csi_args(body: &[u8]) -> Vec<u16> {
    let s = std::str::from_utf8(body).unwrap_or("");
    if s.is_empty() {
        return vec![0];
    }
    s.split(';')
        .map(|p| {
            if p.is_empty() {
                0
            } else {
                p.parse().unwrap_or(0)
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use glyphgrid::Grid;
    use glyphwidth::WidthPolicy;

    #[test]
    fn csi_cursor_position() {
        let mut grid = Grid::new(80, 24, WidthPolicy::default());
        let mut p = Parser::new();
        let actions = p.feed(b"\x1b[5;10H");
        apply(&mut grid, &actions);
        assert_eq!(grid.cursor.col, 9);
        assert_eq!(grid.cursor.row, 4);
    }

    #[test]
    fn print_and_newline() {
        let mut grid = Grid::new(80, 24, WidthPolicy::default());
        let mut p = Parser::new();
        let actions = p.feed(b"hi\n");
        apply(&mut grid, &actions);
        assert_eq!(grid.cursor.row, 1);
    }
}
