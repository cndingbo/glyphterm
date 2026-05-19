use glyphgrid::Grid;
use glyphvt::{apply, Parser};
use glyphwidth::WidthPolicy;

#[test]
fn mixed_cjk_via_parser() {
    let mut grid = Grid::new(80, 24, WidthPolicy::default());
    let mut parser = Parser::new();
    let actions = parser.feed("中文".as_bytes());
    apply(&mut grid, &actions);
    assert_eq!(grid.cursor.col, 4);
}
