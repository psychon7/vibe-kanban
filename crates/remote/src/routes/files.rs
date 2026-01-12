use axum::{
    Extension, Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, get, post},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::instrument;

use crate::{AppState, auth::RequestContext, files::FilesError};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/files/avatars/upload", post(create_avatar_upload_url))
        .route("/files/avatars", get(list_avatars))
        .route("/files/avatars", delete(delete_all_avatars))
        .route("/files/avatars/{key:.*}", delete(delete_avatar))
        .route("/files/config", get(get_files_config))
}

#[derive(Debug, Deserialize)]
pub struct CreateAvatarUploadRequest {
    pub content_type: String,
    #[serde(default)]
    pub content_length: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct CreateAvatarUploadResponse {
    pub upload_url: String,
    pub object_key: String,
    pub public_url: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct FileInfoResponse {
    pub key: String,
    pub public_url: String,
    pub size: Option<i64>,
    pub last_modified: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct ListAvatarsResponse {
    pub avatars: Vec<FileInfoResponse>,
}

#[derive(Debug, Serialize)]
pub struct DeleteAvatarsResponse {
    pub deleted_count: u32,
}

#[derive(Debug, Serialize)]
pub struct FilesConfigResponse {
    pub enabled: bool,
    pub max_file_size_bytes: Option<u64>,
    pub allowed_types: Vec<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum FilesRouteError {
    #[error("files storage not configured")]
    NotConfigured,
    #[error("files error: {0}")]
    Files(#[from] FilesError),
}

impl IntoResponse for FilesRouteError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            FilesRouteError::NotConfigured => (
                StatusCode::SERVICE_UNAVAILABLE,
                "File storage service not available".to_string(),
            ),
            FilesRouteError::Files(FilesError::InvalidFileType(msg)) => {
                (StatusCode::BAD_REQUEST, msg.clone())
            }
            FilesRouteError::Files(FilesError::FileTooLarge(size, max)) => (
                StatusCode::PAYLOAD_TOO_LARGE,
                format!("File size {} bytes exceeds maximum {} bytes", size, max),
            ),
            FilesRouteError::Files(e) => {
                tracing::error!(error = %e, "Files service error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                )
            }
        };

        let body = serde_json::json!({
            "error": message
        });

        (status, Json(body)).into_response()
    }
}

/// Create a presigned URL for avatar upload
#[instrument(name = "files.create_avatar_upload", skip(state, ctx), fields(user_id = %ctx.user.id))]
pub async fn create_avatar_upload_url(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Json(payload): Json<CreateAvatarUploadRequest>,
) -> Result<Json<CreateAvatarUploadResponse>, FilesRouteError> {
    let files = state.files().ok_or(FilesRouteError::NotConfigured)?;

    let upload = files
        .create_avatar_upload_url(ctx.user.id, &payload.content_type, payload.content_length)
        .await?;

    Ok(Json(CreateAvatarUploadResponse {
        upload_url: upload.upload_url,
        object_key: upload.object_key,
        public_url: upload.public_url,
        expires_at: upload.expires_at,
    }))
}

/// List all avatars for the current user
#[instrument(name = "files.list_avatars", skip(state, ctx), fields(user_id = %ctx.user.id))]
pub async fn list_avatars(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
) -> Result<Json<ListAvatarsResponse>, FilesRouteError> {
    let files = state.files().ok_or(FilesRouteError::NotConfigured)?;

    let avatars = files.list_user_avatars(ctx.user.id).await?;

    let avatars = avatars
        .into_iter()
        .map(|f| FileInfoResponse {
            key: f.key,
            public_url: f.public_url,
            size: f.size,
            last_modified: f.last_modified,
        })
        .collect();

    Ok(Json(ListAvatarsResponse { avatars }))
}

/// Delete a specific avatar by key
#[instrument(name = "files.delete_avatar", skip(state, ctx), fields(user_id = %ctx.user.id))]
pub async fn delete_avatar(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Path(key): Path<String>,
) -> Result<StatusCode, FilesRouteError> {
    let files = state.files().ok_or(FilesRouteError::NotConfigured)?;

    // Ensure the user can only delete their own avatars
    let expected_prefix = format!("avatars/{}/", ctx.user.id);
    if !key.starts_with(&expected_prefix) {
        return Err(FilesRouteError::Files(FilesError::Delete(
            "Cannot delete files belonging to other users".to_string(),
        )));
    }

    files.delete_file(&key).await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Delete all avatars for the current user
#[instrument(name = "files.delete_all_avatars", skip(state, ctx), fields(user_id = %ctx.user.id))]
pub async fn delete_all_avatars(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
) -> Result<Json<DeleteAvatarsResponse>, FilesRouteError> {
    let files = state.files().ok_or(FilesRouteError::NotConfigured)?;

    let deleted_count = files.delete_user_avatars(ctx.user.id).await?;

    Ok(Json(DeleteAvatarsResponse { deleted_count }))
}

/// Get files configuration
#[instrument(name = "files.get_config", skip(state))]
pub async fn get_files_config(
    State(state): State<AppState>,
) -> Json<FilesConfigResponse> {
    let (enabled, max_file_size_bytes) = match state.files() {
        Some(files) => (true, Some(files.max_file_size())),
        None => (false, None),
    };

    Json(FilesConfigResponse {
        enabled,
        max_file_size_bytes,
        allowed_types: vec![
            "image/jpeg".to_string(),
            "image/png".to_string(),
            "image/gif".to_string(),
            "image/webp".to_string(),
        ],
    })
}
