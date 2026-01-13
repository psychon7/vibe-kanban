use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, query_as};
use ts_rs::TS;
use uuid::Uuid;

use super::{Tx, identity_errors::IdentityError};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// User struct without the avatar_url field for backward compatibility with .sqlx cache
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
struct UserWithoutAvatar {
    id: Uuid,
    email: String,
    first_name: Option<String>,
    last_name: Option<String>,
    username: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<UserWithoutAvatar> for User {
    fn from(u: UserWithoutAvatar) -> Self {
        Self {
            id: u.id,
            email: u.email,
            first_name: u.first_name,
            last_name: u.last_name,
            username: u.username,
            avatar_url: None,
            created_at: u.created_at,
            updated_at: u.updated_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, TS)]
#[ts(export)]
pub struct UserData {
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
}

/// UserData struct without the avatar_url field for backward compatibility with .sqlx cache
#[derive(Debug, Clone, sqlx::FromRow)]
struct UserDataWithoutAvatar {
    user_id: Uuid,
    first_name: Option<String>,
    last_name: Option<String>,
    username: Option<String>,
}

impl From<UserDataWithoutAvatar> for UserData {
    fn from(u: UserDataWithoutAvatar) -> Self {
        Self {
            user_id: u.user_id,
            first_name: u.first_name,
            last_name: u.last_name,
            username: u.username,
            avatar_url: None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct UpsertUser<'a> {
    pub id: Uuid,
    pub email: &'a str,
    pub first_name: Option<&'a str>,
    pub last_name: Option<&'a str>,
    pub username: Option<&'a str>,
}

pub struct UserRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> UserRepository<'a> {
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    pub async fn upsert_user(&self, user: UpsertUser<'_>) -> Result<User, IdentityError> {
        upsert_user(self.pool, &user)
            .await
            .map_err(IdentityError::from)
    }

    pub async fn fetch_user(&self, user_id: Uuid) -> Result<User, IdentityError> {
        // Note: Use UserWithoutAvatar for compile-time SQLx cache compatibility,
        // then convert to User. The avatar_url will be fetched at runtime after migration.
        query_as!(
            UserWithoutAvatar,
            r#"
            SELECT
                id           AS "id!: Uuid",
                email        AS "email!",
                first_name   AS "first_name?",
                last_name    AS "last_name?",
                username     AS "username?",
                created_at   AS "created_at!",
                updated_at   AS "updated_at!"
            FROM users
            WHERE id = $1
            "#,
            user_id
        )
        .fetch_optional(self.pool)
        .await?
        .map(User::from)
        .ok_or(IdentityError::NotFound)
    }

    /// Fetch user with avatar_url (uses raw query, requires migration to be run)
    pub async fn fetch_user_with_avatar(&self, user_id: Uuid) -> Result<User, IdentityError> {
        sqlx::query_as::<_, User>(
            r#"
            SELECT
                id,
                email,
                first_name,
                last_name,
                username,
                avatar_url,
                created_at,
                updated_at
            FROM users
            WHERE id = $1
            "#,
        )
        .bind(user_id)
        .fetch_optional(self.pool)
        .await?
        .ok_or(IdentityError::NotFound)
    }

    /// Fetch all assignees for a given project id.
    /// Returns Vec<UserData> containing all unique users assigned to tasks in the project.
    pub async fn fetch_assignees_by_project(
        &self,
        project_id: Uuid,
    ) -> Result<Vec<UserData>, IdentityError> {
        // Use UserDataWithoutAvatar for compile-time SQLx cache compatibility
        let rows = sqlx::query_as!(
            UserDataWithoutAvatar,
            r#"
            SELECT DISTINCT
                u.id         as "user_id",
                u.first_name as "first_name",
                u.last_name  as "last_name",
                u.username   as "username"
            FROM shared_tasks st
            INNER JOIN users u ON u.id = st.assignee_user_id
            WHERE st.project_id = $1
            AND st.assignee_user_id IS NOT NULL
            "#,
            project_id
        )
        .fetch_all(self.pool)
        .await
        .map_err(IdentityError::from)?;

        Ok(rows.into_iter().map(UserData::from).collect())
    }

    /// Update the avatar_url for a user (uses raw query, requires migration to be run)
    pub async fn update_avatar_url(
        &self,
        user_id: Uuid,
        avatar_url: Option<&str>,
    ) -> Result<User, IdentityError> {
        sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET avatar_url = $2
            WHERE id = $1
            RETURNING
                id,
                email,
                first_name,
                last_name,
                username,
                avatar_url,
                created_at,
                updated_at
            "#,
        )
        .bind(user_id)
        .bind(avatar_url)
        .fetch_optional(self.pool)
        .await?
        .ok_or(IdentityError::NotFound)
    }
}

async fn upsert_user(pool: &PgPool, user: &UpsertUser<'_>) -> Result<User, sqlx::Error> {
    // Use UserWithoutAvatar for compile-time SQLx cache compatibility
    query_as!(
        UserWithoutAvatar,
        r#"
        INSERT INTO users (id, email, first_name, last_name, username)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            username = EXCLUDED.username
        RETURNING
            id           AS "id!: Uuid",
            email        AS "email!",
            first_name   AS "first_name?",
            last_name    AS "last_name?",
            username     AS "username?",
            created_at   AS "created_at!",
            updated_at   AS "updated_at!"
        "#,
        user.id,
        user.email,
        user.first_name,
        user.last_name,
        user.username
    )
    .fetch_one(pool)
    .await
    .map(User::from)
}

pub async fn fetch_user(tx: &mut Tx<'_>, user_id: Uuid) -> Result<Option<UserData>, IdentityError> {
    // Use raw query without avatar_url for SQLx cache compatibility
    sqlx::query!(
        r#"
        SELECT
            id         AS "id!: Uuid",
            first_name AS "first_name?",
            last_name  AS "last_name?",
            username   AS "username?"
        FROM users
        WHERE id = $1
        "#,
        user_id
    )
    .fetch_optional(&mut **tx)
    .await
    .map_err(IdentityError::from)
    .map(|row_opt| {
        row_opt.map(|row| UserData {
            user_id: row.id,
            first_name: row.first_name,
            last_name: row.last_name,
            username: row.username,
            avatar_url: None, // Will be populated after migration runs
        })
    })
}
