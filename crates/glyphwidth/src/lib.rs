//! # glyphwidth
//!
//! Single source of truth for terminal **column** width of UTF-8 text.
//! All terminal grid code must use this crate — never `str::len()` for layout.

use unicode_segmentation::UnicodeSegmentation;
use unicode_width::{UnicodeWidthChar, UnicodeWidthStr};

/// How to treat East Asian **Ambiguous** characters (UAX #11 category A).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum AmbiguousWidth {
    /// One column (recommended default).
    #[default]
    Narrow,
    /// Two columns.
    Wide,
}

/// Terminal-wide width policy. Fixed for a session unless explicitly reconfigured.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WidthPolicy {
    pub ambiguous: AmbiguousWidth,
    /// When true, emoji presentation sequences default to at least 2 columns.
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

    if cluster.chars().all(|c| c.is_control() && c != '\t') {
        return 0;
    }

    if cluster == "\t" {
        return 1;
    }

    let mut cols = cluster_width_raw(cluster, policy);

    if policy.emoji_wide && is_emoji_cluster(cluster) && cols < 2 {
        cols = 2;
    }

    cols.min(255) as u8
}

fn cluster_width_raw(cluster: &str, policy: WidthPolicy) -> usize {
    if policy.ambiguous == AmbiguousWidth::Narrow {
        return cluster.width();
    }

    cluster
        .chars()
        .map(|ch| char_width_ambiguous(ch, policy))
        .sum()
}

fn char_width_ambiguous(ch: char, policy: WidthPolicy) -> usize {
    if ch.is_control() {
        return 0;
    }
    let base = UnicodeWidthChar::width(ch).unwrap_or(1);
    if base == 1 && policy.ambiguous == AmbiguousWidth::Wide && is_ambiguous_char(ch) {
        2
    } else {
        base
    }
}

/// Unicode East Asian Ambiguous — width 1 in neutral context, configurable to 2.
fn is_ambiguous_char(ch: char) -> bool {
    let cp = ch as u32;
    // UAX #11 ambiguous blocks (representative; unicode-width handles most via width())
    matches!(cp,
        0x00A1..=0x00A7 | 0x00A9..=0x00AC | 0x00AE..=0x00AF |
        0x00B2..=0x00B3 | 0x00B5..=0x00B7 | 0x00B9..=0x00BA |
        0x00BC..=0x00BE | 0x00C0..=0x00D6 | 0x00D8..=0x00F6 |
        0x00F8..=0x00FF | 0x0100..=0x017F | 0x0370..=0x03FF |
        0x2190..=0x21FF | 0x2200..=0x22FF
    )
}

fn is_emoji_cluster(s: &str) -> bool {
    s.chars().any(|c| {
        let cp = c as u32;
        (0x1F300..=0x1FAFF).contains(&cp)
            || (0x2600..=0x27BF).contains(&cp)
            || cp == 0x200D // ZWJ
    })
}

/// Split `text` into grapheme clusters with column widths.
pub fn measure(text: &str, policy: WidthPolicy) -> Vec<ClusterWidth> {
    text.graphemes(true)
        .map(|g| ClusterWidth {
            cols: cluster_width(g, policy),
            text: g.to_string(),
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
        assert_eq!(display_width("中文ABC", policy), 7);
    }

    #[test]
    fn ambiguous_wide_policy() {
        let policy = WidthPolicy {
            ambiguous: AmbiguousWidth::Wide,
            emoji_wide: true,
        };
        assert_eq!(cluster_width("α", policy), 2);
    }

    #[test]
    fn emoji_default_two_cols() {
        let policy = WidthPolicy::default();
        assert_eq!(cluster_width("🙂", policy), 2);
    }

    #[test]
    fn combining_mark_zero_extra_cols() {
        let policy = WidthPolicy::default();
        // e + combining acute — one grapheme, one column
        let s = "e\u{0301}";
        assert_eq!(cluster_width(s, policy), 1);
    }
}
