//! GlyphTerm session layer — PTY, grid, and UI-facing frames.

mod frame;
mod session;

pub use frame::{CellView, Frame, SelectionView};
pub use session::TerminalSession;
