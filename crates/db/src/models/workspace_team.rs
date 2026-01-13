use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
pub struct WorkspaceTeam {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    #[ts(type = "Date")]
    pub created_at: DateTime<Utc>,
    #[ts(type = "Date")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, TS)]
pub struct CreateWorkspaceTeam {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Deserialize, TS)]
pub struct UpdateWorkspaceTeam {
    pub name: Option<String>,
    pub description: Option<String>,
}

impl WorkspaceTeam {
    pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as!(
            WorkspaceTeam,
            r#"SELECT id as "id!: Uuid",
                      name,
                      description,
                      created_at as "created_at!: DateTime<Utc>",
                      updated_at as "updated_at!: DateTime<Utc>"
               FROM workspace_teams
               ORDER BY created_at DESC"#
        )
        .fetch_all(pool)
        .await
    }

    pub async fn find_by_id(pool: &SqlitePool, id: Uuid) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as!(
            WorkspaceTeam,
            r#"SELECT id as "id!: Uuid",
                      name,
                      description,
                      created_at as "created_at!: DateTime<Utc>",
                      updated_at as "updated_at!: DateTime<Utc>"
               FROM workspace_teams
               WHERE id = $1"#,
            id
        )
        .fetch_optional(pool)
        .await
    }

    pub async fn create(pool: &SqlitePool, data: &CreateWorkspaceTeam) -> Result<Self, sqlx::Error> {
        let id = Uuid::new_v4();
        sqlx::query_as!(
            WorkspaceTeam,
            r#"INSERT INTO workspace_teams (id, name, description)
               VALUES ($1, $2, $3)
               RETURNING id as "id!: Uuid",
                         name,
                         description,
                         created_at as "created_at!: DateTime<Utc>",
                         updated_at as "updated_at!: DateTime<Utc>""#,
            id,
            data.name,
            data.description
        )
        .fetch_one(pool)
        .await
    }

    pub async fn update(
        pool: &SqlitePool,
        id: Uuid,
        data: &UpdateWorkspaceTeam,
    ) -> Result<Self, sqlx::Error> {
        let existing = Self::find_by_id(pool, id)
            .await?
            .ok_or(sqlx::Error::RowNotFound)?;

        let name = data.name.clone().unwrap_or(existing.name);
        let description = data.description.clone().or(existing.description);

        sqlx::query_as!(
            WorkspaceTeam,
            r#"UPDATE workspace_teams
               SET name = $2, description = $3, updated_at = datetime('now', 'subsec')
               WHERE id = $1
               RETURNING id as "id!: Uuid",
                         name,
                         description,
                         created_at as "created_at!: DateTime<Utc>",
                         updated_at as "updated_at!: DateTime<Utc>""#,
            id,
            name,
            description
        )
        .fetch_one(pool)
        .await
    }

    pub async fn delete(pool: &SqlitePool, id: Uuid) -> Result<u64, sqlx::Error> {
        let result = sqlx::query!("DELETE FROM workspace_teams WHERE id = $1", id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }

    /// Find all workspace teams that a user is a member of
    pub async fn find_by_user_id(pool: &SqlitePool, user_id: &str) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as!(
            WorkspaceTeam,
            r#"SELECT wt.id as "id!: Uuid",
                      wt.name,
                      wt.description,
                      wt.created_at as "created_at!: DateTime<Utc>",
                      wt.updated_at as "updated_at!: DateTime<Utc>"
               FROM workspace_teams wt
               INNER JOIN workspace_members wm ON wt.id = wm.workspace_team_id
               WHERE wm.user_id = $1
               ORDER BY wt.created_at DESC"#,
            user_id
        )
        .fetch_all(pool)
        .await
    }
}
