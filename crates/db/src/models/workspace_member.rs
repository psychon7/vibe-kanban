use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use ts_rs::TS;
use uuid::Uuid;

use super::role::Role;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
pub struct WorkspaceMember {
    pub id: Uuid,
    pub workspace_team_id: Uuid,
    pub user_id: String,
    pub role_id: Uuid,
    pub invited_by: Option<String>,
    #[ts(type = "Date")]
    pub joined_at: DateTime<Utc>,
    #[ts(type = "Date")]
    pub created_at: DateTime<Utc>,
    #[ts(type = "Date")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct WorkspaceMemberWithRole {
    #[serde(flatten)]
    #[ts(flatten)]
    pub member: WorkspaceMember,
    pub role_name: String,
}

#[derive(Debug, Clone, Deserialize, TS)]
pub struct CreateWorkspaceMember {
    pub user_id: String,
    pub role_id: Uuid,
    pub invited_by: Option<String>,
}

#[derive(Debug, Clone, Deserialize, TS)]
pub struct UpdateWorkspaceMember {
    pub role_id: Option<Uuid>,
}

impl WorkspaceMember {
    pub async fn find_all_for_team(
        pool: &SqlitePool,
        workspace_team_id: Uuid,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as!(
            WorkspaceMember,
            r#"SELECT id as "id!: Uuid",
                      workspace_team_id as "workspace_team_id!: Uuid",
                      user_id,
                      role_id as "role_id!: Uuid",
                      invited_by,
                      joined_at as "joined_at!: DateTime<Utc>",
                      created_at as "created_at!: DateTime<Utc>",
                      updated_at as "updated_at!: DateTime<Utc>"
               FROM workspace_members
               WHERE workspace_team_id = $1
               ORDER BY joined_at ASC"#,
            workspace_team_id
        )
        .fetch_all(pool)
        .await
    }

    pub async fn find_all_with_role_for_team(
        pool: &SqlitePool,
        workspace_team_id: Uuid,
    ) -> Result<Vec<WorkspaceMemberWithRole>, sqlx::Error> {
        let records = sqlx::query!(
            r#"SELECT wm.id as "id!: Uuid",
                      wm.workspace_team_id as "workspace_team_id!: Uuid",
                      wm.user_id,
                      wm.role_id as "role_id!: Uuid",
                      wm.invited_by,
                      wm.joined_at as "joined_at!: DateTime<Utc>",
                      wm.created_at as "created_at!: DateTime<Utc>",
                      wm.updated_at as "updated_at!: DateTime<Utc>",
                      r.name as role_name
               FROM workspace_members wm
               INNER JOIN roles r ON wm.role_id = r.id
               WHERE wm.workspace_team_id = $1
               ORDER BY wm.joined_at ASC"#,
            workspace_team_id
        )
        .fetch_all(pool)
        .await?;

        Ok(records
            .into_iter()
            .map(|r| WorkspaceMemberWithRole {
                member: WorkspaceMember {
                    id: r.id,
                    workspace_team_id: r.workspace_team_id,
                    user_id: r.user_id,
                    role_id: r.role_id,
                    invited_by: r.invited_by,
                    joined_at: r.joined_at,
                    created_at: r.created_at,
                    updated_at: r.updated_at,
                },
                role_name: r.role_name,
            })
            .collect())
    }

    pub async fn find_by_id(pool: &SqlitePool, id: Uuid) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as!(
            WorkspaceMember,
            r#"SELECT id as "id!: Uuid",
                      workspace_team_id as "workspace_team_id!: Uuid",
                      user_id,
                      role_id as "role_id!: Uuid",
                      invited_by,
                      joined_at as "joined_at!: DateTime<Utc>",
                      created_at as "created_at!: DateTime<Utc>",
                      updated_at as "updated_at!: DateTime<Utc>"
               FROM workspace_members
               WHERE id = $1"#,
            id
        )
        .fetch_optional(pool)
        .await
    }

    pub async fn find_by_team_and_user(
        pool: &SqlitePool,
        workspace_team_id: Uuid,
        user_id: &str,
    ) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as!(
            WorkspaceMember,
            r#"SELECT id as "id!: Uuid",
                      workspace_team_id as "workspace_team_id!: Uuid",
                      user_id,
                      role_id as "role_id!: Uuid",
                      invited_by,
                      joined_at as "joined_at!: DateTime<Utc>",
                      created_at as "created_at!: DateTime<Utc>",
                      updated_at as "updated_at!: DateTime<Utc>"
               FROM workspace_members
               WHERE workspace_team_id = $1 AND user_id = $2"#,
            workspace_team_id,
            user_id
        )
        .fetch_optional(pool)
        .await
    }

    pub async fn create(
        pool: &SqlitePool,
        workspace_team_id: Uuid,
        data: &CreateWorkspaceMember,
    ) -> Result<Self, sqlx::Error> {
        let id = Uuid::new_v4();
        sqlx::query_as!(
            WorkspaceMember,
            r#"INSERT INTO workspace_members (id, workspace_team_id, user_id, role_id, invited_by)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id as "id!: Uuid",
                         workspace_team_id as "workspace_team_id!: Uuid",
                         user_id,
                         role_id as "role_id!: Uuid",
                         invited_by,
                         joined_at as "joined_at!: DateTime<Utc>",
                         created_at as "created_at!: DateTime<Utc>",
                         updated_at as "updated_at!: DateTime<Utc>""#,
            id,
            workspace_team_id,
            data.user_id,
            data.role_id,
            data.invited_by
        )
        .fetch_one(pool)
        .await
    }

    pub async fn update_role(
        pool: &SqlitePool,
        id: Uuid,
        role_id: Uuid,
    ) -> Result<Self, sqlx::Error> {
        sqlx::query_as!(
            WorkspaceMember,
            r#"UPDATE workspace_members
               SET role_id = $2, updated_at = datetime('now', 'subsec')
               WHERE id = $1
               RETURNING id as "id!: Uuid",
                         workspace_team_id as "workspace_team_id!: Uuid",
                         user_id,
                         role_id as "role_id!: Uuid",
                         invited_by,
                         joined_at as "joined_at!: DateTime<Utc>",
                         created_at as "created_at!: DateTime<Utc>",
                         updated_at as "updated_at!: DateTime<Utc>""#,
            id,
            role_id
        )
        .fetch_one(pool)
        .await
    }

    pub async fn delete(pool: &SqlitePool, id: Uuid) -> Result<u64, sqlx::Error> {
        let result = sqlx::query!("DELETE FROM workspace_members WHERE id = $1", id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }

    pub async fn delete_by_team_and_user(
        pool: &SqlitePool,
        workspace_team_id: Uuid,
        user_id: &str,
    ) -> Result<u64, sqlx::Error> {
        let result = sqlx::query!(
            "DELETE FROM workspace_members WHERE workspace_team_id = $1 AND user_id = $2",
            workspace_team_id,
            user_id
        )
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }

    /// Check if a user has a specific permission in a workspace team
    pub async fn has_permission(
        pool: &SqlitePool,
        workspace_team_id: Uuid,
        user_id: &str,
        permission_key: &str,
    ) -> Result<bool, sqlx::Error> {
        let result = sqlx::query!(
            r#"SELECT EXISTS(
                SELECT 1
                FROM workspace_members wm
                INNER JOIN role_permissions rp ON wm.role_id = rp.role_id
                INNER JOIN permissions p ON rp.permission_id = p.id
                WHERE wm.workspace_team_id = $1 AND wm.user_id = $2 AND p.key = $3
            ) as "exists!: bool""#,
            workspace_team_id,
            user_id,
            permission_key
        )
        .fetch_one(pool)
        .await?;

        Ok(result.exists)
    }

    /// Get all permissions for a user in a workspace team
    pub async fn get_permissions(
        pool: &SqlitePool,
        workspace_team_id: Uuid,
        user_id: &str,
    ) -> Result<Vec<String>, sqlx::Error> {
        let records = sqlx::query!(
            r#"SELECT DISTINCT p.key
               FROM workspace_members wm
               INNER JOIN role_permissions rp ON wm.role_id = rp.role_id
               INNER JOIN permissions p ON rp.permission_id = p.id
               WHERE wm.workspace_team_id = $1 AND wm.user_id = $2
               ORDER BY p.key"#,
            workspace_team_id,
            user_id
        )
        .fetch_all(pool)
        .await?;

        Ok(records.into_iter().map(|r| r.key).collect())
    }

    /// Get the role for a user in a workspace team
    pub async fn get_role(
        pool: &SqlitePool,
        workspace_team_id: Uuid,
        user_id: &str,
    ) -> Result<Option<Role>, sqlx::Error> {
        sqlx::query_as!(
            Role,
            r#"SELECT r.id as "id!: Uuid",
                      r.name,
                      r.description,
                      r.is_system as "is_system!: bool",
                      r.created_at as "created_at!: DateTime<Utc>",
                      r.updated_at as "updated_at!: DateTime<Utc>"
               FROM roles r
               INNER JOIN workspace_members wm ON r.id = wm.role_id
               WHERE wm.workspace_team_id = $1 AND wm.user_id = $2"#,
            workspace_team_id,
            user_id
        )
        .fetch_optional(pool)
        .await
    }

    /// Count members with a specific role in a workspace team
    pub async fn count_by_role(
        pool: &SqlitePool,
        workspace_team_id: Uuid,
        role_id: Uuid,
    ) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar!(
            r#"SELECT COUNT(*) as "count!: i64"
               FROM workspace_members
               WHERE workspace_team_id = $1 AND role_id = $2"#,
            workspace_team_id,
            role_id
        )
        .fetch_one(pool)
        .await
    }
}
