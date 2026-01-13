//! Authorization middleware and permission checking utilities.
//!
//! This module provides:
//! - `requireAuth` middleware for authenticated routes
//! - `requirePermission(permission_key)` middleware factory
//! - Permission resolution: user -> role -> permissions
//! - Workspace context handling from route params or headers
//! - "Own*" permission logic for task/attempt ownership
//! - Helper functions: `has_permission`, `can_access_task`, `can_edit_task`

use axum::{
    extract::{Path, Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use db::models::{task::Task, workspace::Workspace};
use deployment::Deployment;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use ts_rs::TS;
use uuid::Uuid;

use crate::DeploymentImpl;

/// Permission keys for authorization checks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    // Task permissions
    TaskRead,
    TaskCreate,
    TaskUpdate,
    TaskDelete,
    OwnTaskRead,
    OwnTaskUpdate,
    OwnTaskDelete,

    // Workspace permissions
    WorkspaceRead,
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceDelete,
    OwnWorkspaceRead,
    OwnWorkspaceUpdate,
    OwnWorkspaceDelete,

    // Session/Attempt permissions
    SessionRead,
    SessionCreate,
    SessionUpdate,
    SessionDelete,
    OwnSessionRead,
    OwnSessionUpdate,
    OwnSessionDelete,

    // Project permissions
    ProjectRead,
    ProjectCreate,
    ProjectUpdate,
    ProjectDelete,

    // Admin permissions
    AdminAccess,
}

/// Role definitions with associated permissions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    /// Full access to all resources
    Admin,
    /// Standard member with read/write access to own resources
    Member,
    /// Read-only access
    Viewer,
}

impl Role {
    /// Get the set of permissions for this role.
    pub fn permissions(&self) -> HashSet<Permission> {
        match self {
            Role::Admin => {
                let mut perms = HashSet::new();
                // Admin has all permissions
                perms.insert(Permission::TaskRead);
                perms.insert(Permission::TaskCreate);
                perms.insert(Permission::TaskUpdate);
                perms.insert(Permission::TaskDelete);
                perms.insert(Permission::OwnTaskRead);
                perms.insert(Permission::OwnTaskUpdate);
                perms.insert(Permission::OwnTaskDelete);
                perms.insert(Permission::WorkspaceRead);
                perms.insert(Permission::WorkspaceCreate);
                perms.insert(Permission::WorkspaceUpdate);
                perms.insert(Permission::WorkspaceDelete);
                perms.insert(Permission::OwnWorkspaceRead);
                perms.insert(Permission::OwnWorkspaceUpdate);
                perms.insert(Permission::OwnWorkspaceDelete);
                perms.insert(Permission::SessionRead);
                perms.insert(Permission::SessionCreate);
                perms.insert(Permission::SessionUpdate);
                perms.insert(Permission::SessionDelete);
                perms.insert(Permission::OwnSessionRead);
                perms.insert(Permission::OwnSessionUpdate);
                perms.insert(Permission::OwnSessionDelete);
                perms.insert(Permission::ProjectRead);
                perms.insert(Permission::ProjectCreate);
                perms.insert(Permission::ProjectUpdate);
                perms.insert(Permission::ProjectDelete);
                perms.insert(Permission::AdminAccess);
                perms
            }
            Role::Member => {
                let mut perms = HashSet::new();
                // Member has read access to all, write access to own resources
                perms.insert(Permission::TaskRead);
                perms.insert(Permission::TaskCreate);
                perms.insert(Permission::OwnTaskRead);
                perms.insert(Permission::OwnTaskUpdate);
                perms.insert(Permission::OwnTaskDelete);
                perms.insert(Permission::WorkspaceRead);
                perms.insert(Permission::WorkspaceCreate);
                perms.insert(Permission::OwnWorkspaceRead);
                perms.insert(Permission::OwnWorkspaceUpdate);
                perms.insert(Permission::OwnWorkspaceDelete);
                perms.insert(Permission::SessionRead);
                perms.insert(Permission::SessionCreate);
                perms.insert(Permission::OwnSessionRead);
                perms.insert(Permission::OwnSessionUpdate);
                perms.insert(Permission::OwnSessionDelete);
                perms.insert(Permission::ProjectRead);
                perms
            }
            Role::Viewer => {
                let mut perms = HashSet::new();
                // Viewer has read-only access
                perms.insert(Permission::TaskRead);
                perms.insert(Permission::OwnTaskRead);
                perms.insert(Permission::WorkspaceRead);
                perms.insert(Permission::OwnWorkspaceRead);
                perms.insert(Permission::SessionRead);
                perms.insert(Permission::OwnSessionRead);
                perms.insert(Permission::ProjectRead);
                perms
            }
        }
    }
}

/// User context for authorization, extracted from request.
#[derive(Debug, Clone)]
pub struct AuthContext {
    pub user_id: Option<Uuid>,
    pub role: Role,
    pub workspace_id: Option<Uuid>,
}

impl Default for AuthContext {
    fn default() -> Self {
        Self {
            user_id: None,
            // Default to Admin for local deployment (no auth required by default)
            role: Role::Admin,
            workspace_id: None,
        }
    }
}

impl AuthContext {
    /// Create a new auth context with the given user ID and role.
    pub fn new(user_id: Option<Uuid>, role: Role) -> Self {
        Self {
            user_id,
            role,
            workspace_id: None,
        }
    }

    /// Set the workspace context.
    pub fn with_workspace(mut self, workspace_id: Option<Uuid>) -> Self {
        self.workspace_id = workspace_id;
        self
    }

    /// Check if the user has the given permission.
    pub fn has_permission(&self, permission: Permission) -> bool {
        self.role.permissions().contains(&permission)
    }

    /// Check if the user has any of the given permissions.
    pub fn has_any_permission(&self, permissions: &[Permission]) -> bool {
        let user_perms = self.role.permissions();
        permissions.iter().any(|p| user_perms.contains(p))
    }

    /// Check if the user has all of the given permissions.
    pub fn has_all_permissions(&self, permissions: &[Permission]) -> bool {
        let user_perms = self.role.permissions();
        permissions.iter().all(|p| user_perms.contains(p))
    }
}

/// Header name for workspace context.
pub const WORKSPACE_HEADER: &str = "x-workspace-id";

/// Extract workspace ID from headers or path parameters.
fn extract_workspace_id(headers: &HeaderMap, path_workspace_id: Option<Uuid>) -> Option<Uuid> {
    // First try path parameter
    if let Some(id) = path_workspace_id {
        return Some(id);
    }

    // Then try header
    headers
        .get(WORKSPACE_HEADER)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
}

/// Middleware that requires authentication.
/// For local deployment, this creates a default admin context.
/// For remote deployment, this would validate JWT tokens.
pub async fn require_auth(mut request: Request, next: Next) -> Result<Response, StatusCode> {
    // For local deployment, we use a default admin context
    // In a remote deployment, this would validate JWT and extract user info
    let auth_context = AuthContext::default();

    // Try to extract workspace ID from headers
    let workspace_id = extract_workspace_id(request.headers(), None);
    let auth_context = auth_context.with_workspace(workspace_id);

    request.extensions_mut().insert(auth_context);
    Ok(next.run(request).await)
}

/// Middleware factory that requires a specific permission.
pub fn require_permission(
    permission: Permission,
) -> impl Fn(Request, Next) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Response, StatusCode>> + Send>>
       + Clone
       + Send
       + 'static {
    move |request: Request, next: Next| {
        let permission = permission;
        Box::pin(async move { require_permission_inner(request, next, permission).await })
    }
}

async fn require_permission_inner(
    request: Request,
    next: Next,
    permission: Permission,
) -> Result<Response, StatusCode> {
    let auth_context = request
        .extensions()
        .get::<AuthContext>()
        .cloned()
        .unwrap_or_default();

    if !auth_context.has_permission(permission) {
        tracing::warn!(
            ?permission,
            role = ?auth_context.role,
            "Permission denied"
        );
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(request).await)
}

/// Check if a user has a specific permission.
pub fn has_permission(auth_context: &AuthContext, permission: Permission) -> bool {
    auth_context.has_permission(permission)
}

/// Check if a user can access a task.
/// Returns true if:
/// - User has TaskRead permission (can read all tasks), OR
/// - User has OwnTaskRead permission AND is the task owner
pub async fn can_access_task(
    pool: &sqlx::SqlitePool,
    auth_context: &AuthContext,
    task_id: Uuid,
) -> bool {
    // Admin and users with TaskRead can access any task
    if auth_context.has_permission(Permission::TaskRead) {
        return true;
    }

    // Check own task access
    if auth_context.has_permission(Permission::OwnTaskRead) {
        return is_task_owner(pool, auth_context, task_id).await;
    }

    false
}

/// Check if a user can edit a task.
/// Returns true if:
/// - User has TaskUpdate permission (can update all tasks), OR
/// - User has OwnTaskUpdate permission AND is the task owner
pub async fn can_edit_task(
    pool: &sqlx::SqlitePool,
    auth_context: &AuthContext,
    task_id: Uuid,
) -> bool {
    // Admin and users with TaskUpdate can edit any task
    if auth_context.has_permission(Permission::TaskUpdate) {
        return true;
    }

    // Check own task edit access
    if auth_context.has_permission(Permission::OwnTaskUpdate) {
        return is_task_owner(pool, auth_context, task_id).await;
    }

    false
}

/// Check if a user can delete a task.
/// Returns true if:
/// - User has TaskDelete permission (can delete all tasks), OR
/// - User has OwnTaskDelete permission AND is the task owner
pub async fn can_delete_task(
    pool: &sqlx::SqlitePool,
    auth_context: &AuthContext,
    task_id: Uuid,
) -> bool {
    // Admin and users with TaskDelete can delete any task
    if auth_context.has_permission(Permission::TaskDelete) {
        return true;
    }

    // Check own task delete access
    if auth_context.has_permission(Permission::OwnTaskDelete) {
        return is_task_owner(pool, auth_context, task_id).await;
    }

    false
}

/// Check if a user can access a workspace.
pub async fn can_access_workspace(
    pool: &sqlx::SqlitePool,
    auth_context: &AuthContext,
    workspace_id: Uuid,
) -> bool {
    // Admin and users with WorkspaceRead can access any workspace
    if auth_context.has_permission(Permission::WorkspaceRead) {
        return true;
    }

    // Check own workspace access
    if auth_context.has_permission(Permission::OwnWorkspaceRead) {
        return is_workspace_owner(pool, auth_context, workspace_id).await;
    }

    false
}

/// Check if a user can edit a workspace.
pub async fn can_edit_workspace(
    pool: &sqlx::SqlitePool,
    auth_context: &AuthContext,
    workspace_id: Uuid,
) -> bool {
    // Admin and users with WorkspaceUpdate can edit any workspace
    if auth_context.has_permission(Permission::WorkspaceUpdate) {
        return true;
    }

    // Check own workspace edit access
    if auth_context.has_permission(Permission::OwnWorkspaceUpdate) {
        return is_workspace_owner(pool, auth_context, workspace_id).await;
    }

    false
}

/// Check if a user can delete a workspace.
pub async fn can_delete_workspace(
    pool: &sqlx::SqlitePool,
    auth_context: &AuthContext,
    workspace_id: Uuid,
) -> bool {
    // Admin and users with WorkspaceDelete can delete any workspace
    if auth_context.has_permission(Permission::WorkspaceDelete) {
        return true;
    }

    // Check own workspace delete access
    if auth_context.has_permission(Permission::OwnWorkspaceDelete) {
        return is_workspace_owner(pool, auth_context, workspace_id).await;
    }

    false
}

/// Check if a user can access a session/attempt.
pub async fn can_access_session(
    pool: &sqlx::SqlitePool,
    auth_context: &AuthContext,
    session_id: Uuid,
) -> bool {
    // Admin and users with SessionRead can access any session
    if auth_context.has_permission(Permission::SessionRead) {
        return true;
    }

    // Check own session access
    if auth_context.has_permission(Permission::OwnSessionRead) {
        return is_session_owner(pool, auth_context, session_id).await;
    }

    false
}

/// Check if a user can edit a session/attempt.
pub async fn can_edit_session(
    pool: &sqlx::SqlitePool,
    auth_context: &AuthContext,
    session_id: Uuid,
) -> bool {
    // Admin and users with SessionUpdate can edit any session
    if auth_context.has_permission(Permission::SessionUpdate) {
        return true;
    }

    // Check own session edit access
    if auth_context.has_permission(Permission::OwnSessionUpdate) {
        return is_session_owner(pool, auth_context, session_id).await;
    }

    false
}

/// Check if a user owns a task.
/// In local deployment without user tracking, this returns true.
/// In a multi-user setup, this would check task.created_by or task.assigned_to.
async fn is_task_owner(
    _pool: &sqlx::SqlitePool,
    _auth_context: &AuthContext,
    _task_id: Uuid,
) -> bool {
    // For local deployment, we don't track task ownership
    // In a multi-user setup, this would query the task and check ownership fields
    true
}

/// Check if a user owns a workspace.
/// In local deployment without user tracking, this returns true.
/// In a multi-user setup, this would check workspace.created_by.
async fn is_workspace_owner(
    _pool: &sqlx::SqlitePool,
    _auth_context: &AuthContext,
    _workspace_id: Uuid,
) -> bool {
    // For local deployment, we don't track workspace ownership
    // In a multi-user setup, this would query the workspace and check ownership fields
    true
}

/// Check if a user owns a session.
/// In local deployment without user tracking, this returns true.
/// In a multi-user setup, this would check session.created_by or via workspace ownership.
async fn is_session_owner(
    _pool: &sqlx::SqlitePool,
    _auth_context: &AuthContext,
    _session_id: Uuid,
) -> bool {
    // For local deployment, we don't track session ownership
    // In a multi-user setup, this would query the session and check ownership fields
    true
}

/// Middleware that loads workspace context from path parameter and adds it to auth context.
pub async fn load_workspace_auth_context(
    State(deployment): State<DeploymentImpl>,
    Path(workspace_id): Path<Uuid>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Load the workspace from the database to validate it exists
    let workspace = match Workspace::find_by_id(&deployment.db().pool, workspace_id).await {
        Ok(Some(w)) => w,
        Ok(None) => {
            tracing::warn!("Workspace {} not found", workspace_id);
            return Err(StatusCode::NOT_FOUND);
        }
        Err(e) => {
            tracing::error!("Failed to fetch Workspace {}: {}", workspace_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Update auth context with workspace ID
    let auth_context = request
        .extensions()
        .get::<AuthContext>()
        .cloned()
        .unwrap_or_default()
        .with_workspace(Some(workspace_id));

    request.extensions_mut().insert(auth_context);
    request.extensions_mut().insert(workspace);

    Ok(next.run(request).await)
}

/// Middleware that loads task context and validates access.
pub async fn load_task_auth_context(
    State(deployment): State<DeploymentImpl>,
    Path(task_id): Path<Uuid>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Load the task from the database
    let task = match Task::find_by_id(&deployment.db().pool, task_id).await {
        Ok(Some(t)) => t,
        Ok(None) => {
            tracing::warn!("Task {} not found", task_id);
            return Err(StatusCode::NOT_FOUND);
        }
        Err(e) => {
            tracing::error!("Failed to fetch Task {}: {}", task_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Get auth context
    let auth_context = request
        .extensions()
        .get::<AuthContext>()
        .cloned()
        .unwrap_or_default();

    // Check task access
    if !can_access_task(&deployment.db().pool, &auth_context, task_id).await {
        tracing::warn!("Access denied for task {}", task_id);
        return Err(StatusCode::FORBIDDEN);
    }

    request.extensions_mut().insert(task);

    Ok(next.run(request).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_admin_has_all_permissions() {
        let auth = AuthContext::new(Some(Uuid::new_v4()), Role::Admin);
        assert!(auth.has_permission(Permission::TaskRead));
        assert!(auth.has_permission(Permission::TaskCreate));
        assert!(auth.has_permission(Permission::TaskUpdate));
        assert!(auth.has_permission(Permission::TaskDelete));
        assert!(auth.has_permission(Permission::AdminAccess));
    }

    #[test]
    fn test_member_permissions() {
        let auth = AuthContext::new(Some(Uuid::new_v4()), Role::Member);
        assert!(auth.has_permission(Permission::TaskRead));
        assert!(auth.has_permission(Permission::TaskCreate));
        assert!(!auth.has_permission(Permission::TaskUpdate));
        assert!(!auth.has_permission(Permission::TaskDelete));
        assert!(auth.has_permission(Permission::OwnTaskUpdate));
        assert!(auth.has_permission(Permission::OwnTaskDelete));
        assert!(!auth.has_permission(Permission::AdminAccess));
    }

    #[test]
    fn test_viewer_permissions() {
        let auth = AuthContext::new(Some(Uuid::new_v4()), Role::Viewer);
        assert!(auth.has_permission(Permission::TaskRead));
        assert!(!auth.has_permission(Permission::TaskCreate));
        assert!(!auth.has_permission(Permission::TaskUpdate));
        assert!(!auth.has_permission(Permission::TaskDelete));
        assert!(!auth.has_permission(Permission::AdminAccess));
    }

    #[test]
    fn test_has_any_permission() {
        let auth = AuthContext::new(Some(Uuid::new_v4()), Role::Viewer);
        assert!(auth.has_any_permission(&[Permission::TaskRead, Permission::TaskCreate]));
        assert!(!auth.has_any_permission(&[Permission::TaskUpdate, Permission::TaskDelete]));
    }

    #[test]
    fn test_has_all_permissions() {
        let auth = AuthContext::new(Some(Uuid::new_v4()), Role::Admin);
        assert!(auth.has_all_permissions(&[Permission::TaskRead, Permission::TaskCreate]));
        assert!(auth.has_all_permissions(&[
            Permission::TaskRead,
            Permission::TaskCreate,
            Permission::TaskUpdate,
            Permission::TaskDelete
        ]));

        let viewer = AuthContext::new(Some(Uuid::new_v4()), Role::Viewer);
        assert!(!viewer.has_all_permissions(&[Permission::TaskRead, Permission::TaskCreate]));
    }

    #[test]
    fn test_workspace_context() {
        let workspace_id = Uuid::new_v4();
        let auth = AuthContext::default().with_workspace(Some(workspace_id));
        assert_eq!(auth.workspace_id, Some(workspace_id));
    }
}
