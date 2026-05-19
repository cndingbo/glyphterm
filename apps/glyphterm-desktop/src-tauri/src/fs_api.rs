//! Local filesystem access scoped to workspace root (IDE file tree + editor).

use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

pub fn default_workspace_root() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."))
}

/// Resolve `path` under `root`; rejects paths outside the workspace.
pub fn resolve_under_root(root: &Path, path: &str) -> Result<PathBuf, String> {
    let root = root
        .canonicalize()
        .map_err(|e| format!("workspace root invalid: {e}"))?;

    if path.contains("..") {
        return Err("path escapes workspace (..)".into());
    }

    let candidate = if Path::new(path).is_absolute() {
        PathBuf::from(path)
    } else {
        root.join(path)
    };

    let resolved = if candidate.exists() {
        candidate
            .canonicalize()
            .map_err(|e| format!("canonicalize failed: {e}"))?
    } else {
        let parent = candidate
            .parent()
            .ok_or_else(|| "invalid path".to_string())?
            .canonicalize()
            .map_err(|e| format!("parent missing: {e}"))?;
        let name = candidate
            .file_name()
            .ok_or_else(|| "invalid file name".to_string())?;
        parent.join(name)
    };

    if !resolved.starts_with(&root) {
        return Err("path outside workspace".into());
    }
    Ok(resolved)
}

pub fn list_directory(root: &Path, path: &str) -> Result<Vec<FsEntry>, String> {
    let dir = resolve_under_root(root, path)?;
    if !dir.is_dir() {
        return Err("not a directory".into());
    }

    let mut entries = Vec::new();
    let read = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for item in read {
        let item = item.map_err(|e| e.to_string())?;
        let meta = item.metadata().map_err(|e| e.to_string())?;
        let name = item.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') && name != ".git" {
            continue;
        }
        let path = item.path().to_string_lossy().into_owned();
        entries.push(FsEntry {
            name,
            path,
            is_dir: meta.is_dir(),
        });
    }
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

pub fn read_text_file(root: &Path, path: &str) -> Result<String, String> {
    let file = resolve_under_root(root, path)?;
    if file.is_dir() {
        return Err("is a directory".into());
    }
    std::fs::read_to_string(&file).map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize)]
pub struct FsSearchHit {
    pub path: String,
    pub name: String,
    pub relative: String,
}

const SKIP_DIR_NAMES: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    "__pycache__",
    ".next",
    ".turbo",
    "coverage",
    ".cache",
    "vendor",
    ".idea",
    ".vscode",
    "out",
];

const MAX_SCAN_ENTRIES: usize = 14_000;

fn should_skip_dir(name: &str) -> bool {
    SKIP_DIR_NAMES.contains(&name)
}

fn matches_query(name: &str, relative: &str, query: &str) -> bool {
    if query.is_empty() {
        return true;
    }
    let q = query.to_lowercase();
    name.to_lowercase().contains(&q) || relative.to_lowercase().contains(&q)
}

fn score_hit(name: &str, relative: &str, query: &str) -> i32 {
    if query.is_empty() {
        return 1;
    }
    let q = query.to_lowercase();
    let name_l = name.to_lowercase();
    let rel_l = relative.to_lowercase();
    if name_l == q {
        return 100;
    }
    if name_l.starts_with(&q) {
        return 80;
    }
    if name_l.contains(&q) {
        return 60;
    }
    if rel_l.contains(&q) {
        return 40;
    }
    0
}

fn search_dir(
    root: &Path,
    dir: &Path,
    relative: &str,
    query: &str,
    hits: &mut Vec<FsSearchHit>,
    scanned: &mut usize,
    max_results: usize,
) {
    if hits.len() >= max_results || *scanned >= MAX_SCAN_ENTRIES {
        return;
    }
    let read = match std::fs::read_dir(dir) {
        Ok(r) => r,
        Err(_) => return,
    };
    for item in read.flatten() {
        if hits.len() >= max_results || *scanned >= MAX_SCAN_ENTRIES {
            break;
        }
        *scanned += 1;
        let name = item.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let path = item.path();
        let Ok(meta) = item.metadata() else {
            continue;
        };
        if meta.is_dir() {
            if should_skip_dir(&name) {
                continue;
            }
            let child_rel = if relative.is_empty() {
                name.clone()
            } else {
                format!("{relative}/{name}")
            };
            search_dir(root, &path, &child_rel, query, hits, scanned, max_results);
        } else if meta.is_file() {
            if !matches_query(&name, relative, query) {
                continue;
            }
            let rel = if relative.is_empty() {
                name.clone()
            } else {
                format!("{relative}/{name}")
            };
            hits.push(FsSearchHit {
                path: path.to_string_lossy().into_owned(),
                name,
                relative: rel,
            });
        }
    }
}

/// Fuzzy file search under workspace root (for Quick Open).
pub fn search_files(root: &Path, query: &str, limit: usize) -> Result<Vec<FsSearchHit>, String> {
    let root = root
        .canonicalize()
        .map_err(|e| format!("workspace root invalid: {e}"))?;
    let q = query.trim();
    let limit = limit.clamp(1, 200);
    let mut hits = Vec::new();
    let mut scanned = 0;
    search_dir(&root, &root, "", q, &mut hits, &mut scanned, limit * 4);
    let mut scored: Vec<(i32, FsSearchHit)> = hits
        .into_iter()
        .map(|h| (score_hit(&h.name, &h.relative, q), h))
        .filter(|(s, _)| *s > 0)
        .collect();
    scored.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.relative.cmp(&b.1.relative)));
    Ok(scored.into_iter().take(limit).map(|(_, h)| h).collect())
}

pub fn write_text_file(root: &Path, path: &str, content: &str) -> Result<(), String> {
    let file = resolve_under_root(root, path)?;
    if file.is_dir() {
        return Err("is a directory".into());
    }
    if let Some(parent) = file.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&file, content).map_err(|e| e.to_string())
}
