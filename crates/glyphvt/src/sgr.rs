//! SGR (Select Graphic Rendition) — ANSI 16/256/true color.

use glyphgrid::Grid;

pub fn apply_sgr(grid: &mut Grid, args: &[u16]) {
    let mut i = 0;
    while i < args.len() {
        let advance = match args[i] {
            0 => {
                grid.set_pen(glyphgrid::DEFAULT_FG, glyphgrid::DEFAULT_BG, false);
                1
            }
            1 => {
                grid.set_pen(grid.fg, grid.bg, true);
                1
            }
            22 => {
                grid.set_pen(grid.fg, grid.bg, false);
                1
            }
            30..=37 => {
                let fg = ansi_16(args[i] - 30, false);
                grid.set_pen(fg, grid.bg, grid.bold);
                1
            }
            39 => {
                grid.set_pen(glyphgrid::DEFAULT_FG, grid.bg, grid.bold);
                1
            }
            40..=47 => {
                let bg = ansi_16(args[i] - 40, false);
                grid.set_pen(grid.fg, bg, grid.bold);
                1
            }
            49 => {
                grid.set_pen(grid.fg, glyphgrid::DEFAULT_BG, grid.bold);
                1
            }
            90..=97 => {
                let fg = ansi_16(args[i] - 90, true);
                grid.set_pen(fg, grid.bg, grid.bold);
                1
            }
            100..=107 => {
                let bg = ansi_16(args[i] - 100, true);
                grid.set_pen(grid.fg, bg, grid.bold);
                1
            }
            38 => {
                if let Some((n, rgb)) = parse_extended_color(&args[i + 1..]) {
                    grid.set_pen(rgb, grid.bg, grid.bold);
                    1 + n
                } else {
                    1
                }
            }
            48 => {
                if let Some((n, rgb)) = parse_extended_color(&args[i + 1..]) {
                    grid.set_pen(grid.fg, rgb, grid.bold);
                    1 + n
                } else {
                    1
                }
            }
            _ => 1,
        };
        i += advance;
    }
}

/// Slice begins with mode (`5` or `2`), returns (params consumed, rgb).
fn parse_extended_color(args: &[u16]) -> Option<(usize, u32)> {
    if args.is_empty() {
        return None;
    }
    match args[0] {
        5 if args.len() >= 2 => Some((2, palette_256(args[1]))),
        2 if args.len() >= 4 => Some((
            4,
            rgb_u32(
                args[1].min(255) as u8,
                args[2].min(255) as u8,
                args[3].min(255) as u8,
            ),
        )),
        _ => None,
    }
}

fn rgb_u32(r: u8, g: u8, b: u8) -> u32 {
    ((r as u32) << 16) | ((g as u32) << 8) | (b as u32)
}

fn ansi_16(idx: u16, bright: bool) -> u32 {
    const BASE: [u32; 8] = [
        0x000000, 0xCD3131, 0x0DBC79, 0xE5E510, 0x2472C8, 0xBC3FBC, 0x11A8CD, 0xE5E5E5,
    ];
    const BRIGHT: [u32; 8] = [
        0x666666, 0xF14C4C, 0x23D18B, 0xF5F543, 0x3B8EEA, 0xD670D6, 0x29B8DB, 0xFFFFFF,
    ];
    let table = if bright { &BRIGHT } else { &BASE };
    table.get(idx as usize).copied().unwrap_or(0xFFFFFF)
}

/// xterm 256-color palette (0–255).
pub fn palette_256(n: u16) -> u32 {
    let n = n.min(255) as u8;
    match n {
        0..=15 => {
            let bright = n >= 8;
            ansi_16((n % 8) as u16, bright)
        }
        16..=231 => {
            let n = n - 16;
            let r = n / 36;
            let g = (n % 36) / 6;
            let b = n % 6;
            let scale = |c: u8| if c == 0 { 0 } else { (c as u16) * 40 + 55 };
            rgb_u32(scale(r) as u8, scale(g) as u8, scale(b) as u8)
        }
        232..=255 => {
            let grey = (n - 232) as u16 * 10 + 8;
            rgb_u32(grey as u8, grey as u8, grey as u8)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use glyphgrid::Grid;
    use glyphwidth::WidthPolicy;

    #[test]
    fn true_color_foreground() {
        let mut g = Grid::new(10, 2, WidthPolicy::default());
        apply_sgr(&mut g, &[38, 2, 255, 128, 0]);
        assert_eq!(g.fg, rgb_u32(255, 128, 0));
    }

    #[test]
    fn indexed_256_foreground() {
        let mut g = Grid::new(10, 2, WidthPolicy::default());
        apply_sgr(&mut g, &[38, 5, 196]);
        assert_eq!(g.fg, palette_256(196));
    }
}
