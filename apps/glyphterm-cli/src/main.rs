//! Local PTY terminal using GlyphTerm core (grid + VT parser).
//!
//! Run: `cargo run -p glyphterm-cli`
//! Quit: Ctrl+C

use anyhow::Result;
use crossterm::{
    cursor::{Hide, MoveTo, Show},
    event::{self, Event, KeyCode, KeyModifiers},
    execute,
    style::{Color, Print, ResetColor, SetForegroundColor},
    terminal::{self, ClearType, EnterAlternateScreen, LeaveAlternateScreen},
};
use glyphterm_core::TerminalSession;
use std::time::Duration;

fn main() -> Result<()> {
    let cols: u16 = 120;
    let rows: u16 = 32;

    terminal::enable_raw_mode()?;
    execute!(std::io::stdout(), EnterAlternateScreen, Hide)?;

    let mut session = TerminalSession::spawn_local(cols, rows)?;

    let mut running = true;
    while running {
        session.poll();
        render_session(&session)?;

        if event::poll(Duration::from_millis(16))? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                        running = false;
                    }
                    KeyCode::Char(ch) => {
                        let mut buf = [0u8; 4];
                        session.write_input(ch.encode_utf8(&mut buf).as_bytes())?;
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

fn render_session(session: &TerminalSession) -> Result<()> {
    let frame = session.frame();
    let mut stdout = std::io::stdout();
    execute!(stdout, terminal::Clear(ClearType::All), MoveTo(0, 0))?;

    for r in 0..frame.rows {
        execute!(stdout, MoveTo(0, r))?;
        for c in 0..frame.cols {
            let idx = (r as usize) * frame.cols as usize + c as usize;
            let cell = &frame.cells[idx];
            if cell.wide_continuation {
                continue;
            }
            if cell.ch.is_empty() {
                continue;
            }
            let ch = cell.ch.chars().next().unwrap_or(' ');
            let color = Color::Rgb {
                r: ((cell.fg >> 16) & 0xFF) as u8,
                g: ((cell.fg >> 8) & 0xFF) as u8,
                b: (cell.fg & 0xFF) as u8,
            };
            execute!(stdout, SetForegroundColor(color), Print(ch))?;
        }
    }
    Ok(())
}
