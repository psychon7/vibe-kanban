use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use thiserror::Error;
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum UserError {
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error("User not found")]
    NotFound,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub cf_access_id: Option<String>,
    #[ts(type = "Date")]
    pub created_at: DateTime<Utc>,
    #[ts(type = "Date")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpsertUser {
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub cf_access_id: Option<String>,
}

impl User {
    /// Find a user by ID
    pub async fn find_by_id(pool: &SqlitePool, id: Uuid) -> Result<Option<Self>, UserError> {
        sqlx::query_as!(
            User,
            r#"SELECT
                id as "id!: Uuid",
                email,
                name,
                avatar_url,
                cf_access_id,
                created_at as "created_at!: DateTime<Utc>",
                updated_at as "updated_at!: DateTime<Utc>"
            FROM users
            WHERE id = $1"#,
            id
        )
        .fetch_optional(pool)
        .await
        .map_err(UserError::from)
    }

    /// Find a user by email
    pub async fn find_by_email(pool: &SqlitePool, email: &str) -> Result<Option<Self>, UserError> {
        sqlx::query_as!(
            User,
            r#"SELECT
                id as "id!: Uuid",
                email,
                name,
                avatar_url,
                cf_access_id,
                created_at as "created_at!: DateTime<Utc>",
                updated_at as "updated_at!: DateTime<Utc>"
            FROM users
            WHERE email = $1"#,
            email
        )
        .fetch_optional(pool)
        .await
        .map_err(UserError::from)
    }

    /// Find a user by Cloudflare Access ID
    pub async fn find_by_cf_access_id(
        pool: &SqlitePool,
        cf_access_id: &str,
    ) -> Result<Option<Self>, UserError> {
        sqlx::query_as!(
            User,
            r#"SELECT
                id as "id!: Uuid",
                email,
                name,
                avatar_url,
                cf_access_id,
                created_at as "created_at!: DateTime<Utc>",
                updated_at as "updated_at!: DateTime<Utc>"
            FROM users
            WHERE cf_access_id = $1"#,
            cf_access_id
        )
        .fetch_optional(pool)
        .await
        .map_err(UserError::from)
    }

    /// Upsert a user (create or update by email)
    pub async fn upsert(pool: &SqlitePool, data: &UpsertUser) -> Result<Self, UserError> {
        let id = Uuid::new_v4();
        sqlx::query_as!(
            User,
            r#"INSERT INTO users (id, email, name, avatar_url, cf_access_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (email) DO UPDATE SET
                name = excluded.name,
                avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
                cf_access_id = COALESCE(excluded.cf_access_id, users.cf_access_id),
                updated_at = datetime('now', 'subsec')
            RETURNING
                id as "id!: Uuid",
                email,
                name,
                avatar_url,
                cf_access_id,
                created_at as "created_at!: DateTime<Utc>",
                updated_at as "updated_at!: DateTime<Utc>""#,
            id,
            data.email,
            data.name,
            data.avatar_url,
            data.cf_access_id
        )
        .fetch_one(pool)
        .await
        .map_err(UserError::from)
    }

    /// Update user profile
    pub async fn update(
        pool: &SqlitePool,
        id: Uuid,
        name: Option<&str>,
        avatar_url: Option<&str>,
    ) -> Result<Self, UserError> {
        let existing = Self::find_by_id(pool, id)
            .await?
            .ok_or(UserError::NotFound)?;

        let name = name.unwrap_or(&existing.name);
        let avatar_url = avatar_url.or(existing.avatar_url.as_deref());

        sqlx::query_as!(
            User,
            r#"UPDATE users
            SET name = $2, avatar_url = $3, updated_at = datetime('now', 'subsec')
            WHERE id = $1
            RETURNING
                id as "id!: Uuid",
                email,
                name,
                avatar_url,
                cf_access_id,
                created_at as "created_at!: DateTime<Utc>",
                updated_at as "updated_at!: DateTime<Utc>""#,
            id,
            name,
            avatar_url
        )
        .fetch_one(pool)
        .await
        .map_err(UserError::from)
    }
}
