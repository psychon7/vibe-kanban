//! Authentication routes for Cloudflare Access integration.
//!
//! These routes handle user authentication status and logout functionality
//! when using Cloudflare Access Zero Trust authentication.

use axum::{Extension, Json, Router, extract::State, routing::{get, post}};
use chrono::{DateTime, Utc};
use db::models::user_session::UserSession;
use deployment::Deployment;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError, middleware::cf_access::AuthContext};

/// Response for GET /api/auth/me
#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct AuthMeResponse {
    pub user: UserResponse,
    pub session: SessionResponse,
}

/// User information in auth response
#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
    #[ts(type = "Date")]
    pub created_at: DateTime<Utc>,
}

/// Session information in auth response
#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct SessionResponse {
    pub id: Uuid,
    #[ts(type = "Date")]
    pub expires_at: DateTime<Utc>,
    #[ts(type = "Date")]
    pub created_at: DateTime<Utc>,
}

/// Response for logout operation
#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct LogoutResponse {
    pub success: bool,
    pub message: String,
}

/// Request body for logout (optional - can specify specific session or all)
#[derive(Debug, Deserialize)]
pub struct LogoutRequest {
    /// If true, logout from all sessions
    #[serde(default)]
    pub all_sessions: bool,
}

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/auth/me", get(get_me))
        .route("/auth/logout", post(logout))
}

/// GET /api/auth/me - Get current authenticated user
///
/// Returns the current user and session information.
/// Requires CF Access authentication.
#[axum::debug_handler]
async fn get_me(
    Extension(auth): Extension<AuthContext>,
) -> Result<Json<AuthMeResponse>, ApiError> {
    Ok(Json(AuthMeResponse {
        user: UserResponse {
            id: auth.user.id,
            email: auth.user.email,
            name: auth.user.name,
            avatar_url: auth.user.avatar_url,
            created_at: auth.user.created_at,
        },
        session: SessionResponse {
            id: auth.session.id,
            expires_at: auth.session.expires_at,
            created_at: auth.session.created_at,
        },
    }))
}

/// POST /api/auth/logout - Logout current session or all sessions
///
/// By default, only the current session is invalidated.
/// If `all_sessions: true` is passed, all sessions for the user are invalidated.
#[axum::debug_handler]
async fn logout(
    State(deployment): State<DeploymentImpl>,
    Extension(auth): Extension<AuthContext>,
    Json(request): Json<LogoutRequest>,
) -> Result<Json<LogoutResponse>, ApiError> {
    let pool = &deployment.db().pool;

    if request.all_sessions {
        // Delete all sessions for the user
        let count = UserSession::delete_all_for_user(pool, auth.user.id)
            .await
            .map_err(|e| {
                tracing::error!(?e, "Failed to delete all sessions");
                ApiError::Internal(e.to_string())
            })?;

        Ok(Json(LogoutResponse {
            success: true,
            message: format!("Logged out from {} session(s)", count),
        }))
    } else {
        // Delete only the current session
        UserSession::delete(pool, auth.session.id)
            .await
            .map_err(|e| {
                tracing::error!(?e, "Failed to delete session");
                ApiError::Internal(e.to_string())
            })?;

        Ok(Json(LogoutResponse {
            success: true,
            message: "Successfully logged out".to_string(),
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_logout_request_default() {
        let json = "{}";
        let req: LogoutRequest = serde_json::from_str(json).unwrap();
        assert!(!req.all_sessions);
    }

    #[test]
    fn test_logout_request_all_sessions() {
        let json = r#"{"all_sessions": true}"#;
        let req: LogoutRequest = serde_json::from_str(json).unwrap();
        assert!(req.all_sessions);
    }
}
