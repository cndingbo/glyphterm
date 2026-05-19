//! Local PTY terminal using GlyphTerm core (grid + VT parser).
//!
//! Run: `cargo run -p glyphterm-cli`
//! Quit: Ctrl+C

use anyhow::{Context, Result};
use crossterm::{
    cursor::{Hide, MoveTo, Show},
    event::{self, Event, KeyCode, KeyModifiers},
    execute,
    style::{Color, Print, ResetColor, SetForegroundColor},
    terminal::{self, ClearType, EnterAlternateScreen, LeaveAlternateScreen},
};
use glyphgrid::Grid;
use glyphvt::{apply, Parser};
use glyphwidth::WidthPolicy;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{Read, Write};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

fn main() -> Result<()> {
    let cols: u16 = 120;
    let rows: u16 = 32;

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .context("open pty")?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let cmd = CommandBuilder::new(&shell);
    let _child = pair.slave.spawn_command(cmd).context("spawn shell")?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .context("clone pty reader")?;
    let mut writer = pair.master.take_writer().context("pty writer")?;

    let (tx, rx) = mpsc::channel();
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

    terminal::enable_raw_mode()?;
    execute!(std::io::stdout(), EnterAlternateScreen, Hide)?;

    let policy = WidthPolicy::default();
    let mut grid = Grid::new(cols, rows, policy);
    let mut parser = Parser::new();

    let mut running = true;
    while running {
        while let Ok(chunk) = rx.try_recv() {
            let actions = parser.feed(&chunk);
            apply(&mut grid, &actions);
        }

        render_grid(&grid)?;

        if event::poll(Duration::from_millis(16))? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                        running = false;
                    }
                    KeyCode::Char(ch) => {
                        let mut buf = [0u8; 4];
                        let s = ch.encode_utf8(&mut buf);
                        writer.write_all(s.as_bytes())?;
                        writer.flush()?;
                    }
                    _ => {}
                }
            }
        }
    }

    execute!(std::io::stdout(), Show, ResetColor, LeaveAlternateScreen)?;
    terminal::disable_raw_mode()?;
    Ok(())
}

fn render_grid(grid: &Grid) -> Result<()> {
    let mut stdout = std::io::stdout();
    execute!(stdout, terminal::Clear(ClearType::All), MoveTo(0, 0))?;

    for r in 0..grid.rows {
        execute!(stdout, MoveTo(0, r))?;
        for c in 0..grid.cols {
            if let Some(cell) = grid.cell(c, r) {
                if cell.wide_continuation {
                    continue;
                }
                let color = Color::Rgb {
                    r: ((cell.fg >> 16) & 0xFF) as u8,
                    g: ((cell.fg >> 8) & 0xFF) as u8,
                    b: (cell.fg & 0xFF) as u8,
                };
                execute!(stdout, SetForegroundColor(color), Print(cell.ch))?;
            }
        }
    }
    Ok(())
}
