//! GlyphTerm session layer — PTY, SSH, multi-tab, UI-facing frames.

mod frame;
mod local;
mod manager;
mod session;
mod ssh;

pub use frame::{CellView, Frame, FramePayload, SelectionView};
pub use manager::{SessionManager, TabInfo};
pub use session::TerminalSession;
