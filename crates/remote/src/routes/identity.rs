use axum::{
    Extension, Json, Router,
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, patch},
};
use serde::{Deserialize, Serialize};
use tracing::instrument;
use uuid::Uuid;

use crate::{AppState, auth::RequestContext, db::users::UserRepository};

#[derive(Debug, Serialize, Deserialize)]
pub struct IdentityResponse {
    pub user_id: Uuid,
    pub username: Option<String>,
    pub email: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAvatarRequest {
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UpdateAvatarResponse {
    pub avatar_url: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/identity", get(get_identity))
        .route("/identity/avatar", patch(update_avatar))
}

#[instrument(name = "identity.get_identity", skip(state, ctx), fields(user_id = %ctx.user.id))]
pub async fn get_identity(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
) -> Json<IdentityResponse> {
    // Fetch the full user with avatar_url using raw query
    let repo = UserRepository::new(state.pool());
    let avatar_url = repo
        .fetch_user_with_avatar(ctx.user.id)
        .await
        .ok()
        .and_then(|u| u.avatar_url);

    Json(IdentityResponse {
        user_id: ctx.user.id,
        username: ctx.user.username,
        email: ctx.user.email,
        avatar_url,
    })
}

#[instrument(name = "identity.update_avatar", skip(state, ctx), fields(user_id = %ctx.user.id))]
pub async fn update_avatar(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Json(payload): Json<UpdateAvatarRequest>,
) -> impl IntoResponse {
    let repo = UserRepository::new(state.pool());

    match repo
        .update_avatar_url(ctx.user.id, payload.avatar_url.as_deref())
        .await
    {
        Ok(user) => (
            StatusCode::OK,
            Json(UpdateAvatarResponse {
                avatar_url: user.avatar_url,
            }),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "Failed to update avatar");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to update avatar" })),
            )
                .into_response()
        }
    }
}
