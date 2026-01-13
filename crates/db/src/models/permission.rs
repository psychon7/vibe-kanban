use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
pub struct Permission {
    pub id: Uuid,
    pub key: String,
    pub description: Option<String>,
    #[ts(type = "Date")]
    pub created_at: DateTime<Utc>,
}

impl Permission {
    pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as!(
            Permission,
            r#"SELECT id as "id!: Uuid",
                      key,
                      description,
                      created_at as "created_at!: DateTime<Utc>"
               FROM permissions
               ORDER BY key ASC"#
        )
        .fetch_all(pool)
        .await
    }

    pub async fn find_by_id(pool: &SqlitePool, id: Uuid) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as!(
            Permission,
            r#"SELECT id as "id!: Uuid",
                      key,
                      description,
                      created_at as "created_at!: DateTime<Utc>"
               FROM permissions
               WHERE id = $1"#,
            id
        )
        .fetch_optional(pool)
        .await
    }

    pub async fn find_by_key(pool: &SqlitePool, key: &str) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as!(
            Permission,
            r#"SELECT id as "id!: Uuid",
                      key,
                      description,
                      created_at as "created_at!: DateTime<Utc>"
               FROM permissions
               WHERE key = $1"#,
            key
        )
        .fetch_optional(pool)
        .await
    }

    /// Find permissions by a prefix (e.g., "workspace." for all workspace permissions)
    pub async fn find_by_prefix(pool: &SqlitePool, prefix: &str) -> Result<Vec<Self>, sqlx::Error> {
        let pattern = format!("{}%", prefix);
        sqlx::query_as!(
            Permission,
            r#"SELECT id as "id!: Uuid",
                      key,
                      description,
                      created_at as "created_at!: DateTime<Utc>"
               FROM permissions
               WHERE key LIKE $1
               ORDER BY key ASC"#,
            pattern
        )
        .fetch_all(pool)
        .await
    }
}

/// Permission keys as constants for type-safe access
pub mod keys {
    // Workspace permissions
    pub const WORKSPACE_VIEW: &str = "workspace.view";
    pub const WORKSPACE_EDIT: &str = "workspace.edit";
    pub const WORKSPACE_DELETE: &str = "workspace.delete";
    pub const WORKSPACE_TRANSFER: &str = "workspace.transfer";

    // Member permissions
    pub const MEMBER_VIEW: &str = "member.view";
    pub const MEMBER_INVITE: &str = "member.invite";
    pub const MEMBER_REMOVE: &str = "member.remove";
    pub const MEMBER_ROLE_ASSIGN: &str = "member.role.assign";

    // Task permissions
    pub const TASK_VIEW: &str = "task.view";
    pub const TASK_CREATE: &str = "task.create";
    pub const TASK_EDIT: &str = "task.edit";
    pub const TASK_DELETE: &str = "task.delete";
    pub const TASK_ASSIGN: &str = "task.assign";
    pub const TASK_STATUS_CHANGE: &str = "task.status.change";

    // Project permissions
    pub const PROJECT_VIEW: &str = "project.view";
    pub const PROJECT_CREATE: &str = "project.create";
    pub const PROJECT_EDIT: &str = "project.edit";
    pub const PROJECT_DELETE: &str = "project.delete";
}
