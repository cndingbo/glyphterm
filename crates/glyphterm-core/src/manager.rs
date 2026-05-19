//! Multi-tab session manager.

use crate::session::TerminalSession;
use anyhow::{anyhow, Result};
use std::collections::HashMap;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TabInfo {
    pub id: u64,
    pub title: String,
    pub is_ssh: bool,
}

pub struct SessionManager {
    next_id: u64,
    active: u64,
    sessions: HashMap<u64, TerminalSession>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            next_id: 1,
            active: 0,
            sessions: HashMap::new(),
        }
    }

    pub fn active_id(&self) -> u64 {
        self.active
    }

    pub fn list_tabs(&self) -> Vec<TabInfo> {
        let mut tabs: Vec<_> = self
            .sessions
            .iter()
            .map(|(&id, s)| TabInfo {
                id,
                title: s.title.clone(),
                is_ssh: s.is_ssh(),
            })
            .collect();
        tabs.sort_by_key(|t| t.id);
        tabs
    }

    pub fn create_local(&mut self, cols: u16, rows: u16) -> Result<u64> {
        let id = self.next_id;
        self.next_id += 1;
        let session = TerminalSession::spawn_local(cols, rows)?;
        self.sessions.insert(id, session);
        self.active = id;
        Ok(id)
    }

    pub fn create_ssh(
        &mut self,
        host: &str,
        port: u16,
        user: &str,
        password: Option<&str>,
        cols: u16,
        rows: u16,
    ) -> Result<u64> {
        let id = self.next_id;
        self.next_id += 1;
        let session = TerminalSession::spawn_ssh(host, port, user, password, cols, rows)?;
        self.sessions.insert(id, session);
        self.active = id;
        Ok(id)
    }

    pub fn close(&mut self, id: u64) -> Result<()> {
        if !self.sessions.remove(&id).is_some() {
            return Err(anyhow!("tab not found"));
        }
        if self.sessions.is_empty() {
            self.active = 0;
            return Ok(());
        }
        if self.active == id {
            self.active = *self.sessions.keys().max().unwrap();
        }
        Ok(())
    }

    pub fn set_active(&mut self, id: u64) -> Result<()> {
        if !self.sessions.contains_key(&id) {
            return Err(anyhow!("tab not found"));
        }
        self.active = id;
        Ok(())
    }

    pub fn active_session_mut(&mut self) -> Result<&mut TerminalSession> {
        self.sessions
            .get_mut(&self.active)
            .ok_or_else(|| anyhow!("no active session"))
    }

    pub fn active_session(&self) -> Result<&TerminalSession> {
        self.sessions
            .get(&self.active)
            .ok_or_else(|| anyhow!("no active session"))
    }

    pub fn session_mut(&mut self, id: u64) -> Result<&mut TerminalSession> {
        self.sessions.get_mut(&id).ok_or_else(|| anyhow!("tab not found"))
    }

    pub fn poll_all(&mut self) -> Vec<(u64, bool)> {
        let ids: Vec<u64> = self.sessions.keys().copied().collect();
        let mut out = Vec::new();
        for id in ids {
            if let Some(s) = self.sessions.get_mut(&id) {
                let changed = s.poll();
                out.push((id, changed));
            }
        }
        out
    }

    /// Poll every session and return frames that need rendering.
    pub fn drain_dirty_frames(&mut self) -> Vec<(u64, crate::frame::Frame)> {
        let ids: Vec<u64> = self.sessions.keys().copied().collect();
        let mut out = Vec::new();
        for id in ids {
            if let Some(s) = self.sessions.get_mut(&id) {
                s.poll();
                if s.is_dirty() {
                    let frame = s.frame();
                    s.clear_dirty();
                    out.push((id, frame));
                }
            }
        }
        out
    }

    pub fn resize_active(&mut self, cols: u16, rows: u16) -> Result<()> {
        if let Some(s) = self.sessions.get_mut(&self.active) {
            s.resize(cols, rows)?;
        }
        Ok(())
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::SessionManager;

    #[test]
    fn multiple_local_tabs() {
        let mut mgr = SessionManager::new();
        let a = mgr.create_local(80, 24).unwrap();
        let b = mgr.create_local(80, 24).unwrap();
        assert_ne!(a, b);
        assert_eq!(mgr.list_tabs().len(), 2);
        mgr.set_active(a).unwrap();
        assert_eq!(mgr.active_id(), a);
    }
}
