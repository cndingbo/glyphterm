//! # glyphwidth
//!
//! Single source of truth for terminal **column** width of UTF-8 text.
//! All terminal grid code must use this crate — never `str::len()` for layout.

use unicode_segmentation::UnicodeSegmentation;
use unicode_width::UnicodeWidthChar;

/// How to treat East Asian **Ambiguous** characters (UAX #11 category A).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum AmbiguousWidth {
    /// One column (recommended default; matches most Western-oriented TUIs).
    #[default]
    Narrow,
    /// Two columns (aligns with some CJK locale expectations).
    Wide,
}

/// Terminal-wide width policy. Fixed for a session unless explicitly reconfigured.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WidthPolicy {
    pub ambiguous: AmbiguousWidth,
    /// When true, emoji presentation sequences default to 2 columns.
    pub emoji_wide: bool,
}

impl Default for WidthPolicy {
    fn default() -> Self {
        Self {
            ambiguous: AmbiguousWidth::Narrow,
            emoji_wide: true,
        }
    }
}

/// Measured grapheme cluster for grid placement.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClusterWidth {
    pub text: String,
    pub cols: u8,
}

/// Display width in terminal columns for one grapheme cluster.
pub fn cluster_width(cluster: &str, policy: WidthPolicy) -> u8 {
    if cluster.is_empty() {
        return 0;
    }

    // Control characters: don't occupy visible cells (handled by VT layer).
    if cluster.chars().all(|c| c.is_control() && c != '\t') {
        return 0;
    }

    if cluster == "\t" {
        return 1; // actual tab stops handled in grid
    }

    let mut cols: usize = 0;
    for ch in cluster.chars() {
        cols += char_width(ch, policy);
    }

    // Grapheme clusters for emoji ZWJ sequences: unicode-width sums components;
    // cap presentation width when emoji_wide (common terminal behavior).
    if policy.emoji_wide && is_emoji_presentation(cluster) && cols < 2 {
        cols = 2;
    }

    cols.min(255) as u8
}

fn char_width(ch: char, policy: WidthPolicy) -> usize {
    if ch.is_control() {
        return 0;
    }

    match unicode_width::UnicodeWidthChar::width(ch) {
        Some(0) => 0,
        Some(1) => {
            if is_ambiguous(ch) && policy.ambiguous == AmbiguousWidth::Wide {
                2
            } else {
                1
            }
        }
        Some(2) => 2,
        Some(_) => 2,
        None => 1,
    }
}

/// Ambiguous width characters (subset check via unicode-width + codepoint ranges).
fn is_ambiguous(ch: char) -> bool {
    // unicode-width uses East Asian Width; width 1 for ambiguous in neutral context.
    // Double-check common ambiguous blocks when width reports 1.
    matches!(ch as u32,
        0x00A1..=0x00A7 | 0x00A9..=0x00AC | 0x00AE..=0x00B0 |
        0x00B2..=0x00B3 | 0x00B5..=0x00D6 | 0x00D8..=0x00F6 |
        0x00F8..=0x00FF | 0x0370..=0x03FF
    ) || UnicodeWidthChar::width(ch) == Some(1) && is_eaw_ambiguous(ch)
}

fn is_eaw_ambiguous(ch: char) -> bool {
    // Simplified: rely on unicode-width for W/F; for A, many terminals use tables.
    // Full table ships in tests/golden later.
    let cp = ch as u32;
    (0x2190..=0x21FF).contains(&cp) || (0x2200..=0x22FF).contains(&cp)
}

fn is_emoji_presentation(s: &str) -> bool {
    s.chars().any(|c| {
        let cp = c as u32;
        (0x1F300..=0x1FAFF).contains(&cp) || (0x2600..=0x27BF).contains(&cp)
    })
}

/// Split `text` into grapheme clusters with column widths.
pub fn measure(text: &str, policy: WidthPolicy) -> Vec<ClusterWidth> {
    text.graphemes(true)
        .map(|g| {
            let cols = cluster_width(g, policy);
            ClusterWidth {
                text: g.to_string(),
                cols,
            }
        })
        .collect()
}

/// Total display columns for `text`.
pub fn display_width(text: &str, policy: WidthPolicy) -> usize {
    measure(text, policy)
        .iter()
        .map(|c| c.cols as usize)
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cjk_is_wide() {
        let policy = WidthPolicy::default();
        assert_eq!(cluster_width("中", policy), 2);
        assert_eq!(cluster_width("文", policy), 2);
        assert_eq!(display_width("中文", policy), 4);
    }

    #[test]
    fn ascii_is_narrow() {
        let policy = WidthPolicy::default();
        assert_eq!(cluster_width("A", policy), 1);
        assert_eq!(display_width("Hello", policy), 5);
    }

    #[test]
    fn mixed_cjk_latin() {
        let policy = WidthPolicy::default();
        assert_eq!(display_width("中文ABC", policy), 7); // 4 + 3
    }

    #[test]
    fn ambiguous_wide_policy() {
        let policy = WidthPolicy {
            ambiguous: AmbiguousWidth::Wide,
            emoji_wide: true,
        };
        // Greek alpha — ambiguous in many terminals
        let w = cluster_width("α", policy);
        assert!(w >= 1);
    }

    #[test]
    fn emoji_default_two_cols() {
        let policy = WidthPolicy::default();
        let w = cluster_width("🙂", policy);
        assert_eq!(w, 2);
    }
}
