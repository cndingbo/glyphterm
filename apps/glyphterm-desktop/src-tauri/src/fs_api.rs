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
