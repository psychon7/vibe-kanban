use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use thiserror::Error;
use ts_rs::TS;
use uuid::Uuid;

/// Default session duration (7 days)
pub const DEFAULT_SESSION_DURATION: Duration = Duration::days(7);

/// Maximum session inactivity before expiration (24 hours)
pub const MAX_SESSION_INACTIVITY: Duration = Duration::hours(24);

#[derive(Debug, Error)]
pub enum UserSessionError {
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error("Session not found")]
    NotFound,
    #[error("Session expired")]
    Expired,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct UserSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub cf_access_jwt_id: Option<String>,
    #[ts(type = "Date")]
    pub expires_at: DateTime<Utc>,
    #[ts(type = "Date")]
    pub created_at: DateTime<Utc>,
    #[ts(type = "Date")]
    pub last_used_at: DateTime<Utc>,
}

impl UserSession {
    /// Create a new session for a user
    pub async fn create(
        pool: &SqlitePool,
        user_id: Uuid,
        cf_access_jwt_id: Option<&str>,
        duration: Option<Duration>,
    ) -> Result<Self, UserSessionError> {
        let id = Uuid::new_v4();
        let expires_at = Utc::now() + duration.unwrap_or(DEFAULT_SESSION_DURATION);

        sqlx::query_as!(
            UserSession,
            r#"INSERT INTO user_sessions (id, user_id, cf_access_jwt_id, expires_at)
            VALUES ($1, $2, $3, $4)
            RETURNING
                id as "id!: Uuid",
                user_id as "user_id!: Uuid",
                cf_access_jwt_id,
                expires_at as "expires_at!: DateTime<Utc>",
                created_at as "created_at!: DateTime<Utc>",
                last_used_at as "last_used_at!: DateTime<Utc>""#,
            id,
            user_id,
            cf_access_jwt_id,
            expires_at
        )
        .fetch_one(pool)
        .await
        .map_err(UserSessionError::from)
    }

    /// Find a session by ID
    pub async fn find_by_id(pool: &SqlitePool, id: Uuid) -> Result<Option<Self>, UserSessionError> {
        sqlx::query_as!(
            UserSession,
            r#"SELECT
                id as "id!: Uuid",
                user_id as "user_id!: Uuid",
                cf_access_jwt_id,
                expires_at as "expires_at!: DateTime<Utc>",
                created_at as "created_at!: DateTime<Utc>",
                last_used_at as "last_used_at!: DateTime<Utc>"
            FROM user_sessions
            WHERE id = $1"#,
            id
        )
        .fetch_optional(pool)
        .await
        .map_err(UserSessionError::from)
    }

    /// Find a valid (non-expired) session by ID
    pub async fn find_valid(pool: &SqlitePool, id: Uuid) -> Result<Option<Self>, UserSessionError> {
        let now = Utc::now();
        sqlx::query_as!(
            UserSession,
            r#"SELECT
                id as "id!: Uuid",
                user_id as "user_id!: Uuid",
                cf_access_jwt_id,
                expires_at as "expires_at!: DateTime<Utc>",
                created_at as "created_at!: DateTime<Utc>",
                last_used_at as "last_used_at!: DateTime<Utc>"
            FROM user_sessions
            WHERE id = $1 AND expires_at > $2"#,
            id,
            now
        )
        .fetch_optional(pool)
        .await
        .map_err(UserSessionError::from)
    }

    /// Update the last_used_at timestamp (touch session)
    pub async fn touch(pool: &SqlitePool, id: Uuid) -> Result<(), UserSessionError> {
        let now = Utc::now();
        let result = sqlx::query!(
            r#"UPDATE user_sessions
            SET last_used_at = $2
            WHERE id = $1"#,
            id,
            now
        )
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(UserSessionError::NotFound);
        }
        Ok(())
    }

    /// Delete a session (logout)
    pub async fn delete(pool: &SqlitePool, id: Uuid) -> Result<(), UserSessionError> {
        sqlx::query!(r#"DELETE FROM user_sessions WHERE id = $1"#, id)
            .execute(pool)
            .await?;
        Ok(())
    }

    /// Delete all sessions for a user
    pub async fn delete_all_for_user(
        pool: &SqlitePool,
        user_id: Uuid,
    ) -> Result<u64, UserSessionError> {
        let result = sqlx::query!(r#"DELETE FROM user_sessions WHERE user_id = $1"#, user_id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }

    /// Cleanup expired sessions
    pub async fn cleanup_expired(pool: &SqlitePool) -> Result<u64, UserSessionError> {
        let now = Utc::now();
        let result = sqlx::query!(r#"DELETE FROM user_sessions WHERE expires_at <= $1"#, now)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }

    /// Check if session is expired
    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }

    /// Check if session is inactive (last used too long ago)
    pub fn is_inactive(&self) -> bool {
        Utc::now() - self.last_used_at > MAX_SESSION_INACTIVITY
    }

    /// Check if session is valid (not expired and not inactive)
    pub fn is_valid(&self) -> bool {
        !self.is_expired() && !self.is_inactive()
    }
}
