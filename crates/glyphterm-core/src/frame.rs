//! Serializable terminal frame for UI rendering.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionView {
    pub start_col: u16,
    pub start_row: u16,
    pub end_col: u16,
    pub end_row: u16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Frame {
    pub cols: u16,
    pub rows: u16,
    pub cursor_col: u16,
    pub cursor_row: u16,
    pub scrollback_lines: usize,
    pub cells: Vec<CellView>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selection: Option<SelectionView>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CellView {
    pub ch: String,
    pub fg: u32,
    pub bg: u32,
    pub bold: bool,
    #[serde(rename = "wideCont")]
    pub wide_continuation: bool,
}

impl Frame {
    pub fn rgb_hex(fg: u32) -> String {
        format!("#{:06X}", fg & 0xFFFFFF)
    }
}
