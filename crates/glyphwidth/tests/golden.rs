//! Golden-file tests for display width (see `tests/golden/*.txt`).

use glyphwidth::{display_width, measure, WidthPolicy};
use std::fs;
use std::path::PathBuf;

fn golden_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/golden")
}

#[test]
fn golden_mixed_line() {
    let path = golden_dir().join("mixed_line.txt");
    let raw = fs::read_to_string(&path).expect("read golden file");
    let (text, expected) = parse_golden(&raw);
    let policy = WidthPolicy::default();
    assert_eq!(
        display_width(text.trim_end(), policy),
        expected,
        "width mismatch for {:?}",
        text.trim_end()
    );
}

#[test]
fn golden_cjk_sentence() {
    let path = golden_dir().join("cjk_sentence.txt");
    let raw = fs::read_to_string(&path).expect("read golden file");
    let (text, expected) = parse_golden(&raw);
    let policy = WidthPolicy::default();
    assert_eq!(display_width(text.trim_end(), policy), expected);
    let clusters = measure(text.trim_end(), policy);
    assert!(!clusters.is_empty());
}

#[test]
fn golden_emoji_zwj() {
    let path = golden_dir().join("emoji_zwj.txt");
    let raw = fs::read_to_string(&path).expect("read golden file");
    let (text, expected) = parse_golden(&raw);
    let policy = WidthPolicy::default();
    assert_eq!(display_width(text.trim_end(), policy), expected);
}

/// Format: first line = text, second line = `# width=N`
fn parse_golden(raw: &str) -> (&str, usize) {
    let mut lines = raw.lines();
    let text = lines.next().expect("text line");
    let meta = lines.next().expect("width meta");
    let expected = meta
        .strip_prefix("# width=")
        .expect("meta format # width=N")
        .parse::<usize>()
        .expect("parse width");
    (text, expected)
}
